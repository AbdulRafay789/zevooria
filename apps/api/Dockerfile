# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /repo

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN npm ci

FROM deps AS build
COPY apps/api ./apps/api
RUN npm run build -w @zevooria/api

FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN npm ci -w @zevooria/api --omit=dev

FROM node:20-alpine AS runner
WORKDIR /repo
RUN addgroup -S nodejs && adduser -S nestjs -G nodejs

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=prod-deps --chown=nestjs:nodejs /repo/package.json ./package.json
COPY --from=prod-deps --chown=nestjs:nodejs /repo/node_modules ./node_modules
COPY --from=prod-deps --chown=nestjs:nodejs /repo/apps/api/package.json ./apps/api/package.json
COPY --from=prod-deps --chown=nestjs:nodejs /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=nestjs:nodejs /repo/apps/api/dist ./apps/api/dist

USER nestjs
WORKDIR /repo/apps/api
EXPOSE 3001
CMD ["node", "dist/main.js"]
