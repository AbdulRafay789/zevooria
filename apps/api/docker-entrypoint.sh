#!/bin/sh
set -eu

# Host bind-mounts often arrive as root-owned; nestjs must write product uploads.
mkdir -p /app/assets
chown -R nestjs:nodejs /app/assets || true
chmod -R u+rwX,g+rwX /app/assets || true

exec su-exec nestjs "$@"
