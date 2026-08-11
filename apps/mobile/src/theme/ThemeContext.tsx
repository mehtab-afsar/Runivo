import React, { createContext, useContext } from 'react';
import { Colors, DarkColors, type AppColors } from './colors';

const ThemeContext = createContext<AppColors>(Colors);
const IsDarkContext = createContext<boolean>(false);

export function ThemeProvider({
  isDark,
  children,
}: {
  isDark: boolean;
  children: React.ReactNode;
}) {
  const colors = isDark ? DarkColors : Colors;
  return (
    <IsDarkContext.Provider value={isDark}>
      <ThemeContext.Provider value={colors}>{children}</ThemeContext.Provider>
    </IsDarkContext.Provider>
  );
}

export function useTheme(): AppColors {
  return useContext(ThemeContext);
}

/** The app's own dark-mode setting (settings.darkMode) — not the OS color scheme. */
export function useIsDark(): boolean {
  return useContext(IsDarkContext);
}
