import { createContext, useContext, useMemo, useState } from 'react';
import api from '../services/api';

const AUTH_STORAGE_KEY = 'unicep_auth';

const AuthContext = createContext(null);

function getInitialAuth() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return { token: null, user: null };
    const parsed = JSON.parse(raw);
    return {
      token: parsed.token || null,
      user: parsed.user || null,
    };
  } catch (_error) {
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(getInitialAuth);

  const isAuthenticated = Boolean(auth.token);

  async function login({ correo, folio_matricula, password }) {
    const response = await api.post('/auth/login', {
      correo: correo || undefined,
      folio_matricula: folio_matricula || undefined,
      password,
    });

    const next = {
      token: response.data.token,
      user: response.data.user,
    };

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next));
    setAuth(next);
    return next;
  }

  function logout() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuth({ token: null, user: null });
  }

  const value = useMemo(
    () => ({
      token: auth.token,
      user: auth.user,
      isAuthenticated,
      login,
      logout,
    }),
    [auth.token, auth.user, isAuthenticated],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}
