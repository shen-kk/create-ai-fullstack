// 此文件由 pnpm template:init / template:sync 自动生成，请勿手工修改。
export const project = {
  "name": "adminback-template",
  "packageScope": "@template",
  "displayName": "AI 友好全栈模板",
  "description": "可复用的后台管理、用户端与 API 项目模板",
  "runtime": {
    "packageManager": "pnpm",
    "adminPort": 3000,
    "apiPort": 3001,
    "webPort": 3002,
    "deployment": "local"
  },
  "database": {
    "mode": "memory",
    "engine": "none",
    "orm": "none"
  },
  "localization": {
    "defaultLocale": "zh-CN",
    "supportedLocales": [
      "zh-CN"
    ]
  },
  "ui": {
    "web": {
      "businessComponents": "shadcn-vue",
      "motion": "vueuse-motion",
      "orchestration": "gsap",
      "designStandard": "apple-linear-vercel"
    }
  },
  "modules": {
    "authentication": true,
    "customerAuthentication": true,
    "userWeb": true,
    "adminUsers": true,
    "rolesAndPermissions": true,
    "auditLogs": true,
    "serviceConfig": true,
    "objectStorage": true,
    "redis": true,
    "sms": true,
    "email": true,
    "payment": true
  },
  "providers": {
    "objectStorage": "tencent_cos"
  }
} as const;
