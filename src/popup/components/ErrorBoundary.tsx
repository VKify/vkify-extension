import React from 'react';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Logged here so it survives even if the esbuild console-drop flag is set:
    // this runs only in the browser, not during build, so it won't be stripped.
    // Replace with a real error-reporting service if needed.
    console.error('[VKify] Popup crash:', error.message, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ error: null });
  };

  render(): React.ReactNode {
    const { error } = this.state;

    if (!error) return this.props.children;

    // Intentionally uses inline styles so the fallback renders even when
    // Tailwind CSS has not loaded (e.g., the popup opened before the build finished).
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: 300,
        padding: 24,
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
        <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 8px' }}>
          Что-то пошло не так
        </p>
        <p style={{ fontSize: 12, color: '#888', margin: '0 0 20px', maxWidth: 260 }}>
          {error.message}
        </p>
        <button
          onClick={this.handleReset}
          style={{
            padding: '8px 20px',
            background: '#3a76c2',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          Попробовать снова
        </button>
      </div>
    );
  }
}