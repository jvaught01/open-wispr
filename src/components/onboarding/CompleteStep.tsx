import { useEffect, useState } from 'react';

interface CompleteStepProps {
  onComplete: () => void;
}

export function CompleteStep({ onComplete }: CompleteStepProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    // Trigger confetti animation after a short delay
    const timer = setTimeout(() => setShowConfetti(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="max-w-lg text-center relative">
      {/* Confetti effect */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full animate-confetti"
              style={{
                left: `${10 + Math.random() * 80}%`,
                backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'][i % 5],
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: `${1 + Math.random() * 1}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Success icon */}
      <div className="mb-8 flex justify-center">
        <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center animate-scale-in">
          <CheckIcon className="w-12 h-12 text-white" />
        </div>
      </div>

      {/* Title */}
      <h1 className="text-4xl font-bold text-white mb-4">
        You're all set!
      </h1>

      {/* Description */}
      <p className="text-white/60 text-lg mb-10 leading-relaxed">
        Open Wispr is ready to use. Hold your hotkey to start dictating anywhere
        on your computer.
      </p>

      {/* Tips */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-10 text-left">
        <h3 className="text-white font-semibold mb-4">Quick tips</h3>
        <ul className="space-y-3">
          <Tip
            icon={<KeyboardIcon />}
            text="Hold your hotkey while speaking, release to transcribe"
          />
          <Tip
            icon={<PillIcon />}
            text="Look for the dictation pill at the bottom of your screen"
          />
          <Tip
            icon={<SettingsIcon />}
            text="Customize settings anytime from the app or system tray"
          />
        </ul>
      </div>

      {/* CTA */}
      <button
        onClick={onComplete}
        className="px-10 py-4 bg-white text-black font-semibold rounded-xl text-lg hover:bg-white/90 transition-colors"
      >
        Start Dictating
      </button>

      {/* Add confetti animation styles */}
      <style>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(400px) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti 2s ease-out forwards;
        }
        @keyframes scale-in {
          0% {
            transform: scale(0);
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
          }
        }
        .animate-scale-in {
          animation: scale-in 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

function Tip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0 text-white/60">
        {icon}
      </div>
      <span className="text-white/70 text-sm pt-1">{text}</span>
    </li>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function KeyboardIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
  );
}

function PillIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
