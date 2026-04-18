import React from 'react';
import { captureException } from './sentry';

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
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, background: '#F8F6F3' }}>
          <h2 style={{ fontFamily: 'Barlow, sans-serif', fontSize: 24, color: '#0A0A0A', margin: 0 }}>Something went wrong</h2>
          <p style={{ color: '#6B6B6B', margin: 0 }}>The app hit an unexpected error. Please try again.</p>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ background: '#D93518', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 32px', cursor: 'pointer', fontSize: 15 }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
