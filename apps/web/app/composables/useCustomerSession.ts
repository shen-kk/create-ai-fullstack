import type {
  ApiError,
  CustomerLoginRequest,
  CustomerProfile,
  CustomerRegisterRequest,
  CustomerSession,
  SendVerificationCodeRequest,
  SendVerificationCodeResponse,
} from '@template/contracts';

const customer = ref<CustomerProfile | null>(null);
const accessToken = ref('');
const restoring = ref(false);
const restored = ref(false);

function apiBase(): string {
  return useRuntimeConfig().public.apiBaseUrl;
}
async function parseError(response: Response): Promise<Error> {
  const fallback = `请求失败（${response.status}）`;
  try {
    const body = (await response.json()) as ApiError;
    return new Error(body.message || body.code || fallback);
  } catch {
    return new Error(fallback);
  }
}
async function requestSession(path: string, init: RequestInit): Promise<CustomerSession> {
  const response = await fetch(`${apiBase()}/customer-auth${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  if (!response.ok) throw await parseError(response);
  const session = (await response.json()) as CustomerSession;
  accessToken.value = session.accessToken;
  customer.value = session.customer;
  return session;
}
export function useCustomerSession() {
  async function sendVerification(
    input: SendVerificationCodeRequest,
  ): Promise<SendVerificationCodeResponse> {
    const response = await fetch(`${apiBase()}/customer-auth/verification/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw await parseError(response);
    return response.json() as Promise<SendVerificationCodeResponse>;
  }
  async function login(input: CustomerLoginRequest): Promise<void> {
    await requestSession('/login', { method: 'POST', body: JSON.stringify(input) });
  }
  async function loginWithCode(input: { phone: string; code: string }): Promise<void> {
    await requestSession('/login/code', { method: 'POST', body: JSON.stringify(input) });
  }
  async function register(input: CustomerRegisterRequest): Promise<void> {
    await requestSession('/register', { method: 'POST', body: JSON.stringify(input) });
  }
  async function restore(): Promise<void> {
    if (restored.value || restoring.value) return;
    restoring.value = true;
    try {
      await requestSession('/refresh', { method: 'POST' });
    } catch {
      customer.value = null;
      accessToken.value = '';
    } finally {
      restoring.value = false;
      restored.value = true;
    }
  }
  async function logout(): Promise<void> {
    try {
      await fetch(`${apiBase()}/customer-auth/logout`, { method: 'POST', credentials: 'include' });
    } finally {
      customer.value = null;
      accessToken.value = '';
      restored.value = true;
    }
  }
  async function authenticated<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!accessToken.value) await restore();
    const response = await fetch(`${apiBase()}/customer-auth${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${accessToken.value}`,
        ...init.headers,
      },
    });
    if (!response.ok) throw await parseError(response);
    return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
  }
  async function updateProfile(input: {
    name: string;
    email: string | null;
    avatarUrl: string | null;
  }): Promise<CustomerProfile> {
    const updated = await authenticated<CustomerProfile>('/profile', {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    customer.value = updated;
    return updated;
  }
  return {
    customer: readonly(customer),
    accessToken: readonly(accessToken),
    restoring: readonly(restoring),
    restored: readonly(restored),
    login,
    loginWithCode,
    register,
    restore,
    logout,
    authenticated,
    updateProfile,
    sendVerification,
  };
}
