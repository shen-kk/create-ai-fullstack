<script setup lang="ts">
import type { DeploymentProjectSummary } from '@template/contracts';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { listDeploymentProjects } from '../api/deployments';

const router = useRouter();
const projects = ref<DeploymentProjectSummary[]>([]);
const loading = ref(true);
const error = ref('');

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    projects.value = await listDeploymentProjects();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '部署项目加载失败';
  } finally {
    loading.value = false;
  }
}
onMounted(load);
</script>

<template>
  <div>
    <section class="page-heading">
      <div>
        <p class="eyebrow">部署中心 / 项目定义</p>
        <h1>部署项目</h1>
        <p>构建规则由部署中心管理，密钥与环境资源在创建环境时绑定。</p>
      </div>
      <button
        class="primary-button"
        type="button"
        @click="router.push('/deployments/projects/new')"
      >
        新增项目
      </button>
    </section>
    <p v-if="error" class="operation-notice" role="alert">{{ error }}</p>
    <div v-if="loading" class="panel table-state"><span class="loading-ring" />正在加载…</div>
    <section v-else-if="projects.length" class="deployment-project-grid">
      <article v-for="project in projects" :key="project.id" class="panel deployment-project-card">
        <header>
          <div>
            <span class="project-code">{{ project.code }}</span>
            <h2>{{ project.name }}</h2>
          </div>
          <span v-if="project.system" class="status-pill"><i />系统预设</span>
        </header>
        <p>{{ project.description || '暂无项目说明' }}</p>
        <dl>
          <div>
            <dt>部署方式</dt>
            <dd>版本目录 + PM2</dd>
          </div>
          <div>
            <dt>安装命令</dt>
            <dd>
              <code>{{ project.installCommand }}</code>
            </dd>
          </div>
          <div>
            <dt>部署单元</dt>
            <dd>{{ project.units.map((unit) => unit.name).join(' / ') }}</dd>
          </div>
          <div>
            <dt>环境数量</dt>
            <dd>{{ project.environmentCount }}</dd>
          </div>
          <div>
            <dt>配置版本</dt>
            <dd>v{{ project.version }}</dd>
          </div>
        </dl>
        <footer>
          <button
            class="secondary-button"
            type="button"
            @click="router.push(`/deployments/projects/${project.id}/edit`)"
          >
            编辑项目
          </button>
          <button
            class="primary-button"
            type="button"
            @click="router.push(`/deployments/projects/${project.id}`)"
          >
            查看环境
          </button>
        </footer>
      </article>
    </section>
    <section v-else class="panel table-state">尚未创建部署项目。</section>
  </div>
</template>

<style scoped>
.deployment-project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 20px;
}
.deployment-project-card {
  display: grid;
  gap: 20px;
  padding: 24px;
}
.deployment-project-card header,
.deployment-project-card footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}
.deployment-project-card h2 {
  margin: 6px 0 0;
}
.deployment-project-card > p {
  min-height: 42px;
  margin: 0;
  color: var(--muted);
  line-height: 1.6;
}
.deployment-project-card dl {
  display: grid;
  gap: 10px;
  margin: 0;
}
.deployment-project-card dl div {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr);
  gap: 12px;
}
.deployment-project-card dt {
  color: var(--muted);
}
.deployment-project-card dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.project-code {
  color: #5262cf;
  font-size: 12px;
  font-weight: 700;
}
</style>
