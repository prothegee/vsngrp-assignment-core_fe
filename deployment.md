# Deployment Guide: Core FE

<br>

## Overview

Core FE runs on the same AWS EC2 instance as Core BE and Core BE WS, as its own `docker compose`-less single container (it has no datastore, so there is no `containers/` stack to provision). A single shared reverse-proxy container (`vsngrp-reverse-proxy`, `network_mode: host`) owns ports 80 and 443 and is the only process reachable from outside the instance, it terminates TLS and reverse-proxies to this container's own nginx on `127.0.0.1:9003`. That container-internal nginx only serves the built static files and the baked `/health` file, it is a different process from the shared reverse-proxy container, one hop apart, see `tasks.md` Deployment infrastructure. This service owns and deploys its own server block, `nginx/vsngrp-fec.conf`, see Deploy flow below.

Core FE holds no secrets and mounts no config file at runtime, `VITE_API_BASE_URL` and `VITE_WS_BASE_URL` are baked into the static bundle at Docker build time instead, from a `.env` seeded from GitHub Actions secrets right before `docker build` runs, see ADR 016.

<br>

## Ports

| Port | Reachable from | Purpose |
| :- |
| `80` | public internet | certbot ACME challenge, redirects to `443` |
| `443` | public internet | the only public entry point, TLS terminates here |
| `9003` | `127.0.0.1` on the EC2 instance only | this container's own nginx, serving static files, never exposed directly |

The EC2 security group only opens `22` (SSH), `80`, and `443`. Port `9003` is closed to the public internet at the security group level as well as bound to loopback at the container level.

<br>

## One-time server setup

1. Clone this repository to the server, on the `main-stable` branch. Core BE and Core BE WS should already be deployed and reachable at their own production domains, since a real browser session against this app depends on both.
2. No config file to prepare, this service reads nothing at runtime.
3. Confirm the shared reverse proxy (`vsngrp-reverse-proxy`) is already up and its certificate for `vsngrp-fec.prothegee.dev` already issued, this is separate, shared infra provisioned once, see `tasks.md` Deployment infrastructure, not a per-service step. From here on, this service's own server block (`nginx/vsngrp-fec.conf`, committed in this repo) deploys into it automatically on every `cd.yml` run, no manual nginx or certbot step needed per service.
4. Confirm Core BE's and Core BE WS's `corsAllowedOrigins` (respectively their CORS policy and their `/ws/chat` origin check) both include `https://vsngrp-fec.prothegee.dev`, see their own `deployment.md`.

<br>

## GitHub Actions secrets

`cd.yml` needs these repository secrets configured before it can deploy:

| Secret | Value |
| :- |
| `EC2_HOST` | the EC2 instance's address |
| `EC2_SSH_USER` | the SSH user used for deploys |
| `EC2_SSH_KEY` | the private half of a deploy key, the matching public key must be authorized on the instance |
| `CORE_FE_DEPLOY_PATH` | absolute path to this repository's clone on the instance |
| `PROXY_CONF_D_PATH` | absolute path to the shared reverse proxy's `conf.d` folder on the instance, this service's own `nginx/vsngrp-fec.conf` is copied there on every deploy |
| `CORE_FE_ENV_API_BASE_URL` | the production Core BE origin, `https://vsngrp-bec.prothegee.dev` |
| `CORE_FE_ENV_WS_BASE_URL` | the production Core BE WS origin, `wss://vsngrp-bews.prothegee.dev` |

Unlike Core BE and Core BE WS, there is no `CORE_FE_CONFIG_PATH` secret, this service has no runtime config file to mount.

<br>

## Deploy flow

1. Open a pull request into `main`. `ci.yml` must pass (build, lint, `run-tests.sh`, Docker build check).
2. Once `main` is green and ready to ship, promote it into `main-stable`, either by merging a pull request from `main` into `main-stable`, or by pushing directly to `main-stable`.
3. Any push to `main-stable` triggers `cd.yml` (a PR merge is itself a push under the hood, so both paths use the same trigger), which connects over SSH and:
   - checks that `PROXY_CONF_D_PATH` (the shared reverse proxy's `conf.d` folder) exists, and fails the deploy immediately if it does not
   - pulls the latest `main-stable`
   - regenerates `.env` from `.env.template` every single deploy, seeding `VITE_API_BASE_URL` and `VITE_WS_BASE_URL` from the `CORE_FE_ENV_*` secrets, fails the deploy immediately if a `CHANGE_THIS` placeholder remains after seeding
   - builds the image with `--build-arg GIT_SHA=$(git rev-parse --short HEAD)`, Vite picks up `.env` on its own during `npm run build`
   - stops and replaces the running app container
   - copies this service's own `nginx/vsngrp-fec.conf` into `PROXY_CONF_D_PATH` and reloads the `vsngrp-reverse-proxy` container
   - runs `verify-deploy.sh`

The production API and WS origins come from `CORE_FE_ENV_API_BASE_URL` and `CORE_FE_ENV_WS_BASE_URL`, not literal values in `cd.yml`. `cd.yml` seeds them into `.env` fresh every deploy (see ADR 016), the same regenerate-every-time approach `config.json` uses on Core BE/Core BE WS. Since Vite bakes `VITE_*` variables into the bundle at build time, a wrong value here can only be fixed by correcting the secret and redeploying, `.env` on the server is never hand-edited or preserved across deploys, it would just get overwritten on the next one anyway.

<br>

## Verifying a deploy manually

```
./verify-deploy.sh
```

This checks the TLS certificate is valid and `GET /health` reports the expected `version` and `gitSha`. It cannot confirm that port `9003` is actually unreachable from outside the instance, that check only means something run from an external machine and stays a manual step.
