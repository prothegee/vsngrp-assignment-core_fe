#!/bin/bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

ENV_FILE=".env"
ENV_TEMPLATE=".env.template"

if [ ! -f "$ENV_FILE" ]; then
    echo "debug: WARNING, ${ENV_FILE} not found, copying ${ENV_TEMPLATE}"
    cp "$ENV_TEMPLATE" "$ENV_FILE"
    echo "debug: WARNING, ${ENV_FILE} still has CHANGE_THIS placeholders, signin/signup/chat will fail until real values are filled in"
fi

if [ ! -d node_modules ]; then
    echo "debug: node_modules not found, running npm install"
    npm install
fi

npm run dev
