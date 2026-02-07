#!/usr/bin/env bash
set -euo pipefail

OUTDIR="./certs"
URL=${1:-"https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem"}

mkdir -p "$OUTDIR"

echo "Downloading RDS CA bundle from: $URL"
curl -fsSL "$URL" -o "$OUTDIR/rds-global-bundle.pem"
chmod 644 "$OUTDIR/rds-global-bundle.pem"

echo "Saved RDS CA bundle to $OUTDIR/rds-global-bundle.pem"

echo "To use it in the container, set: PGSSLROOTCERT=/app/certs/rds-global-bundle.pem in backend/.env and restart the backend service"