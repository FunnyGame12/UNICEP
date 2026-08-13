const AUTH_STORAGE_KEY = 'unicep_auth';

function parseAuth(raw) {
  if (!raw) {
    return { token: null, refreshToken: null, user: null };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      token: parsed?.token || null,
      refreshToken: parsed?.refreshToken || parsed?.refresh_token || null,
      user: parsed?.user || null,
    };
  } catch (_error) {
    return { token: null, refreshToken: null, user: null };
  }
}

export function getStoredAuth() {
  const sessionRaw = sessionStorage.getItem(AUTH_STORAGE_KEY);
  if (sessionRaw) {
    return parseAuth(sessionRaw);
  }

  // Backward compatibility: migrate legacy localStorage auth to sessionStorage.
  const legacyRaw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!legacyRaw) {
    return { token: null, refreshToken: null, user: null };
  }

  const parsed = parseAuth(legacyRaw);
  if (parsed.token) {
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
  }
  localStorage.removeItem(AUTH_STORAGE_KEY);
  return parsed;
}

export function setStoredAuth(auth) {
  sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
    token: auth?.token || null,
    refreshToken: auth?.refreshToken || auth?.refresh_token || null,
    user: auth?.user || null,
  }));
}

export function clearStoredAuth() {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(AUTH_STORAGE_KEY);
}
