#!/bin/bash
set -euo pipefail

DOMAIN="vsngrp-fec.prothegee.dev"
EXPECTED_GIT_SHA="${1:-$(git rev-parse --short HEAD)}"

echo "verify-deploy: checking TLS certificate for ${DOMAIN}"
CERT_END_DATE=$(echo | openssl s_client -servername "$DOMAIN" -connect "${DOMAIN}:443" 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2)
CERT_END_EPOCH=$(date -d "$CERT_END_DATE" +%s)
NOW_EPOCH=$(date +%s)
if [ "$CERT_END_EPOCH" -le "$NOW_EPOCH" ]; then
    echo "verify-deploy: FAIL, TLS certificate for ${DOMAIN} is expired"
    exit 1
fi
echo "verify-deploy: TLS certificate valid until ${CERT_END_DATE}"

echo "verify-deploy: checking /health"
HEALTH_BODY=$(curl -sf "https://${DOMAIN}/health")
HEALTH_STATUS=$(echo "$HEALTH_BODY" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
HEALTH_GIT_SHA=$(echo "$HEALTH_BODY" | grep -o '"gitSha":"[^"]*"' | cut -d'"' -f4)

if [ "$HEALTH_STATUS" != "ok" ]; then
    echo "verify-deploy: FAIL, /health status was '${HEALTH_STATUS}', expected 'ok'"
    exit 1
fi

if [ "$HEALTH_GIT_SHA" != "$EXPECTED_GIT_SHA" ]; then
    echo "verify-deploy: FAIL, /health gitSha was '${HEALTH_GIT_SHA}', expected '${EXPECTED_GIT_SHA}'"
    exit 1
fi
echo "verify-deploy: /health ok, gitSha matches ${EXPECTED_GIT_SHA}"

echo "verify-deploy: all checks passed"
