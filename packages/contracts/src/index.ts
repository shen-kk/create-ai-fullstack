export interface HealthResponse {
  status: 'ok';
  service: string;
  timestamp: string;
}

export interface SystemInfoResponse {
  service: string;
  version: string;
  environment: 'development' | 'test' | 'production';
  dataSource: 'memory' | 'prisma';
  uptimeSeconds: number;
  nodeVersion: string;
  timestamp: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export type UserStatus = 'active' | 'disabled' | 'pending';

export interface UserSummary {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: string;
  roleCodes: string[];
  status: UserStatus;
  createdAt: string;
  lastActiveAt: string | null;
}

export interface UserListQuery {
  keyword?: string;
  status?: UserStatus;
  page?: number;
  pageSize?: number;
}

export type UserListResponse = PageResult<UserSummary>;

export interface CreateUserRequest {
  name: string;
  phone: string;
  email?: string;
  password: string;
}
export interface UpdateUserRequest {
  name: string;
  phone: string;
  email?: string;
}
export interface ChangeUserStatusRequest {
  status: UserStatus;
}
export interface RoleOption {
  code: string;
  name: string;
  description: string | null;
  system: boolean;
  permissions: string[];
}
export interface AssignUserRolesRequest {
  roleCodes: string[];
}
export type PermissionType = 'menu' | 'action';
export interface PermissionOption {
  code: string;
  description: string;
  type: PermissionType;
  groupCode: string;
}
/**
 * 权限目录的代码权威来源。新增后台模块时先在这里登记菜单与操作权限，
 * API 种子、内存预览和 Admin 角色配置会共同读取此目录。
 */
export const permissionCatalog = [
  { code: 'menu.dashboard', description: '显示工作台菜单', type: 'menu', groupCode: 'dashboard' },
  { code: 'menu.users', description: '显示用户管理菜单', type: 'menu', groupCode: 'users' },
  {
    code: 'menu.customers',
    description: '显示用户端用户菜单',
    type: 'menu',
    groupCode: 'customers',
  },
  { code: 'menu.roles', description: '显示角色权限菜单', type: 'menu', groupCode: 'roles' },
  { code: 'menu.audit', description: '显示操作日志菜单', type: 'menu', groupCode: 'audit' },
  {
    code: 'menu.verification',
    description: '显示验证码记录菜单',
    type: 'menu',
    groupCode: 'verification',
  },
  { code: 'menu.system', description: '显示系统信息菜单', type: 'menu', groupCode: 'system' },
  {
    code: 'menu.integrations',
    description: '显示服务配置菜单',
    type: 'menu',
    groupCode: 'integrations',
  },
  {
    code: 'menu.deployments',
    description: '显示部署中心菜单',
    type: 'menu',
    groupCode: 'deployments',
  },
  { code: 'users.read', description: '查看用户', type: 'action', groupCode: 'users' },
  { code: 'users.write', description: '创建和修改用户', type: 'action', groupCode: 'users' },
  {
    code: 'customers.read',
    description: '查看用户端用户',
    type: 'action',
    groupCode: 'customers',
  },
  {
    code: 'customers.write',
    description: '修改用户端用户状态',
    type: 'action',
    groupCode: 'customers',
  },
  { code: 'roles.manage', description: '管理角色与权限', type: 'action', groupCode: 'roles' },
  { code: 'audit.read', description: '查看审计日志', type: 'action', groupCode: 'audit' },
  {
    code: 'verification.read',
    description: '查看验证码发送记录',
    type: 'action',
    groupCode: 'verification',
  },
  { code: 'system.read', description: '查看系统运行信息', type: 'action', groupCode: 'system' },
  {
    code: 'integrations.manage',
    description: '管理外部服务配置',
    type: 'action',
    groupCode: 'integrations',
  },
  {
    code: 'deployments.read',
    description: '查看部署环境、任务与日志',
    type: 'action',
    groupCode: 'deployments',
  },
  {
    code: 'deployments.manage',
    description: '管理部署环境和加密凭据',
    type: 'action',
    groupCode: 'deployments',
  },
  {
    code: 'deployments.execute',
    description: '执行或取消部署',
    type: 'action',
    groupCode: 'deployments',
  },
  {
    code: 'deployments.rollback',
    description: '回滚到历史成功版本',
    type: 'action',
    groupCode: 'deployments',
  },
] as const satisfies readonly PermissionOption[];
export interface CreateRoleRequest {
  code: string;
  name: string;
  description?: string;
  permissions: string[];
}
export interface UpdateRoleRequest {
  name: string;
  description?: string;
  permissions: string[];
}
export interface AuditLogSummary {
  id: string;
  actorId: string | null;
  actorName?: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  result: string;
  requestId: string | null;
  ipAddress: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
export type AuditLogListResponse = PageResult<AuditLogSummary>;
export interface AuditLogListQuery {
  keyword?: string;
  action?: string;
  resource?: string;
  result?: 'success' | 'failure';
  page?: number;
  pageSize?: number;
}

export interface LoginRequest {
  phone: string;
  password: string;
}
export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  avatarUrl: string | null;
  permissions: string[];
}
export interface AuthSession {
  accessToken: string;
  expiresIn: number;
  user: AuthUser;
}
export interface UpdateProfileRequest {
  name: string;
  avatarUrl?: string | null;
}
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export type CustomerStatus = 'active' | 'disabled';
export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  avatarUrl: string | null;
  status: CustomerStatus;
  createdAt: string;
  phoneVerifiedAt: string | null;
  emailVerifiedAt: string | null;
}
export interface CustomerSummary extends CustomerProfile {
  lastActiveAt: string | null;
}
export interface CustomerListQuery {
  keyword?: string;
  status?: CustomerStatus;
  page?: number;
  pageSize?: number;
}
export type CustomerListResponse = PageResult<CustomerSummary>;
export interface ChangeCustomerStatusRequest {
  status: CustomerStatus;
}
export interface CustomerSession {
  accessToken: string;
  expiresIn: number;
  customer: CustomerProfile;
}
export interface CustomerRegisterRequest {
  phone: string;
  password: string;
  name: string;
  email?: string;
  verificationCode: string;
}
export interface CustomerLoginRequest {
  phone: string;
  password: string;
}
export type VerificationChannel = 'sms' | 'email';
export type VerificationPurpose = 'register' | 'login' | 'reset_password' | 'bind_contact';
export interface SendVerificationCodeRequest {
  channel: VerificationChannel;
  target: string;
  purpose: VerificationPurpose;
}
export interface SendVerificationCodeResponse {
  expiresIn: number;
  retryAfter: number;
}
export interface VerificationCodeLoginRequest {
  phone: string;
  code: string;
}
export interface ResetCustomerPasswordRequest {
  phone: string;
  code: string;
  newPassword: string;
}
export interface BindCustomerContactRequest {
  channel: VerificationChannel;
  target: string;
  code: string;
}
export interface CustomerSessionDevice {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}
export interface VerificationDeliverySummary {
  id: string;
  channel: VerificationChannel;
  purpose: VerificationPurpose;
  targetMasked: string;
  status: 'sent' | 'failed' | 'consumed' | 'expired';
  attempts: number;
  failureCode: string | null;
  createdAt: string;
  consumedAt: string | null;
}
export interface VerificationDeliveryQuery {
  channel?: VerificationChannel;
  purpose?: VerificationPurpose;
  status?: 'sent' | 'failed' | 'consumed' | 'expired';
  page?: number;
  pageSize?: number;
}
export type VerificationDeliveryListResponse = PageResult<VerificationDeliverySummary>;
export interface UpdateCustomerProfileRequest {
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
}
export interface ChangeCustomerPasswordRequest {
  currentPassword: string;
  newPassword: string;
}
export type IntegrationKind = 'object_storage' | 'sql' | 'redis' | 'sms' | 'email' | 'payment';
export interface IntegrationField {
  key: string;
  label: string;
  secret: boolean;
  required: boolean;
  options?: Array<{ value: string; label: string }>;
}
export interface IntegrationConfigSummary {
  kind: IntegrationKind;
  name: string;
  description: string;
  enabled: boolean;
  configured: boolean;
  values: Record<string, string>;
  configuredSecrets: string[];
  fields: IntegrationField[];
  updatedAt: string | null;
}
export interface UpdateIntegrationConfigRequest {
  enabled: boolean;
  values: Record<string, string>;
  secrets: Record<string, string>;
}

export type DeployApplication = 'admin' | 'api' | 'web';
export type DeployEnvironmentKind = 'development' | 'test' | 'staging' | 'production' | 'custom';
export type DeployGitProvider = 'github' | 'gitlab' | 'cnb' | 'gitee' | 'generic';
export type DeployGitAuthMode = 'none' | 'token' | 'ssh_key';
export type DeploySshAuthMode = 'password' | 'private_key';
export type DeployEnvironmentStatus = 'draft' | 'verified' | 'unreachable';
export type DeployRunStatus =
  'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'rolling_back' | 'rolled_back';
export type DeployStepStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';

export interface DeploymentEnvironmentSummary {
  id: string;
  name: string;
  kind: DeployEnvironmentKind;
  applications: DeployApplication[];
  gitProvider: DeployGitProvider;
  repositoryUrl: string;
  gitRef: string;
  gitAuthMode: DeployGitAuthMode;
  host: string;
  sshPort: number;
  sshUser: string;
  sshAuthMode: DeploySshAuthMode;
  deployPath: string;
  adminUrl: string | null;
  apiUrl: string | null;
  webUrl: string | null;
  healthCheckUrl: string | null;
  retainReleases: number;
  configuredSecrets: string[];
  status: DeployEnvironmentStatus;
  lastVerifiedAt: string | null;
  currentRelease: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertDeploymentEnvironmentRequest {
  name: string;
  kind: DeployEnvironmentKind;
  applications: DeployApplication[];
  gitProvider: DeployGitProvider;
  repositoryUrl: string;
  gitRef: string;
  gitAuthMode: DeployGitAuthMode;
  host: string;
  sshPort: number;
  sshUser: string;
  sshAuthMode: DeploySshAuthMode;
  deployPath: string;
  adminUrl?: string;
  apiUrl?: string;
  webUrl?: string;
  healthCheckUrl?: string;
  retainReleases: number;
  secrets: {
    gitToken?: string;
    gitSshPrivateKey?: string;
    sshPassword?: string;
    sshPrivateKey?: string;
    databaseUrl?: string;
    jwtAccessSecret?: string;
    jwtRefreshSecret?: string;
    configEncryptionKey?: string;
    customerJwtAccessSecret?: string;
    customerJwtRefreshSecret?: string;
  };
}

export interface DeploymentCheckItem {
  key: string;
  label: string;
  status: 'passed' | 'failed';
  message: string;
}
export interface DeploymentCheckResult {
  success: boolean;
  checkedAt: string;
  checks: DeploymentCheckItem[];
}
export interface DeploymentStepSummary {
  id: string;
  key: string;
  label: string;
  status: DeployStepStatus;
  progress: number;
  message: string | null;
  startedAt: string | null;
  completedAt: string | null;
}
export interface DeploymentRunSummary {
  id: string;
  environmentId: string;
  actorId: string | null;
  gitRef: string;
  commitSha: string | null;
  applications: DeployApplication[];
  status: DeployRunStatus;
  progress: number;
  currentStep: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  releaseId: string | null;
  steps: DeploymentStepSummary[];
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}
export interface DeploymentLogEntry {
  id: string;
  sequence: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  createdAt: string;
}
export interface DeploymentReleaseSummary {
  id: string;
  environmentId: string;
  version: string;
  commitSha: string;
  applications: DeployApplication[];
  createdAt: string;
  current: boolean;
}
export interface CreateDeploymentRunRequest {
  applications: DeployApplication[];
  gitRef?: string;
}
