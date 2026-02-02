import { useState, useEffect, useRef } from 'react';
import { SentimentResult } from '../services/groq';
import { SettingsPanel } from './SettingsPanel';
import { HistoryPanel } from './HistoryPanel';
import { DictionaryPanel, DictionaryEntry } from './DictionaryPanel';

interface DetectedCorrection {
  original: string;
  corrected: string;
}

export interface TranscriptionRecord {
  id: string;
  text: string;
  timestamp: number;
  wordCount: number;
}

interface OverlayProps {
  isRecording: boolean;
  isProcessing: boolean;
  transcript: string;
  sentiment: SentimentResult | null;
  hotkey: string;
  wordsThisMonth: number;
  wordsTotal: number;
  history: TranscriptionRecord[];
  dictionary: DictionaryEntry[];
  onStopRecording: () => void;
  onClose: () => void;
  onSettingsChange: () => void;
  onClearHistory: () => void;
  onDeleteHistoryItem: (id: string) => void;
  onAddDictionaryEntry: (entry: Omit<DictionaryEntry, 'id' | 'createdAt'>) => void;
  onUpdateDictionaryEntry: (id: string, updates: Partial<DictionaryEntry>) => void;
  onDeleteDictionaryEntry: (id: string) => void;
}

function formatHotkey(hotkey: string): string {
  return hotkey
    .replace('CommandOrControl', 'Ctrl')
    .replace('Command', 'Cmd')
    .replace('Control', 'Ctrl')
    .replace(/\+/g, ' + ');
}

type NavItem = 'home' | 'history' | 'dictionary' | 'styles' | 'settings';

export function Overlay({
  isRecording,
  isProcessing,
  transcript,
  sentiment: _sentiment,
  hotkey,
  wordsThisMonth,
  wordsTotal,
  history,
  dictionary,
  onStopRecording,
  onClose: _onClose,
  onSettingsChange,
  onClearHistory,
  onDeleteHistoryItem,
  onAddDictionaryEntry,
  onUpdateDictionaryEntry,
  onDeleteDictionaryEntry,
}: OverlayProps) {
  const [activeNav, setActiveNav] = useState<NavItem>('home');
  const [editableText, setEditableText] = useState('');
  const [originalTranscript, setOriginalTranscript] = useState('');
  const [detectedCorrection, setDetectedCorrection] = useState<DetectedCorrection | null>(null);
  const editableTextRef = useRef('');

  // Keep ref in sync with state
  useEffect(() => {
    editableTextRef.current = editableText;
  }, [editableText]);

  // Track when a new transcript arrives - copy to editable state
  // This handles transcripts from the main window's own recording
  useEffect(() => {
    if (transcript && transcript !== originalTranscript) {
      setOriginalTranscript(transcript);
      setEditableText(transcript);
      setDetectedCorrection(null);
    }
  }, [transcript]);

  // Handle text changes - detect when new transcription arrives via paste
  const handleNewText = (newText: string) => {
    const wasEmpty = !editableTextRef.current || editableTextRef.current.trim() === '';
    const hasContent = newText && newText.trim() !== '';

    setEditableText(newText);

    // If textarea was empty and now has substantial content, this is likely a new transcription
    // (substantial = more than a few characters, to avoid triggering on single keystrokes)
    if (wasEmpty && hasContent && newText.length > 10) {
      setOriginalTranscript(newText);
      setDetectedCorrection(null);
    }
  };

  const handleAddDetectedCorrection = () => {
    if (detectedCorrection) {
      onAddDictionaryEntry({
        original: detectedCorrection.original,
        corrected: detectedCorrection.corrected,
        caseSensitive: false,
        enabled: true,
      });
      setDetectedCorrection(null);
    }
  };

  const handleDismissCorrection = () => {
    setDetectedCorrection(null);
  };

  const displayHotkey = formatHotkey(hotkey);

  return (
    <div className="w-full h-full bg-black flex overflow-hidden select-none">
      {/* Sidebar */}
      <div className="w-56 bg-black flex flex-col border-r border-white/10">
        {/* Logo */}
        <div className="px-5 py-6 flex items-center gap-3">
          <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
          <span className="text-white font-bold text-xl tracking-tight">Open-Wispr</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavButton
            icon={<HomeIcon />}
            label="Home"
            active={activeNav === 'home'}
            onClick={() => setActiveNav('home')}
          />
          <NavButton
            icon={<HistoryIcon />}
            label="History"
            active={activeNav === 'history'}
            onClick={() => setActiveNav('history')}
            badge={history.length > 0 ? history.length : undefined}
          />
          <NavButton
            icon={<DictionaryIcon />}
            label="Dictionary"
            active={activeNav === 'dictionary'}
            onClick={() => setActiveNav('dictionary')}
          />
          <NavButton
            icon={<StylesIcon />}
            label="Styles"
            active={activeNav === 'styles'}
            onClick={() => setActiveNav('styles')}
          />
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-white/10 space-y-4">
          <NavButton
            icon={<SettingsIcon />}
            label="Settings"
            active={activeNav === 'settings'}
            onClick={() => setActiveNav('settings')}
          />
          {/* Logo at bottom */}
          <div className="flex items-center justify-center pt-2 pb-1">
            <div className="flex items-center gap-2 text-white/30">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              <span className="text-xs font-medium">v1.0.0</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-black">
        <div className="flex-1 overflow-y-auto">
          {activeNav === 'home' && (
            <HomePanel
              wordsThisMonth={wordsThisMonth}
              wordsTotal={wordsTotal}
              displayHotkey={displayHotkey}
              isRecording={isRecording}
              isProcessing={isProcessing}
              editableText={editableText}
              onTextChange={handleNewText}
              onStopRecording={onStopRecording}
              originalTranscript={originalTranscript}
              onCorrectionDetected={setDetectedCorrection}
              detectedCorrection={detectedCorrection}
              onAddCorrection={handleAddDetectedCorrection}
              onDismissCorrection={handleDismissCorrection}
              existingDictionary={dictionary}
            />
          )}

          {activeNav === 'history' && (
            <HistoryPanel
              history={history}
              onClearHistory={onClearHistory}
              onDeleteItem={onDeleteHistoryItem}
            />
          )}

          {activeNav === 'dictionary' && (
            <DictionaryPanel
              dictionary={dictionary}
              onAddEntry={onAddDictionaryEntry}
              onUpdateEntry={onUpdateDictionaryEntry}
              onDeleteEntry={onDeleteDictionaryEntry}
            />
          )}

          {activeNav === 'styles' && (
            <ComingSoonPanel title="Styles" description="Create custom writing styles for different contexts." />
          )}

          {activeNav === 'settings' && (
            <SettingsPanel onSettingsChange={onSettingsChange} />
          )}
        </div>
      </div>
    </div>
  );
}

// Utility function to detect word corrections
function detectWordCorrection(
  originalText: string,
  editedText: string,
  existingDictionary: DictionaryEntry[]
): DetectedCorrection | null {
  if (!originalText || !editedText || originalText === editedText) {
    return null;
  }

  // Tokenize into words, preserving punctuation attached to words
  const tokenize = (text: string) => text.split(/\s+/).filter(w => w.length > 0);

  const originalWords = tokenize(originalText);
  const editedWords = tokenize(editedText);

  // Simple approach: find single word replacements
  // If the word counts are the same, look for differences
  if (originalWords.length === editedWords.length) {
    const differences: { original: string; corrected: string }[] = [];

    for (let i = 0; i < originalWords.length; i++) {
      if (originalWords[i].toLowerCase() !== editedWords[i].toLowerCase()) {
        differences.push({
          original: originalWords[i],
          corrected: editedWords[i],
        });
      }
    }

    // If exactly one word changed, that's likely a correction
    if (differences.length === 1) {
      const diff = differences[0];
      // Check if this correction already exists in dictionary
      const alreadyExists = existingDictionary.some(
        entry => entry.original.toLowerCase() === diff.original.toLowerCase()
      );
      if (!alreadyExists) {
        return diff;
      }
    }
  }

  // Handle case where word count changed (e.g., "Tally dot io" -> "tallie.io")
  // Use a simple heuristic: look for the longest common subsequence and find what changed
  if (Math.abs(originalWords.length - editedWords.length) <= 2) {
    // Find words that are in original but not in edited (potential "from" words)
    // Find words that are in edited but not in original (potential "to" words)
    const originalLower = new Set(originalWords.map(w => w.toLowerCase()));
    const editedLower = new Set(editedWords.map(w => w.toLowerCase()));

    const removed = originalWords.filter(w => !editedLower.has(w.toLowerCase()));
    const added = editedWords.filter(w => !originalLower.has(w.toLowerCase()));

    // If one word was replaced with another (or a phrase collapsed to one word)
    if (removed.length >= 1 && added.length === 1) {
      const original = removed.join(' ');
      const corrected = added[0];

      // Check if this correction already exists in dictionary
      const alreadyExists = existingDictionary.some(
        entry => entry.original.toLowerCase() === original.toLowerCase()
      );
      if (!alreadyExists && original.toLowerCase() !== corrected.toLowerCase()) {
        return { original, corrected };
      }
    }
  }

  return null;
}

// Home Panel
function HomePanel({
  wordsThisMonth,
  wordsTotal,
  displayHotkey,
  isRecording,
  isProcessing,
  editableText,
  onTextChange,
  onStopRecording,
  originalTranscript,
  onCorrectionDetected,
  detectedCorrection,
  onAddCorrection,
  onDismissCorrection,
  existingDictionary,
}: {
  wordsThisMonth: number;
  wordsTotal: number;
  displayHotkey: string;
  isRecording: boolean;
  isProcessing: boolean;
  editableText: string;
  onTextChange: (text: string) => void;
  onStopRecording: () => void;
  originalTranscript: string;
  onCorrectionDetected: (correction: DetectedCorrection | null) => void;
  detectedCorrection: DetectedCorrection | null;
  onAddCorrection: () => void;
  onDismissCorrection: () => void;
  existingDictionary: DictionaryEntry[];
}) {
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckedTextRef = useRef<string>('');

  // Detect corrections when text changes
  const handleTextChange = (newText: string) => {
    onTextChange(newText);

    // Debounce the correction detection
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      // Only check if we have an original transcript and the text has changed
      if (originalTranscript && newText !== lastCheckedTextRef.current) {
        lastCheckedTextRef.current = newText;
        const correction = detectWordCorrection(originalTranscript, newText, existingDictionary);
        if (correction) {
          onCorrectionDetected(correction);
        }
      }
    }, 800); // Wait 800ms after user stops typing
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);
  return (
    <div className="p-10">
      <div className="max-w-2xl">
        {/* Welcome */}
        <h1 className="text-4xl font-extrabold text-white mb-3 tracking-tight">
          Welcome back
        </h1>
        <p className="text-white/50 text-lg mb-12">
          Press your hotkey to start dictating anywhere.
        </p>

        {/* Stats */}
        <div className="flex gap-16 mb-16">
          <div>
            <div className="text-5xl font-bold text-white tracking-tight">
              {wordsThisMonth.toLocaleString()}
            </div>
            <div className="text-white/40 text-sm mt-1 font-medium">Words this month</div>
          </div>
          <div>
            <div className="text-5xl font-bold text-white tracking-tight">
              {wordsTotal.toLocaleString()}
            </div>
            <div className="text-white/40 text-sm mt-1 font-medium">Words total</div>
          </div>
        </div>

        {/* Try it out */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Try it out</h2>
            <div className="flex items-center gap-2 text-white/40">
              <span className="text-sm">Press</span>
              <kbd className="px-3 py-1.5 bg-white/10 rounded text-sm font-mono text-white">
                {displayHotkey}
              </kbd>
            </div>
          </div>

          {/* Dictation area */}
          <div className="relative">
            {isRecording && (
              <div className="absolute inset-0 bg-black/90 rounded-lg flex flex-col items-center justify-center z-10 border border-white/20">
                <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mb-5">
                  <MicIcon className="w-8 h-8 text-black" />
                </div>
                <p className="text-white font-semibold text-lg mb-5">Listening...</p>
                <button
                  onClick={onStopRecording}
                  className="px-6 py-2.5 bg-white text-black rounded-lg font-semibold text-sm hover:bg-white/90 transition-colors"
                >
                  Stop Recording
                </button>
              </div>
            )}
            {isProcessing && (
              <div className="absolute inset-0 bg-black/90 rounded-lg flex flex-col items-center justify-center z-10 border border-white/20">
                <div className="w-10 h-10 rounded-full border-2 border-white border-t-transparent animate-spin mb-4" />
                <p className="text-white/70 font-medium">Transcribing...</p>
              </div>
            )}
            <textarea
              value={editableText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Your transcription will appear here..."
              className="w-full h-52 p-5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 resize-none focus:outline-none focus:border-white/30 transition-colors text-base leading-relaxed"
            />
          </div>

          {/* Detected correction prompt */}
          {detectedCorrection && !isRecording && !isProcessing && (
            <div className="flex items-center gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="flex-shrink-0">
                <DictionaryIcon className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white">
                  Add to dictionary?{' '}
                  <span className="text-white/60">"{detectedCorrection.original}"</span>
                  <span className="text-white/40 mx-1.5">&rarr;</span>
                  <span className="text-blue-400 font-medium">"{detectedCorrection.corrected}"</span>
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={onDismissCorrection}
                  className="px-3 py-1.5 text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  Dismiss
                </button>
                <button
                  onClick={onAddCorrection}
                  className="px-3 py-1.5 text-sm font-semibold bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {originalTranscript && !isRecording && !isProcessing && !detectedCorrection && (
            <div className="flex items-center gap-2 text-white/60 text-sm">
              <CheckIcon className="w-4 h-4" />
              <span>Text typed at cursor</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Coming Soon Panel
function ComingSoonPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex-1 flex items-center justify-center p-10 min-h-[400px]">
      <div className="text-center max-w-md">
        <h2 className="text-2xl font-bold text-white mb-3">{title}</h2>
        <p className="text-white/40 text-base mb-6">{description}</p>
        <span className="inline-block px-4 py-2 bg-white/5 rounded-full text-white/50 text-sm font-medium">
          Coming soon
        </span>
      </div>
    </div>
  );
}

// Nav Button
function NavButton({
  icon,
  label,
  active,
  onClick,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${
        active
          ? 'bg-white text-black'
          : 'text-white/60 hover:text-white hover:bg-white/5'
      }`}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {badge !== undefined && (
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
          active ? 'bg-black/20 text-black' : 'bg-white/10 text-white/60'
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
}

// Icons
function HomeIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function HistoryIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function DictionaryIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}

function StylesIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}

function SettingsIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function MicIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
    </svg>
  );
}

function CheckIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
