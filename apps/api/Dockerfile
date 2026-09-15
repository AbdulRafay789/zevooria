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

# Official AWS RDS CA trust store (public, non-secret).
# Source: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html
FROM alpine:3.20 AS rds-certs
RUN apk add --no-cache curl \
  && mkdir -p /certs/rds \
  && curl -fsSL \
    https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem \
    -o /certs/rds/global-bundle.pem \
  && test -s /certs/rds/global-bundle.pem

FROM node:20-alpine AS runner
WORKDIR /repo
RUN addgroup -S nodejs && adduser -S nestjs -G nodejs \
  && mkdir -p /certs/rds

ENV NODE_ENV=production
ENV PORT=3001
ENV DB_SSL_CA=/certs/rds/global-bundle.pem

COPY --from=rds-certs /certs/rds/global-bundle.pem /certs/rds/global-bundle.pem
RUN chown -R nestjs:nodejs /certs

COPY --from=prod-deps --chown=nestjs:nodejs /repo/package.json ./package.json
COPY --from=prod-deps --chown=nestjs:nodejs /repo/node_modules ./node_modules
COPY --from=prod-deps --chown=nestjs:nodejs /repo/apps/api/package.json ./apps/api/package.json
COPY --from=prod-deps --chown=nestjs:nodejs /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=nestjs:nodejs /repo/apps/api/dist ./apps/api/dist

USER nestjs
WORKDIR /repo/apps/api
EXPOSE 3001
CMD ["node", "dist/main.js"]
