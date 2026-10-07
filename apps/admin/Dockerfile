# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /repo

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/admin/package.json ./apps/admin/
RUN npm ci

FROM deps AS build
COPY apps/admin ./apps/admin
RUN npm run build -w @zevooria/admin

FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

ENV NODE_ENV=production
ENV PORT=3002
ENV HOSTNAME=0.0.0.0
ENV API_URL=http://api:3001
ENV ASSETS_ROOT=/app/assets

COPY --from=build --chown=nextjs:nodejs /repo/apps/admin/public ./apps/admin/public
COPY --from=build --chown=nextjs:nodejs /repo/apps/admin/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/apps/admin/.next/static ./apps/admin/.next/static

USER nextjs
EXPOSE 3002
CMD ["node", "apps/admin/server.js"]
