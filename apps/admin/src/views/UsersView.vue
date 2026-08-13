<script setup lang="ts">
import type { RoleOption, UserStatus, UserSummary } from '@template/contracts';
import { onMounted, ref } from 'vue';

import {
  assignUserRoles,
  changeUserStatus,
  createUser,
  getRoleOptions,
  getUsers,
  updateUser,
} from '../api/users';
import AppSelect from '../components/AppSelect.vue';
import AppPagination from '../components/AppPagination.vue';
import AppCheckbox from '../components/AppCheckbox.vue';

const keyword = ref('');
const selectedStatus = ref<'' | UserStatus>('');
const users = ref<UserSummary[]>([]);
const page = ref(1);
const pageSize = ref(10);
const total = ref(0);
const loading = ref(false);
const error = ref('');
const notice = ref('');
const createOpen = ref(false);
const saving = ref(false);
const createForm = ref({ name: '', phone: '', email: '', password: '' });
const editOpen = ref(false);
const editTargetId = ref('');
const editForm = ref({ name: '', phone: '', email: '' });
const rolesOpen = ref(false);
const rolesTarget = ref<UserSummary | null>(null);
const roleOptions = ref<RoleOption[]>([]);
const selectedRoleCodes = ref<string[]>([]);

const statusLabels: Record<UserStatus, string> = {
  active: '正常',
  disabled: '已停用',
  pending: '待激活',
};
const statusOptions = [
  { value: '', label: '全部状态' },
  { value: 'active', label: '正常' },
  { value: 'pending', label: '待激活' },
  { value: 'disabled', label: '已停用' },
];
const rowStatusOptions = statusOptions.slice(1);

function formatDate(value: string | null): string {
  if (!value) return '从未登录';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

async function loadUsers(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const result = await getUsers({
      ...(keyword.value ? { keyword: keyword.value } : {}),
      ...(selectedStatus.value ? { status: selectedStatus.value } : {}),
      page: page.value,
      pageSize: pageSize.value,
    });
    users.value = result.items;
    total.value = result.total;
  } catch {
    error.value = '用户数据加载失败，请检查 API 服务后重试。';
    users.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function search(): void {
  page.value = 1;
  void loadUsers();
}
function reset(): void {
  keyword.value = '';
  selectedStatus.value = '';
  page.value = 1;
  void loadUsers();
}
async function submitCreate(): Promise<void> {
  saving.value = true;
  notice.value = '';
  try {
    await createUser(createForm.value);
    createOpen.value = false;
    createForm.value = { name: '', phone: '', email: '', password: '' };
    notice.value = '管理员已创建，当前状态为待激活。';
    page.value = 1;
    await loadUsers();
  } catch {
    notice.value = '创建失败，请检查邮箱是否重复及输入是否符合要求。';
  } finally {
    saving.value = false;
  }
}
async function setStatus(user: UserSummary, status: UserStatus): Promise<void> {
  if (user.status === status || saving.value) return;
  saving.value = true;
  notice.value = '';
  try {
    await changeUserStatus(user.id, { status });
    notice.value = `已更新 ${user.name} 的状态。`;
    await loadUsers();
  } catch {
    notice.value = '状态更新失败，请重新登录或检查 API 服务。';
  } finally {
    saving.value = false;
  }
}
function openEdit(user: UserSummary): void {
  editTargetId.value = user.id;
  editForm.value = { name: user.name, phone: user.phone, email: user.email ?? '' };
  editOpen.value = true;
}
async function submitEdit(): Promise<void> {
  saving.value = true;
  notice.value = '';
  try {
    await updateUser(editTargetId.value, editForm.value);
    editOpen.value = false;
    notice.value = '用户基本资料已更新。';
    await loadUsers();
  } catch {
    notice.value = '更新失败，请检查邮箱是否与其他用户重复。';
  } finally {
    saving.value = false;
  }
}
async function openRoles(user: UserSummary): Promise<void> {
  rolesTarget.value = user;
  selectedRoleCodes.value = [...user.roleCodes];
  rolesOpen.value = true;
  try {
    roleOptions.value = await getRoleOptions();
  } catch {
    notice.value = '角色列表加载失败，请重新登录。';
    rolesOpen.value = false;
  }
}
async function submitRoles(): Promise<void> {
  if (!rolesTarget.value) return;
  saving.value = true;
  notice.value = '';
  try {
    await assignUserRoles(rolesTarget.value.id, { roleCodes: selectedRoleCodes.value });
    rolesOpen.value = false;
    notice.value = '用户角色已更新。';
    await loadUsers();
  } catch {
    notice.value = '角色更新失败，请检查权限或角色是否仍然存在。';
  } finally {
    saving.value = false;
  }
}
function toggleRole(code: string, checked: boolean): void {
  const next = new Set(selectedRoleCodes.value);
  checked ? next.add(code) : next.delete(code);
  selectedRoleCodes.value = [...next];
}

onMounted(loadUsers);
</script>

<template>
  <div class="users-page">
    <section class="page-heading users-heading">
      <div>
        <p class="eyebrow">系统管理 / 管理员</p>
        <h1>管理员</h1>
        <p>通过手机号创建和管理后台账号，邮箱仅作为可选联系资料。</p>
      </div>
      <button class="primary-button" @click="createOpen = true">＋ 新增管理员</button>
    </section>
    <p v-if="notice" class="operation-notice" role="status">{{ notice }}</p>

    <section class="panel filter-panel" aria-label="用户筛选">
      <form class="filter-form" @submit.prevent="search">
        <label
          ><span>关键词</span
          ><input v-model="keyword" type="search" placeholder="搜索姓名、手机号或邮箱"
        /></label>
        <label
          ><span>账号状态</span
          ><AppSelect v-model="selectedStatus" aria-label="账号状态" :options="statusOptions"
        /></label>
        <div class="filter-actions">
          <button type="button" class="secondary-button" @click="reset">重置</button
          ><button type="submit" class="primary-button">查询</button>
        </div>
      </form>
    </section>

    <section class="panel users-table-panel">
      <header class="table-header">
        <div>
          <h2>管理员列表</h2>
          <p>共 {{ total }} 位管理员</p>
        </div>
        <span class="template-badge">后台身份</span>
      </header>
      <div v-if="loading" class="table-state"><span class="loading-ring" />正在加载用户…</div>
      <div v-else-if="error" class="table-state error-state">
        <strong>加载失败</strong>
        <p>{{ error }}</p>
        <button class="secondary-button" @click="loadUsers">重新加载</button>
      </div>
      <div v-else-if="users.length === 0" class="table-state">
        <strong>没有找到用户</strong>
        <p>尝试更换关键词或状态筛选。</p>
        <button class="secondary-button" @click="reset">清空筛选</button>
      </div>
      <div v-else class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>用户</th>
              <th>角色</th>
              <th>状态</th>
              <th>加入时间</th>
              <th>最近活跃</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td>
                <div class="user-cell">
                  <span class="user-avatar">{{ user.name.slice(0, 1) }}</span>
                  <div>
                    <strong>{{ user.name }}</strong
                    ><small
                      >{{ user.phone
                      }}<template v-if="user.email"> · {{ user.email }}</template></small
                    >
                  </div>
                </div>
              </td>
              <td>{{ user.role }}</td>
              <td>
                <AppSelect
                  class="status-select"
                  :model-value="user.status"
                  :disabled="saving"
                  :aria-label="`修改 ${user.name} 的状态`"
                  :options="rowStatusOptions"
                  @change="setStatus(user, $event as UserStatus)"
                />
              </td>
              <td>{{ formatDate(user.createdAt) }}</td>
              <td>{{ formatDate(user.lastActiveAt) }}</td>
              <td>
                <div class="row-actions">
                  <button class="row-action" @click="openEdit(user)">编辑</button
                  ><button class="row-action" @click="openRoles(user)">角色</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <AppPagination
        v-if="!loading && !error && users.length"
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="total"
        @change="loadUsers"
      />
    </section>
    <div v-if="createOpen" class="dialog-backdrop">
      <form class="user-dialog" @submit.prevent="submitCreate">
        <header>
          <div>
            <p class="eyebrow">系统管理</p>
            <h2>新增管理员</h2>
          </div>
          <button type="button" class="dialog-close" aria-label="关闭" @click="createOpen = false">
            ×
          </button>
        </header>
        <label
          ><span>姓名</span
          ><input v-model.trim="createForm.name" required minlength="2" maxlength="80" /></label
        ><label
          ><span>手机号</span
          ><input
            v-model.trim="createForm.phone"
            required
            type="tel"
            inputmode="tel"
            pattern="\+?[1-9]\d{6,14}" /></label
        ><label
          ><span>邮箱（可选）</span
          ><input v-model.trim="createForm.email" type="email" maxlength="254" /></label
        ><label
          ><span>初始密码</span
          ><input
            v-model="createForm.password"
            required
            type="password"
            minlength="12"
            maxlength="128"
            autocomplete="new-password"
          /><small>至少 12 个字符，服务端仅保存 scrypt 哈希。</small></label
        >
        <footer>
          <button type="button" class="secondary-button" @click="createOpen = false">取消</button
          ><button class="primary-button" :disabled="saving">
            {{ saving ? '正在创建…' : '创建管理员' }}
          </button>
        </footer>
      </form>
    </div>
    <div v-if="editOpen" class="dialog-backdrop">
      <form class="user-dialog" @submit.prevent="submitEdit">
        <header>
          <div>
            <p class="eyebrow">系统管理</p>
            <h2>编辑管理员</h2>
          </div>
          <button type="button" class="dialog-close" aria-label="关闭" @click="editOpen = false">
            ×
          </button>
        </header>
        <label
          ><span>姓名</span
          ><input v-model.trim="editForm.name" required minlength="2" maxlength="80" /></label
        ><label
          ><span>手机号</span
          ><input
            v-model.trim="editForm.phone"
            required
            type="tel"
            inputmode="tel"
            pattern="\+?[1-9]\d{6,14}" /></label
        ><label
          ><span>邮箱（可选）</span
          ><input v-model.trim="editForm.email" type="email" maxlength="254"
        /></label>
        <footer>
          <button type="button" class="secondary-button" @click="editOpen = false">取消</button
          ><button class="primary-button" :disabled="saving">
            {{ saving ? '正在保存…' : '保存修改' }}
          </button>
        </footer>
      </form>
    </div>
    <div v-if="rolesOpen" class="dialog-backdrop">
      <form class="user-dialog" @submit.prevent="submitRoles">
        <header>
          <div>
            <p class="eyebrow">角色权限</p>
            <h2>分配角色 · {{ rolesTarget?.name }}</h2>
          </div>
          <button type="button" class="dialog-close" aria-label="关闭" @click="rolesOpen = false">
            ×
          </button>
        </header>
        <div class="role-options">
          <div v-for="role in roleOptions" :key="role.code" class="role-option">
            <AppCheckbox
              :model-value="selectedRoleCodes.includes(role.code)"
              :disabled="saving"
              @update:model-value="toggleRole(role.code, $event)"
            >
              <strong>{{ role.name }}</strong>
              <small>{{ role.description || role.code }}</small>
            </AppCheckbox>
            <i v-if="role.system">系统</i>
          </div>
        </div>
        <footer>
          <button type="button" class="secondary-button" @click="rolesOpen = false">取消</button
          ><button class="primary-button" :disabled="saving">
            {{ saving ? '正在保存…' : '保存角色' }}
          </button>
        </footer>
      </form>
    </div>
  </div>
</template>
