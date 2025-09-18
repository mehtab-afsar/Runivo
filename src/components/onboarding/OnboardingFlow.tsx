import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: string;
}

interface OnboardingFlowProps {
  onComplete?: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);

  const onboardingSteps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to Runivo',
      description: 'Your personal running companion that turns every run into an adventure.',
      icon: '🏃‍♂️'
    },
    {
      id: 'tracking',
      title: 'Track Your Progress',
      description: 'Monitor your runs, set goals, and watch your fitness improve over time.',
      icon: '📊'
    },
    {
      id: 'routes',
      title: 'Discover Routes',
      description: 'Explore new running paths and find the perfect route for every mood.',
      icon: '🗺️'
    },
    {
      id: 'community',
      title: 'Join the Community',
      description: 'Connect with other runners, share your achievements, and stay motivated.',
      icon: '👥'
    }
  ];

  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeOnboarding();
    }
  };

  const handleSkip = () => {
    completeOnboarding();
  };

  const completeOnboarding = () => {
    localStorage.setItem('onboarding_completed', 'true');
    if (onComplete) {
      onComplete();
    }
    navigate('/home');
  };

  const currentStepData = onboardingSteps[currentStep];
  const isLastStep = currentStep === onboardingSteps.length - 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex flex-col items-center justify-center px-6">
      {/* Progress Indicator */}
      <div className="flex items-center gap-2 mb-8">
        {onboardingSteps.map((_, index) => (
          <div
            key={index}
            className={`h-2 rounded-full transition-all duration-300 ${
              index <= currentStep ? 'w-8 bg-blue-500' : 'w-2 bg-gray-600'
            }`}
          />
        ))}
      </div>

      {/* Main Content */}
      <div className="text-center max-w-md space-y-6">
        <div className="text-6xl mb-4">{currentStepData.icon}</div>
        <h1 className="text-2xl font-bold text-white mb-4">
          {currentStepData.title}
        </h1>
        <p className="text-gray-300 text-lg leading-relaxed">
          {currentStepData.description}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 mt-12">
        {!isLastStep && (
          <button
            onClick={handleSkip}
            className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Skip
          </button>
        )}
        <Button
          onClick={handleNext}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
        >
          {isLastStep ? 'Get Started' : 'Next'}
        </Button>
      </div>

      <div className="mt-6 text-sm text-gray-500">
        {currentStep + 1} of {onboardingSteps.length}
      </div>
    </div>
  );
};

// Wrapper component to check if onboarding is needed
export const OnboardingWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    const onboardingCompleted = localStorage.getItem('onboarding_completed');
    setShowOnboarding(!onboardingCompleted);
    setIsLoading(false);
  }, []);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-runner-black flex items-center justify-center">
        <div className="text-runner-lime text-2xl animate-pulse">🏃‍♂️</div>
      </div>
    );
  }

  if (showOnboarding) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  }

  return <>{children}</>;
};