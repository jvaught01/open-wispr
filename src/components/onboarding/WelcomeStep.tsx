interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <div className="max-w-lg text-center">
      {/* Logo */}
      <div className="mb-8 flex justify-center">
        <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center">
          <svg className="w-14 h-14 text-black" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </div>
      </div>

      {/* Title */}
      <h1 className="text-4xl font-bold text-white mb-2">
        Open Wispr
      </h1>

      {/* Tagline */}
      <p className="text-white/70 text-xl mb-8">
        Type at the speed of your voice
      </p>

      {/* Features */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <Feature
          icon={<SpeedIcon />}
          title="Fast"
          description="Real-time transcription"
        />
        <Feature
          icon={<AccuracyIcon />}
          title="Accurate"
          description="AI-powered cleaning"
        />
        <Feature
          icon={<PrivacyIcon />}
          title="Private"
          description="Your data stays yours"
        />
      </div>

      {/* CTA */}
      <button
        onClick={onNext}
        className="px-8 py-4 bg-white text-black font-semibold rounded-xl text-lg hover:bg-white/90 transition-colors"
      >
        Get Started
      </button>
    </div>
  );
}

function Feature({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 mx-auto mb-3 bg-white/10 rounded-xl flex items-center justify-center text-white/80">
        {icon}
      </div>
      <h3 className="text-white font-semibold mb-1">{title}</h3>
      <p className="text-white/40 text-sm">{description}</p>
    </div>
  );
}

function SpeedIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function AccuracyIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function PrivacyIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}
