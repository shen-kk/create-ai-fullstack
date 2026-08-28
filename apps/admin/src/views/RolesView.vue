<script setup lang="ts">
import type { PermissionOption, RoleOption } from '@template/contracts';
import { computed, onMounted, ref } from 'vue';
import { createRole, getPermissions, updateRole } from '../api/roles';
import { getRoleOptions } from '../api/users';
import AppCheckbox from '../components/AppCheckbox.vue';
import AppDialog from '../components/AppDialog.vue';

const roles = ref<RoleOption[]>([]);
const permissions = ref<PermissionOption[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const notice = ref('');
const dialogOpen = ref(false);
const editingCode = ref('');
const form = ref({ code: '', name: '', description: '', permissions: [] as string[] });
const groupNames: Record<string, string> = {
  dashboard: '工作台',
  users: '管理员',
  customers: '用户端用户',
  roles: '角色权限',
  audit: '操作日志',
  verification: '验证码记录',
  system: '系统信息',
  integrations: '服务配置',
  security: '敏感信息',
  deployments: '部署中心',
};
const permissionGroups = computed(() => {
  const groups = new Map<
    string,
    { code: string; menu?: PermissionOption; actions: PermissionOption[] }
  >();
  permissions.value.forEach((permission) => {
    const group = groups.get(permission.groupCode) ?? {
      code: permission.groupCode,
      actions: [],
    };
    if (permission.type === 'menu') group.menu = permission;
    else group.actions.push(permission);
    groups.set(permission.groupCode, group);
  });
  return [...groups.values()];
});
function togglePermissionItems(items: PermissionOption[], checked: boolean): void {
  const next = new Set(form.value.permissions);
  items.forEach((permission) =>
    checked ? next.add(permission.code) : next.delete(permission.code),
  );
  form.value.permissions = [...next];
}
function allSelected(items: PermissionOption[]): boolean {
  return (
    items.length > 0 &&
    items.every((permission) => form.value.permissions.includes(permission.code))
  );
}
function isSelected(code: string): boolean {
  return form.value.permissions.includes(code);
}
function togglePermission(code: string, checked: boolean): void {
  const next = new Set(form.value.permissions);
  checked ? next.add(code) : next.delete(code);
  form.value.permissions = [...next];
}
function groupItems(group: (typeof permissionGroups.value)[number]): PermissionOption[] {
  return [...(group.menu ? [group.menu] : []), ...group.actions];
}
async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    [roles.value, permissions.value] = await Promise.all([getRoleOptions(), getPermissions()]);
  } catch {
    error.value = '角色目录加载失败，请检查权限与 API 服务。';
  } finally {
    loading.value = false;
  }
}
function openCreate(): void {
  editingCode.value = '';
  form.value = { code: '', name: '', description: '', permissions: [] };
  dialogOpen.value = true;
}
function openEdit(role: RoleOption): void {
  if (role.system) return;
  editingCode.value = role.code;
  form.value = {
    code: role.code,
    name: role.name,
    description: role.description || '',
    permissions: [...role.permissions],
  };
  dialogOpen.value = true;
}
async function submit(): Promise<void> {
  saving.value = true;
  notice.value = '';
  try {
    const description = form.value.description.trim();
    if (editingCode.value)
      await updateRole(editingCode.value, {
        name: form.value.name,
        ...(description ? { description } : {}),
        permissions: form.value.permissions,
      });
    else
      await createRole({
        code: form.value.code,
        name: form.value.name,
        ...(description ? { description } : {}),
        permissions: form.value.permissions,
      });
    dialogOpen.value = false;
    notice.value = editingCode.value ? '角色已更新。' : '角色已创建。';
    await load();
  } catch {
    notice.value = '保存失败：角色代码可能重复，或权限已不存在。';
  } finally {
    saving.value = false;
  }
}
onMounted(load);
</script>
<template>
  <div>
    <section class="page-heading">
      <div>
        <p class="eyebrow">系统 / 角色权限</p>
        <h1>角色权限</h1>
        <p>分别配置功能菜单可见性与服务端操作权限。</p>
      </div>
      <div class="heading-actions">
        <button class="secondary-button" :disabled="loading" @click="load">刷新</button
        ><button class="primary-button" @click="openCreate">＋ 新增角色</button>
      </div>
    </section>
    <p
      v-if="notice"
      :key="notice"
      class="operation-notice"
      :role="/失败|错误|不能|请检查/.test(notice) ? 'alert' : 'status'"
    >
      {{ notice }}
    </p>
    <div v-if="loading" class="panel table-state"><span class="loading-ring" />正在加载角色…</div>
    <div v-else-if="error" class="panel table-state error-state">
      <strong>加载失败</strong>
      <p>{{ error }}</p>
    </div>
    <div v-else class="role-grid">
      <article v-for="role in roles" :key="role.code" class="panel role-card">
        <header>
          <div>
            <h2>{{ role.name }}</h2>
            <code>{{ role.code }}</code>
          </div>
          <span v-if="role.system" class="template-badge">系统角色</span>
        </header>
        <p>{{ role.description || '暂无角色说明' }}</p>
        <div class="permission-list">
          <span
            v-for="permission in role.permissions"
            :key="permission"
            :class="{
              'menu-permission':
                permissions.find((item) => item.code === permission)?.type === 'menu',
            }"
            >{{ permissions.find((item) => item.code === permission)?.description || permission
            }}<small>{{ permission }}</small></span
          ><em v-if="!role.permissions.length">暂未分配权限</em>
        </div>
        <button v-if="!role.system" class="secondary-button role-edit" @click="openEdit(role)">
          编辑角色
        </button>
        <p v-else class="system-role-tip">系统角色受保护，不允许修改</p>
      </article>
    </div>
    <AppDialog
      :open="dialogOpen"
      :title="editingCode ? '编辑角色' : '新增角色'"
      eyebrow="角色权限"
      size="xl"
      @close="dialogOpen = false"
    >
      <form id="role-permission-form" class="role-permission-form" @submit.prevent="submit">
        <label
          ><span>角色代码</span
          ><input
            v-model.trim="form.code"
            required
            minlength="3"
            maxlength="50"
            pattern="[a-z][a-z0-9_]{2,49}"
            :disabled="Boolean(editingCode)"
          /><small>创建后不可修改，仅使用小写字母、数字和下划线。</small></label
        ><label
          ><span>角色名称</span
          ><input v-model.trim="form.name" required minlength="2" maxlength="80" /></label
        ><label
          ><span>角色说明</span><input v-model.trim="form.description" maxlength="240"
        /></label>
        <section class="permission-section" aria-labelledby="permission-section-title">
          <header class="permission-section__header">
            <div>
              <h3 id="permission-section-title">功能与操作权限</h3>
              <p>按模块配置入口和操作，避免菜单权限与操作权限相互脱节。</p>
            </div>
            <span>{{ form.permissions.length }} / {{ permissions.length }} 项</span>
          </header>
          <div class="permission-module-grid">
            <article v-for="group in permissionGroups" :key="group.code" class="permission-module">
              <header>
                <div>
                  <strong>{{ groupNames[group.code] || group.code }}</strong>
                  <small>{{ group.actions.length }} 项操作</small>
                </div>
                <button
                  type="button"
                  class="permission-toggle"
                  @click="togglePermissionItems(groupItems(group), !allSelected(groupItems(group)))"
                >
                  {{ allSelected(groupItems(group)) ? '取消本组' : '选择本组' }}
                </button>
              </header>
              <div v-if="group.menu" class="permission-menu-row">
                <AppCheckbox
                  :model-value="isSelected(group.menu.code)"
                  @update:model-value="togglePermission(group.menu.code, $event)"
                >
                  <strong>显示菜单入口</strong>
                  <small>{{ group.menu.description }}</small>
                </AppCheckbox>
              </div>
              <div class="permission-actions">
                <p>允许的操作</p>
                <AppCheckbox
                  v-for="permission in group.actions"
                  :key="permission.code"
                  :model-value="isSelected(permission.code)"
                  @update:model-value="togglePermission(permission.code, $event)"
                >
                  <strong>{{ permission.description }}</strong>
                  <small>{{ permission.code }}</small>
                </AppCheckbox>
                <small v-if="!group.actions.length" class="permission-empty"
                  >此模块没有独立操作权限</small
                >
              </div>
            </article>
          </div>
        </section>
        <div class="permission-help">
          <strong>配置提示</strong>
          <span
            >菜单入口影响后台可见性，操作权限决定 API
            能力。通常应整组选择，再按职责取消不需要的操作。</span
          >
        </div>
      </form>
      <template #footer>
        <button type="button" class="secondary-button" @click="dialogOpen = false">取消</button>
        <button type="submit" form="role-permission-form" class="primary-button" :disabled="saving">
          {{ saving ? '正在保存…' : '保存角色' }}
        </button>
      </template>
    </AppDialog>
  </div>
</template>
