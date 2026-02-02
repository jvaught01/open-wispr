import { useState, useEffect, useRef } from 'react';

interface MicrophoneStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function MicrophoneStep({ onNext, onBack }: MicrophoneStepProps) {
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'testing'>('prompt');
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState('');

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const requestPermission = async () => {
    setPermissionState('testing');
    setError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      streamRef.current = stream;

      // Set up audio analysis for visualization
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      setPermissionState('granted');

      // Start visualizing audio levels
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length / 255;
        setAudioLevel(Math.min(1, average * 3)); // Boost for visibility

        animationRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err: any) {
      console.error('Microphone permission error:', err);
      setPermissionState('denied');

      if (err.name === 'NotAllowedError') {
        setError('Microphone access was denied. Please enable it in your system settings.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone and try again.');
      } else {
        setError('Could not access microphone. Please try again.');
      }
    }
  };

  const handleContinue = () => {
    // Stop the stream before continuing
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    onNext();
  };

  return (
    <div className="max-w-md w-full">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-white/50 hover:text-white mb-8 transition-colors"
      >
        <BackIcon />
        <span>Back</span>
      </button>

      {/* Title */}
      <h2 className="text-3xl font-bold text-white mb-3">
        Enable microphone access
      </h2>
      <p className="text-white/50 mb-8">
        Open Wispr needs microphone access to transcribe your voice.
        We only listen when you activate dictation.
      </p>

      {/* Microphone visualization */}
      <div className="mb-8">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 flex flex-col items-center">
          {/* Mic icon with level indicator */}
          <div className="relative mb-6">
            <div
              className="absolute inset-0 bg-white/20 rounded-full transition-transform duration-75"
              style={{
                transform: `scale(${1 + audioLevel * 0.5})`,
                opacity: audioLevel > 0.1 ? 1 : 0,
              }}
            />
            <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-colors ${
              permissionState === 'granted' ? 'bg-green-500' :
              permissionState === 'denied' ? 'bg-red-500' :
              'bg-white/10'
            }`}>
              <MicIcon className={`w-10 h-10 ${
                permissionState === 'granted' || permissionState === 'denied' ? 'text-white' : 'text-white/60'
              }`} />
            </div>
          </div>

          {/* Status text */}
          {permissionState === 'prompt' && (
            <p className="text-white/60 text-center">
              Click the button below to grant microphone access
            </p>
          )}
          {permissionState === 'testing' && (
            <p className="text-white/60 text-center">
              Requesting microphone access...
            </p>
          )}
          {permissionState === 'granted' && (
            <div className="text-center">
              <p className="text-green-400 font-medium mb-2">
                Microphone connected!
              </p>
              <p className="text-white/40 text-sm">
                {audioLevel > 0.1 ? 'We can hear you!' : 'Try speaking to test your microphone'}
              </p>
            </div>
          )}
          {permissionState === 'denied' && (
            <p className="text-red-400 text-center">
              {error}
            </p>
          )}

          {/* Audio level bars */}
          {permissionState === 'granted' && (
            <div className="flex items-end gap-1 h-8 mt-4">
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="w-2 bg-white/20 rounded-full transition-all duration-75"
                  style={{
                    height: `${Math.max(4, Math.min(32, audioLevel * 32 * (1 + Math.sin(i * 0.5) * 0.3)))}px`,
                    backgroundColor: audioLevel > 0.1 ? `rgba(34, 197, 94, ${0.4 + audioLevel * 0.6})` : undefined,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action button */}
      {permissionState === 'granted' ? (
        <button
          onClick={handleContinue}
          className="w-full px-6 py-4 bg-white text-black font-semibold rounded-xl hover:bg-white/90 transition-colors flex items-center justify-center gap-2"
        >
          Continue
          <ArrowIcon />
        </button>
      ) : (
        <button
          onClick={requestPermission}
          disabled={permissionState === 'testing'}
          className="w-full px-6 py-4 bg-white text-black font-semibold rounded-xl hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {permissionState === 'testing' ? (
            <>
              <LoadingSpinner />
              Requesting access...
            </>
          ) : permissionState === 'denied' ? (
            'Try Again'
          ) : (
            'Enable Microphone'
          )}
        </button>
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

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}
