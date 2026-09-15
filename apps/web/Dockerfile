# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /repo

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN npm ci

FROM deps AS build
COPY apps/web ./apps/web
RUN npm run build -w @zevooria/web

FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs \
  && mkdir -p /app/assets \
  && chown nextjs:nodejs /app/assets

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV API_URL=http://api:3001
ENV ASSETS_ROOT=/app/assets

COPY --from=build --chown=nextjs:nodejs /repo/apps/web/public ./apps/web/public
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
