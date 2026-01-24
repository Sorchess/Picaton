import { TapBar, type TapBarOption } from "@/shared";
import "./PageSwitcher.scss";

type PageType = "search" | "collaboration" | "contacts" | "profile" | "company";

interface PageSwitcherProps {
  value: PageType;
  onChange: (page: PageType) => void;
}

const pageOptions: TapBarOption[] = [
  {
    value: "search",
    label: "Поиск",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    ),
  },
  {
    value: "collaboration",
    label: "Коллаб",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M12 2v1" />
        <path d="M12 21v1" />
        <path d="m4.93 4.93.71.71" />
        <path d="m18.36 18.36.71.71" />
        <path d="M2 12h1" />
        <path d="M21 12h1" />
        <path d="m4.93 19.07.71-.71" />
        <path d="m18.36 5.64.71-.71" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
  },
  {
    value: "profile",
    label: "Профиль",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    value: "contacts",
    label: "Контакты",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    value: "company",
    label: "Компания",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M3 21h18" />
        <path d="M5 21V7l8-4v18" />
        <path d="M19 21V11l-6-4" />
        <path d="M9 9h.01" />
        <path d="M9 12h.01" />
        <path d="M9 15h.01" />
        <path d="M9 18h.01" />
      </svg>
    ),
  },
];

export function PageSwitcher({ value, onChange }: PageSwitcherProps) {
  return (
    <TapBar
      options={pageOptions}
      value={value}
      onChange={(val) => onChange(val as PageType)}
      size="lg"
      className="page-switcher"
    />
  );
}

export type { PageType };
