import os
import json
import google.generativeai as genai
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- CONFIGURATION ---
# WARNING: Storing API keys directly in code is insecure. Use environment variables for production.
api_key = "AIzaSyDzSVCxJIvVpsxybYUPXet53thPBLxRx2c"
genai.configure(api_key=api_key)

# --- SYSTEM PROMPT FOR COMPARISON ---
COMPARISON_SYSTEM_PROMPT = """You are a verification and synthesis AI. Your task is to analyze two different AI-generated summaries and their corresponding 'flags' based on the same source text. Your goal is to produce a single, more accurate and reliable final JSON output.

You will receive a JSON object with four keys: "summary1", "flags1", "summary2", and "flags2".

**Your task is to perform two main actions:**

**1. Synthesize the Summaries:**
   - Read both `summary1` and `summary2`.
   - Combine their insights to create a single, more comprehensive and accurate final summary.
   - The final summary should be objective and reflect the consensus between the two inputs.

**2. Verify and Consolidate the Flags:**
   - Compare `flags1` and `flags2` to identify semantically equivalent flags.
   - A **Direct Match** occurs when a flag from one list clearly refers to the same event or statement as a flag in the other list, even if the wording differs slightly. Matched flags should be included once in the final list without any 'confidence' field.
   - A **Mismatch** occurs when a flag from either list does NOT have a clear semantic equivalent in the other. Mismatched flags MUST have a `"confidence": "low"` field added to them.
   - The final list of flags should not contain duplicates.

**Output Instructions:**
You MUST return a single, valid JSON object with two top-level keys:
- `"summary"`: The new, synthesized summary string.
- `"flags"`: The final, consolidated list of flag objects.
"""

# --- SCRIPT LOGIC ---
def get_final_output(summary1, flags1, summary2, flags2):
    """
    Uses the Gemini API to compare two summaries and two lists of flags.
    """
    try:
        model = genai.GenerativeModel("gemini-2.5-flash-preview-05-20")
        
        generation_config = genai.types.GenerationConfig(
            response_mime_type="application/json"
        )
        
        prompt_data = {
            "summary1": summary1,
            "flags1": flags1,
            "summary2": summary2,
            "flags2": flags2
        }
        
        response = model.generate_content(
            [COMPARISON_SYSTEM_PROMPT, json.dumps(prompt_data)],
            generation_config=generation_config
        )
        
        # The model should return a complete JSON object with 'summary' and 'flags'
        return json.loads(response.text)
        
    except Exception as e:
        logging.error(f"Error during verification and synthesis: {e}")
        # As a fallback, combine all flags and mark them as low confidence
        all_flags = flags1 + flags2
        for flag in all_flags:
            flag['confidence'] = 'low'
        return {
            "summary": f"Could not synthesize summaries due to an error. Original summary 1: {summary1}",
            "flags": all_flags
        }

def compare_and_generate_final_summary(log_dir):
    """
    Compares summary.json and summary2.json and creates a final_summary.json.
    """
    summary1_path = os.path.join(log_dir, "summary.json")
    summary2_path = os.path.join(log_dir, "summary2.json")
    final_summary_path = os.path.join(log_dir, "final_summary.json")

    if not (os.path.exists(summary1_path) and os.path.exists(summary2_path)):
        return # Both files must exist to compare

    if os.path.exists(final_summary_path):
        logging.info(f"Final summary already exists in {log_dir}, skipping.")
        return

    logging.info(f"Comparing summaries in {log_dir}...")

    try:
        with open(summary1_path, 'r') as f:
            summary1_data = json.load(f)
        with open(summary2_path, 'r') as f:
            summary2_data = json.load(f)

        summary1 = summary1_data.get("summary", "")
        flags1 = summary1_data.get("flags", [])
        
        summary2 = summary2_data.get("summary", "")
        flags2 = summary2_data.get("flags", [])

        final_data = get_final_output(summary1, flags1, summary2, flags2)

        if final_data:
            with open(final_summary_path, 'w') as f:
                json.dump(final_data, f, indent=2)
            logging.info(f"Successfully created final summary in {log_dir}")

    except Exception as e:
        logging.error(f"An error occurred in {log_dir}: {e}")

def main():
    """
    Main function to walk through directories and compare summaries.
    """
    base_dirs = ["Truthful", "Deceitful"]
    for base_dir in base_dirs:
        for root, dirs, files in os.walk(base_dir):
            if 'summary.json' in files and 'summary2.json' in files:
                compare_and_generate_final_summary(root)
    logging.info("Comparison script finished.")

if __name__ == "__main__":
    main() 