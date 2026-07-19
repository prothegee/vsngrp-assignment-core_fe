# Architecture Decision Records: Core FE

Each entry is a decision, the reason for it, and what was traded away.

<br>

## ADR 001: Access token storage: in-memory Pinia store

Decision: the access token lives only in a Pinia ref, never in `localStorage` or a JS-readable cookie.

Reason: `localStorage` and any cookie readable by JavaScript are both readable by an XSS payload. A token that only exists in memory disappears the moment the tab closes or reloads, the refresh cookie (httpOnly, not readable by this app's own JavaScript either) is what re-establishes it.

<br>

## ADR 002: Refresh token: never touched directly, only via the cookie

Decision: Core FE never reads or stores the refresh token itself, `POST /auth/refresh` is called with `credentials: "include"` and the httpOnly cookie Core BE set does the rest.

Reason: this is Core BE's decision (see its own `adr.md`), Core FE's only obligation is to always send credentials on auth calls and never attempt to read that cookie's value, which the browser would refuse anyway.

<br>

## ADR 003: Message content: rendered as sanitized markdown, not plain text

Decision: `ChatMessageList.vue` parses every message's content with `marked` and runs the result through `DOMPurify.sanitize` before injecting it via `v-html`. The user's own local-echoed message goes through the same path as the assistant's reply.

Reason: DeepSeek replies routinely use markdown, bold, bullet lists, code fences, since nothing in the prompt or protocol asks it not to, and the plain-text rendering used until now showed the raw `**`/`-` markers instead of formatting. `v-html` on unsanitized model output would be a stored-XSS vector, DOMPurify's default profile strips script tags, event-handler attributes, and `javascript:` URLs before the HTML ever reaches the DOM, `tests/unit/ChatMessageList.spec.ts` asserts on this directly with an `onerror` payload. Rendering the user's own message through the same path too, rather than only the assistant's, keeps the two visually consistent (a literal `**bold**` the user typed shows the same way in their own bubble as it will once echoed by a future feature) and avoids a second, parallel rendering path to maintain.

<br>

## ADR 004: Session restore: `ensureBootstrapped()` on every navigation, memoized

Decision: the router's global guard awaits `authStore.ensureBootstrapped()` before evaluating any route, and that function only ever calls `/auth/refresh` once per page load no matter how many times it is invoked.

Reason: without this, a fresh page load has no access token yet and every route guard would need its own logic to decide whether to wait for a silent refresh first, memoizing the in-flight promise avoids firing that request once per guard invocation if several run close together during startup.

<br>

## ADR 005: User's own chat message: rendered by local echo

Decision: when `sendMessage` is called, the user's message is pushed into `messagesByConversation` immediately, before any server response.

Reason: Core BE WS's WS protocol does not echo the user's own message back as a distinct frame, only `message_chunk`/`message_complete` for the assistant's reply. Waiting for a server confirmation that will never come would mean the user never sees their own message appear.

<br>

## ADR 006: Waiting-for-reply indicator: a separate state from the streamed pending message

Decision: `ChatView.vue` derives an `isWaitingForReply` computed (`chatStore.isSending` is true and the last message is not yet a pending assistant one) and passes it to `ChatMessageList.vue`, which renders a bouncing-dots bubble whenever it is true.

Reason: there is a real gap between a message being sent and the first `message_chunk` arriving, DeepSeek does not always stream the very first token immediately, and the existing blinking cursor only exists once a pending assistant message is already in the list. Without a distinct indicator for that gap, sending a message gave no feedback at all until the reply started appearing, which reads as the app doing nothing. The indicator disappears the moment the first chunk arrives and the pending message's own cursor takes over, the two never show at once.

<br>

## ADR 007: WS reconnect: exponential backoff, fresh auth frame every time

Decision: `ChatWsClient` reconnects automatically after an unexpected close, backing off from 1 second up to a 10 second cap, and reads the current access token through a callback (`() => authStore.accessToken`) rather than a value captured at construction time.

Reason: a dropped connection should recover on its own without a manual page reload. Reading the token through a callback means a reconnect that happens to land after a silent refresh already rotated the token still authenticates with the current one, not a stale one captured when the socket was first opened.

<br>

## ADR 008: Reconnect replay: re-list and re-open, not a resume protocol

Decision: on every transition to an authenticated connection (first connect or any reconnect), the chat store re-requests the conversation list and, if a conversation is already active, re-opens it via `open_conversation`.

Reason: Core BE WS's protocol has no concept of "resume from where we left off", `open_conversation` already returns the full trimmed history, calling it again is simpler than adding a client-side diff and gives an identical result.

<br>

## ADR 009: Client-side message size cap, mirroring the server's

Decision: `chat.ts`'s `sendMessage` rejects content over `maxMessageContentBytes` (60 KiB) before it is ever sent over the wire, leaving headroom under Core BE WS's own 64 KiB per-frame cap.

Reason: without this, an oversized message would round-trip to the server only to come back as a `message_too_large` error frame. Rejecting it locally gives faster feedback and one less network round trip, the server-side cap is still the actual source of truth, this is a client-side courtesy check, not a replacement for it.

<br>

## ADR 010: Mobile layout: one pane visible at a time, not a shrunk split view

Decision: below a 40rem viewport, `ChatView.vue` shows either the conversation list or the active thread, never both, with a Back button to switch. At or above that width both panes show side by side.

Reason: a fixed 18rem sidebar next to a chat thread does not leave usable width for either on a phone-sized screen, showing one full-width pane at a time is the same pattern most chat apps already use on mobile, and needs no extra state beyond a boolean toggled by conversation selection.

<br>

## ADR 011: Config: build-time `VITE_*` variables, no runtime config file

Decision: `VITE_API_BASE_URL` and `VITE_WS_BASE_URL` are read from `.env` at build time and baked directly into the static bundle. The deployed container mounts nothing and reads no config file at startup.

Reason: unlike Core BE and Core BE WS, Core FE has no secrets, both values are public origins the browser calls directly, and Vite resolves `import.meta.env.VITE_*` at build time regardless, there is no runtime code path that could read a mounted file even if one were provided. `cd.yml` passes the production origins as Docker build-args instead of a mounted file, see `deployment.md`.

<br>

## ADR 012: Playwright e2e: gated on live backend reachability, not mocked

Decision: `run-tests.sh` always runs the Vitest unit and edge suite. It runs the Playwright e2e suite (`signin-chat-signout.spec.ts`) only if Core BE and Core BE WS both respond on `/health`, otherwise it prints a warning and skips that stage instead of failing.

Reason: Core BE and Core BE WS live in separate repositories with their own Postgres and Redis, Core FE's own CI runner has no access to either and, per the "Core FE holds no secrets" design, should never need the DeepSeek API key just to run its own test suite. Mocking the WebSocket and REST layer instead was considered, it would let the suite run unconditionally in CI, but it would then only prove Core FE's own modules talk to each other correctly, not that they can actually complete a signin-to-chat round trip against the real protocol, which is the entire point of an integration suite. Reachability gating keeps `ci.yml` green everywhere while still giving full coverage the moment a developer runs `./run-tests.sh` locally with the full stack up, exactly as this suite was verified during development.

<br>

## ADR 013: Core BE local dev fix: `ASPNETCORE_ENVIRONMENT=Development`

Decision: Core BE's `debug.sh` now sets `ASPNETCORE_ENVIRONMENT=Development` before `dotnet run` (see Core BE's own `adr.md` for the full entry).

Reason: connecting a real browser to Core BE for the first time surfaced a bug that curl and wscat based testing never could, Core BE has no `launchSettings.json`, so a bare `dotnet run` defaults to the `Production` environment, and `AuthController` issues the refresh cookie as `Secure` in that environment. A `Secure` cookie is silently refused by a real browser over plain `http://localhost`, so the refresh flow this app depends on would never actually work locally without this fix. Documented here because it is the reason Core FE's local session-restore and silent-refresh behavior work at all in development.

<br>

## ADR 014: Mobile thread visibility: set from the user action, not derived from a value-change watcher

Decision: `ChatView.vue`'s `@select` handler sets `isMobileThreadVisible.value = true` directly, alongside a `watch` on `chatStore.activeConversationId` kept for the conversation-created auto-select path. The thread header also always shows the active conversation's title, not only its bold state in the sidebar list.

Reason: a mobile user tapping Back then re-selecting the same already-active conversation left the thread pane stuck hidden. `isMobileThreadVisible` was previously set only inside a `watch` on `activeConversationId`, and Vue's reactivity system does not trigger a watcher when a ref is reassigned to the value it already holds, re-selecting the same conversation is exactly that case. Deriving visibility straight from the action that should show the thread, rather than from a side effect of a value happening to change, removes that class of bug entirely. The title in the header exists for the same underlying reason, the sidebar's bold styling is the only other way to know which conversation is open, and that is invisible on mobile once the list pane is hidden.

<br>

## ADR 015: Reverse proxy: containerized, this service owns and deploys its own conf file

Decision: the public-facing reverse proxy (`vsngrp-reverse-proxy`, `nginx:alpine`, `network_mode: host`) is a separate container this service does not own, but this repo commits and deploys its own server block, `nginx/vsngrp-fec.conf`, copied into the proxy's shared `conf.d` and reloaded on every `cd.yml` run. This is a different file from the root-level `nginx.conf`, which is baked into this service's own Docker image and only serves the built static files inside this container on `127.0.0.1:9003`, that one never sees the public internet directly.

Reason: `network_mode: host` lets the proxy container reach `127.0.0.1:9003` exactly like a host-installed nginx would, so nothing about this service's own port binding needed to change to support it. Each service owning exactly 1 conf file, written by exactly 1 pipeline, keeps 3 independent deploy pipelines from racing on or overwriting a shared file, one truth source per domain even though the proxy itself is shared. The 2 nginx configs in this repo are for 2 different nginx processes with 2 different jobs: `nginx.conf` serves files inside this container, `nginx/vsngrp-fec.conf` tells the shared proxy container how to route to it, not a duplicate and not a mistake. Full detail in `tasks.md`'s Deployment infrastructure section.

<br>

## ADR 016: production API/WS origins seeded into `.env`, not passed as Docker build-args

Decision: `cd.yml` now copies `.env.template` to `.env` and seeds `VITE_API_BASE_URL`/`VITE_WS_BASE_URL` from the `CORE_FE_ENV_*` secrets, the exact same `CHANGE_THIS`-placeholder pattern Core BE/Core BE WS use for `config.json`, right before `docker build` runs, unconditionally on every deploy. `.dockerignore` no longer excludes `.env`, so it reaches the build context, and the Dockerfile no longer declares `ARG`/`ENV` for these 2 values, Vite's own built-in `.env` loading picks them up automatically during `npm run build`, confirmed with a real local build: both values land correctly in the compiled bundle (`VITE_API_BASE_URL` in the entry chunk, `VITE_WS_BASE_URL` in the lazy-loaded chat chunk, since that is the only place it is referenced).

Reason: passing secrets as `--build-arg` and seeding a template file into `.env` both ultimately land the same values in the same place at the same point in the build, `--build-arg` was the original design, but sir wants every service to seed its runtime-facing values from secrets the same consistent way, matching `config.json`'s pattern, rather than one service using a different mechanism just because it happens to be a static SPA. Since Vite variables are compiled into the bundle regardless of which mechanism supplies them, this is not a functional regression, just a consistency fix, `.env` on the server is still never hand-edited or preserved across deploys, `cd.yml` regenerates it fresh every time, same as `config.json`.
