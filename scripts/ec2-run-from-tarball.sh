#!/usr/bin/env bash
# After uploading zevooria-deploy.tar.gz to /home/ubuntu, run:
#   tar -xzf zevooria-deploy.tar.gz -O ./scripts/ec2-run-from-tarball.sh > /tmp/ec2-run-from-tarball.sh
#   sed -i 's/\r$//' /tmp/ec2-run-from-tarball.sh
#   bash /tmp/ec2-run-from-tarball.sh
#
# Pulls ec2-server-deploy.sh from the tarball into /tmp, strips CRLF, then runs full deploy.
set -euo pipefail
cd /home/ubuntu
if [[ ! -f zevooria-deploy.tar.gz ]]; then
  echo "Missing /home/ubuntu/zevooria-deploy.tar.gz"
  exit 1
fi
tar -xzf zevooria-deploy.tar.gz -O ./scripts/ec2-server-deploy.sh > /tmp/ec2-server-deploy.sh
sed -i 's/\r$//' /tmp/ec2-server-deploy.sh
chmod +x /tmp/ec2-server-deploy.sh
bash /tmp/ec2-server-deploy.sh
