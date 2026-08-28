<script setup lang="ts">
import type { DeploymentWorkerStatus } from '@template/contracts';
import { ref } from 'vue';
import { deploymentWorkerStartGuidance } from '../deployments/worker-guidance';
import AppDialog from './AppDialog.vue';

defineProps<{ status: DeploymentWorkerStatus; refreshing?: boolean }>();
const emit = defineEmits<{ refresh: [] }>();
const showingGuidance = ref(false);
</script>

<template>
  <section class="panel worker-status" :class="{ offline: !status.online }" role="status">
    <span class="worker-indicator" />
    <div class="worker-summary">
      <strong>{{ status.online ? 'Deploy Worker 在线' : 'Deploy Worker 离线' }}</strong>
      <p v-if="status.online">
        {{ status.activeWorkers }} 个执行器在线，{{ status.runningRuns }} 个任务执行中，{{
          status.queuedRuns
        }}
        个任务排队。
      </p>
      <p v-else>当前没有执行器上报心跳。配置检查仍可使用，但部署和回滚已暂停。</p>
    </div>
    <div v-if="!status.online" class="worker-actions">
      <button
        type="button"
        class="secondary-button"
        :disabled="refreshing"
        @click="emit('refresh')"
      >
        {{ refreshing ? '检测中…' : '重新检测' }}
      </button>
      <button type="button" class="primary-button" @click="showingGuidance = true">启动说明</button>
    </div>
  </section>

  <AppDialog
    :open="showingGuidance"
    size="lg"
    eyebrow="部署中心"
    title="启动 Deploy Worker"
    @close="showingGuidance = false"
  >
    <div class="worker-guidance">
      <p>
        Worker 是独立执行进程，只需要与 API 使用相同的
        <code>DATABASE_URL</code>、<code>CONFIG_ENCRYPTION_KEY</code> 以及访问 Git/SSH 的网络权限。
      </p>
      <section>
        <h3>本地开发</h3>
        <pre><code>{{ deploymentWorkerStartGuidance.development }}</code></pre>
      </section>
      <section>
        <h3>生产环境</h3>
        <p>在可信管理节点的仓库根目录构建并启动：</p>
        <pre><code>{{ deploymentWorkerStartGuidance.production }}</code></pre>
      </section>
      <section>
        <h3>使用 PM2 常驻</h3>
        <pre><code>{{ deploymentWorkerStartGuidance.pm2 }}</code></pre>
        <p>首次配置后按 PM2 输出完成 <code>pm2 startup</code>，确保服务器重启后自动恢复。</p>
      </section>
      <p class="worker-warning">
        不要把 Worker 加入它负责管理的业务部署单元，否则平台自部署时会中断正在执行的任务。
      </p>
    </div>
    <template #footer>
      <button type="button" class="primary-button" @click="showingGuidance = false">知道了</button>
    </template>
  </AppDialog>
</template>

<style scoped>
.worker-status {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding: 16px 18px;
  border-color: #b9e3ca;
  background: #f4fbf6;
}
.worker-status.offline {
  border-color: #f0c9c6;
  background: #fff7f6;
}
.worker-summary {
  min-width: 0;
  flex: 1;
}
.worker-summary p {
  margin: 4px 0 0;
  color: var(--muted);
}
.worker-indicator {
  width: 10px;
  height: 10px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: #24945c;
}
.offline .worker-indicator {
  background: #c44b43;
}
.worker-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 10px;
}
.worker-guidance {
  display: grid;
  gap: 20px;
  line-height: 1.65;
}
.worker-guidance > p,
.worker-guidance section,
.worker-guidance section p {
  margin: 0;
}
.worker-guidance h3 {
  margin: 0 0 8px;
  font-size: 14px;
}
.worker-guidance pre {
  margin: 8px 0 0;
  padding: 14px 16px;
  overflow-x: auto;
  color: #e2e8f0;
  background: #172033;
  border-radius: 10px;
  white-space: pre-wrap;
}
.worker-warning {
  padding: 12px 14px;
  color: #854d0e;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 10px;
}
@media (max-width: 720px) {
  .worker-status {
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .worker-actions {
    width: 100%;
    padding-left: 22px;
  }
}
</style>
