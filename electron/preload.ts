import { contextBridge, ipcRenderer } from 'electron';

export interface Settings {
  // API
  apiKey: string;
  whisperModel: string;

  // General
  hotkey: string;
  outputMode: 'clipboard' | 'type';
  autoLaunch: boolean;
  showPill: boolean;
  pillVisibility: 'always' | 'recording' | 'never';

  // Processing
  language: string;
  aiPostProcessing: boolean;
  removeFillerWords: boolean;
  removeFalseStarts: boolean;
  fixPunctuation: boolean;
  fixGrammar: boolean;

  // Audio
  preferredMicrophone: string;

  // More
  incognitoMode: boolean;
  autoUpdate: boolean;
}

export interface WordStats {
  wordsThisMonth: number;
  wordsTotal: number;
}

export interface TranscriptionRecord {
  id: string;
  text: string;
  timestamp: number;
  wordCount: number;
}

export interface AudioDevice {
  deviceId: string;
  label: string;
}

export interface DictionaryEntry {
  id: string;
  original: string;
  corrected: string;
  caseSensitive: boolean;
  enabled: boolean;
  createdAt: number;
}

export interface ElectronAPI {
  getSettings: () => Promise<Settings>;
  saveSettings: (settings: Partial<Settings>) => Promise<boolean>;
  copyToClipboard: (text: string) => Promise<boolean>;
  typeText: (text: string) => Promise<boolean>;
  getWordStats: () => Promise<WordStats>;
  addWords: (wordCount: number) => Promise<WordStats>;
  getHistory: () => Promise<TranscriptionRecord[]>;
  addToHistory: (record: TranscriptionRecord) => Promise<TranscriptionRecord[]>;
  clearHistory: () => Promise<void>;
  deleteHistoryItem: (id: string) => Promise<TranscriptionRecord[]>;
  getDictionary: () => Promise<DictionaryEntry[]>;
  addDictionaryEntry: (entry: Omit<DictionaryEntry, 'id' | 'createdAt'>) => Promise<DictionaryEntry[]>;
  updateDictionaryEntry: (id: string, updates: Partial<DictionaryEntry>) => Promise<DictionaryEntry[]>;
  deleteDictionaryEntry: (id: string) => Promise<DictionaryEntry[]>;
  clearAllData: () => Promise<void>;
  testApiKey: (apiKey: string) => Promise<boolean>;
  onRecordingStart: (callback: () => void) => void;
  onRecordingStop: (callback: () => void) => void;
  onOpenSettings: (callback: () => void) => void;
  recordingStopped: () => void;
  hideWindow: () => void;
  playSound: (sound: 'start' | 'stop' | 'error') => void;
  setIgnoreMouseEvents: (ignore: boolean) => void;
}

contextBridge.exposeInMainWorld('electron', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: Partial<Settings>) => ipcRenderer.invoke('save-settings', settings),
  copyToClipboard: (text: string) => ipcRenderer.invoke('copy-to-clipboard', text),
  typeText: (text: string) => ipcRenderer.invoke('type-text', text),
  getWordStats: () => ipcRenderer.invoke('get-word-stats'),
  addWords: (wordCount: number) => ipcRenderer.invoke('add-words', wordCount),
  getHistory: () => ipcRenderer.invoke('get-history'),
  addToHistory: (record: TranscriptionRecord) => ipcRenderer.invoke('add-to-history', record),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  deleteHistoryItem: (id: string) => ipcRenderer.invoke('delete-history-item', id),
  getDictionary: () => ipcRenderer.invoke('get-dictionary'),
  addDictionaryEntry: (entry: Omit<DictionaryEntry, 'id' | 'createdAt'>) => ipcRenderer.invoke('add-dictionary-entry', entry),
  updateDictionaryEntry: (id: string, updates: Partial<DictionaryEntry>) => ipcRenderer.invoke('update-dictionary-entry', id, updates),
  deleteDictionaryEntry: (id: string) => ipcRenderer.invoke('delete-dictionary-entry', id),
  clearAllData: () => ipcRenderer.invoke('clear-all-data'),
  testApiKey: (apiKey: string) => ipcRenderer.invoke('test-api-key', apiKey),
  onRecordingStart: (callback: () => void) => {
    ipcRenderer.removeAllListeners('recording-start');
    ipcRenderer.on('recording-start', callback);
  },
  onRecordingStop: (callback: () => void) => {
    ipcRenderer.removeAllListeners('recording-stop');
    ipcRenderer.on('recording-stop', callback);
  },
  onOpenSettings: (callback: () => void) => {
    ipcRenderer.removeAllListeners('open-settings');
    ipcRenderer.on('open-settings', callback);
  },
  recordingStopped: () => {
    ipcRenderer.send('recording-stopped');
  },
  hideWindow: () => {
    ipcRenderer.send('hide-window');
  },
  playSound: (sound: 'start' | 'stop' | 'error') => {
    ipcRenderer.send('play-sound', sound);
  },
  setIgnoreMouseEvents: (ignore: boolean) => {
    ipcRenderer.send('set-ignore-mouse-events', ignore);
  },
} as ElectronAPI);
