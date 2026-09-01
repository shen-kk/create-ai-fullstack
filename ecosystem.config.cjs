const { existsSync } = require('node:fs');
const { join } = require('node:path');
const config = require('./project.config.json');
const project = config.project ?? config;
const modules = config.modules ?? project.modules;
const runtime = config.runtime ?? project.runtime;
const userWebEnabled =
  modules?.userWeb ??
  (Array.isArray(config.features)
    ? config.features.includes('customerWeb')
    : existsSync(join(__dirname, 'apps/web/package.json')));
const apiProcessName = `${project.name}-api`;
const webProcessName = `${project.name}-web`;
const webPort = process.env.WEB_PORT || runtime?.webPort;

if (userWebEnabled && !webPort)
  throw new Error('Web 已启用，但 project.config.json 未声明 runtime.webPort，且未设置 WEB_PORT');

module.exports = {
  apps: [
    {
      name: apiProcessName,
      cwd: __dirname,
      script: 'apps/api/dist/src/main.js',
      node_args: '--env-file=.env',
      autorestart: true,
      restart_delay: 3000,
      kill_timeout: 10000,
    },
    ...(userWebEnabled
      ? [
          {
            name: webProcessName,
            cwd: __dirname,
            script: 'apps/web/.output/server/index.mjs',
            node_args: '--env-file=.env',
            env: {
              PORT: String(webPort),
            },
            autorestart: true,
            restart_delay: 3000,
            kill_timeout: 10000,
          },
        ]
      : []),
  ],
};
