import { useState } from 'react';

interface ApiKeyStepProps {
  onNext: (apiKey: string) => void;
  onBack: () => void;
  initialValue: string;
}

export function ApiKeyStep({ onNext, onBack, initialValue }: ApiKeyStepProps) {
  const [apiKey, setApiKey] = useState(initialValue);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');

  const isValidFormat = apiKey.startsWith('gsk_') && apiKey.length > 20;

  const handleSubmit = async () => {
    if (!isValidFormat) {
      setError('Please enter a valid Groq API key (starts with gsk_)');
      return;
    }

    setIsValidating(true);
    setError('');

    try {
      // Test the API key by making a simple request
      const Groq = (await import('groq-sdk')).default;
      const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true });

      await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      });

      onNext(apiKey);
    } catch (err: any) {
      console.error('API key validation error:', err);
      if (err.message?.includes('401') || err.message?.includes('Invalid')) {
        setError('Invalid API key. Please check and try again.');
      } else {
        setError('Could not validate API key. Please try again.');
      }
    } finally {
      setIsValidating(false);
    }
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
        Connect your API key
      </h2>
      <p className="text-white/50 mb-8">
        Open Wispr uses Groq for fast, accurate transcription.
        Your API key is stored locally on your device.
      </p>

      {/* API Key input */}
      <div className="mb-6">
        <label className="block text-white/70 text-sm font-medium mb-2">
          Groq API Key
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value);
            setError('');
          }}
          placeholder="gsk_..."
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition-colors"
        />
        {error && (
          <p className="text-red-400 text-sm mt-2">{error}</p>
        )}
      </div>

      {/* Help link */}
      <div className="mb-8">
        <a
          href="https://console.groq.com/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/50 hover:text-white text-sm flex items-center gap-1 transition-colors"
        >
          Get a free API key from Groq
          <ExternalLinkIcon />
        </a>
      </div>

      {/* Continue button */}
      <button
        onClick={handleSubmit}
        disabled={!apiKey || isValidating}
        className="w-full px-6 py-4 bg-white text-black font-semibold rounded-xl hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isValidating ? (
          <>
            <LoadingSpinner />
            Validating...
          </>
        ) : (
          <>
            Continue
            <ArrowIcon />
          </>
        )}
      </button>
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

function ExternalLinkIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
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
