import React, { createContext, useContext } from 'react';
import { Colors, DarkColors, type AppColors } from './colors';

const ThemeContext = createContext<AppColors>(Colors);

export function ThemeProvider({
  isDark,
  children,
}: {
  isDark: boolean;
  children: React.ReactNode;
}) {
  const colors = isDark ? DarkColors : Colors;
  return <ThemeContext.Provider value={colors}>{children}</ThemeContext.Provider>;
}

export function useTheme(): AppColors {
  return useContext(ThemeContext);
}
