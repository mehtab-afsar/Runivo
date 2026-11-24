import React from 'react';
import { View, Text, Pressable, StyleSheet, Appearance } from 'react-native';
import { Colors, DarkColors, Fonts, type AppColors } from '@theme';
import { captureException } from '../services/sentry';

interface Props {
  children: React.ReactNode;
  /** Screen-level boundary: offers Go back next to Try again, so one broken
   *  screen doesn't take the whole app (or a run in progress) down with it. */
  onBack?: () => void;
}
interface State { error: Error | null }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    captureException(error, { componentStack: info.componentStack });
  }

  render() {
    if (this.state.error) {
      // Read the OS scheme directly rather than useTheme(): this is the crash
      // fallback, so it must not depend on the app's ThemeProvider (which may be
      // exactly what failed). Class component → resolve palette at render time.
      const C = Appearance.getColorScheme() === 'dark' ? DarkColors : Colors;
      const s = mkStyles(C);
      return (
        <View style={s.container}>
          <Text style={s.title}>Something went wrong</Text>
          <Text style={s.message}>The app hit an unexpected error. Please try again.</Text>
          <Pressable style={s.btn} onPress={() => this.setState({ error: null })} accessibilityRole="button">
            <Text style={s.btnText}>Try again</Text>
          </Pressable>
          {this.props.onBack && (
            <Pressable style={s.back} onPress={() => { this.setState({ error: null }); this.props.onBack?.(); }} accessibilityRole="button">
              <Text style={s.backText}>Go back</Text>
            </Pressable>
          )}
        </View>
      );
    }
    return this.props.children;
  }
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
    title:     { fontFamily: Fonts.bold, fontSize: 22, color: C.t1, marginBottom: 12 },
    message:   { fontFamily: Fonts.regular, fontSize: 15, color: C.t2, textAlign: 'center', marginBottom: 32 },
    btn:       { backgroundColor: C.red, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40 },
    btnText:   { fontFamily: Fonts.semiBold, fontSize: 15, color: C.alwaysLight },
    back:      { marginTop: 14, paddingVertical: 10, paddingHorizontal: 24 },
    backText:  { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
  });
}
