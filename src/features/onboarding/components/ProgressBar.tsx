import { motion } from 'framer-motion';

interface ProgressBarProps {
  currentStep: number; // 0-8
}

const chapters = [
  { label: 'Account',  steps: [0, 1]       }, // welcome, create account
  { label: 'Body',     steps: [2]           }, // biometrics
  { label: 'Training', steps: [3, 4, 5]    }, // experience, goal, weekly
  { label: 'Setup',    steps: [6, 7, 8]    }, // location, prefs, ready
];

export default function OnboardingProgress({ currentStep }: ProgressBarProps) {
  return (
    <div className="flex items-center gap-2 px-6">
      {chapters.map((chapter, ci) => {
        const chapterStart = chapter.steps[0];
        const chapterEnd = chapter.steps[chapter.steps.length - 1];
        const stepsInChapter = chapter.steps.length;

        let fillPercent = 0;
        if (currentStep > chapterEnd) {
          fillPercent = 100;
        } else if (currentStep >= chapterStart) {
          const stepsCompleted = currentStep - chapterStart;
          fillPercent = (stepsCompleted / stepsInChapter) * 100;
        }

        return (
          <div key={ci} className="flex-1">
            <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-teal-500 rounded-full"
                initial={false}
                animate={{ width: `${fillPercent}%` }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            </div>
            <span className={`text-[9px] mt-1 block text-center font-medium ${
              currentStep >= chapterStart ? 'text-teal-600' : 'text-gray-300'
            }`}>
              {chapter.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
