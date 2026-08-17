import { StrictMode, Component } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from '@heroui/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Analytics } from '@vercel/analytics/react';
import './index.css';
import App from './App.tsx';

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('PupPace Error Boundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
          <div className="text-center space-y-4 px-6">
            <div className="text-5xl">🐾</div>
            {/* These strings remain hardcoded as ErrorBoundary renders before I18nProvider */}
            <h1 className="text-xl font-bold">Something went wrong</h1>
            <p className="text-sm text-slate-400">PupPace encountered an unexpected error.</p>
            <button
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function getAppRoute(): string {
  if (typeof window === 'undefined') return '/dashboard';
  const path = window.location.pathname.toLowerCase();
  if (path.includes('health-passport') || path.includes('passport') || path.includes('carnetdesante')) return '/health-passport';
  if (path.includes('settings')) return '/settings';
  return '/dashboard';
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider placement="bottom" />
      <App />
      <SpeedInsights
        route={getAppRoute()}
        beforeSend={(event) => {
          return {
            ...event,
            route: getAppRoute(),
          };
        }}
      />
      <Analytics
        beforeSend={(event) => {
          const route = getAppRoute();
          return {
            ...event,
            url: window.location.origin + route,
          };
        }}
      />
    </ErrorBoundary>
  </StrictMode>,
);

