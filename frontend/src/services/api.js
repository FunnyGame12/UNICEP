import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1',
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
