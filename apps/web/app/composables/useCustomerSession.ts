import type {
  ApiError,
  BindCustomerContactRequest,
  ChangeCustomerPasswordRequest,
  CustomerLoginRequest,
  CustomerProfile,
  CustomerRegisterRequest,
  CustomerSession,
  CustomerSessionDevice,
  ResetCustomerPasswordRequest,
  SendVerificationCodeRequest,
  SendVerificationCodeResponse,
  UpdateCustomerProfileRequest,
  VerificationCodeLoginRequest,
} from '@template/contracts';
import { readonly } from 'vue';

const errorLabels: Record<string, string> = {
  INVALID_CUSTOMER_CREDENTIALS: '手机号或密码错误',
  CUSTOMER_NOT_FOUND: '用户不存在或账号已停用',
  CUSTOMER_PHONE_EXISTS: '该手机号已经注册',
  VERIFICATION_CODE_INVALID: '验证码错误或已过期',
  VERIFICATION_ATTEMPTS_EXCEEDED: '验证码错误次数过多，请重新获取',
  VERIFICATION_RETRY_LATER: '验证码发送过于频繁，请稍后再试',
  INVALID_PHONE: '手机号格式不正确',
  INVALID_EMAIL: '邮箱格式不正确',
  CURRENT_PASSWORD_INVALID: '当前密码不正确',
  PASSWORD_UNCHANGED: '新密码不能与当前密码相同',
  CUSTOMER_SESSION_NOT_FOUND: '登录设备不存在或已经退出',
  SMS_NOT_CONFIGURED: '短信服务尚未配置，请联系管理员',
  EMAIL_NOT_CONFIGURED: '邮件服务尚未配置，请联系管理员',
  SMS_CONFIG_INCOMPLETE: '短信服务配置不完整，请联系管理员',
  EMAIL_CONFIG_INCOMPLETE: '邮件服务配置不完整，请联系管理员',
  SMS_PROVIDER_ADAPTER_REQUIRED: '短信服务暂不可用，请联系管理员',
  EMAIL_PROVIDER_ADAPTER_REQUIRED: '邮件服务暂不可用，请联系管理员',
  SMS_DELIVERY_FAILED: '短信发送失败，请稍后重试',
  EMAIL_DELIVERY_FAILED: '邮件发送失败，请稍后重试',
  LOGIN_RATE_LIMITED: '尝试次数过多，请稍后再试',
  RATE_LIMITED: '请求过于频繁，请稍后再试',
  VALIDATION_ERROR: '请检查填写内容是否完整正确',
  SERVICE_UNAVAILABLE: '服务暂时不可用，请稍后重试',
};

export class CustomerApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'CustomerApiError';
  }
}

let refreshPromise: Promise<CustomerSession> | null = null;

async function parseError(response: Response): Promise<CustomerApiError> {
  const fallback = `请求失败（${response.status}）`;
  try {
    const body = (await response.json()) as ApiError & { requestId?: string };
    const message = errorLabels[body.code] ?? body.message ?? fallback;
    return new CustomerApiError(
      body.code || 'REQUEST_FAILED',
      message,
      response.status,
      body.requestId,
    );
  } catch {
    return new CustomerApiError('REQUEST_FAILED', fallback, response.status);
  }
}

async function fetchApi(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError')
      throw new CustomerApiError('REQUEST_TIMEOUT', '请求超时，请检查网络后重试', 0);
    throw new CustomerApiError('NETWORK_ERROR', '网络连接失败，请稍后重试', 0);
  } finally {
    clearTimeout(timeout);
  }
}

export function useCustomerSession() {
  const customer = useState<CustomerProfile | null>('customer-profile', () => null);
  const accessToken = useState('customer-access-token', () => '');
  const restoring = useState('customer-restoring', () => false);
  const restored = useState('customer-restored', () => false);
  const apiBase = () => useRuntimeConfig().public.apiBaseUrl;

  function applySession(session: CustomerSession): CustomerSession {
    accessToken.value = session.accessToken;
    customer.value = session.customer;
    restored.value = true;
    return session;
  }

  function clearSession(): void {
    customer.value = null;
    accessToken.value = '';
    restored.value = true;
  }

  async function requestSession(path: string, init: RequestInit): Promise<CustomerSession> {
    const response = await fetchApi(`${apiBase()}/customer-auth${path}`, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init.headers },
    });
    if (!response.ok) throw await parseError(response);
    return applySession((await response.json()) as CustomerSession);
  }

  async function refreshSession(): Promise<CustomerSession> {
    if (!refreshPromise) {
      refreshPromise = requestSession('/refresh', { method: 'POST' }).finally(() => {
        refreshPromise = null;
      });
    }
    return refreshPromise;
  }

  async function restore(force = false): Promise<void> {
    if ((!force && restored.value) || restoring.value) return;
    restoring.value = true;
    try {
      await refreshSession();
    } catch {
      clearSession();
    } finally {
      restoring.value = false;
      restored.value = true;
    }
  }

  async function authenticated<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
    if (!accessToken.value) await restore();
    if (!accessToken.value)
      throw new CustomerApiError('AUTHENTICATION_REQUIRED', '登录状态已失效，请重新登录', 401);
    const response = await fetchApi(`${apiBase()}/customer-auth${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${accessToken.value}`,
        ...init.headers,
      },
    });
    if (response.status === 401 && retry) {
      try {
        await refreshSession();
        return authenticated<T>(path, init, false);
      } catch {
        clearSession();
        throw new CustomerApiError('AUTHENTICATION_REQUIRED', '登录状态已失效，请重新登录', 401);
      }
    }
    if (!response.ok) throw await parseError(response);
    return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
  }

  async function sendVerification(
    input: SendVerificationCodeRequest,
  ): Promise<SendVerificationCodeResponse> {
    const response = await fetchApi(`${apiBase()}/customer-auth/verification/send`, {
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
  async function loginWithCode(input: VerificationCodeLoginRequest): Promise<void> {
    await requestSession('/login/code', { method: 'POST', body: JSON.stringify(input) });
  }
  async function register(input: CustomerRegisterRequest): Promise<void> {
    await requestSession('/register', { method: 'POST', body: JSON.stringify(input) });
  }
  async function resetPassword(input: ResetCustomerPasswordRequest): Promise<void> {
    const response = await fetchApi(`${apiBase()}/customer-auth/password/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw await parseError(response);
  }
  async function logout(): Promise<void> {
    try {
      await fetchApi(`${apiBase()}/customer-auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      clearSession();
    }
  }
  async function updateProfile(input: UpdateCustomerProfileRequest): Promise<CustomerProfile> {
    const updated = await authenticated<CustomerProfile>('/profile', {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    customer.value = updated;
    return updated;
  }
  async function changePassword(input: ChangeCustomerPasswordRequest): Promise<void> {
    await authenticated('/password', { method: 'POST', body: JSON.stringify(input) });
  }
  async function bindContact(input: BindCustomerContactRequest): Promise<CustomerProfile> {
    const updated = await authenticated<CustomerProfile>('/contact/bind', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    customer.value = updated;
    return updated;
  }
  const listSessions = () => authenticated<CustomerSessionDevice[]>('/sessions');
  const revokeSession = (id: string) =>
    authenticated<void>(`/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
  const revokeOtherSessions = () => authenticated<void>('/sessions/others', { method: 'DELETE' });

  return {
    customer: readonly(customer),
    accessToken: readonly(accessToken),
    restoring: readonly(restoring),
    restored: readonly(restored),
    login,
    loginWithCode,
    register,
    resetPassword,
    restore,
    logout,
    authenticated,
    updateProfile,
    changePassword,
    bindContact,
    listSessions,
    revokeSession,
    revokeOtherSessions,
    sendVerification,
  };
}
