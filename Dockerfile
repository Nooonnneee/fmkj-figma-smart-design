# FMKJ 自托管镜像（国内云服务器 + PostgreSQL）。Figma Make 不使用这个文件。
#
#   docker compose build         # 构建
#   docker compose up -d         # 启动（首次启动自动建表）
#
# 国内服务器拉不到 Docker Hub 时，在 .env 里设置 NODE_IMAGE 为镜像加速地址。
# 镜像内钉 pnpm 10（与 package.json engines / packageManager 一致），避免 corepack
# 默认拉到 pnpm 12 触发 MINIMUM_RELEASE_AGE / IGNORED_BUILDS。
ARG NODE_IMAGE=node:24-bookworm-slim

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
# 国内可设置 NPM_REGISTRY=https://registry.npmmirror.com
ARG NPM_REGISTRY=https://registry.npmjs.org
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm config set registry ${NPM_REGISTRY} && pnpm install --frozen-lockfile

# tools：带完整依赖和源码，用来跑数据导入、设置密码、手动迁移等 payload 命令。
FROM deps AS tools
COPY . .
# 让 @payload-config 指向自托管配置（只在镜像里替换，仓库文件不变）。
RUN printf "export { default } from './payload.selfhost.config'\n" > src/payload.config.ts
ENV PAYLOAD_CONFIG_PATH=src/payload.selfhost.config.ts

FROM tools AS builder
# NEXT_PUBLIC_SITE_URL 在构建时写入前端代码，所以正式域名要在构建时给出。
# 构建期占位：勿把生产 .env 的 PAYLOAD_SECRET / DATABASE_URI 当 build-arg 烤进层。
# 运行时由 compose env_file + DATABASE_URI 注入真值。
ARG PUBLIC_URL=http://localhost:3000
ARG PAYLOAD_SECRET=docker-build-placeholder-not-for-runtime
ARG DATABASE_URI=postgres://fmkj:build-only@127.0.0.1:5432/fmkj
ENV PUBLIC_URL=${PUBLIC_URL} NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production \
    PAYLOAD_SECRET=${PAYLOAD_SECRET} DATABASE_URI=${DATABASE_URI}
RUN pnpm exec payload generate:importmap && pnpm build

FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 MEDIA_DIR=/data/media
RUN mkdir -p /data/media && chown -R node:node /data
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
