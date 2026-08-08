import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const required = ['AGENT_API_URL', 'DEPLOYMENT_CALLBACK_TOKEN', 'DEPLOY_PROJECT_DIR'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}

const apiUrl = process.env.AGENT_API_URL.replace(/\/$/, '');
const projectDir = process.env.DEPLOY_PROJECT_DIR;
const composeFile = process.env.DEPLOY_COMPOSE_FILE || 'docker-compose.production.yml';
const runId = process.env.DEPLOYMENT_RUN_ID;
const version = process.env.DEPLOYMENT_VERSION || 'latest';
const healthUrls = (process.env.DEPLOY_HEALTH_URLS || '').split(',').map((value) => value.trim()).filter(Boolean);

async function callback(status, currentStep, errorCode = null) {
  if (!runId) return;
  await fetch(`${apiUrl}/deployments/internal/runs/${encodeURIComponent(runId)}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-deployment-callback-token': process.env.DEPLOYMENT_CALLBACK_TOKEN,
    },
    body: JSON.stringify({ status, currentStep, ...(errorCode ? { errorCode } : {}) }),
  });
}

async function waitForHealth() {
  for (const url of healthUrls) {
    let healthy = false;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (response.ok) { healthy = true; break; }
      } catch { /* retry until timeout */ }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    if (!healthy) throw new Error(`Health check failed: ${url}`);
  }
}

async function main() {
  await callback('deploying', 'release');
  await exec('docker', ['compose', '-f', composeFile, 'pull'], { cwd: projectDir });
  await exec('docker', ['compose', '-f', composeFile, 'up', '-d', '--remove-orphans'], { cwd: projectDir });
  await waitForHealth();
  await callback('succeeded', 'health');
  console.log(`Deployment ${version} completed successfully.`);
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  try { await callback('failed', 'health', 'DEPLOY_AGENT_EXECUTION_FAILED'); } catch { /* preserve original failure */ }
  process.exitCode = 1;
});
