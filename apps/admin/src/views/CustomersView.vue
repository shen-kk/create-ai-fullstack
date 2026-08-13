<script setup lang="ts">
import type { CustomerStatus, CustomerSummary } from '@template/contracts';
import { onMounted, ref } from 'vue';
import { changeCustomerStatus, getCustomers } from '../api/customers';
import AppSelect from '../components/AppSelect.vue';
import AppPagination from '../components/AppPagination.vue';

const keyword = ref('');
const selectedStatus = ref<'' | CustomerStatus>('');
const customers = ref<CustomerSummary[]>([]);
const page = ref(1);
const pageSize = ref(10);
const total = ref(0);
const loading = ref(false);
const error = ref('');
const notice = ref('');
const savingId = ref('');
const statusOptions = [
  { value: '', label: '全部状态' },
  { value: 'active', label: '正常' },
  { value: 'disabled', label: '已停用' },
];
const rowStatusOptions = statusOptions.slice(1);

function formatDate(value: string | null): string {
  if (!value) return '从未登录';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
async function loadCustomers(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const result = await getCustomers({
      ...(keyword.value ? { keyword: keyword.value } : {}),
      ...(selectedStatus.value ? { status: selectedStatus.value } : {}),
      page: page.value,
      pageSize: pageSize.value,
    });
    customers.value = result.items;
    total.value = result.total;
  } catch {
    error.value = '用户端用户加载失败，请检查服务或当前权限。';
    customers.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}
function search(): void {
  page.value = 1;
  void loadCustomers();
}
function reset(): void {
  keyword.value = '';
  selectedStatus.value = '';
  page.value = 1;
  void loadCustomers();
}
async function setStatus(customer: CustomerSummary, status: CustomerStatus): Promise<void> {
  if (customer.status === status || savingId.value) return;
  savingId.value = customer.id;
  notice.value = '';
  try {
    await changeCustomerStatus(customer.id, { status });
    notice.value =
      status === 'disabled'
        ? `已停用 ${customer.name}，其登录会话已全部撤销。`
        : `已恢复 ${customer.name} 的账号。`;
    await loadCustomers();
  } catch {
    notice.value = '状态更新失败，请检查权限后重试。';
  } finally {
    savingId.value = '';
  }
}
onMounted(loadCustomers);
</script>

<template>
  <div class="users-page">
    <section class="page-heading users-heading">
      <div>
        <p class="eyebrow">用户运营 / 用户端用户</p>
        <h1>用户端用户</h1>
        <p>管理通过用户端注册的账号。该身份与后台管理员完全隔离。</p>
      </div>
      <span class="template-badge">可选模块</span>
    </section>
    <p v-if="notice" class="operation-notice" role="status">{{ notice }}</p>
    <section class="panel filter-panel" aria-label="用户端用户筛选">
      <form class="filter-form" @submit.prevent="search">
        <label
          ><span>关键词</span
          ><input v-model="keyword" type="search" placeholder="搜索称呼、手机号或邮箱" /></label
        ><label
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
          <h2>注册用户</h2>
          <p>共 {{ total }} 位用户</p>
        </div>
        <span class="template-badge">独立身份</span>
      </header>
      <div v-if="loading" class="table-state"><span class="loading-ring" />正在加载用户…</div>
      <div v-else-if="error" class="table-state error-state">
        <strong>加载失败</strong>
        <p>{{ error }}</p>
        <button class="secondary-button" @click="loadCustomers">重新加载</button>
      </div>
      <div v-else-if="customers.length === 0" class="table-state">
        <strong>没有找到用户</strong>
        <p>新用户注册后会显示在这里。</p>
        <button class="secondary-button" @click="reset">清空筛选</button>
      </div>
      <div v-else class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>用户</th>
              <th>状态</th>
              <th>身份验证</th>
              <th>注册时间</th>
              <th>最近活跃</th>
              <th>管理</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="customer in customers" :key="customer.id">
              <td>
                <div class="user-cell">
                  <span class="user-avatar">{{ customer.name.slice(0, 1) }}</span>
                  <div>
                    <strong>{{ customer.name }}</strong
                    ><small
                      >{{ customer.phone
                      }}<template v-if="customer.email"> · {{ customer.email }}</template></small
                    >
                  </div>
                </div>
              </td>
              <td>
                <span :class="['status-badge', customer.status]">{{
                  customer.status === 'active' ? '正常' : '已停用'
                }}</span>
              </td>
              <td>
                <span class="status-badge active">手机已验证</span
                ><small v-if="customer.email" style="display: block; margin-top: 6px">{{
                  customer.emailVerifiedAt ? '邮箱已验证' : '邮箱未验证'
                }}</small>
              </td>
              <td>{{ formatDate(customer.createdAt) }}</td>
              <td>{{ formatDate(customer.lastActiveAt) }}</td>
              <td>
                <AppSelect
                  class="status-select"
                  :model-value="customer.status"
                  :disabled="Boolean(savingId)"
                  :aria-label="`修改 ${customer.name} 的状态`"
                  :options="rowStatusOptions"
                  @change="setStatus(customer, $event as CustomerStatus)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <AppPagination
        v-if="!loading && !error && customers.length"
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="total"
        @change="loadCustomers"
      />
    </section>
  </div>
</template>
