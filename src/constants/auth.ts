const getSuperAdminEmail = (): string => {
  const globalObj = globalThis as Record<string, any>;
  if (globalObj.process?.env?.SUPER_ADMIN_EMAIL) {
    return globalObj.process.env.SUPER_ADMIN_EMAIL;
  }
  // Vite client-side env support
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_SUPER_ADMIN_EMAIL) {
      return (import.meta as any).env.VITE_SUPER_ADMIN_EMAIL;
    }
  } catch {
    // Ignore in non-Vite environments
  }
  return 'matthieu.jacquet@gmail.com';
};

export const SUPER_ADMIN_EMAIL: string = getSuperAdminEmail();

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
}
