// The screen shown, as the route Analytics and Speed Insights file each event and metric under
export const VIEW_ROUTES = { dashboard: '/dashboard', carnetdesante: '/health-passport', settings: '/settings' } as const;

/** The screen the URL asks for: the passport (older /carnetdesante links too), the settings, else the dashboard. */
export function getViewFromPath(): keyof typeof VIEW_ROUTES {
  const path = window.location.pathname.toLowerCase();
  if (path.includes('passport') || path.includes('carnetdesante')) return 'carnetdesante';
  if (path.includes('settings')) return 'settings';
  return 'dashboard';
}
