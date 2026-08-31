const configuredBaseUrl: unknown = import.meta.env['VITE_API_BASE_URL'];

export const apiBaseUrl = (
  typeof configuredBaseUrl === 'string' && configuredBaseUrl.trim()
    ? configuredBaseUrl.trim()
    : '/api'
).replace(/\/$/, '');
