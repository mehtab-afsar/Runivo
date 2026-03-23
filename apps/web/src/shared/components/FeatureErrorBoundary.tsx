import React from 'react';

interface Props {
  feature: string;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class FeatureErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <p className="text-sm text-gray-400">{this.props.feature} failed to load</p>
          <button
            className="mt-4 text-xs text-red-500 underline"
            onClick={() => this.setState({ hasError: false })}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
