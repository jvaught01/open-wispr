import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Modal } from './Modal';

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
}

interface SettingsPanelProps {
  onSettingsChange: () => void;
}

export function SettingsPanel({ onSettingsChange }: SettingsPanelProps) {
  const [settings, setSettings] = useState<Settings>({
    apiKey: '',
    whisperModel: 'whisper-large-v3-turbo',
    hotkey: 'CommandOrControl+Shift+Space',
    outputMode: 'type',
    autoLaunch: false,
    showPill: true,
    pillVisibility: 'always',
    language: 'en',
    aiPostProcessing: false,
    removeFillerWords: true,
    removeFalseStarts: true,
    fixPunctuation: true,
    fixGrammar: false,
    preferredMicrophone: 'default',
    incognitoMode: false,
    autoUpdate: true,
  });

  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [testingKey, setTestingKey] = useState(false);
  const [keyValid, setKeyValid] = useState<boolean | null>(null);

  // Hotkey capture state
  const [isCapturingHotkey, setIsCapturingHotkey] = useState(false);
  const [capturedKeys, setCapturedKeys] = useState<string[]>([]);

  // Microphone test state
  const [isMicTesting, setIsMicTesting] = useState(false);
  const [micTestAudioUrl, setMicTestAudioUrl] = useState<string | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micRecorderRef = useRef<MediaRecorder | null>(null);
  const micChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    window.electron.getSettings().then((s) => {
      setSettings(s as Settings);
    });
    loadMicrophones();
  }, []);

  const loadMicrophones = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter((d) => d.kind === 'audioinput');
      setMicrophones(mics);
    } catch (err) {
      console.error('Error loading microphones:', err);
    }
  };

  const saveSettings = async (newSettings: Partial<Settings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    await window.electron.saveSettings(newSettings);
    onSettingsChange();
  };

  const handleTestApiKey = async () => {
    setTestingKey(true);
    setKeyValid(null);
    try {
      const valid = await window.electron.testApiKey(settings.apiKey);
      setKeyValid(valid);
    } catch {
      setKeyValid(false);
    } finally {
      setTestingKey(false);
    }
  };

  const handleClearData = async () => {
    if (confirm('Are you sure? This will delete all settings and history.')) {
      await window.electron.clearAllData();
      window.location.reload();
    }
  };

  // Hotkey capture handlers
  const formatHotkeyDisplay = (hotkey: string): string => {
    return hotkey
      .replace('CommandOrControl', 'Ctrl')
      .replace('Command', 'Cmd')
      .replace('Control', 'Ctrl')
      .replace('Super', 'Win')
      .replace('Meta', 'Win')
      .replace(/\+/g, ' + ');
  };

  const saveHotkeyTimeout = useRef<NodeJS.Timeout | null>(null);

  const saveHotkey = useCallback(async (keys: string[]) => {
    if (keys.length === 0) return;
    const hotkey = keys.join('+');
    console.log('Saving hotkey:', hotkey);
    const updated = { ...settings, hotkey };
    setSettings(updated);
    await window.electron.saveSettings({ hotkey });
    onSettingsChange();
    setIsCapturingHotkey(false);
    setCapturedKeys([]);
  }, [settings, onSettingsChange]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isCapturingHotkey) return;
    e.preventDefault();
    e.stopPropagation();

    // Clear any pending save
    if (saveHotkeyTimeout.current) {
      clearTimeout(saveHotkeyTimeout.current);
    }

    const keys: string[] = [];

    // Detect modifiers - check the actual key being pressed too
    const key = e.key;
    const code = e.code;

    // Windows/Meta key
    if (e.metaKey || key === 'Meta' || key === 'OS' || code === 'MetaLeft' || code === 'MetaRight') {
      if (!keys.includes('Super')) keys.push('Super');
    }
    // Ctrl key
    if (e.ctrlKey || key === 'Control' || code === 'ControlLeft' || code === 'ControlRight') {
      if (!keys.includes('Control')) keys.push('Control');
    }
    // Shift key
    if (e.shiftKey || key === 'Shift' || code === 'ShiftLeft' || code === 'ShiftRight') {
      if (!keys.includes('Shift')) keys.push('Shift');
    }
    // Alt key
    if (e.altKey || key === 'Alt' || code === 'AltLeft' || code === 'AltRight') {
      if (!keys.includes('Alt')) keys.push('Alt');
    }

    // Add non-modifier key
    const isModifierKey = ['Control', 'Shift', 'Alt', 'Meta', 'OS'].includes(key);
    if (!isModifierKey) {
      const finalKey = key.length === 1 ? key.toUpperCase() : key;
      keys.push(finalKey);
    }

    console.log('Keys detected:', keys, 'key:', key, 'code:', code);
    setCapturedKeys([...keys]);
  }, [isCapturingHotkey]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (!isCapturingHotkey) return;
    e.preventDefault();

    // When a key is released, wait a short moment then save
    // This allows capturing multi-key combinations
    if (saveHotkeyTimeout.current) {
      clearTimeout(saveHotkeyTimeout.current);
    }

    saveHotkeyTimeout.current = setTimeout(() => {
      if (capturedKeys.length > 0) {
        saveHotkey(capturedKeys);
      }
    }, 300);
  }, [isCapturingHotkey, capturedKeys, saveHotkey]);

  useEffect(() => {
    if (isCapturingHotkey) {
      window.addEventListener('keydown', handleKeyDown, true);
      window.addEventListener('keyup', handleKeyUp, true);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      if (saveHotkeyTimeout.current) {
        clearTimeout(saveHotkeyTimeout.current);
      }
    };
  }, [isCapturingHotkey, handleKeyDown, handleKeyUp]);

  // Microphone test handlers
  const startMicTest = async () => {
    try {
      // Clean up any previous test
      stopMicTest();

      const deviceId = settings.preferredMicrophone === 'default'
        ? undefined
        : settings.preferredMicrophone;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      });

      micStreamRef.current = stream;

      // Set up audio analysis
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Set up recording
      const mediaRecorder = new MediaRecorder(stream);
      micRecorderRef.current = mediaRecorder;
      micChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          micChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(micChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setMicTestAudioUrl(url);
      };

      mediaRecorder.start();
      setIsMicTesting(true);

      // Start level monitoring
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length / 255;
        setMicLevel(avg);

        if (isMicTesting) {
          animationRef.current = requestAnimationFrame(updateLevel);
        }
      };
      updateLevel();

    } catch (err) {
      console.error('Mic test error:', err);
    }
  };

  const stopMicTest = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (micRecorderRef.current && micRecorderRef.current.state === 'recording') {
      micRecorderRef.current.stop();
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setIsMicTesting(false);
    setMicLevel(0);
  };

  const playMicTest = () => {
    if (micTestAudioUrl) {
      const audio = new Audio(micTestAudioUrl);
      audio.play();
    }
  };

  return (
    <div className="p-10 pb-28">
      <div className="max-w-xl">
        <h1 className="text-3xl font-extrabold text-white mb-10 tracking-tight">Settings</h1>

        {/* General */}
        <Section title="General">
          <SettingsRow
            icon={<RocketIcon />}
            label="Start on system startup"
            onClick={() => saveSettings({ autoLaunch: !settings.autoLaunch })}
          >
            <Toggle checked={settings.autoLaunch} onChange={(v) => saveSettings({ autoLaunch: v })} />
          </SettingsRow>

          <SettingsRow
            icon={<MicIcon />}
            label="Microphone"
            description="Select input device"
            onClick={() => setActiveModal('microphone')}
            hasArrow
          />

          <SettingsRow
            icon={<SpeakerIcon />}
            label="Audio"
            description="Output settings"
            onClick={() => setActiveModal('audio')}
            hasArrow
          />

          <SettingsRow
            icon={<KeyboardIcon />}
            label="Hotkey shortcuts"
            description="Customize keyboard shortcuts"
            onClick={() => setActiveModal('hotkey')}
            hasArrow
          />

          <SettingsRow
            icon={<DotsIcon />}
            label="More settings"
            description="Additional options"
            onClick={() => setActiveModal('more')}
            hasArrow
          />
        </Section>

        {/* Processing */}
        <Section title="Processing">
          <SettingsRow
            icon={<BrainIcon />}
            label="AI transcription"
            description="Configure transcription API"
            onClick={() => setActiveModal('transcription')}
            hasArrow
          />

          <SettingsRow
            icon={<SparklesIcon />}
            label="AI post-processing"
            onClick={() => saveSettings({ aiPostProcessing: !settings.aiPostProcessing })}
          >
            <Toggle
              checked={settings.aiPostProcessing}
              onChange={(v) => saveSettings({ aiPostProcessing: v })}
            />
          </SettingsRow>

          {settings.aiPostProcessing && (
            <div className="ml-8 space-y-1 py-2 border-b border-white/5">
              <SubToggle
                label="Remove filler words"
                checked={settings.removeFillerWords}
                onChange={(v) => saveSettings({ removeFillerWords: v })}
              />
              <SubToggle
                label="Fix false starts"
                checked={settings.removeFalseStarts}
                onChange={(v) => saveSettings({ removeFalseStarts: v })}
              />
              <SubToggle
                label="Add punctuation"
                checked={settings.fixPunctuation}
                onChange={(v) => saveSettings({ fixPunctuation: v })}
              />
              <SubToggle
                label="Fix grammar"
                checked={settings.fixGrammar}
                onChange={(v) => saveSettings({ fixGrammar: v })}
              />
            </div>
          )}

          <SettingsRow icon={<GlobeIcon />} label="Language">
            <select
              value={settings.language}
              onChange={(e) => saveSettings({ language: e.target.value })}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 cursor-pointer"
            >
              <option value="en" className="bg-black">English</option>
              <option value="es" className="bg-black">Spanish</option>
              <option value="fr" className="bg-black">French</option>
              <option value="de" className="bg-black">German</option>
              <option value="it" className="bg-black">Italian</option>
              <option value="pt" className="bg-black">Portuguese</option>
              <option value="zh" className="bg-black">Chinese</option>
              <option value="ja" className="bg-black">Japanese</option>
              <option value="ko" className="bg-black">Korean</option>
              <option value="auto" className="bg-black">Auto-detect</option>
            </select>
          </SettingsRow>
        </Section>

        {/* Links */}
        <Section title="About">
          <SettingsRow
            icon={<DocIcon />}
            label="Terms & conditions"
            onClick={() => window.open('https://github.com/open-wispr/terms', '_blank')}
            hasArrow
          />
          <SettingsRow
            icon={<ShieldIcon />}
            label="Privacy policy"
            onClick={() => window.open('https://github.com/open-wispr/privacy', '_blank')}
            hasArrow
          />
        </Section>

        {/* Danger Zone */}
        <Section title="Danger zone" danger>
          <SettingsRow
            icon={<TrashIcon />}
            label="Clear local data"
            description="Delete all settings and history"
            danger
            onClick={handleClearData}
            hasArrow
          />
        </Section>

        <div className="text-center text-white/30 text-xs mt-10">Open-Wispr v1.0.0</div>
      </div>

      {/* Microphone Modal */}
      <Modal
        isOpen={activeModal === 'microphone'}
        onClose={() => {
          stopMicTest();
          setActiveModal(null);
        }}
        title="Microphone settings"
        footer={
          <>
            <button
              onClick={() => setActiveModal(null)}
              className="px-4 py-2 text-sm font-semibold text-white/60 hover:text-white transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => setActiveModal(null)}
              className="px-4 py-2 text-sm font-semibold bg-white text-black rounded-lg hover:bg-white/90 transition-colors"
            >
              Save changes
            </button>
          </>
        }
      >
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-white mb-1">Preferred microphone</h3>
            <p className="text-sm text-white/40 mb-3">
              Choose which microphone to use when recording. Automatic picks the best available device.
            </p>
            <select
              value={settings.preferredMicrophone}
              onChange={(e) => saveSettings({ preferredMicrophone: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-3 text-sm text-white focus:outline-none focus:border-white/30 cursor-pointer"
            >
              <option value="default" className="bg-black">Automatic (Recommended)</option>
              {microphones.map((mic) => (
                <option key={mic.deviceId} value={mic.deviceId} className="bg-black">
                  {mic.label || `Microphone ${mic.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
            <button
              onClick={loadMicrophones}
              className="mt-2 text-sm text-white/50 hover:text-white transition-colors"
            >
              Refresh devices
            </button>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-1">Test your microphone</h3>
            <p className="text-sm text-white/40 mb-3">
              Start a short test to see live audio levels and play back what was recorded.
            </p>
            {/* Audio level waveform */}
            <div className="h-12 bg-white/5 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
              {isMicTesting ? (
                <div className="flex items-center gap-0.5 h-full px-2">
                  {Array.from({ length: 32 }).map((_, i) => {
                    const height = Math.max(4, Math.min(40, micLevel * 100 * Math.sin((i / 32) * Math.PI) * (0.5 + Math.random() * 0.5)));
                    return (
                      <div
                        key={i}
                        className="w-1 bg-white rounded-full transition-all duration-75"
                        style={{ height: `${height}px` }}
                      />
                    );
                  })}
                </div>
              ) : (
                <span className="text-white/30 text-sm">Press Record to test</span>
              )}
            </div>
            <div className="flex gap-2">
              {!isMicTesting ? (
                <button
                  onClick={startMicTest}
                  className="px-4 py-2 text-sm font-semibold bg-white text-black rounded-lg hover:bg-white/90 transition-colors"
                >
                  Record
                </button>
              ) : (
                <button
                  onClick={stopMicTest}
                  className="px-4 py-2 text-sm font-semibold bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  Stop
                </button>
              )}
              <button
                onClick={playMicTest}
                disabled={!micTestAudioUrl}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  micTestAudioUrl
                    ? 'bg-white/10 text-white hover:bg-white/20'
                    : 'bg-white/5 text-white/30 cursor-not-allowed'
                }`}
              >
                Play
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Audio Modal */}
      <Modal
        isOpen={activeModal === 'audio'}
        onClose={() => setActiveModal(null)}
        title="Audio settings"
        footer={
          <button
            onClick={() => setActiveModal(null)}
            className="px-4 py-2 text-sm font-semibold text-white/60 hover:text-white transition-colors"
          >
            Close
          </button>
        }
      >
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white mb-1">Output mode</h3>
            <p className="text-sm text-white/40 mb-3">How transcribed text is delivered</p>
            <div className="flex gap-2">
              <button
                onClick={() => saveSettings({ outputMode: 'type' })}
                className={`flex-1 px-4 py-3 text-sm font-semibold rounded-lg transition-colors ${
                  settings.outputMode === 'type'
                    ? 'bg-white text-black'
                    : 'bg-white/5 text-white/60 hover:text-white'
                }`}
              >
                Type at cursor
              </button>
              <button
                onClick={() => saveSettings({ outputMode: 'clipboard' })}
                className={`flex-1 px-4 py-3 text-sm font-semibold rounded-lg transition-colors ${
                  settings.outputMode === 'clipboard'
                    ? 'bg-white text-black'
                    : 'bg-white/5 text-white/60 hover:text-white'
                }`}
              >
                Copy to clipboard
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Hotkey Modal */}
      <Modal
        isOpen={activeModal === 'hotkey'}
        onClose={() => {
          setActiveModal(null);
          setIsCapturingHotkey(false);
          setCapturedKeys([]);
        }}
        title="Keyboard shortcuts"
        footer={
          <button
            onClick={() => {
              setActiveModal(null);
              setIsCapturingHotkey(false);
              setCapturedKeys([]);
            }}
            className="px-4 py-2 text-sm font-semibold text-white/60 hover:text-white transition-colors"
          >
            Close
          </button>
        }
      >
        <div className="space-y-6">
          <p className="text-sm text-white/50">
            Customize your keyboard shortcuts. Keyboard shortcuts can be triggered from within any app.
          </p>

          <div className="space-y-4">
            <div className="py-3 border-b border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">Start/stop dictating</h3>
                  <p className="text-xs text-white/40">Start recording audio and transcribe your speech</p>
                </div>
              </div>

              {/* Preset hotkeys dropdown */}
              <div className="mb-3">
                <label className="block text-xs text-white/40 mb-2">Choose a preset</label>
                <select
                  value={
                    ['CommandOrControl+Shift+Space', 'CommandOrControl+Shift+V', 'Alt+Space', 'F9', 'Super+Shift+Space', 'Super+Space'].includes(settings.hotkey)
                      ? settings.hotkey
                      : 'custom'
                  }
                  onChange={(e) => {
                    if (e.target.value !== 'custom') {
                      saveSettings({ hotkey: e.target.value });
                    }
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-3 text-sm text-white focus:outline-none focus:border-white/30 cursor-pointer"
                >
                  <option value="CommandOrControl+Shift+Space" className="bg-black">Ctrl + Shift + Space</option>
                  <option value="CommandOrControl+Shift+V" className="bg-black">Ctrl + Shift + V</option>
                  <option value="Alt+Space" className="bg-black">Alt + Space</option>
                  <option value="Super+Shift+Space" className="bg-black">Win + Shift + Space</option>
                  <option value="Super+Space" className="bg-black">Win + Space</option>
                  <option value="F9" className="bg-black">F9</option>
                  <option value="custom" className="bg-black">Custom...</option>
                </select>
              </div>

              {/* Custom hotkey capture */}
              <div>
                <label className="block text-xs text-white/40 mb-2">Or set a custom hotkey</label>
                <button
                  onClick={() => {
                    setIsCapturingHotkey(!isCapturingHotkey);
                    setCapturedKeys([]);
                  }}
                  className={`w-full px-4 py-3 text-sm font-mono rounded-lg border transition-all ${
                    isCapturingHotkey
                      ? 'bg-white/10 border-white/40 text-white animate-pulse'
                      : 'bg-white/5 border-white/10 text-white hover:border-white/20'
                  }`}
                >
                  {isCapturingHotkey
                    ? capturedKeys.length > 0
                      ? capturedKeys.map(k =>
                          k.replace('CommandOrControl', 'Ctrl')
                           .replace('Control', 'Ctrl')
                           .replace('Super', 'Win')
                        ).join(' + ')
                      : 'Press keys...'
                    : formatHotkeyDisplay(settings.hotkey)
                  }
                </button>
                {isCapturingHotkey && (
                  <p className="text-xs text-white/40 mt-2">
                    Press your desired key combination, then release to save
                  </p>
                )}
              </div>

              {/* Current hotkey display */}
              <div className="mt-4 p-3 bg-white/5 rounded-lg">
                <p className="text-xs text-white/40">Current hotkey:</p>
                <p className="text-sm font-mono text-white">{formatHotkeyDisplay(settings.hotkey)}</p>
                <p className="text-xs text-white/30 mt-1">Raw: {settings.hotkey}</p>
              </div>

              {/* Note about Windows key */}
              <p className="text-xs text-white/30 mt-3">
                Note: Some Windows key combinations (like Win+Space) are reserved by the system.
                If a hotkey doesn't work, try a different combination.
              </p>
            </div>
          </div>
        </div>
      </Modal>

      {/* More Settings Modal */}
      <Modal
        isOpen={activeModal === 'more'}
        onClose={() => setActiveModal(null)}
        title="More settings"
        footer={
          <button
            onClick={() => setActiveModal(null)}
            className="px-4 py-2 text-sm font-semibold text-white/60 hover:text-white transition-colors"
          >
            Close
          </button>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Incognito mode</h3>
              <p className="text-xs text-white/40">Don't save transcription history or audio</p>
            </div>
            <Toggle
              checked={settings.incognitoMode}
              onChange={(v) => saveSettings({ incognitoMode: v })}
            />
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Automatically show updates</h3>
              <p className="text-xs text-white/40">Open the update window when a new version is available</p>
            </div>
            <Toggle checked={settings.autoUpdate} onChange={(v) => saveSettings({ autoUpdate: v })} />
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Dictation pill visibility</h3>
              <p className="text-xs text-white/40">Control when the dictation pill is shown</p>
            </div>
            <select
              value={settings.pillVisibility}
              onChange={(e) => saveSettings({ pillVisibility: e.target.value as any })}
              className="bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 cursor-pointer"
            >
              <option value="always" className="bg-black">Always</option>
              <option value="recording" className="bg-black">While recording</option>
              <option value="never" className="bg-black">Never</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* AI Transcription Modal */}
      <Modal
        isOpen={activeModal === 'transcription'}
        onClose={() => setActiveModal(null)}
        title="AI transcription"
        footer={
          <button
            onClick={() => setActiveModal(null)}
            className="px-4 py-2 text-sm font-semibold text-white/60 hover:text-white transition-colors"
          >
            Done
          </button>
        }
      >
        <div className="space-y-6">
          <p className="text-sm text-white/50">
            Configure how Open-Wispr transcribes your recordings using the Groq API.
          </p>

          <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">groq</h3>
                <p className="text-xs text-white/40">GROQ</p>
                {settings.apiKey && (
                  <p className="text-xs text-white/30 mt-1">
                    Ends with {settings.apiKey.slice(-4)}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleTestApiKey}
                  disabled={testingKey || !settings.apiKey}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                    keyValid === true
                      ? 'bg-green-500/20 text-green-400'
                      : keyValid === false
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {testingKey ? 'Testing...' : keyValid === true ? 'Valid' : keyValid === false ? 'Invalid' : 'Test'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-white/40 mb-1">API Key</label>
              <input
                type="password"
                value={settings.apiKey}
                onChange={(e) => {
                  setSettings({ ...settings, apiKey: e.target.value });
                  setKeyValid(null);
                }}
                onBlur={() => saveSettings({ apiKey: settings.apiKey })}
                placeholder="gsk_..."
                className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-white/30 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-white/40 mb-1">Model</label>
              <select
                value={settings.whisperModel}
                onChange={(e) => saveSettings({ whisperModel: e.target.value })}
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 cursor-pointer"
              >
                <option value="whisper-large-v3-turbo" className="bg-black">whisper-large-v3-turbo</option>
                <option value="whisper-large-v3" className="bg-black">whisper-large-v3</option>
                <option value="distil-whisper-large-v3-en" className="bg-black">distil-whisper-large-v3-en</option>
              </select>
            </div>
          </div>

          <p className="text-sm text-white/40">
            Get your free API key at{' '}
            <a
              href="https://console.groq.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white underline"
            >
              console.groq.com
            </a>
          </p>
        </div>
      </Modal>
    </div>
  );
}

// Components

function Section({ title, children, danger = false }: { title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <div className="mb-8">
      <h2 className={`text-xs font-bold uppercase tracking-wider mb-3 ${danger ? 'text-red-400/60' : 'text-white/40'}`}>
        {title}
      </h2>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function SettingsRow({
  icon,
  label,
  description,
  children,
  onClick,
  hasArrow,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  children?: React.ReactNode;
  onClick?: () => void;
  hasArrow?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-colors ${
        onClick ? 'cursor-pointer hover:bg-white/5' : ''
      }`}
    >
      <div className={`w-5 h-5 ${danger ? 'text-red-400/60' : 'text-white/40'}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-semibold ${danger ? 'text-red-400/80' : 'text-white'}`}>{label}</div>
        {description && <div className="text-xs text-white/40">{description}</div>}
      </div>
      {children}
      {hasArrow && (
        <svg className="w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      )}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-white' : 'bg-white/20'}`}
    >
      <div
        className={`absolute top-1 w-4 h-4 rounded-full transition-all ${
          checked ? 'left-6 bg-black' : 'left-1 bg-white/60'
        }`}
      />
    </button>
  );
}

function SubToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2 pl-5">
      <span className="text-sm text-white/60">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-white' : 'bg-white/20'}`}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
            checked ? 'left-4 bg-black' : 'left-0.5 bg-white/60'
          }`}
        />
      </button>
    </div>
  );
}

// Icons
function RocketIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
    </svg>
  );
}

function KeyboardIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h17.25c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125H3.375A1.125 1.125 0 012.25 16.875v-9.75zM8.25 12h.008v.008H8.25V12zm0 3h.008v.008H8.25V15zm0-6h.008v.008H8.25V9zm3 6h.008v.008h-.008V15zm0-6h.008v.008h-.008V9zm3 6h.008v.008h-.008V15zm0-6h.008v.008h-.008V9zm3 0h.008v.008h-.008V9z" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}
