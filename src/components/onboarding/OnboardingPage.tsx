import { useState } from 'react';
import { WelcomeStep } from './WelcomeStep';
import { ApiKeyStep } from './ApiKeyStep';
import { MicrophoneStep } from './MicrophoneStep';
import { HotkeyStep } from './HotkeyStep';
import { CompleteStep } from './CompleteStep';

export type OnboardingStep = 'welcome' | 'apiKey' | 'microphone' | 'hotkey' | 'complete';

interface OnboardingPageProps {
  onComplete: () => void;
}

export function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [apiKey, setApiKey] = useState('');
  const [hotkey, setHotkey] = useState('CommandOrControl+Shift+Space');

  const steps: OnboardingStep[] = ['welcome', 'apiKey', 'microphone', 'hotkey', 'complete'];
  const currentIndex = steps.indexOf(currentStep);
  const progress = ((currentIndex) / (steps.length - 1)) * 100;

  const goToNext = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex]);
    }
  };

  const goBack = () => {
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex]);
    }
  };

  const handleApiKeySave = async (key: string) => {
    setApiKey(key);
    await window.electron.saveSettings({ apiKey: key });
    goToNext();
  };

  const handleHotkeySave = async (key: string) => {
    setHotkey(key);
    await window.electron.saveSettings({ hotkey: key });
    goToNext();
  };

  const handleComplete = async () => {
    await window.electron.saveSettings({ onboardingComplete: true });
    onComplete();
  };

  return (
    <div className="w-full h-full bg-black flex flex-col">
      {/* Progress bar */}
      {currentStep !== 'welcome' && currentStep !== 'complete' && (
        <div className="h-1 bg-white/10">
          <div
            className="h-full bg-white transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-8">
        {currentStep === 'welcome' && (
          <WelcomeStep onNext={goToNext} />
        )}
        {currentStep === 'apiKey' && (
          <ApiKeyStep
            onNext={handleApiKeySave}
            onBack={goBack}
            initialValue={apiKey}
          />
        )}
        {currentStep === 'microphone' && (
          <MicrophoneStep onNext={goToNext} onBack={goBack} />
        )}
        {currentStep === 'hotkey' && (
          <HotkeyStep
            onNext={handleHotkeySave}
            onBack={goBack}
            initialValue={hotkey}
          />
        )}
        {currentStep === 'complete' && (
          <CompleteStep onComplete={handleComplete} />
        )}
      </div>

      {/* Step indicator */}
      {currentStep !== 'welcome' && currentStep !== 'complete' && (
        <div className="flex justify-center gap-2 pb-8">
          {steps.slice(1, -1).map((step, index) => (
            <div
              key={step}
              className={`w-2 h-2 rounded-full transition-colors ${
                index <= currentIndex - 1 ? 'bg-white' : 'bg-white/20'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
