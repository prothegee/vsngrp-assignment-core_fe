# Development Guide: Core FE

<br>

## Prerequisites

- Node.js 24
- Docker (or a Docker-compatible engine, for example Podman), for the production build only
- Core BE and Core BE WS checked out alongside this repository, see `tasks.md` Local dev order, both must actually be running for signin, chat, and the Playwright e2e suite to work

<br>

## First-time setup

1. Copy the config template:
   ```
   cp .env.template .env
   ```
   The default dev values already point at `http://localhost:9001` and `ws://localhost:9002`, matching Core BE and Core BE WS's own default ports, no further editing is needed for local development.

2. Start Core BE, then Core BE WS, each from their own repository (`./containers.sh up` then `./debug.sh` in each):
   ```
   # in vsngrp-assignment-core_be
   ./debug.sh

   # in vsngrp-assignment-core_be_ws
   ./debug.sh
   ```

<br>

## Running the service

```
./debug.sh
```

`debug.sh` checks that `.env` exists first, copying `.env.template` and printing a warning if it does not. It then installs dependencies if `node_modules` is missing, and starts the Vite dev server on port `9003`.

<br>

## Running tests

```
./run-tests.sh
```

Runs `vitest run` (unit and edge, jsdom, no live backend needed) first, always. It then checks whether Core BE and Core BE WS both respond on `/health`, if they do it runs `playwright test` (the signin-chat-signout integration suite) against the real stack, if they do not it prints a warning and skips that stage, since that suite genuinely needs a real signup, a real DeepSeek-backed chat reply, and a real signout to pass, see `adr.md`.

The Vitest suite alone can also be run on its own:

```
npm run test:unit
```

The Playwright suite needs a Chromium build installed once:

```
npx playwright install chromium
```

<br>

## Trying the app by hand

With Core BE, Core BE WS, and this service's dev server all running, open `http://localhost:9003`. Sign up with any email and password (there is no validation or OTP by design, see `tasks.md`), create a conversation, and send a message, the reply streams in token by token. Reloading the page keeps the session alive through the silent refresh, but does not remember which conversation was open, select it again from the list to replay its history.

<br>

## Formatting and linting

```
npm run lint
```

Runs ESLint (including the Vue plugin) and `vue-tsc --noEmit`. `ci.yml` runs the same command, run it locally before opening a pull request.

<br>

## Troubleshooting

- **Signin succeeds but a reload always lands back on `/signin`**: Core BE's refresh cookie was issued as `Secure` and a real browser silently refused to store it over plain `http://localhost`. Core BE's `debug.sh` must set `ASPNETCORE_ENVIRONMENT=Development` for its refresh cookie to be usable locally, see Core BE's `adr.md`. If you are running Core BE some other way, set that environment variable yourself.
- **Chat connects but every action returns `auth_error` or the connection closes immediately**: the access token being sent as the WS auth frame does not match Core BE WS's `jwtSecret`, or Core BE WS cannot reach Core BE's session Redis. Confirm both services are using the same `jwtSecret` in their own `config/config.json`, see `tasks-core_be_ws.md`.
- **`./run-tests.sh` always skips the Playwright suite**: Core BE and/or Core BE WS are not reachable on `9001`/`9002`. Start both first, see First-time setup above.
- **CORS error in the browser console**: Core BE's and Core BE WS's `corsAllowedOrigins` must include `http://localhost:9003`, this is already the default in both services' `config.json.template`.
