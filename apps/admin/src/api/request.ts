import { getAccessToken, refreshAccessToken } from '../auth/session';
import { apiBaseUrl } from './base';

export async function requestResponse(
  path: string,
  init: RequestInit = {},
  timeout = 6000,
  retry = true,
): Promise<Response> {
  const token = getAccessToken();
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    signal: init.signal ?? AbortSignal.timeout(timeout),
    headers,
  });
  if (response.status === 401 && retry) {
    if ((getAccessToken() && getAccessToken() !== token) || (await refreshAccessToken()))
      return requestResponse(path, init, timeout, false);
  }
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { code?: string } | null;
    throw new Error(error?.code ?? `HTTP_${response.status}`);
  }
  return response;
}

export async function request<T>(path: string, init?: RequestInit, timeout?: number): Promise<T> {
  const response = await requestResponse(path, init, timeout);
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}

export function queryString(query: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  return params.toString();
}
