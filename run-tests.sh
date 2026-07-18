#!/bin/bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

npm run test:unit

CORE_BE_HEALTH_URL="${CORE_BE_HEALTH_URL:-http://localhost:9001/health}"
CORE_BE_WS_HEALTH_URL="${CORE_BE_WS_HEALTH_URL:-http://localhost:9002/health}"

if curl -sf "$CORE_BE_HEALTH_URL" >/dev/null 2>&1 && curl -sf "$CORE_BE_WS_HEALTH_URL" >/dev/null 2>&1; then
    echo "run-tests: Core BE and Core BE WS are reachable, running the Playwright e2e suite"
    npm run test:e2e
else
    echo "run-tests: WARNING, Core BE and/or Core BE WS are not reachable at ${CORE_BE_HEALTH_URL} / ${CORE_BE_WS_HEALTH_URL}"
    echo "run-tests: WARNING, skipping the Playwright e2e suite, see tasks.md Local dev order to start both first"
fi
