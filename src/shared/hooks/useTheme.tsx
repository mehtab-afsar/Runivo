import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getSettings, saveSettings } from '@shared/services/store';

interface ThemeContextValue {
  dark: boolean;
  setDark: (v: boolean) => void;
}

const ThemeCtx = createContext<ThemeContextValue>({ dark: false, setDark: () => {} });

function applyDarkClass(isDark: boolean) {
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDarkState] = useState(false);

  useEffect(() => {
    getSettings().then(s => {
      setDarkState(s.darkMode);
      applyDarkClass(s.darkMode);
    });
  }, []);

  const setDark = useCallback(async (v: boolean) => {
    setDarkState(v);
    applyDarkClass(v);
    const settings = await getSettings();
    await saveSettings({ ...settings, darkMode: v });
  }, []);

  return <ThemeCtx.Provider value={{ dark, setDark }}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  return useContext(ThemeCtx);
}
