import * as React from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  /** Preferencia del usuario (incluye 'system'). */
  theme: ThemeMode;
  /** Tema efectivamente aplicado al DOM ('light' | 'dark'). */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeMode) => void;
}

const STORAGE_KEY = "tms.theme";
const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* noop */
  }
  return "light";
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
  root.setAttribute("data-theme", resolved);
  root.style.colorScheme = resolved;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = React.useState<ThemeMode>(() => readStoredTheme());
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>(() => {
    const stored = readStoredTheme();
    return stored === "system" ? getSystemTheme() : (stored as ResolvedTheme);
  });

  // Apply on mount + theme change
  React.useEffect(() => {
    const resolved: ResolvedTheme = theme === "system" ? getSystemTheme() : theme;
    setResolvedTheme(resolved);
    applyTheme(resolved);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* noop */
    }
  }, [theme]);

  // Listen to OS changes when in 'system' mode
  React.useEffect(() => {
    if (theme !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const resolved: ResolvedTheme = mq.matches ? "dark" : "light";
      setResolvedTheme(resolved);
      applyTheme(resolved);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = React.useCallback((t: ThemeMode) => setThemeState(t), []);

  const value = React.useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    // Fallback no-op para evitar romper si falta el provider
    return {
      theme: "light",
      resolvedTheme: "light",
      setTheme: () => {
        /* noop */
      },
    };
  }
  return ctx;
}