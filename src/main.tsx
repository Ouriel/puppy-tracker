import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Analytics } from '@vercel/analytics/react';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <SpeedInsights
      beforeSend={(data) => {
        const path = window.location.pathname || '/';
        return {
          ...data,
          route: data.route && data.route !== '(unknown)' ? data.route : path,
        };
      }}
    />
    <Analytics
      beforeSend={(event) => {
        return {
          ...event,
          url: event.url || window.location.href,
        };
      }}
    />
  </StrictMode>,
);
