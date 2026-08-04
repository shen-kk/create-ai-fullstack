import { project } from '../generated/project';

const configuredBaseUrl: unknown = import.meta.env['VITE_API_BASE_URL'];

export const apiBaseUrl = (
  typeof configuredBaseUrl === 'string' && configuredBaseUrl.trim()
    ? configuredBaseUrl.trim()
    : `${window.location.protocol}//${window.location.hostname}:${project.runtime.apiPort}/api`
).replace(/\/$/, '');
