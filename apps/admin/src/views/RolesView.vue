<script setup lang="ts">
import type { PermissionOption, RoleOption } from '@template/contracts';
import { computed, onMounted, ref } from 'vue';
import { createRole, getPermissions, updateRole } from '../api/roles';
import { getRoleOptions } from '../api/users';

const roles = ref<RoleOption[]>([]);
const permissions = ref<PermissionOption[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const notice = ref('');
const dialogOpen = ref(false);
const editingCode = ref('');
const form = ref({ code: '', name: '', description: '', permissions: [] as string[] });
const menuPermissions = computed(() =>
  permissions.value.filter((permission) => permission.type === 'menu'),
);
const actionPermissions = computed(() =>
  permissions.value.filter((permission) => permission.type === 'action'),
);
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
    <p v-if="notice" class="operation-notice" role="status">{{ notice }}</p>
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
    <div v-if="dialogOpen" class="dialog-backdrop">
      <form class="user-dialog role-dialog" @submit.prevent="submit">
        <header>
          <div>
            <p class="eyebrow">角色权限</p>
            <h2>{{ editingCode ? '编辑角色' : '新增角色' }}</h2>
          </div>
          <button type="button" class="dialog-close" aria-label="关闭" @click="dialogOpen = false">
            ×
          </button>
        </header>
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
        <div class="permission-grid">
        <fieldset>
          <legend>功能菜单权限</legend>
          <label
            v-for="permission in menuPermissions"
            :key="permission.code"
            class="permission-option"
            ><input v-model="form.permissions" type="checkbox" :value="permission.code" /><span
              ><strong>{{ permission.description }}</strong
              ><small>{{ permission.code }}</small></span
            ></label
          >
        </fieldset>
        <fieldset>
          <legend>操作权限</legend>
          <label
            v-for="permission in actionPermissions"
            :key="permission.code"
            class="permission-option"
            ><input v-model="form.permissions" type="checkbox" :value="permission.code" /><span
              ><strong>{{ permission.description }}</strong
              ><small>{{ permission.code }}</small></span
            ></label
          >
        </fieldset>
        </div>
        <p class="permission-help">
          菜单权限决定入口与路由可见性；操作权限由 API
          守卫执行。新增功能的权限代码由共享契约登记并随版本发布，不在后台动态创建。
        </p>
        <footer>
          <button type="button" class="secondary-button" @click="dialogOpen = false">取消</button
          ><button class="primary-button" :disabled="saving">
            {{ saving ? '正在保存…' : '保存角色' }}
          </button>
        </footer>
      </form>
    </div>
  </div>
</template>
