import { useState, useEffect, useCallback, useMemo } from 'react';

interface HotkeyStepProps {
  onNext: (hotkey: string) => void;
  onBack: () => void;
  initialValue: string;
}

export function HotkeyStep({ onNext, onBack, initialValue }: HotkeyStepProps) {
  const [selectedHotkey, setSelectedHotkey] = useState(initialValue);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [customKeys, setCustomKeys] = useState<string[]>([]);

  // Detect platform
  const isMac = useMemo(() => {
    if (typeof navigator !== 'undefined') {
      return navigator.platform.toUpperCase().indexOf('MAC') >= 0 ||
             navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
    }
    return false;
  }, []);

  const PRESET_HOTKEYS = useMemo(() => [
    { value: 'CommandOrControl+Shift+Space', label: isMac ? 'Cmd + Shift + Space' : 'Ctrl + Shift + Space', description: 'Recommended' },
    { value: 'Alt+Space', label: isMac ? 'Option + Space' : 'Alt + Space', description: 'Quick access' },
    { value: 'CommandOrControl+Shift+D', label: isMac ? 'Cmd + Shift + D' : 'Ctrl + Shift + D', description: 'D for Dictate' },
  ], [isMac]);

  const formatHotkeyDisplay = useCallback((hotkey: string): string => {
    if (isMac) {
      return hotkey
        .replace('CommandOrControl', 'Cmd')
        .replace('Command', 'Cmd')
        .replace('Control', 'Ctrl')
        .replace('Super', 'Cmd')
        .replace('Alt', 'Option')
        .replace(/\+/g, ' + ');
    }
    return hotkey
      .replace('CommandOrControl', 'Ctrl')
      .replace('Command', 'Ctrl')
      .replace('Control', 'Ctrl')
      .replace('Super', 'Win')
      .replace(/\+/g, ' + ');
  }, [isMac]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isCustomizing) return;

    e.preventDefault();
    e.stopPropagation();

    const keys: string[] = [];

    // On Mac, Cmd key (metaKey) should map to CommandOrControl
    // On Windows/Linux, Ctrl key should map to CommandOrControl
    if (isMac) {
      if (e.metaKey) keys.push('Cmd'); // Display as Cmd, will convert to CommandOrControl
      if (e.ctrlKey) keys.push('Ctrl');
    } else {
      if (e.ctrlKey || e.metaKey) keys.push('Ctrl');
    }
    if (e.shiftKey) keys.push('Shift');
    if (e.altKey) keys.push(isMac ? 'Option' : 'Alt');

    // Get the actual key
    const key = e.key;
    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
      // Format the key nicely
      const formattedKey = key.length === 1 ? key.toUpperCase() : key;
      keys.push(formattedKey);
    }

    setCustomKeys(keys);
  }, [isCustomizing, isMac]);

  const handleKeyUp = useCallback((_e: KeyboardEvent) => {
    if (!isCustomizing || customKeys.length === 0) return;

    // Check if we have at least a modifier + key
    const modifiers = isMac ? ['Cmd', 'Ctrl', 'Shift', 'Option'] : ['Ctrl', 'Shift', 'Alt'];
    const hasModifier = customKeys.some(k => modifiers.includes(k));
    const hasKey = customKeys.some(k => !modifiers.includes(k));

    if (hasModifier && hasKey) {
      // Convert to Electron format
      const electronHotkey = customKeys
        .map(k => {
          if (k === 'Cmd' || k === 'Ctrl') return 'CommandOrControl';
          if (k === 'Option') return 'Alt';
          return k;
        })
        .join('+');

      setSelectedHotkey(electronHotkey);
      setIsCustomizing(false);
      setCustomKeys([]);
    }
  }, [isCustomizing, customKeys, isMac]);

  useEffect(() => {
    if (isCustomizing) {
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isCustomizing, handleKeyDown, handleKeyUp]);

  const handlePresetSelect = (value: string) => {
    setSelectedHotkey(value);
    setIsCustomizing(false);
  };

  const handleCustomize = () => {
    setIsCustomizing(true);
    setCustomKeys([]);
  };

  const handleCancel = () => {
    setIsCustomizing(false);
    setCustomKeys([]);
  };

  return (
    <div className="max-w-md w-full">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-white/50 hover:text-white mb-4 transition-colors"
      >
        <BackIcon />
        <span>Back</span>
      </button>

      {/* Title */}
      <h2 className="text-2xl font-bold text-white mb-2">
        Set your hotkey
      </h2>
      <p className="text-white/50 text-sm mb-4">
        Choose a keyboard shortcut to start dictation. Hold while speaking.
      </p>

      {/* Current selection */}
      <div className="mb-4">
        <div className={`bg-white/5 border rounded-xl p-4 text-center transition-colors ${
          isCustomizing ? 'border-white/40' : 'border-white/10'
        }`}>
          {isCustomizing ? (
            <div>
              <p className="text-white/60 text-sm mb-3">Press your desired key combination...</p>
              <div className="flex items-center justify-center gap-2 min-h-[40px]">
                {customKeys.length > 0 ? (
                  customKeys.map((key, i) => (
                    <span key={i}>
                      <kbd className="px-3 py-1.5 bg-white/10 rounded-lg text-white font-mono">
                        {key}
                      </kbd>
                      {i < customKeys.length - 1 && (
                        <span className="text-white/40 mx-1">+</span>
                      )}
                    </span>
                  ))
                ) : (
                  <span className="text-white/30 text-sm">Waiting for input...</span>
                )}
              </div>
              <button
                onClick={handleCancel}
                className="mt-3 text-white/50 hover:text-white text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div>
              <p className="text-white/60 mb-2 text-xs">Current shortcut</p>
              <kbd className="px-4 py-2 bg-white/10 rounded-lg text-white font-mono text-lg inline-block">
                {formatHotkeyDisplay(selectedHotkey)}
              </kbd>
            </div>
          )}
        </div>
      </div>

      {/* Preset options */}
      {!isCustomizing && (
        <div className="mb-4">
          <p className="text-white/40 text-xs mb-2">Quick options</p>
          <div className="space-y-1.5">
            {PRESET_HOTKEYS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => handlePresetSelect(preset.value)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                  selectedHotkey === preset.value
                    ? 'bg-white/10 border border-white/20'
                    : 'bg-white/5 border border-transparent hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    selectedHotkey === preset.value ? 'border-white bg-white' : 'border-white/30'
                  }`}>
                    {selectedHotkey === preset.value && (
                      <div className="w-1.5 h-1.5 rounded-full bg-black" />
                    )}
                  </div>
                  <span className="text-white text-sm font-medium">{preset.label}</span>
                </div>
                <span className="text-white/40 text-xs">{preset.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Custom option and Continue button in a row */}
      {!isCustomizing && (
        <div className="flex items-center gap-4 mt-4">
          <button
            onClick={handleCustomize}
            className="text-white/50 hover:text-white text-sm transition-colors whitespace-nowrap"
          >
            Custom shortcut...
          </button>
          <button
            onClick={() => onNext(selectedHotkey)}
            className="flex-1 px-6 py-3 bg-white text-black font-semibold rounded-xl hover:bg-white/90 transition-colors flex items-center justify-center gap-2"
          >
            Continue
            <ArrowIcon />
          </button>
        </div>
      )}
    </div>
  );
}

function BackIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}
