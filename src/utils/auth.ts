const TOKEN_KEY = 'puppace_auth_token';

let _authToken: string | null = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;

export function getAuthToken(): string | null {
  if (!_authToken && typeof localStorage !== 'undefined') {
    _authToken = localStorage.getItem(TOKEN_KEY);
  }
  return _authToken;
}

export function setAuthToken(token: string | null): void {
  _authToken = token;
  if (typeof localStorage !== 'undefined') {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }
}

export function clearAuthToken(): void {
  _authToken = null;
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('puppace_unlocked_v4');
  }
}
