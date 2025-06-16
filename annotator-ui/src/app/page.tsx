'use client';

import { useState, useEffect, useMemo } from 'react';
import type { LogEntry, ChatSession, SummaryData, Annotation } from '../types';

const INDICATORS = [
  'Inconsistency',
  'Vague / Evasive Language',
  'Engagement Level',
  'Gaming the System',
];

export default function HomePage() {
  // App state
  const [appState, setAppState] = useState<'guidelines' | 'setup' | 'annotating' | 'finished'>('guidelines');
  const [annotatorName, setAnnotatorName] = useState<string>('');
  const [annotatorGroup, setAnnotatorGroup] = useState<'group1' | 'group2' | null>(null);
  
  // Data and loading state
  const [logQueue, setLogQueue] = useState<LogEntry[]>([]);
  const [currentLog, setCurrentLog] = useState<LogEntry | null>(null);
  const [chatContent, setChatContent] = useState<ChatSession[] | null>(null);
  const [summaryContent, setSummaryContent] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Annotation form and timer state
  const [selectedDeception, setSelectedDeception] = useState<'truthful' | 'deceitful' | null>(null);
  const [selectedAdherence, setSelectedAdherence] = useState<'adhering' | 'non-adhering' | null>(null);
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
  const [timerStartTime, setTimerStartTime] = useState<number | null>(null);
  const [isAnnotationStarted, setIsAnnotationStarted] = useState<boolean>(false);

  // Load the manifest on initial load
  useEffect(() => {
    async function fetchManifest() {
      try {
        const res = await fetch('/manifest.json');
        if (!res.ok) throw new Error('Failed to fetch manifest');
        let data: LogEntry[] = await res.json();
        data = data.sort(() => Math.random() - 0.5); // Randomize order
        setLogQueue(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    }
    fetchManifest();
  }, []);

  // Effect to load the next log from the queue
  useEffect(() => {
    if (appState === 'annotating' && logQueue.length > 0 && !currentLog) {
      const nextLog = logQueue[0];
      setCurrentLog(nextLog);
      setLogQueue(prev => prev.slice(1));
    } else if (appState === 'annotating' && logQueue.length === 0 && !currentLog) {
      setAppState('finished');
    }
  }, [appState, logQueue, currentLog]);

  // Determine if summary should be shown based on group and log ID
  const shouldShowSummary = useMemo(() => {
    if (!currentLog || !annotatorGroup) return false;
    const logNumberMatch = currentLog.id.match(/log(\d+)/);
    if (!logNumberMatch) return false;
    const logNumber = parseInt(logNumberMatch[1], 10);

    if (annotatorGroup === 'group1') {
      return logNumber >= 3; // Show for log3, log4
    }
    if (annotatorGroup === 'group2') {
      return logNumber < 3; // Show for log1, log2
    }
    return false;
  }, [currentLog, annotatorGroup]);


  // Effect to fetch content when a new log is set
  useEffect(() => {
    async function fetchLogData(log: LogEntry) {
      setIsLoading(true);
      setError(null);
      setChatContent(null);
      setSummaryContent(null);
      setIsAnnotationStarted(false); // Hide annotation section until user is ready
      setTimerStartTime(null);

      try {
        // Fetch chat log
        const logRes = await fetch(log.logPath);
        if (!logRes.ok) throw new Error(`Failed to fetch log: ${log.logPath}`);
        const logData = await logRes.json();
        setChatContent(logData);

        // Fetch summary if required
        if (shouldShowSummary && log.summaryPath) {
          const summaryRes = await fetch(log.summaryPath);
          if (summaryRes.ok) {
            const summaryData = await summaryRes.json();
            setSummaryContent(summaryData);
          } else {
            console.warn(`Could not fetch summary for ${log.id}`);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    }

    if (currentLog) {
      fetchLogData(currentLog);
    }
  }, [currentLog, shouldShowSummary]);

  const handleStartExperiment = () => {
    if (!annotatorName.trim() || !annotatorGroup) {
      alert('Please enter your name and select a group.');
      return;
    }
    setAppState('annotating');
    setIsLoading(true); 
  };
  
  const handleStartAnnotation = () => {
    setIsAnnotationStarted(true);
    setTimerStartTime(Date.now());
  };

  const handleIndicatorChange = (indicator: string) => {
    setSelectedIndicators(prev =>
      prev.includes(indicator) ? prev.filter(i => i !== indicator) : [...prev, indicator]
    );
  };

  const handleSubmit = async () => {
    if (!currentLog || !selectedDeception || !selectedAdherence || !annotatorGroup || !timerStartTime) {
        alert("Please complete all fields before submitting.");
        return;
    }

    const timeToAnnotateInSeconds = (Date.now() - timerStartTime) / 1000;
    
    const annotation: Annotation = {
        logId: currentLog.id,
        annotatorName,
        annotatorGroup,
        condition: shouldShowSummary ? 'log-with-summary' : 'log-only',
        deception: selectedDeception,
        adherence: selectedAdherence,
        indicators: selectedIndicators,
        timeToAnnotateInSeconds,
    };

    setIsLoading(true);
    try {
        const response = await fetch('/api/annotate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(annotation),
        });

        if (!response.ok) throw new Error('Failed to save annotation.');

        // Reset for next log
        setCurrentLog(null);
        setSelectedDeception(null);
        setSelectedAdherence(null);
        setSelectedIndicators([]);
        setError(null);

    } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not submit annotation.');
        setIsLoading(false); 
    }
  };
  
  const isSubmitDisabled = !selectedDeception || !selectedAdherence || isLoading;
  const chatMessages = useMemo(() => chatContent?.flatMap(session => session.messages) ?? [], [chatContent]);

  // RENDER LOGIC
  if (appState === 'guidelines') {
    return (
      <div className="min-h-screen bg-gray-900 text-white font-sans">
        <div className="container mx-auto p-4 md:p-8 max-w-4xl">
          <header className="mb-8 text-center">
            <h1 className="text-4xl font-bold text-cyan-400">Annotator Guidelines</h1>
          </header>
          <div className="bg-gray-800 rounded-lg p-8 space-y-6">
            <div>
              <h2 className="text-2xl font-semibold text-cyan-400 mb-3">Your Task</h2>
              <p className="text-gray-300">
                Your primary task is to read patient-bot chat logs and classify each log based on the evidence you find. You will also be asked to select the specific indicators that led you to your conclusion. Please base your judgments solely on the indicators described below.
              </p>
              <h3 className="text-xl font-semibold text-cyan-400 mt-4 mb-2">Annotation Categories</h3>
              <p className="text-gray-300">You will classify each log into one of the following four categories:</p>
              <ul className="list-disc list-inside pl-4 mt-2 space-y-1 text-gray-300">
                  <li><span className="font-bold">Truthful & Adhering:</span> The patient is honest and generally follows the program guidelines.</li>
                  <li><span className="font-bold">Truthful & Non-Adhering:</span> The patient is honest about their struggles or failure to follow the program.</li>
                  <li><span className="font-bold">Deceitful & Adhering:</span> The patient is generally following the program but is dishonest about certain aspects.</li>
                  <li><span className="font-bold">Deceitful & Non-Adhering:</span> The patient is dishonest and not following the program guidelines.</li>
              </ul>
              <h3 className="text-xl font-semibold text-cyan-400 mt-4 mb-2">Definition of "Adhering"</h3>
              <p className="text-gray-300">
                Please note that "adhering" does not mean the patient is 100% perfect. A patient can be considered "adhering" if they are generally following the program's core principles and taking their participation seriously.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-cyan-400 mb-3">Key Indicators</h2>
              <p className="text-gray-400 mb-4">Please read these definitions carefully. You must annotate according to these specific indicators.</p>
              <div className="space-y-4">
                <div className="bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-lg font-bold text-cyan-400">Inconsistencies</h3>
                  <p className="text-gray-300 mt-1">Patients may contradict themselves across conversations (e.g., claiming dietary adherence but later mentioning off-plan eating). When patients provide contradictory information it either means they are being deceptive, or that they are misremembering. This will be fairly trivial to detect in our use case as we will be able to directly compare all the chats the patient has had.</p>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-lg font-bold text-cyan-400">Vague or Evasive Language</h3>
                  <p className="text-gray-300 mt-1">Patients who are deceptive or non-adherent often use language that introduces uncertainty or avoids specific commitments. This includes frequent use of hedging words like "maybe," "should," or "could," and generalizing terms such as "always" or "everyone" that avoid concrete details. They might respond indirectly or provide irrelevant details instead of answering questions clearly. Research specifically highlights that deceptive communication often involves intentionally unclear language, including ambiguous phrasing, increased usage of modal verbs, and passive voice, to avoid providing verifiable specifics. Similarly, a hallmark of deceptive statements is their low specificity and concreteness deceivers deliberately omit concrete facts like dates, quantities, or names that could be easily verified.</p>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-lg font-bold text-cyan-400">Engagement Level</h3>
                  <p className="text-gray-300 mt-1">Patients levels of engagement, meaning how short or long the answers are. Can signal deception or non-adherence, depending on context. Research suggests that in asynchronous text chat contexts similar to the patient bot interactions in the CHIP system, deceivers often produce longer and more elaborate messages, as they have more time to craft convincing stories, thereby converting their deception cues into richer, more detailed text. While very short answers might indicate the patients disengaging from the CHIP system overall.</p>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-lg font-bold text-cyan-400">Gaming the System</h3>
                  <p className="text-gray-300 mt-1">Patients sometimes give overly consistent or perfect answers, claiming flawless adherence to appear cooperative and avoid negative judgment. Research shows that self-reported adherence measures often show "strong tendencies for over-reporting," resulting in ceiling effects where patients frequently claim perfect adherence despite objective evidence to the contrary. Such exaggerated reporting is typically driven by social-desirability bias, where patients aim to present themselves positively rather than truthfully. Therefore detecting and flagging responses that seem unrealistically good can be an effective indicator of non-adherence and deception.</p>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-cyan-400 mb-3">Timed Annotations</h2>
              <p className="text-gray-300">
                For each chat log, the annotation process is timed. The timer will start the moment you click the **"Start Annotation & Timer"** button, which is also when the chat log and summary (if applicable) will become visible. The timer stops when you click "Submit & Next". This helps us understand the time taken for each annotation.
              </p>
            </div>
            
            <div>
              <h2 className="text-2xl font-semibold text-cyan-400 mb-3">Understanding AI Summaries</h2>
              <p className="text-gray-300 mb-2">
                In some cases, you will be shown an AI-generated summary alongside the chat log. These summaries are structured with a main summary and a list of "flags".
              </p>
              <p className="text-gray-300">
                A flag marked with **(Low Confidence)** indicates that the AI detected a potential indicator but was not certain. This happens when two different AI runs did not agree on the flag. You should evaluate these low-confidence flags with extra scrutiny.
              </p>
              <div className="bg-gray-700 p-4 rounded-lg mt-4">
                <h4 className="font-bold text-cyan-400">Example Summary Structure:</h4>
                <div className="mt-2 text-sm">
                  <p><span className="font-semibold">Summary:</span> "The patient reported general adherence but struggled with exercise..."</p>
                  <p className="mt-2"><span className="font-semibold">Flags:</span></p>
                  <ul className="list-disc list-inside pl-4 mt-1 space-y-1">
                    <li>VagueLanguage <span className="text-yellow-400">(Low Confidence)</span>: "I ate okay."</li>
                    <li>Inconsistency: "Said they took medication, but later mentioned forgetting."</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="text-center pt-4">
                <p className="text-lg text-gray-400 mb-4">Please make sure you have read and understood all the guidelines before proceeding.</p>
                <button
                onClick={() => setAppState('setup')}
                className="w-full max-w-xs bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-md"
                >
                I Understand, Continue to Setup
                </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (appState === 'setup') {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-gray-800 p-8 rounded-lg shadow-lg">
          <h1 className="text-3xl font-bold text-cyan-400 mb-6">Annotation Experiment Setup</h1>
          <div className="space-y-6">
            <div>
              <label htmlFor="annotatorName" className="block text-sm font-medium text-gray-300 mb-2">Your Name</label>
              <input
                type="text"
                id="annotatorName"
                value={annotatorName}
                onChange={e => setAnnotatorName(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-cyan-500 focus:border-cyan-500"
                placeholder="Enter your name"
              />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-2">Select Your Group</h3>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setAnnotatorGroup('group1')} className={`p-4 rounded-md text-center ${annotatorGroup === 'group1' ? 'bg-cyan-600 text-white font-bold' : 'bg-gray-700'}`}>Group 1</button>
                <button onClick={() => setAnnotatorGroup('group2')} className={`p-4 rounded-md text-center ${annotatorGroup === 'group2' ? 'bg-cyan-600 text-white font-bold' : 'bg-gray-700'}`}>Group 2</button>
              </div>
            </div>
            <button
              onClick={handleStartExperiment}
              disabled={!annotatorName.trim() || !annotatorGroup || isLoading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-md disabled:bg-gray-500 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Loading...' : 'Start Annotation'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (appState === 'finished') {
    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8">
            <h1 className="text-4xl font-bold mb-4">Annotation Complete!</h1>
            <p className="text-lg text-gray-400">Thank you for your participation, {annotatorName}.</p>
        </div>
    );
  }

  if (isLoading || !currentLog) {
    return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Loading next log...</div>;
  }
  
  if (error) {
     return <div className="min-h-screen bg-red-900 text-white flex items-center justify-center p-4"><p>An error occurred: {error}</p></div>;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      <div className="w-full p-4 md:p-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-cyan-400">Annotation Task</h1>
          <p className="text-gray-400">{logQueue.length} logs remaining</p>
          <p className="text-sm text-yellow-400 mt-1">
            Annotator: {annotatorName} (Group: {annotatorGroup}) | Condition: {shouldShowSummary ? 'Log + AI Summary' : 'Log Only'}
          </p>
        </header>

        <div className={`grid grid-cols-1 ${shouldShowSummary ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-8`}>
          {/* Chat Log Section */}
          {isAnnotationStarted ? (
            <div className="bg-gray-800 rounded-lg p-6 h-[70vh] overflow-y-auto">
              <h2 className="text-2xl font-semibold mb-4 text-gray-200">Chat Log</h2>
              <div className="space-y-2">
                {chatContent?.map((session, sessionIndex) => (
                  <div key={`session-${sessionIndex}`}>
                    <div className="flex items-center my-4">
                      <hr className="flex-grow border-t border-gray-600" />
                      <span className="px-2 text-xs text-gray-400 bg-gray-800">
                        Chat Session {sessionIndex + 1}
                      </span>
                      <hr className="flex-grow border-t border-gray-600" />
                    </div>
                    <div className="space-y-4">
                      {session.messages.map((msg, msgIndex) => (
                        <div
                          key={`msg-${sessionIndex}-${msgIndex}`}
                          className={`p-3 rounded-lg ${
                            msg.user.name === 'Patient'
                              ? 'bg-blue-900/50'
                              : 'bg-gray-700/50'
                          }`}
                        >
                          <p
                            className={`font-semibold ${
                              msg.user.name === 'Patient'
                                ? 'text-cyan-400'
                                : 'text-green-400'
                            }`}
                          >
                            {msg.user.name}
                          </p>
                          <p className="text-gray-300 whitespace-pre-wrap">
                            {msg.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg p-6 h-[70vh] flex items-center justify-center text-gray-500">
                <p>Chat log will appear here.</p>
            </div>
          )}

          {/* AI Generated Summary (Conditional Column) */}
          {shouldShowSummary && (
            isAnnotationStarted ? (
                summaryContent && (
                    <div className="bg-gray-800 rounded-lg p-6 h-[70vh] overflow-y-auto">
                        <h2 className="text-2xl font-semibold mb-4 text-gray-200">AI Generated Summary</h2>
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-lg font-bold text-cyan-400 mb-2">Summary</h3>
                                <p className="text-gray-300">{summaryContent.summary}</p>
                            </div>
                            <div>
                                 <h3 className="text-lg font-bold text-cyan-400 mb-2">Flags</h3>
                                 {summaryContent.flags.length > 0 ? (
                                    <ul className="space-y-3">
                                    {summaryContent.flags.map((flag, i) => (
                                        <li key={i} className="bg-gray-700/50 p-3 rounded">
                                            <p className="font-semibold">{flag.indicator} {flag.confidence && <span className="text-sm text-yellow-400">(Low Confidence)</span>}</p>
                                            <p className="text-sm text-gray-400 italic">"{flag.excerpt}"</p>
                                            <p className="text-sm text-gray-300 mt-1">{flag.explanation}</p>
          </li>
                                    ))}
                                    </ul>
                                 ) : (<p className="text-gray-400">No flags were raised by the AI.</p>)}
                            </div>
                        </div>
                    </div>
                )
            ) : (
                <div className="bg-gray-800 rounded-lg p-6 h-[70vh] flex items-center justify-center text-gray-500">
                    <p>AI summary will appear here.</p>
                </div>
            )
          )}
            
          {/* Annotation Form */}
          <div className="bg-gray-800 rounded-lg p-6 h-[70vh] overflow-y-auto flex flex-col">
            <h2 className="text-2xl font-semibold mb-6 text-gray-200">Your Annotation</h2>
            
            {!isAnnotationStarted ? (
              <div className="flex-grow flex items-center justify-center">
                <button 
                  onClick={handleStartAnnotation}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-4 px-8 rounded-lg text-xl"
                >
                  Start Annotation & Timer
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Category Selection */}
                <div>
                  <h3 className="text-lg font-bold text-cyan-400 mb-3">1. Select Category</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button onClick={() => {setSelectedDeception('deceitful'); setSelectedAdherence('adhering');}} className={`p-3 text-sm rounded ${selectedDeception === 'deceitful' && selectedAdherence === 'adhering' ? 'bg-cyan-500 text-white' : 'bg-gray-700'}`}>Deceitful, Adhering</button>
                    <button onClick={() => {setSelectedDeception('deceitful'); setSelectedAdherence('non-adhering');}} className={`p-3 text-sm rounded ${selectedDeception === 'deceitful' && selectedAdherence === 'non-adhering' ? 'bg-cyan-500 text-white' : 'bg-gray-700'}`}>Deceitful, Non-Adhering</button>
                    <button onClick={() => {setSelectedDeception('truthful'); setSelectedAdherence('adhering');}} className={`p-3 text-sm rounded ${selectedDeception === 'truthful' && selectedAdherence === 'adhering' ? 'bg-cyan-500 text-white' : 'bg-gray-700'}`}>Truthful, Adhering</button>
                    <button onClick={() => {setSelectedDeception('truthful'); setSelectedAdherence('non-adhering');}} className={`p-3 text-sm rounded ${selectedDeception === 'truthful' && selectedAdherence === 'non-adhering' ? 'bg-cyan-500 text-white' : 'bg-gray-700'}`}>Truthful, Non-Adhering</button>
                  </div>
                </div>

                {/* Indicator Selection */}
                <div>
                  <h3 className="text-lg font-bold text-cyan-400 mb-3">2. Select Key Indicators</h3>
                  <div className="space-y-2">
                    {INDICATORS.map(indicator => (
                      <label key={indicator} className="flex items-center p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600">
                        <input
                          type="checkbox"
                          checked={selectedIndicators.includes(indicator)}
                          onChange={() => handleIndicatorChange(indicator)}
                          className="h-4 w-4 rounded bg-gray-900 border-gray-600 text-cyan-600 focus:ring-cyan-500"
                        />
                        <span className="ml-3 text-gray-300">{indicator}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <footer className="mt-8 text-center">
            {isAnnotationStarted && (
                <button 
                    onClick={handleSubmit}
                    disabled={isSubmitDisabled}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-12 rounded-lg disabled:bg-gray-500 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Saving...' : 'Submit & Next'}
                </button>
            )}
            {isSubmitDisabled && !isLoading && isAnnotationStarted && <p className="text-xs text-red-400 mt-2">Please select a category to continue.</p>}
      </footer>
      </div>
    </div>
  );
}
