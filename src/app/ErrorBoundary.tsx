import React from 'react';

type State = { hasError: boolean; message?: string };

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('[Steel Command] UI error:', error, info);
  }

  reload = () => {
    this.setState({ hasError: false, message: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-screen">
          <h1>Steel Command crashed</h1>
          <p>An unexpected error occurred. Open the browser console for details.</p>
          <pre>{this.state.message ?? 'unknown error'}</pre>
          <button onClick={this.reload}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
