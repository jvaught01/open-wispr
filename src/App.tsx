import { useState, useEffect } from 'react';
import { Overlay, TranscriptionRecord } from './components/Overlay';
import { RecordingOverlay } from './components/RecordingOverlay';
import { OnboardingPage } from './components/onboarding';
import { useRecording } from './hooks/useRecording';
import { transcribeAudio, analyzeSentiment, SentimentResult } from './services/groq';
import { postProcessTranscription, PostProcessingOptions, DictionaryEntry } from './services/postProcessing';
import './index.css';

interface Settings {
  apiKey: string;
  whisperModel: string;
  hotkey: string;
  outputMode: 'clipboard' | 'type';
  autoLaunch: boolean;
  showPill: boolean;
  pillVisibility: 'always' | 'recording' | 'never';
  language: string;
  aiPostProcessing: boolean;
  removeFillerWords: boolean;
  removeFalseStarts: boolean;
  fixPunctuation: boolean;
  fixGrammar: boolean;
  preferredMicrophone: string;
  incognitoMode: boolean;
  autoUpdate: boolean;
  onboardingComplete?: boolean;
}

declare global {
  interface Window {
    electron: {
      getSettings: () => Promise<Settings>;
      saveSettings: (settings: Partial<Settings>) => Promise<boolean>;
      copyToClipboard: (text: string) => Promise<boolean>;
      typeText: (text: string) => Promise<boolean>;
      getWordStats: () => Promise<{ wordsThisMonth: number; wordsTotal: number }>;
      addWords: (wordCount: number) => Promise<{ wordsThisMonth: number; wordsTotal: number }>;
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
    };
  }
}

// Check if this is the overlay window
const isOverlay = window.location.hash === '#overlay';

// Add overlay class to body if needed
if (isOverlay) {
  document.body.classList.add('overlay-mode');
}

function App() {
  if (isOverlay) {
    return <OverlayApp />;
  }
  return <MainApp />;
}

function OverlayApp() {
  const [hotkey, setHotkey] = useState('CommandOrControl+Shift+Space');

  useEffect(() => {
    window.electron.getSettings().then((settings) => {
      setHotkey(settings.hotkey);
    });
  }, []);

  return <RecordingOverlay hotkey={hotkey} />;
}

function MainApp() {
  const [transcript, setTranscript] = useState('');
  const [sentiment, setSentiment] = useState<SentimentResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [wordsThisMonth, setWordsThisMonth] = useState(0);
  const [wordsTotal, setWordsTotal] = useState(0);
  const [history, setHistory] = useState<TranscriptionRecord[]>([]);
  const [dictionary, setDictionary] = useState<DictionaryEntry[]>([]);
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);

  const { isRecording, audioData, startRecording: _startRecording, stopRecording } = useRecording();

  const loadSettings = async () => {
    const s = await window.electron.getSettings();
    setSettings(s);

    // Check if onboarding is needed (no API key or onboarding not complete)
    if (showOnboarding === null) {
      const needsOnboarding = !s.apiKey || !s.onboardingComplete;
      setShowOnboarding(needsOnboarding);
    }
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    loadSettings(); // Reload settings after onboarding
  };

  useEffect(() => {
    // Load settings on mount
    loadSettings();

    // Load word stats
    window.electron.getWordStats().then((stats) => {
      setWordsThisMonth(stats.wordsThisMonth);
      setWordsTotal(stats.wordsTotal);
    });

    // Load history
    window.electron.getHistory().then((h) => {
      setHistory(h);
    });

    // Load dictionary
    window.electron.getDictionary().then((d) => {
      setDictionary(d);
    });

    // Listen for settings open request
    window.electron.onOpenSettings(() => {
      // Settings is now in sidebar, so just focus the window
    });

    // Refresh stats, history, and dictionary periodically
    const interval = setInterval(() => {
      window.electron.getWordStats().then((stats) => {
        setWordsThisMonth(stats.wordsThisMonth);
        setWordsTotal(stats.wordsTotal);
      });
      // Refresh history to pick up items added by overlay
      window.electron.getHistory().then((h) => {
        setHistory(h);
      });
      // Refresh dictionary
      window.electron.getDictionary().then((d) => {
        setDictionary(d);
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Process audio when recording stops and we have data
    if (!isRecording && audioData && settings?.apiKey) {
      processAudio(audioData);
    }
  }, [isRecording, audioData, settings?.apiKey]);

  const processAudio = async (audio: Blob) => {
    if (!settings) return;

    setIsProcessing(true);
    setTranscript('');
    setSentiment(null);

    try {
      // Transcribe audio with selected model and language
      let text = await transcribeAudio(audio, settings.apiKey, {
        model: settings.whisperModel,
        language: settings.language,
      });

      // Apply AI post-processing if enabled
      if (settings.aiPostProcessing && text.trim()) {
        const postProcessOptions: PostProcessingOptions = {
          removeFillerWords: settings.removeFillerWords,
          removeFalseStarts: settings.removeFalseStarts,
          fixPunctuation: settings.fixPunctuation,
          fixCapitalization: true,
          fixGrammar: settings.fixGrammar,
          smartFormatting: false,
          dictionary: dictionary,
        };
        text = await postProcessTranscription(text, settings.apiKey, postProcessOptions);
      }

      setTranscript(text);

      // Count words and update stats
      const wordCount = text.trim().split(/\s+/).filter(w => w.length > 0).length;
      if (wordCount > 0) {
        const newStats = await window.electron.addWords(wordCount);
        setWordsThisMonth(newStats.wordsThisMonth);
        setWordsTotal(newStats.wordsTotal);

        // Add to history (unless incognito mode is on)
        if (!settings.incognitoMode) {
          const record: TranscriptionRecord = {
            id: Date.now().toString(),
            text: text.trim(),
            timestamp: Date.now(),
            wordCount,
          };
          const newHistory = await window.electron.addToHistory(record);
          setHistory(newHistory);
        }
      }

      // Analyze sentiment
      const sentimentResult = await analyzeSentiment(text, settings.apiKey);
      setSentiment(sentimentResult);

      // In the main window "Try It Out" section, the text is already displayed
      // in the textarea via React state, so we don't need to paste externally.
      // Just copy to clipboard for easy access.
      await window.electron.copyToClipboard(text);
    } catch (error) {
      console.error('Processing error:', error);
      setTranscript('Error: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
      window.electron.recordingStopped();
    }
  };

  const handleStopRecording = () => {
    stopRecording();
  };

  const handleClose = () => {
    setTranscript('');
    setSentiment(null);
    window.electron.hideWindow();
  };

  const handleSettingsChange = () => {
    // Reload settings when changed
    loadSettings();
  };

  const handleClearHistory = async () => {
    await window.electron.clearHistory();
    setHistory([]);
  };

  const handleDeleteHistoryItem = async (id: string) => {
    const newHistory = await window.electron.deleteHistoryItem(id);
    setHistory(newHistory);
  };

  const handleAddDictionaryEntry = async (entry: Omit<DictionaryEntry, 'id' | 'createdAt'>) => {
    const newDictionary = await window.electron.addDictionaryEntry(entry);
    setDictionary(newDictionary);
  };

  const handleUpdateDictionaryEntry = async (id: string, updates: Partial<DictionaryEntry>) => {
    const newDictionary = await window.electron.updateDictionaryEntry(id, updates);
    setDictionary(newDictionary);
  };

  const handleDeleteDictionaryEntry = async (id: string) => {
    const newDictionary = await window.electron.deleteDictionaryEntry(id);
    setDictionary(newDictionary);
  };

  // Show loading state while checking onboarding status
  if (showOnboarding === null) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  // Show onboarding if needed
  if (showOnboarding) {
    return <OnboardingPage onComplete={handleOnboardingComplete} />;
  }

  return (
    <Overlay
      isRecording={isRecording}
      isProcessing={isProcessing}
      transcript={transcript}
      sentiment={sentiment}
      hotkey={settings?.hotkey || 'CommandOrControl+Shift+Space'}
      wordsThisMonth={wordsThisMonth}
      wordsTotal={wordsTotal}
      history={history}
      dictionary={dictionary}
      onStopRecording={handleStopRecording}
      onClose={handleClose}
      onSettingsChange={handleSettingsChange}
      onClearHistory={handleClearHistory}
      onDeleteHistoryItem={handleDeleteHistoryItem}
      onAddDictionaryEntry={handleAddDictionaryEntry}
      onUpdateDictionaryEntry={handleUpdateDictionaryEntry}
      onDeleteDictionaryEntry={handleDeleteDictionaryEntry}
    />
  );
}

export default App;
