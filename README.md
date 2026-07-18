# Core FE

Core FE is the browser client for the chat-bot product. It renders sign up, sign in, sign out, and the chat itself, and talks to Core BE over REST for accounts and to Core BE WS over a WebSocket for the chat.

<br>

## What it does

- `/signup`, `/signin`: create an account or start a session against Core BE.
- `/signout`: end the current session.
- `/chat`: create, rename, and delete named conversations, and exchange messages with the chat model, streamed token by token as the reply arrives.

The access token lives only in memory (Pinia) and is lost on a full page reload, a silent refresh call restores it from the httpOnly cookie Core BE set. Core FE holds no secrets of its own, it only ever calls Core BE and Core BE WS's public endpoints.

<br>

## Prerequisites

- Node.js 24
- Docker (or a Docker-compatible engine, for example Podman), for the production build only
- Core BE and Core BE WS checked out alongside this repository and running first, see `tasks.md` Local dev order

<br>

## Setup

1. Copy the config template and fill in real values:
   ```
   cp .env.template .env
   ```
2. Run the service:
   ```
   ./debug.sh
   ```
   `debug.sh` warns and copies the config template for you if `.env` is missing, installs dependencies if `node_modules` is missing, then starts the dev server.

The dev server listens on port `9003`. See `development.md` for a full local setup walkthrough and `deployment.md` for production setup.

<br>

## Testing

```
./run-tests.sh
```

This runs the Vitest unit and edge suite first, which never needs a live backend. It then checks whether Core BE and Core BE WS are reachable, if they are, it runs the Playwright end to end suite (sign up, chat, sign out) against them, if they are not, it prints a warning and skips that stage instead of failing, since that suite genuinely needs both other services running.

<br>

## More documentation

- `hld.md`: how the service fits into the wider system.
- `lld.md`: project structure and internal design.
- `adr.md`: why specific technical choices were made.
- `development.md`: local development guide.
- `deployment.md`: production deployment guide.
