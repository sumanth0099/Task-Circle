const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

let csrfToken = '';

export const apiRequest = async (path, options = {}) => {
  const method = (options.method || 'GET').toUpperCase();
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(method === 'GET' || method === 'HEAD' ? {} : csrfToken ? { 'x-csrf-token': csrfToken } : {}),
      ...(options.headers || {})
    },
    ...options
  });

  const headerToken = response.headers.get('x-csrf-token');
  if (headerToken) {
    csrfToken = headerToken;
  }

  const payload = await response.json().catch(() => ({ success: false, message: 'Invalid response' }));
  if (payload?.data?.csrfToken) {
    csrfToken = payload.data.csrfToken;
  }

  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || 'Request failed');
  }

  return payload.data;
};

export const apiUrl = API_URL;
