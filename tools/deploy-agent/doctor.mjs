const required = ['AGENT_API_URL', 'DEPLOYMENT_CALLBACK_TOKEN', 'DEPLOY_PROJECT_DIR'];
const missing = required.filter((name) => !process.env[name]?.trim());
const apiUrl = process.env.AGENT_API_URL?.replace(/\/$/, '');

if (missing.length > 0) {
  console.error(`缺少 Deploy Agent 配置：${missing.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('Deploy Agent 必填配置已就绪');
}

if (apiUrl) {
  try {
    const url = new URL(apiUrl);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('必须使用 http 或 https');
    console.log(`API 地址：${url.origin}${url.pathname}`);
  } catch (error) {
    console.error(`AGENT_API_URL 无效：${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

const projectDir = process.env.DEPLOY_PROJECT_DIR;
if (projectDir && !projectDir.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(projectDir)) {
  console.error('DEPLOY_PROJECT_DIR 必须是绝对路径');
  process.exitCode = 1;
}

if (process.exitCode === 1) {
  console.error('请修正 /opt/deploy-agent/.env 后重新执行。');
} else {
  console.log('Deploy Agent 配置检查通过');
}
