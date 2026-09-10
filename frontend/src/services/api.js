import axios from 'axios';

function resolveDefaultApiBaseUrl() {
  const configured = String(import.meta.env.VITE_API_URL || '').trim();
  if (configured) return configured;

  // Compatibilidad: cuando se abre el frontend desde Live Server (5500),
  // apunta por defecto al backend local de desarrollo.
  const location = globalThis?.window?.location;
  if (!location) return '/api/v1';

  const isLocalHost = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
  if (isLocalHost && location.port === '5500') {
    return `http://${location.hostname}:4000/api/v1`;
  }

  return '/api/v1';
}

const api = axios.create({
  baseURL: resolveDefaultApiBaseUrl(),
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const raw = localStorage.getItem('unicep_auth');
  if (!raw) return config;

  try {
    const auth = JSON.parse(raw);
    if (auth?.token) {
      config.headers.Authorization = `Bearer ${auth.token}`;
    }
  } catch (_error) {
    // Ignora datos corruptos en localStorage.
  }

  return config;
});

export default api;
