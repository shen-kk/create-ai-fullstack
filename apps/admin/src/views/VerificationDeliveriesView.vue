<script setup lang="ts">
import type { VerificationDeliverySummary } from '@template/contracts';
import { onMounted, ref } from 'vue';
import { getVerificationDeliveries } from '../api/verification';
import AppSelect from '../components/AppSelect.vue';
import { integrationErrorLabel, verificationStatusLabel } from '../status-labels';
const items = ref<VerificationDeliverySummary[]>([]),
  loading = ref(false),
  error = ref('');
const channel = ref(''),
  status = ref(''),
  page = ref(1),
  total = ref(0);
const pageSize = 20;
const channelOptions = [
    { value: '', label: '全部渠道' },
    { value: 'sms', label: '短信' },
    { value: 'email', label: '邮件' },
  ],
  statusOptions = [
    { value: '', label: '全部结果' },
    { value: 'sent', label: '已发送' },
    { value: 'consumed', label: '已验证' },
    { value: 'failed', label: '发送失败' },
    { value: 'expired', label: '已过期' },
  ];
const purposeLabel = {
  register: '注册',
  login: '登录',
  reset_password: '找回密码',
  bind_contact: '绑定联系方式',
} as const;
async function load() {
  loading.value = true;
  error.value = '';
  try {
    const result = await getVerificationDeliveries({
      ...(channel.value ? { channel: channel.value as 'sms' | 'email' } : {}),
      ...(status.value
        ? { status: status.value as 'sent' | 'consumed' | 'failed' | 'expired' }
        : {}),
      page: page.value,
      pageSize,
    });
    items.value = result.items;
    total.value = result.total;
  } catch {
    error.value = '验证码记录加载失败，请检查权限。';
  } finally {
    loading.value = false;
  }
}
function search() {
  page.value = 1;
  void load();
}
onMounted(load);
</script>
<template>
  <div>
    <section class="page-heading">
      <div>
        <p class="eyebrow">用户运营 / 验证码记录</p>
        <h1>验证码记录</h1>
        <p>仅显示脱敏接收方、用途和发送结果，不保存或展示验证码明文。</p>
      </div>
    </section>
    <section class="panel filter-panel">
      <form class="filter-form" @submit.prevent="search">
        <label><span>发送渠道</span><AppSelect v-model="channel" :options="channelOptions" /></label
        ><label><span>发送结果</span><AppSelect v-model="status" :options="statusOptions" /></label>
        <div class="filter-actions"><button class="primary-button">查询</button></div>
      </form>
    </section>
    <section class="panel users-table-panel">
      <div v-if="loading" class="table-state">正在加载…</div>
      <div v-else-if="error" class="table-state error-state">{{ error }}</div>
      <div v-else-if="!items.length" class="table-state">暂无验证码发送记录</div>
      <div v-else class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>接收方</th>
              <th>渠道</th>
              <th>用途</th>
              <th>状态</th>
              <th>错误次数</th>
              <th>发送时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id">
              <td>{{ item.targetMasked }}</td>
              <td>{{ item.channel === 'sms' ? '短信' : '邮件' }}</td>
              <td>{{ purposeLabel[item.purpose] }}</td>
              <td>
                <span :class="['status-badge', item.status === 'failed' ? 'disabled' : 'active']">{{
                  verificationStatusLabel(item.status)
                }}</span
                ><small v-if="item.failureCode" style="display: block">{{
                  integrationErrorLabel(item.failureCode)
                }}</small>
              </td>
              <td>{{ item.attempts }}</td>
              <td>{{ new Date(item.createdAt).toLocaleString('zh-CN') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <footer v-if="items.length" class="pagination">
        <span>共 {{ total }} 条</span>
        <div>
          <button
            :disabled="page <= 1"
            @click="
              page--;
              load();
            "
          >
            上一页</button
          ><button
            :disabled="page * pageSize >= total"
            @click="
              page++;
              load();
            "
          >
            下一页
          </button>
        </div>
      </footer>
    </section>
  </div>
</template>
