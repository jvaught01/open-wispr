import { useState, useEffect, useRef } from 'react';

interface RecordingOverlayProps {
  hotkey: string;
}

// Waveform constants
const TAU = Math.PI * 2;
const WAVE_BASE_PHASE_STEP = 0.08;
const WAVE_PHASE_GAIN = 0.18;
const MIN_AMPLITUDE = 0.02;
const MAX_AMPLITUDE = 0.6;

const WAVE_CONFIG = [
  { frequency: 0.8, multiplier: 1.0, phaseOffset: 0, opacity: 1 },
  { frequency: 1.0, multiplier: 0.85, phaseOffset: 0.85, opacity: 0.78 },
  { frequency: 1.25, multiplier: 0.65, phaseOffset: 1.7, opacity: 0.56 },
];

// Pill dimensions
const COLLAPSED_WIDTH = 48;
const COLLAPSED_HEIGHT = 6;
const EXPANDED_WIDTH = 120;
const EXPANDED_HEIGHT = 32;

function formatHotkey(hotkey: string): string {
  const isMac = navigator.platform.toLowerCase().includes('mac');
  return hotkey
    .replace('CommandOrControl', isMac ? 'Cmd' : 'Ctrl')
    .replace('Command', 'Cmd')
    .replace('Control', 'Ctrl')
    .replace('Super', 'Win')
    .replace(/\+/g, ' + ');
}

function createWavePath(
  width: number,
  baseline: number,
  amplitude: number,
  frequency: number,
  phase: number
): string {
  const segments = Math.max(72, Math.floor(width / 2));
  let path = `M 0 ${baseline + amplitude * Math.sin(phase)}`;

  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const x = width * t;
    const theta = frequency * t * TAU + phase;
    const y = baseline + amplitude * Math.sin(theta);
    path += ` L ${x} ${y}`;
  }

  return path;
}

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

interface DictionaryEntry {
  id: string;
  original: string;
  corrected: string;
  caseSensitive: boolean;
  enabled: boolean;
  createdAt: number;
}

export function RecordingOverlay({ hotkey: initialHotkey }: RecordingOverlayProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hotkey, setHotkey] = useState(initialHotkey);
  const [pillVisibility, setPillVisibility] = useState<'always' | 'recording' | 'never'>('always');
  const settingsRef = useRef<Settings | null>(null);
  const dictionaryRef = useRef<DictionaryEntry[]>([]);

  // Listen for settings changes and load dictionary
  useEffect(() => {
    const loadSettings = async () => {
      const settings = await window.electron.getSettings();
      settingsRef.current = settings;
      setHotkey(settings.hotkey);
      setPillVisibility(settings.pillVisibility || 'always');
    };

    const loadDictionary = async () => {
      const dictionary = await window.electron.getDictionary();
      dictionaryRef.current = dictionary;
    };

    // Load on mount and periodically check for changes
    loadSettings();
    loadDictionary();
    const interval = setInterval(() => {
      loadSettings();
      loadDictionary();
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Determine if pill should be visible
  const shouldShowPill = () => {
    if (pillVisibility === 'never') return false;
    if (pillVisibility === 'recording') return isRecording || isProcessing;
    return true; // 'always'
  };

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef(false);

  // Audio analysis refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dataArrayRef = useRef<any>(null);

  // Waveform refs
  const waveRefs = useRef<(SVGPathElement | null)[]>([]);
  const animationRef = useRef<number>();
  const phaseRef = useRef(0);
  const currentLevelRef = useRef(0);
  const targetLevelRef = useRef(0);

  const displayHotkey = formatHotkey(hotkey);
  const isIdle = !isRecording && !isProcessing;
  const isExpanded = isHovered || isRecording || isProcessing;

  // Handle recording start/stop from main process
  useEffect(() => {
    window.electron.onRecordingStart(() => {
      if (!isRecordingRef.current) {
        startRecording();
      }
    });

    window.electron.onRecordingStop(() => {
      if (isRecordingRef.current && mediaRecorderRef.current) {
        stopRecording();
      }
    });
  }, []);

  // Waveform animation
  useEffect(() => {
    if (!isRecording && !isProcessing) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      // Reset to flat line
      const baseline = EXPANDED_HEIGHT / 2;
      const flatPath = `M 0 ${baseline} L ${EXPANDED_WIDTH} ${baseline}`;
      waveRefs.current.forEach((path) => {
        if (path) path.setAttribute('d', flatPath);
      });
      phaseRef.current = 0;
      currentLevelRef.current = 0;
      targetLevelRef.current = 0;
      return;
    }

    const animate = () => {
      // Get audio levels from analyser if recording
      if (isRecording && analyserRef.current && dataArrayRef.current) {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        const data = dataArrayRef.current;

        // Calculate average and peak levels
        let sum = 0;
        let peak = 0;
        for (let i = 0; i < data.length; i++) {
          const value = data[i] / 255;
          sum += value;
          if (value > peak) peak = value;
        }
        const average = sum / data.length;

        // Combine average and peak - weight average more for smoother response
        const combined = Math.min(1, average * 0.7 + peak * 0.3);
        // Apply gentler boost
        const boosted = Math.min(1, Math.pow(combined, 0.7) * 0.9);

        targetLevelRef.current = boosted;
      } else if (isProcessing) {
        // Gentle animation during processing
        targetLevelRef.current = 0.12;
      }

      // Smooth the level changes more aggressively
      const smoothing = 0.08;
      currentLevelRef.current += (targetLevelRef.current - currentLevelRef.current) * smoothing;

      // Faster decay for more natural feel
      targetLevelRef.current *= 0.85;

      if (currentLevelRef.current < 0.001) {
        currentLevelRef.current = 0;
      }

      const level = currentLevelRef.current;
      const advance = WAVE_BASE_PHASE_STEP + WAVE_PHASE_GAIN * level;
      phaseRef.current = (phaseRef.current + advance) % TAU;

      const baseline = EXPANDED_HEIGHT / 2;

      waveRefs.current.forEach((path, index) => {
        if (!path) return;
        const config = WAVE_CONFIG[index];
        const amplitudeFactor = Math.min(
          MAX_AMPLITUDE,
          Math.max(MIN_AMPLITUDE, level * config.multiplier)
        );
        const amplitude = Math.max(1, EXPANDED_HEIGHT * 0.75 * amplitudeFactor);
        const phase = phaseRef.current + config.phaseOffset;
        const pathD = createWavePath(EXPANDED_WIDTH, baseline, amplitude, config.frequency, phase);
        path.setAttribute('d', pathD);
        path.setAttribute('opacity', config.opacity.toString());
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRecording, isProcessing]);

  const startRecording = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      chunksRef.current = [];
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });

      streamRef.current = stream;

      // Set up audio analysis for waveform visualization
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsProcessing(true);
        setError(null);

        try {
          if (chunksRef.current.length === 0) {
            setError('No audio');
            throw new Error('No audio data collected');
          }

          const audioBlob = new Blob(chunksRef.current, { type: mimeType });

          if (audioBlob.size < 100) {
            setError('Too short');
            throw new Error('Audio too short');
          }

          const settings = await window.electron.getSettings();

          if (!settings.apiKey) {
            setError('No API key');
            throw new Error('No API key configured');
          }

          const { transcribeAudio } = await import('../services/groq');
          let text = await transcribeAudio(audioBlob, settings.apiKey);

          // Apply AI post-processing if enabled
          if (settings.aiPostProcessing && text && text.trim()) {
            try {
              const { postProcessTranscription } = await import('../services/postProcessing');
              text = await postProcessTranscription(text, settings.apiKey, {
                removeFillerWords: settings.removeFillerWords,
                removeFalseStarts: settings.removeFalseStarts,
                fixPunctuation: settings.fixPunctuation,
                fixCapitalization: true,
                fixGrammar: settings.fixGrammar,
                smartFormatting: false,
                dictionary: dictionaryRef.current,
              });
            } catch (e) {
              console.error('Post-processing error:', e);
              // Continue with original text if post-processing fails
            }
          }

          if (text && text.trim()) {
            const wordCount = text.trim().split(/\s+/).filter((w: string) => w.length > 0).length;
            if (wordCount > 0) {
              await window.electron.addWords(wordCount);

              // Save to history if not in incognito mode
              if (!settings.incognitoMode) {
                await window.electron.addToHistory({
                  id: Date.now().toString(),
                  text: text.trim(),
                  timestamp: Date.now(),
                  wordCount,
                });
              }
            }
            const pasteSuccess = await window.electron.typeText(text);
            if (!pasteSuccess) {
              console.warn('Paste may have failed - text is in clipboard');
            }
          } else {
            setError('Empty result');
          }
        } catch (err: any) {
          console.error('Transcription error:', err);
          setError(err.message?.slice(0, 15) || 'Error');
          setTimeout(() => setError(null), 3000);
        } finally {
          setIsProcessing(false);
          window.electron.recordingStopped();

          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }
          if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
          }
          analyserRef.current = null;
          dataArrayRef.current = null;
          mediaRecorderRef.current = null;
          chunksRef.current = [];
        }
      };

      mediaRecorder.start(100);
      isRecordingRef.current = true;
      setIsRecording(true);
    } catch (err) {
      console.error('Recording error:', err);
      setError('Mic error');
      setTimeout(() => setError(null), 3000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      isRecordingRef.current = false;
      setIsRecording(false);

      // Stop analyzing audio (cleanup happens in onstop handler)
      analyserRef.current = null;
      dataArrayRef.current = null;
    }
  };

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else if (!isProcessing) {
      startRecording();
    }
  };

  // Don't render if pill should be hidden
  if (!shouldShowPill()) {
    return null;
  }

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-end pb-1"
      style={{ background: 'transparent' }}
    >
      {/* Tooltip - shows on hover when idle */}
      <div
        className={`mb-2 transition-all duration-150 ${
          isHovered && isIdle ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
        }`}
        style={{ pointerEvents: 'none' }}
      >
        <div className="bg-black border border-white/20 rounded-lg px-3 py-1.5">
          <span className="text-white text-xs font-semibold whitespace-nowrap flex items-center gap-1.5">
            Hold{' '}
            <kbd className="px-1.5 py-0.5 bg-white/10 border border-white/20 rounded text-[10px] font-mono">
              {displayHotkey}
            </kbd>{' '}
            to dictate
          </span>
        </div>
      </div>

      {/* Pill */}
      <div
        onMouseEnter={() => {
          setIsHovered(true);
          // Capture mouse events when hovering the pill
          window.electron.setIgnoreMouseEvents(false);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          // Allow clicks to pass through when not on the pill
          window.electron.setIgnoreMouseEvents(true);
        }}
        onClick={handleClick}
        className="cursor-pointer transition-all duration-200 flex items-center justify-center overflow-hidden"
        style={{
          width: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
          height: isExpanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT,
          borderRadius: isExpanded ? 12 : 6,
          backgroundColor: isExpanded ? 'rgba(0, 0, 0, 0.95)' : 'rgba(0, 0, 0, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        }}
      >
        {/* Inner content */}
        <div
          className={`relative flex items-center justify-center transition-opacity duration-150 ${
            isExpanded ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ width: EXPANDED_WIDTH - 8, height: '100%' }}
        >
          {/* Error state */}
          {error && (
            <span className="absolute text-red-400 text-xs font-medium">{error}</span>
          )}

          {/* Click to dictate text */}
          {!error && (
            <span
              className={`absolute text-white/40 text-[11px] font-medium tracking-wide whitespace-nowrap transition-opacity duration-150 ${
                isIdle && isHovered ? 'opacity-100' : 'opacity-0'
              }`}
            >
              Click to dictate
            </span>
          )}

          {/* Processing indicator */}
          {!error && (
            <div
              className={`absolute w-full h-full flex items-center justify-center transition-opacity duration-150 ${
                isProcessing ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <div className="w-full h-0.5 bg-white/20 rounded overflow-hidden">
                <div
                  className="h-full bg-white/80 rounded"
                  style={{
                    width: '40%',
                    animation: 'shimmer 1.5s ease-in-out infinite',
                  }}
                />
              </div>
            </div>
          )}

          {/* Waveform */}
          {!error && (
            <div
              className={`absolute inset-0 transition-opacity duration-150 ${
                isRecording ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${EXPANDED_WIDTH} ${EXPANDED_HEIGHT}`}
                preserveAspectRatio="none"
              >
                {WAVE_CONFIG.map((config, index) => (
                  <path
                    key={config.frequency}
                    ref={(node) => {
                      waveRefs.current[index] = node;
                    }}
                    fill="none"
                    stroke="white"
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={config.opacity}
                  />
                ))}
              </svg>
            </div>
          )}

          {/* Gradient overlay for waveform edges */}
          {!error && (
            <div
              className={`absolute inset-0 pointer-events-none transition-opacity duration-150 ${
                !isIdle ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                background:
                  'linear-gradient(90deg, rgba(0,0,0,0.95) 0%, transparent 15%, transparent 85%, rgba(0,0,0,0.95) 100%)',
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
