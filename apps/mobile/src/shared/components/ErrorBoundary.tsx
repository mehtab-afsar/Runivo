import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { captureException } from '../services/sentry';

interface Props { children: React.ReactNode }
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
      return (
        <View style={s.container}>
          <Text style={s.title}>Something went wrong</Text>
          <Text style={s.message}>The app hit an unexpected error. Please try again.</Text>
          <Pressable style={s.btn} onPress={() => this.setState({ error: null })}>
            <Text style={s.btnText}>Retry</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F6F3', alignItems: 'center', justifyContent: 'center', padding: 32 },
  title:     { fontFamily: 'Barlow_700Bold', fontSize: 22, color: '#0A0A0A', marginBottom: 12 },
  message:   { fontFamily: 'Barlow_400Regular', fontSize: 15, color: '#6B6B6B', textAlign: 'center', marginBottom: 32 },
  btn:       { backgroundColor: '#D93518', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40 },
  btnText:   { fontFamily: 'Barlow_600SemiBold', fontSize: 15, color: '#FFFFFF' },
});
