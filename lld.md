# Low-Level Design: Core FE

<br>

## Project structure

```
vsngrp-assignment-core_fe
|
|___/src
|   |___/views
|   |   |___ChatView.vue
|   |   |___SigninView.vue
|   |   |___SignoutView.vue
|   |   |___SignupView.vue
|   |
|   |___/components
|   |   |___ChatInput.vue
|   |   |___ChatMessageList.vue
|   |   |___ConversationList.vue
|   |
|   |___/stores
|   |   |___auth.ts                   (Pinia: access token in memory, silent refresh)
|   |   |___chat.ts                   (Pinia: conversations, messages, WS state)
|   |
|   |___/services
|   |   |___httpClient.ts             (REST, credentials: include for refresh cookie)
|   |   |___wsClient.ts               (WebSocket, auth-frame on connect, auto-reconnect)
|   |
|   |___/router
|   |   |___index.ts
|   |
|   |___App.vue
|   |___env.d.ts
|   |___main.ts
|
|___/tests
|   |___/unit
|   |   |___auth.store.spec.ts
|   |   |___auth.edge.spec.ts         (wrong credentials, duplicate signup, mid-session expiry)
|   |   |___chat.store.spec.ts
|   |   |___wsClient.edge.spec.ts     (disconnect/reconnect, empty/oversized input)
|   |
|   |___/e2e
|       |___signin-chat-signout.spec.ts   (Playwright, integration)
|
|___/.github
|   |___/workflows
|       |___ci.yml
|       |___cd.yml
|
|___package.json
|___package-lock.json
|___Dockerfile
|___nginx.conf
|___debug.sh
|___run-tests.sh
|___verify-deploy.sh
|___.dockerignore
|___.gitignore
|___.env.template
|___index.html
|___vite.config.ts
|___vitest.config.ts
|___playwright.config.ts
|___eslint.config.js
|___tsconfig.json
|___tsconfig.app.json
|___tsconfig.node.json
|___README.md
|___hld.md
|___lld.md
|___adr.md
|___development.md
|___deployment.md
|___LICENSE
```

<br>

## Scripts

| Script | Purpose |
| :- |
| `debug.sh` | local dev entrypoint, warns and copies `.env.template` if `.env` is missing, installs dependencies if `node_modules` is missing, then runs the Vite dev server |
| `run-tests.sh` | runs the Vitest unit and edge suite, then the Playwright e2e suite only if Core BE and Core BE WS are both reachable, otherwise skips it with a warning |
| `verify-deploy.sh` | post-deploy smoke test, TLS and `/health`, run from `cd.yml` |

Core FE owns no datastore, so unlike Core BE and Core BE WS there is no `containers.sh`.

<br>

## Routes

| Path | Component | Guard |
| :- |
| `/` | (redirects to `/signin`) | |
| `/signin` | `SigninView.vue` | bounces to `/chat` if already authenticated |
| `/signup` | `SignupView.vue` | bounces to `/chat` if already authenticated |
| `/signout` | `SignoutView.vue` | none, always reachable |
| `/chat` | `ChatView.vue` | bounces to `/signin` if not authenticated |

A global navigation guard in `router/index.ts` awaits the auth store's `ensureBootstrapped()` before evaluating any guard, so a page reload always tries the refresh cookie first before deciding whether a route is reachable.

<br>

## State: `stores/auth.ts`

Holds the access token in memory only, never in `localStorage`, so it does not survive a reload. `expiresAt` is tracked internally to schedule a silent refresh call (`POST /auth/refresh`) 60 seconds before the token expires, or at half the remaining lifetime if the token's own lifetime is under 60 seconds. `ensureBootstrapped()` calls `refresh()` exactly once per page load and memoizes the in-flight promise, so concurrent callers (multiple route guards firing close together) never trigger more than one network call.

<br>

## State: `stores/chat.ts`

Owns one `ChatWsClient` instance for the lifetime of the store. `ChatView.vue` calls `connect()` on mount and `disconnect()` on unmount, so the socket only exists while `/chat` is actually on screen.

| Field | Meaning |
| :- |
| `connectionStatus` | `connecting`, `open` (authenticated), or `closed` |
| `conversations` | the account's conversation list |
| `activeConversationId` | the conversation currently open in the thread pane, `null` after a fresh reload until one is selected |
| `messagesByConversation` | chat history per conversation id, replaced wholesale on `conversation_history`, appended to on `message_chunk`/`message_complete` |
| `isSending` | true between a `send_message` call and its `message_complete` |

On every transition to `connectionStatus: "open"` (the first connect, and every reconnect), the store re-requests the conversation list and, if a conversation is already active, re-opens it to replay its history. A user's own message is rendered locally the moment it is sent, since the WS protocol does not echo it back, only the assistant's streamed reply comes over the wire.

<br>

## `services/wsClient.ts`

`ChatWsClient` owns the raw `WebSocket` and the wire protocol only, it has no application state. It sends the `auth` frame as soon as the socket opens, exposes one method per client-to-server message type, and an `onMessage`/`onStatusChange` subscription pair for the store to consume. An unexpected close reconnects automatically with exponential backoff (capped at 10 seconds) and re-sends a fresh auth frame, reading the current token through a callback rather than a captured value, so a token refreshed mid-session is used on the next reconnect without any extra wiring. `maxMessageContentBytes` (60 KiB) leaves headroom under Core BE WS's own 64 KiB per-frame cap for the JSON envelope, `chat.ts`'s `sendMessage` rejects anything larger before it is ever sent.

<br>

## Config (`.env`)

| Field | Notes |
| :- |
| `VITE_API_BASE_URL` | Core BE's REST origin, dev `http://localhost:9001`, prod `https://vsngrp-bec.prothegee.dev` |
| `VITE_WS_BASE_URL` | Core BE WS's WebSocket origin, dev `ws://localhost:9002`, prod `wss://vsngrp-bews.prothegee.dev` |

Both are read at build time by Vite and baked into the static bundle, there is no runtime config file in the deployed container, see `adr.md`.

<br>

## Responsive layout

Below a 40rem (`~640px`) viewport, `ChatView.vue` shows either the conversation list or the active thread, never both, with a Back button to return to the list. At or above that width both panes show side by side at a fixed 18rem sidebar width. The breakpoint is CSS-only (`@media`), no JavaScript viewport detection is involved.
