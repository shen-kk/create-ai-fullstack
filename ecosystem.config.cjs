const config = require('./project.config.json');
const apiProcessName = `${config.project.name}-api`;
const webProcessName = `${config.project.name}-web`;

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
    ...(config.modules.userWeb
      ? [
          {
            name: webProcessName,
            cwd: __dirname,
            script: 'apps/web/.output/server/index.mjs',
            node_args: '--env-file=.env',
            env: {
              PORT: process.env.WEB_PORT || String(config.runtime.webPort),
            },
            autorestart: true,
            restart_delay: 3000,
            kill_timeout: 10000,
          },
        ]
      : []),
  ],
};
