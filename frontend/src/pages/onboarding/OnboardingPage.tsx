import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/features/auth";
import { useI18n } from "@/shared/config";
import { userApi } from "@/entities/user/model/api";
import { businessCardApi } from "@/entities/business-card/model/api";
import type { BusinessCard } from "@/entities/business-card";
import { UnifiedBioEditor } from "@/features/bio-editor";
import { TagsEditor } from "@/features/tags-editor";
import {
  Typography,
  Button,
  Card,
  Input,
  Loader,
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
const PROFILE_STEPS = 5; // profile, bio, tags, privacy, done

interface SlideData {
  animation: string;
  titleKey: string;
  descriptionKey: string;
}

const slides: SlideData[] = [
  {
    animation: Loupe,
    titleKey: "onboarding.smartSearch",
    descriptionKey: "onboarding.smartSearchDesc",
  },
  {
    animation: Handshake,
    titleKey: "onboarding.createConnections",
    descriptionKey: "onboarding.createConnectionsDesc",
  },
  {
    animation: House,
    titleKey: "onboarding.companyTitle",
    descriptionKey: "onboarding.companyDesc",
  },
  {
    animation: Stars,
    titleKey: "onboarding.aiAssistant",
    descriptionKey: "onboarding.aiAssistantDesc",
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
  const { t } = useI18n();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [errors, setErrors] = useState<{
    firstName?: string;
    lastName?: string;
  }>({});

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!firstName.trim()) newErrors.firstName = t("onboarding.enterFirstName");
    if (!lastName.trim()) newErrors.lastName = t("onboarding.enterLastName");
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
            {t("onboarding.createProfile")}
          </Typography>
          <Typography variant="body" className="onboarding__profile-subheading">
            {t("onboarding.tellAbout")}
          </Typography>

          <div className="onboarding__profile-fields">
            <Input
              placeholder={t("onboarding.firstNamePlaceholder")}
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
              placeholder={t("onboarding.lastNamePlaceholder")}
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
          {isSubmitting ? t("common.saving") : t("onboarding.continue")}
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
  const { t } = useI18n();
  const { user } = useAuth();
  const [card, setCard] = useState<BusinessCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [bioText, setBioText] = useState("");
  const [, setError] = useState<string | null>(null);

  // Fetch primary card on mount
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const primaryCard = await businessCardApi.getPrimary(user.id);
        const fullCard = await businessCardApi.getFull(primaryCard.id);
        if (!cancelled) {
          setCard(fullCard);
          setBioText(fullCard.bio || "");
        }
      } catch {
        // Card may not exist yet — fallback handled below
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleCardUpdate = useCallback((updatedCard: BusinessCard) => {
    setCard(updatedCard);
    setBioText(updatedCard.bio || "");
  }, []);

  return (
    <>
      <div className="onboarding__center">
        <div className="onboarding__profile-form">
          <Typography variant="h1" className="onboarding__profile-heading">
            {t("onboarding.bioTitle")}
          </Typography>
          <Typography variant="body" className="onboarding__profile-subheading">
            {t("onboarding.bioDescription")}
          </Typography>

          <div className="onboarding__profile-fields">
            {loading ? (
              <Loader />
            ) : card && user ? (
              <UnifiedBioEditor
                card={card}
                userId={user.id}
                isActive={true}
                onCardUpdate={handleCardUpdate}
                onError={setError}
                onBioTextChange={setBioText}
                showTitle={false}
              />
            ) : (
              <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                {t("onboarding.bioDescription")}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="onboarding__bottom">
        <Button
          variant="primary"
          className="onboarding__continue"
          onClick={() => onNext(bioText.trim())}
          disabled={isSubmitting}
        >
          {isSubmitting ? t("common.saving") : t("onboarding.continue")}
        </Button>
        <Button
          variant="ghost"
          className="onboarding__skip"
          onClick={() => onNext("")}
          disabled={isSubmitting}
        >
          {t("onboarding.skip")}
        </Button>
      </div>
    </>
  );
}

/* ── Step 3: Tags ── */
function ProfileTagsStep({
  onNext,
  isSubmitting,
}: {
  onNext: (tags: string[]) => void;
  isSubmitting: boolean;
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [card, setCard] = useState<BusinessCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileTags, setProfileTags] = useState<string[]>([]);

  // Fetch primary card and existing tags on mount
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const primaryCard = await businessCardApi.getPrimary(user.id);
        const fullCard = await businessCardApi.getFull(primaryCard.id);
        if (!cancelled) {
          setCard(fullCard);
          setProfileTags(fullCard.search_tags || []);
        }
      } catch {
        // Card may not exist yet
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleTagsChange = useCallback((newTags: string[]) => {
    setProfileTags(newTags);
  }, []);

  return (
    <>
      <div className="onboarding__center">
        <div className="onboarding__profile-form">
          <Typography variant="h1" className="onboarding__profile-heading">
            {t("onboarding.tagsTitle")}
          </Typography>
          <Typography variant="body" className="onboarding__profile-subheading">
            {t("onboarding.tagsDescription")}
          </Typography>

          <div className="onboarding__profile-fields">
            {loading || !card || !user ? (
              <Loader />
            ) : (
              <TagsEditor
                card={card}
                userId={user.id}
                value={profileTags}
                onChange={handleTagsChange}
                placeholder={t("onboarding.tagsPlaceholder")}
              />
            )}
          </div>
        </div>
      </div>

      <div className="onboarding__bottom">
        <Button
          variant="primary"
          className="onboarding__continue"
          onClick={() => onNext(profileTags)}
          disabled={isSubmitting}
        >
          {isSubmitting ? t("common.saving") : t("onboarding.continue")}
        </Button>
        <Button
          variant="ghost"
          className="onboarding__skip"
          onClick={() => onNext([])}
          disabled={isSubmitting}
        >
          {t("onboarding.skip")}
        </Button>
      </div>
    </>
  );
}

/* ── Step 4: Privacy ── */
function ProfilePrivacyStep({
  onNext,
  isSubmitting,
}: {
  onNext: (privacy: PrivacyLevel) => void;
  isSubmitting: boolean;
}) {
  const { t } = useI18n();
  const [privacy, setPrivacy] = useState<PrivacyLevel>("public");

  return (
    <>
      <div className="onboarding__center">
        <div className="onboarding__profile-form">
          <Typography variant="h1" className="onboarding__profile-heading">
            {t("onboarding.privacyTitle")}
          </Typography>
          <Typography variant="body" className="onboarding__profile-subheading">
            {t("onboarding.privacyQuestion")}
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
          {isSubmitting ? t("common.saving") : t("onboarding.continue")}
        </Button>
      </div>
    </>
  );
}

/* ── Step 5: Done ── */
function DoneStep({ onFinish }: { onFinish: () => void }) {
  const { t } = useI18n();
  return (
    <>
      <div className="onboarding__center">
        <div className="onboarding__profile-form">
          <Typography variant="h1" className="onboarding__profile-heading">
            {t("onboarding.allReady")}
          </Typography>
          <Typography variant="body" className="onboarding__profile-subheading">
            {t("onboarding.profileCreated")}
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
          {t("onboarding.start")}
        </Button>
      </div>
    </>
  );
}

export function OnboardingPage() {
  const { t } = useI18n();
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

  /* Save bio to primary business card, advance to tags step */
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

  /* Save tags to primary business card, advance to privacy step */
  const handleTagsNext = async (tags: string[]) => {
    if (!user) return;
    if (tags.length > 0) {
      setIsSubmitting(true);
      try {
        const primaryCard = await businessCardApi.getPrimary(user.id);
        await businessCardApi.updateSearchTags(primaryCard.id, user.id, tags);
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
          <ProfileTagsStep
            onNext={handleTagsNext}
            isSubmitting={isSubmitting}
          />
        );
      case 3:
        return (
          <ProfilePrivacyStep
            onNext={handlePrivacyNext}
            isSubmitting={isSubmitting}
          />
        );
      case 4:
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
                alt={t(s.titleKey)}
                className="onboarding__animation"
                style={{ display: i === currentStep ? "block" : "none" }}
              />
            ))}
          </div>

          <div className="onboarding__bottom">
            <Card className="onboarding__card">
              <Typography variant="h1" className="onboarding__title">
                {t(slides[currentStep].titleKey)}
              </Typography>
              <Typography variant="body" className="onboarding__subtitle">
                {t(slides[currentStep].descriptionKey)}
              </Typography>
            </Card>

            <Button
              variant="primary"
              className="onboarding__continue"
              onClick={handleContinue}
            >
              {isLastSlide ? t("onboarding.next") : t("onboarding.continue")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
