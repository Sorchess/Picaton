import {
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { Theme } from "./types";
import { ThemeContext } from "./context";

const THEME_STORAGE_KEY = "picaton-theme";

function getInitialTheme(): Theme {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    if (stored === "dark" || stored === "light") {
      return stored;
    }

    if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      return "light";
    }
  }
  return "dark";
}

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
}

export function ThemeProvider({ children, defaultTheme }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(
    defaultTheme ?? getInitialTheme
  );

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
