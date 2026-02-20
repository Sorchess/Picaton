import { useState } from "react";
import { useAuth } from "@/features/auth";
import { userApi } from "@/entities/user/model/api";
import { businessCardApi } from "@/entities/business-card/model/api";
import {
  Typography,
  Button,
  Card,
  Input,
  Textarea,
  PrivacyOptionList,
} from "@/shared";
import type { PrivacyLevel } from "@/shared";
import Loupe from "@/shared/assets/Loupe.webp";
import House from "@/shared/assets/House.webp";
import Stars from "@/shared/assets/Stars.webp";
import Handshake from "@/shared/assets/Handshake.webp";
import Done from "@/shared/assets/Done.webp";
import "./OnboardingPage.scss";

const SLIDE_COUNT = 4;
const PROFILE_STEPS = 4; // profile, bio, privacy, done

interface SlideData {
  animation: string;
  title: string;
  description: string;
}

const slides: SlideData[] = [
  {
    animation: Loupe,
    title: "Умный поиск",
    description: "Найдите экспертов по любым навыкам",
  },
  {
    animation: Handshake,
    title: "Создавайте связи",
    description: "Узнайте как вы связаны с нужными людьми",
  },
  {
    animation: House,
    title: "Компания",
    description: "Исследуйте структуру и людей вашей организации",
  },
  {
    animation: Stars,
    title: "AI ассистирование",
    description: "Экономь время и собственные ресурсы, используя AI",
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

/* ── Step 1: Name ── */
function ProfileNameStep({
  onNext,
  isSubmitting,
}: {
  onNext: (firstName: string, lastName: string) => void;
  isSubmitting: boolean;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [errors, setErrors] = useState<{
    firstName?: string;
    lastName?: string;
  }>({});

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!firstName.trim()) newErrors.firstName = "Введите имя";
    if (!lastName.trim()) newErrors.lastName = "Введите фамилию";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onNext(firstName.trim(), lastName.trim());
    }
  };

  return (
    <>
      <div className="onboarding__center">
        <div className="onboarding__profile-form">
          <Typography variant="h1" className="onboarding__profile-heading">
            Создайте профиль
          </Typography>
          <Typography variant="body" className="onboarding__profile-subheading">
            Расскажите о себе
          </Typography>

          <div className="onboarding__profile-fields">
            <Input
              placeholder="Имя"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                if (errors.firstName)
                  setErrors((prev) => ({ ...prev, firstName: undefined }));
              }}
              error={errors.firstName}
              fullWidth
            />
            <Input
              placeholder="Фамилия"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                if (errors.lastName)
                  setErrors((prev) => ({ ...prev, lastName: undefined }));
              }}
              error={errors.lastName}
              fullWidth
            />
          </div>
        </div>
      </div>

      <div className="onboarding__bottom">
        <Button
          variant="primary"
          className="onboarding__continue"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Сохранение..." : "Продолжить"}
        </Button>
      </div>
    </>
  );
}

/* ── Step 2: Bio ── */
function ProfileBioStep({
  onNext,
  isSubmitting,
}: {
  onNext: (bio: string) => void;
  isSubmitting: boolean;
}) {
  const [bio, setBio] = useState("");

  return (
    <>
      <div className="onboarding__center">
        <div className="onboarding__profile-form">
          <Typography variant="h1" className="onboarding__profile-heading">
            Расскажите о себе
          </Typography>
          <Typography variant="body" className="onboarding__profile-subheading">
            Это поможет другим людям узнать вас лучше
          </Typography>

          <div className="onboarding__profile-fields">
            <Textarea
              placeholder="Чем вы занимаетесь, ваши интересы и опыт..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={5}
              fullWidth
            />
          </div>
        </div>
      </div>

      <div className="onboarding__bottom">
        <Button
          variant="primary"
          className="onboarding__continue"
          onClick={() => onNext(bio.trim())}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Сохранение..." : "Продолжить"}
        </Button>
        <Button
          variant="ghost"
          className="onboarding__skip"
          onClick={() => onNext("")}
          disabled={isSubmitting}
        >
          Пропустить
        </Button>
      </div>
    </>
  );
}

/* ── Step 3: Privacy ── */
function ProfilePrivacyStep({
  onNext,
  isSubmitting,
}: {
  onNext: (privacy: PrivacyLevel) => void;
  isSubmitting: boolean;
}) {
  const [privacy, setPrivacy] = useState<PrivacyLevel>("public");

  return (
    <>
      <div className="onboarding__center">
        <div className="onboarding__profile-form">
          <Typography variant="h1" className="onboarding__profile-heading">
            Конфиденциальность
          </Typography>
          <Typography variant="body" className="onboarding__profile-subheading">
            Кто сможет видеть ваш профиль?
          </Typography>

          <div className="onboarding__profile-fields">
            <PrivacyOptionList selectedLevel={privacy} onChange={setPrivacy} />
          </div>
        </div>
      </div>

      <div className="onboarding__bottom">
        <Button
          variant="primary"
          className="onboarding__continue"
          onClick={() => onNext(privacy)}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Сохранение..." : "Продолжить"}
        </Button>
      </div>
    </>
  );
}

/* ── Step 4: Done ── */
function DoneStep({ onFinish }: { onFinish: () => void }) {
  return (
    <>
      <div className="onboarding__center">
        <div className="onboarding__profile-form">
          <Typography variant="h1" className="onboarding__profile-heading">
            Всё готово!
          </Typography>
          <Typography variant="body" className="onboarding__profile-subheading">
            Ваш профиль создан. Начните искать нужных людей
          </Typography>
        </div>
        <img src={Done} alt="Done" className="onboarding__animation" />
      </div>

      <div className="onboarding__bottom">
        <Button
          variant="primary"
          className="onboarding__continue"
          onClick={onFinish}
        >
          Начать
        </Button>
      </div>
    </>
  );
}

export function OnboardingPage() {
  const { user, refreshUser } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isProfilePhase = currentStep >= SLIDE_COUNT;
  const profileStepIndex = currentStep - SLIDE_COUNT; // 0, 1, 2
  const isLastSlide = currentStep === SLIDE_COUNT - 1;

  const handleContinue = () => {
    setCurrentStep((prev) => prev + 1);
  };

  /* Save name, advance to bio step */
  const handleNameNext = async (firstName: string, lastName: string) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      await userApi.update(user.id, {
        first_name: firstName,
        last_name: lastName,
      });
      setCurrentStep((prev) => prev + 1);
    } finally {
      setIsSubmitting(false);
    }
  };

  /* Save bio to primary business card, advance to privacy step */
  const handleBioNext = async (bio: string) => {
    if (!user) return;
    if (bio) {
      setIsSubmitting(true);
      try {
        const primaryCard = await businessCardApi.getPrimary(user.id);
        await businessCardApi.update(primaryCard.id, user.id, { bio });
      } finally {
        setIsSubmitting(false);
      }
    }
    setCurrentStep((prev) => prev + 1);
  };

  /* Save privacy, advance to done step */
  const handlePrivacyNext = async (privacy: PrivacyLevel) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      // Маппинг уровней приватности онбординга → бекенд
      const privacyMap: Record<
        PrivacyLevel,
        { who_can_see_profile: string; who_can_message: string }
      > = {
        public: { who_can_see_profile: "all", who_can_message: "all" },
        contacts: {
          who_can_see_profile: "contacts",
          who_can_message: "contacts",
        },
        company: {
          who_can_see_profile: "company_colleagues",
          who_can_message: "company_colleagues",
        },
        private: {
          who_can_see_profile: "nobody",
          who_can_message: "contacts",
        },
      };

      await userApi.updateVisibility(user.id, privacy === "public");
      await userApi.updatePrivacySettings(user.id, privacyMap[privacy]);
      setCurrentStep((prev) => prev + 1);
    } finally {
      setIsSubmitting(false);
    }
  };

  /* Finish onboarding */
  const handleFinish = async () => {
    await refreshUser();
  };

  const renderProfileStep = () => {
    switch (profileStepIndex) {
      case 0:
        return (
          <ProfileNameStep
            onNext={handleNameNext}
            isSubmitting={isSubmitting}
          />
        );
      case 1:
        return (
          <ProfileBioStep onNext={handleBioNext} isSubmitting={isSubmitting} />
        );
      case 2:
        return (
          <ProfilePrivacyStep
            onNext={handlePrivacyNext}
            isSubmitting={isSubmitting}
          />
        );
      case 3:
        return <DoneStep onFinish={handleFinish} />;
      default:
        return null;
    }
  };

  return (
    <div className="onboarding">
      <div className="onboarding__top">
        <ProgressBar
          current={isProfilePhase ? profileStepIndex : currentStep}
          total={isProfilePhase ? PROFILE_STEPS : SLIDE_COUNT}
        />
      </div>

      {isProfilePhase ? (
        renderProfileStep()
      ) : (
        <>
          <div className="onboarding__center">
            {slides.map((s, i) => (
              <img
                key={i}
                src={s.animation}
                alt={s.title}
                className="onboarding__animation"
                style={{ display: i === currentStep ? "block" : "none" }}
              />
            ))}
          </div>

          <div className="onboarding__bottom">
            <Card className="onboarding__card">
              <Typography variant="h1" className="onboarding__title">
                {slides[currentStep].title}
              </Typography>
              <Typography variant="body" className="onboarding__subtitle">
                {slides[currentStep].description}
              </Typography>
            </Card>

            <Button
              variant="primary"
              className="onboarding__continue"
              onClick={handleContinue}
            >
              {isLastSlide ? "Далее" : "Продолжить"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
