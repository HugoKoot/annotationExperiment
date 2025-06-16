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
  const [appState, setAppState] = useState<'setup' | 'annotating' | 'finished'>('setup');
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

  // RENDER LOGIC
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
