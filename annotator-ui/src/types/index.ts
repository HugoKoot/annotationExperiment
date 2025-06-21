export interface LogEntry {
  id: string;
  logPath: string;
  summaryPath: string | null;
  groundTruth: {
    deception: 'truthful' | 'deceitful';
    adherence: 'adhering' | 'non-adhering';
  };
}

export interface ChatMessage {
  user: { name: string };
  message: string;
}

export interface ChatSession {
  messages: ChatMessage[];
}

export interface SummaryData {
  summary: string;
  flags: {
    indicator: string;
    excerpt: string;
    explanation: string;
    confidence?: 'low';
  }[];
}

export interface Annotation {
  logId: string;
  annotatorId: number;
  annotatorGroup: 'group1' | 'group2';
  condition: 'log-only' | 'log-with-summary'; // The actual condition for this trial
  deception: 'truthful' | 'deceitful';
  adherence: 'adhering' | 'non-adhering';
  indicators: string[]; // e.g., ['Inconsistency', 'VagueLanguage']
  timeToAnnotateInSeconds: number;
} 