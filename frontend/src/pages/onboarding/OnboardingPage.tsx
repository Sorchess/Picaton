import { useState } from "react";
import { useAuth } from "@/features/auth";
import { Typography, Button } from "@/shared";
import "./OnboardingPage.scss";

const TOTAL_STEPS = 4;

interface SlideData {
  emoji: string;
  title: string;
  description: string;
}

const slides: SlideData[] = [
  {
    emoji: "🔍",
    title: "Находите специалистов",
    description: "Ищите людей по навыкам и интересам для совместных проектов",
  },
  {
    emoji: "🤝",
    title: "Создавайте связи",
    description: "Обменивайтесь контактами через QR-коды за секунды",
  },
  {
    emoji: "✨",
    title: "AI-презентация",
    description: "ИИ создаст вашу уникальную визитку автоматически",
  },
  {
    emoji: "🚀",
    title: "Начните прямо сейчас",
    description: "Заполните профиль и присоединяйтесь к сообществу",
  },
];

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <svg
      className="onboarding__progress"
      viewBox="0 0 393 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {Array.from({ length: total }, (_, i) => {
        const gap = 8;
        const sidePadding = 24;
        const availableWidth = 393 - sidePadding * 2;
        const barWidth = (availableWidth - gap * (total - 1)) / total;
        const x = sidePadding + i * (barWidth + gap);
        return (
          <rect
            key={i}
            x={x}
            y={10}
            width={barWidth}
            height={4}
            rx={2}
            fill={i <= current ? "#0081FF" : "#E3EAF7"}
          />
        );
      })}
    </svg>
  );
}

export function OnboardingPage() {
  const { refreshUser } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);

  const slide = slides[currentStep];
  const isLastStep = currentStep === TOTAL_STEPS - 1;

  const handleContinue = async () => {
    if (isLastStep) {
      await refreshUser();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  return (
    <div className="onboarding">
      <div className="onboarding__top">
        <ProgressBar current={currentStep} total={TOTAL_STEPS} />
      </div>

      <div className="onboarding__center">
        <div className="onboarding__illustration" key={currentStep}>
          <span className="onboarding__emoji">{slide.emoji}</span>
        </div>
        <Typography variant="h1" className="onboarding__title">
          {slide.title}
        </Typography>
        <Typography variant="body" className="onboarding__subtitle">
          {slide.description}
        </Typography>
      </div>

      <div className="onboarding__bottom">
        <Button
          variant="primary"
          className="onboarding__continue"
          onClick={handleContinue}
        >
          {isLastStep ? "Начать" : "Продолжить"}
        </Button>
      </div>
    </div>
  );
}
