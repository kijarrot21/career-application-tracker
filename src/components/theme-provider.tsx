"use client";

import { Tooltip } from "radix-ui";
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { Toaster } from "sonner";

export type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: Theme;
  setTheme: (theme: Theme | ((prev: Theme) => Theme)) => void;
  themes: Theme[];
}

const STORAGE_KEY = "theme";
const DEFAULT_THEME: Theme = "light";
const AVAILABLE_THEMES: Theme[] = ["light", "dark"];
const listeners = new Set<() => void>();
let memoryTheme: Theme | null = null;

function getStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") {
      memoryTheme = stored;
      return stored;
    }
  } catch {
    // Ignore storage read errors
  }
  if (memoryTheme) return memoryTheme;
  if (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
  ) {
    return "dark";
  }
  return DEFAULT_THEME;
}

function getServerTheme(): Theme {
  return DEFAULT_THEME;
}

function subscribeTheme(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      memoryTheme = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function disableTransitionsTemporarily() {
  const style = document.createElement("style");
  style.appendChild(
    document.createTextNode(
      "*,*::before,*::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}",
    ),
  );
  document.head.appendChild(style);
  return () => {
    void window.getComputedStyle(document.body).opacity;
    window.setTimeout(() => {
      style.remove();
    }, 1);
  };
}

function applyThemeToDocument(theme: Theme, disableTransitions = false) {
  const cleanup = disableTransitions ? disableTransitionsTemporarily() : null;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.style.colorScheme = theme;
  cleanup?.();
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  resolvedTheme: DEFAULT_THEME,
  setTheme: () => {},
  themes: AVAILABLE_THEMES,
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(
    subscribeTheme,
    getStoredTheme,
    getServerTheme,
  );

  useLayoutEffect(() => {
    applyThemeToDocument(theme, false);
  }, [theme]);

  const setTheme = useCallback((next: Theme | ((prev: Theme) => Theme)) => {
    const current = getStoredTheme();
    const resolved: Theme =
      typeof next === "function"
        ? next(current)
        : next === "dark"
          ? "dark"
          : "light";
    memoryTheme = resolved;
    try {
      window.localStorage.setItem(STORAGE_KEY, resolved);
    } catch {
      // Ignore storage write errors (e.g. restricted storage)
    }
    applyThemeToDocument(resolved, true);
    listeners.forEach((listener) => listener());
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme: theme,
      setTheme,
      themes: AVAILABLE_THEMES,
    }),
    [theme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      <Tooltip.Provider delayDuration={250}>
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </Tooltip.Provider>
    </ThemeContext.Provider>
  );
}
