# Deploy Agent 配置

Deploy Agent 是安装在目标服务器上的部署执行程序。它不需要单独购买，后续由模板提供安装脚本和运行程序。

## 配置位置

在目标服务器上执行：

```bash
mkdir -p /opt/deploy-agent
cd /opt/deploy-agent
cp .env.example .env
```

然后编辑 `/opt/deploy-agent/.env`，至少修改：

```env
AGENT_API_URL=https://api.example.com/api
DEPLOYMENT_CALLBACK_TOKEN=与 API 环境变量完全一致的随机令牌
DEPLOY_PROJECT_DIR=/opt/apps/adminback-template
```

不要把真实 `.env` 提交 Git。

## 后台部署环境填写位置

打开后台：

```text
/deployments
```

新增环境时填写：

| 字段             | 填写内容                            |
| ---------------- | ----------------------------------- |
| 环境名称         | 例如：测试环境                      |
| 服务器 IP 或域名 | 目标服务器地址                      |
| SSH 端口         | 通常为 22                           |
| SSH 用户         | 例如 deploy 或 root                 |
| 部署目录         | 例如 `/opt/apps/adminback-template` |
| 部署应用         | 按需选择 Admin、API、Web            |
| 后台地址         | 该环境的后台访问地址                |
| API 地址         | 选择 API 时填写                     |
| 用户端地址       | 选择 Web 时填写                     |
| CNB 仓库         | `组织/仓库` 或完整 CNB URL          |
| CNB Token        | 具备触发构建权限的 Token            |
| SSH 私钥/密码    | 二选一即可                          |

SSH、CNB 和 Registry 密钥会由 API 加密保存，后台不会回显明文。

## API 环境变量

API 所在服务器的 `.env` 必须配置：

```env
DEPLOYMENT_CALLBACK_TOKEN=与 Agent 完全一致的随机令牌
CONFIG_ENCRYPTION_KEY=至少32位随机密钥
```

Agent 和 API 的 `DEPLOYMENT_CALLBACK_TOKEN` 不一致时，任务状态无法回传。

## 当前状态

当前仓库已完成后台部署环境、CNB 构建触发、任务记录和状态回传契约。Deploy Agent 的 Docker 执行器、安装脚本、健康检查和回滚程序将在本目录继续实现。
