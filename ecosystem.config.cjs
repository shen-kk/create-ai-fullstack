module.exports = {
  apps: [
    {
      name: 'aiforge-api',
      cwd: __dirname,
      script: 'apps/api/dist/src/main.js',
      node_args: '--env-file=.env',
      autorestart: true,
      restart_delay: 3000,
      kill_timeout: 10000,
    },
    {
      name: 'aiforge-web',
      cwd: __dirname,
      script: 'apps/web/.output/server/index.mjs',
      node_args: '--env-file=.env',
      autorestart: true,
      restart_delay: 3000,
      kill_timeout: 10000,
    },
  ],
};
