FROM node:22-alpine AS build
WORKDIR /workspace
ARG PUBLIC_API_BASE_URL
ENV PUBLIC_API_BASE_URL=$PUBLIC_API_BASE_URL
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile
COPY apps/web apps/web
COPY packages/contracts packages/contracts
COPY packages/config packages/config
RUN pnpm --filter @template/contracts build && pnpm --filter @template/web build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3002
COPY --from=build /workspace/apps/web/.output ./
EXPOSE 3002
HEALTHCHECK --interval=15s --timeout=3s --retries=3 CMD wget -q -O - http://127.0.0.1:3002/ || exit 1
CMD ["node", "server/index.mjs"]
