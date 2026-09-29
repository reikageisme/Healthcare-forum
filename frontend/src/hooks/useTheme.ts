import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'medicvn-theme';
const THEME_EVENT = 'medicvn-theme-change';

function preferredTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Private mode can reject storage access.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content',
    theme === 'dark' ? '#0A1220' : '#2D6DD1',
  );
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => preferredTheme());

  useEffect(() => applyTheme(theme), [theme]);

  useEffect(() => {
    const syncFromStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setThemeState(preferredTheme());
    };
    const syncInThisTab = (event: Event) => {
      const next = (event as CustomEvent<Theme>).detail;
      if (next === 'light' || next === 'dark') setThemeState(next);
    };
    window.addEventListener('storage', syncFromStorage);
    window.addEventListener(THEME_EVENT, syncInThisTab);
    return () => {
      window.removeEventListener('storage', syncFromStorage);
      window.removeEventListener(THEME_EVENT, syncInThisTab);
    };
  }, []);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Theme still works for this tab.
    }
    window.dispatchEvent(new CustomEvent<Theme>(THEME_EVENT, { detail: next }));
  };

  return { theme, setTheme, toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark') };
}

export default useTheme;
