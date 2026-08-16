const getSuperAdminEmail = (): string => {
  const globalEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  if (globalEnv?.SUPER_ADMIN_EMAIL) {
    return globalEnv.SUPER_ADMIN_EMAIL;
  }
  return 'matthieu.jacquet@gmail.com';
};

export const SUPER_ADMIN_EMAIL: string = getSuperAdminEmail();

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
}
