import os
import json
import google.generativeai as genai
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- CONFIGURATION ---
# WARNING: Storing API keys directly in code is insecure and not recommended for production.
# It is better to use environment variables or a secrets management system.
api_key = "ADD_API_KEY"
genai.configure(api_key=api_key)

# Constants for the system prompt
N_SENTENCES = 15  # The {N} value for the summary sentences.
K_EXCERPTS = 20   # The {K} value for the number of excerpts.
THINKING_BUDGET = 8192 # Sets the token budget for the model's internal "thinking" process.

# TODO: Add your system prompt here
SYSTEM_PROMPT = f"""You are a compliance summariser for diabetes patient-bot chats that should take note of deception and non-adherence according to the provided indicators.  Audience: the prescribing doctor who will read a one-page update before the next appointment.

================  TASK  ===============================
1. **Adherence & Progress Summary** In < {N_SENTENCES} sentences, describe:  
   - What the patient reported doing (diet, medication, activity).  
   - Any successes, struggles, or trends.  
   - Overall adherence status and momentum.  
2. **Risk Flags** List every chat excerpt that matches an indicator below.  
3. Output the exact JSON schema shown at the end.

================  INDICATOR GUIDELINES  ================
- **Inconsistency**  Flag any statement that clashes with the patient's earlier chats.
- **Vague / Evasive Language** Watch for hedges (maybe, should, could), sweeping generalities (always, everyone), passive phrasing, or missing specifics (dates, quantities, names). Low-concreteness wording is a hallmark of deceptive replies. Rate severity {{low | medium | high}}.  
- **Engagement Level** Extremely short replies can show disengagement, while unusually long, highly detailed stories may indicate a crafted (and possibly false) narrative. Either extreme can suggest non-adherence or deception; interpret in context. 
- **Gaming the System**  Identify too-perfect self-reports: identical answers across check-ins, flawless adherence claims, or copy-pasted text.

================  IMPLICIT-RAG INSTRUCTIONS  ================
Step 1 From the full transcript, **extract up to {K_EXCERPTS} excerpts 
(30 - 120 words each)** that are most relevant to any indicator above.  
Step 2 Using **only those excerpts**, perform TASK 1 and 2.  
Step 3 Create a single JSON object with two top-level keys: "summary" (a string) and "flags" (an array of objects). Each flag object must have an "indicator", an "excerpt", and an "explanation" You must include all 4 indicators.

{{
  "summary": "< {N_SENTENCES} sentences>",
  "flags": [
    {{
      "indicator": "Inconsistency",
      "excerpt": "...",
      "explanation": "..."
    }},
    {{
      "indicator": "VagueLanguage",
      "excerpt": "...",
      "explanation": "..."
    }}
    /* 0-N more flags */
  ]
}}
"""

# --- SCRIPT LOGIC ---
def get_gemini_summary(chat_log_content, system_prompt):
    """
    Calls the Gemini API to get a summary of the chat log.

    Args:
        chat_log_content (str): The full content of the chat log.
        system_prompt (str): The system prompt to guide the model.

    Returns:
        str: The summary text from the Gemini API, or None on error.
    """
    try:
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash-preview-05-20",
            system_instruction=system_prompt
        )
        generation_config = genai.types.GenerationConfig(
            response_mime_type="application/json"
        )
        response = model.generate_content(
            chat_log_content,
            generation_config=generation_config
        )
        return response.text
    except Exception as e:
        logging.error(f"Error calling Gemini API: {e}")
        return None

def process_chat_log(file_path):
    """
    Reads a chat log, and if summary.json exists, creates summary2.json.
    """
    log_dir = os.path.dirname(file_path)
    original_summary_path = os.path.join(log_dir, "summary.json")
    new_summary_path = os.path.join(log_dir, "summary2.json")

    # This is the new logic: only run if summary.json exists.
    if not os.path.exists(original_summary_path):
        logging.info(f"No summary.json found in {log_dir}, skipping.")
        return

    # Also, don't re-run if we've already created summary2.json
    if os.path.exists(new_summary_path):
        logging.info(f"{new_summary_path} already exists, skipping.")
        return

    logging.info(f"Processing {file_path} to create {new_summary_path}...")

    try:
        with open(file_path, 'r') as f:
            logs = json.load(f)

        full_conversation = []
        for session in logs:
            for message in session.get("messages", []):
                user = message.get("user", {}).get("name", "Unknown")
                text = message.get("message", "")
                full_conversation.append(f"{user}: {text}")

        chat_log_text = "\\n".join(full_conversation)

        if not chat_log_text:
            logging.warning(f"No messages found in {file_path}, skipping.")
            return

        summary_text = get_gemini_summary(chat_log_text, SYSTEM_PROMPT)

        if summary_text:
            try:
                # The API response should be a JSON string, so we parse it
                summary_data = json.loads(summary_text)
                with open(new_summary_path, 'w') as f:
                    json.dump(summary_data, f, indent=2)
                logging.info(f"Successfully created {new_summary_path}")
            except json.JSONDecodeError:
                logging.error(f"Failed to decode JSON from Gemini API response for {file_path}. Response was:\n{summary_text}")

    except json.JSONDecodeError:
        logging.error(f"Could not decode JSON from {file_path}")
    except Exception as e:
        logging.error(f"An unexpected error occurred processing {file_path}: {e}")

def main():
    """
    Main function to walk through directories and process logs.
    """
    base_dirs = ["Truthful", "Deceitful"]
    for base_dir in base_dirs:
        for root, dirs, files in os.walk(base_dir):
            # Handle case variation for 'Adhering'
            if 'Adhering' in dirs and 'adhering' not in dirs:
                dirs[dirs.index('Adhering')] = 'adhering'

            for file in files:
                if file.endswith('.json') and not file.endswith('summary.json'):
                    file_path = os.path.join(root, file)
                    process_chat_log(file_path)
    logging.info("Script finished.")

if __name__ == "__main__":
    main() 
