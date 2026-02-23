// ===========================================
// Picaton UI Kit
// Based on Figma Design System
// ===========================================

// Base Components
export { Button } from "./Button";
export type { ButtonVariant, ButtonSize } from "./Button";

export { IconButton } from "./IconButton";
export type { IconButtonVariant, IconButtonSize } from "./IconButton";

export { Card } from "./Card";
export type { CardVariant } from "./Card";

export { Input } from "./Input";

export { Textarea } from "./Textarea";

export { Tag } from "./Tag";

export { Badge } from "./Badge";

export { ThemeToggle } from "./ThemeToggle";

export { Typography } from "./Typography";

export { Icon } from "./Icon";

export { Loader } from "./Loader";

export { SocialLink } from "./SocialLink";

export { SkillBar } from "./SkillBar";

export { Container } from "./Container";

export { TapBar } from "./TapBar";
export type { TapBarOption } from "./TapBar";

export { GlassSelect } from "./GlassSelect";
export type { GlassSelectOption } from "./GlassSelect";

export { Tabs } from "./Tabs";
export type { Tab } from "./Tabs";

export { SearchBox } from "./SearchBox";

export { Modal } from "./Modal";

export { StatsCard } from "./StatsCard";

export { NavBar } from "./Navbar";

export { ProcessStep } from "./ProcessStep";

export { Avatar } from "./Avatar";
export type { AvatarSize } from "./Avatar";

export { TagInput } from "./TagInput";

export { EndorsableSkill } from "./EndorsableSkill";

export {
  AvatarEmojiButton,
  DEFAULT_PROFILE_EMOJIS,
  EMOJI_CATEGORIES,
} from "./AvatarEmojiButton";

// ===========================================
// Figma Design Components
// ===========================================

// Primary Button (gradient)
export { PrimaryButton } from "./PrimaryButton";

// Search Input
export { SearchInput } from "./SearchInput";

// Feature Card (onboarding)
export {
  FeatureCard,
  FeatureCardList,
  getDefaultFeatures,
} from "./FeatureCard";

// Progress Bar & Dots
export { ProgressBar, ProgressDots } from "./ProgressBar";

// Skill Tags
export { SkillTag, SkillTagList, defaultSkills } from "./SkillTag";

// Contact Card
export { ContactCard, ContactCardList } from "./ContactCard";

// Privacy Options
export { PrivacyOption, PrivacyOptionList } from "./PrivacyOption";
export type { PrivacyLevel } from "./PrivacyOption";

// Switcher (bottom navigation)
export { Switcher, getDefaultTabs } from "./Switcher";
export type { SwitcherItem } from "./Switcher";

// Empty States
export {
  EmptyState,
  EmptySearchState,
  NoResultsState,
  EmptyContactsState,
} from "./EmptyState";

// Page Headers
export { PageHeader, OnboardingHeader } from "./PageHeader";

// Text Input (with label & validation)
export { TextInput } from "./TextInput";
