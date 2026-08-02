// 此文件由 pnpm template:init / template:sync 自动生成，请勿手工修改。
export const project = {
  "name": "adminback-template",
  "packageScope": "@template",
  "displayName": "AI 友好后台模板",
  "description": "可复用的后台管理与 API 项目模板",
  "modules": {
    "authentication": true,
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
