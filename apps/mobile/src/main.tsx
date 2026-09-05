import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './styles.css';
import '../../../packages/games/digital-game/ui.css';
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="error-screen">
        <h1>Board Arena</h1>
        <p>
          Something went wrong. Reload to recover your match.
          <br />
          حدث خطأ. أعد التحميل لاستعادة المباراة.
        </p>
        <button className="button primary" onClick={() => location.reload()}>
          Reload · إعادة التحميل
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
