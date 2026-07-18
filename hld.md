# High-Level Design: Core FE

<br>

## System context

Core FE is one of three services in the chat-bot product:

```mermaid
flowchart LR
    User(("Browser"))
    FE["Core FE : port 9003
    Vue 3 static app"]
    BE["Core BE : port 9001
    accounts and sessions"]
    BEWS["Core BE WS : port 9002
    chat over WebSocket"]

    User --> FE
    FE -- "REST: signup / signin / signout / refresh" --> BE
    FE -- "WebSocket: auth-frame + chat" --> BEWS
```

Core FE is a static single-page app, it holds no secrets and runs no server-side logic of its own beyond serving files. Every REST and WebSocket call it makes goes directly from the browser to Core BE or Core BE WS, Core FE's own container never sits in that path.

<br>

## Responsibilities

- Let a visitor create an account, sign in, or sign out, against Core BE's REST API.
- Keep a signed-in session alive across the access token's short lifetime with a silent refresh, using the httpOnly cookie Core BE issued.
- Open a WebSocket connection to Core BE WS, send the auth frame, and drive the rest of the chat protocol: conversation list, create, rename, delete, and streamed message send.
- Render conversation history, including replaying it after selecting a conversation again on reconnect or after a page reload.
- Stay usable on both a phone-sized and a desktop-sized viewport.
- Serve a static `/health` file baked at build time, for both local debugging and deployment verification.

<br>

## What it does not do

- It does not issue or validate JWTs itself, that is Core BE.
- It does not persist the access token anywhere durable, a full page reload always re-establishes the session through the refresh cookie, never through client-side storage.
- It does not run any server-side code beyond the static file server, all the actual account and chat logic lives in Core BE and Core BE WS.
- It does not retry a failed chat completion itself, Core BE WS already reports that as an error frame on the same connection, Core FE just shows it.

<br>

## Session flow: sign in, silent refresh, sign out

```mermaid
sequenceDiagram
    participant Browser
    participant CoreFE as Core FE
    participant CoreBE as Core BE

    Browser->>CoreFE: open /signin, submit credentials
    CoreFE->>CoreBE: POST /auth/signin
    CoreBE-->>CoreFE: access token + httpOnly refresh cookie
    CoreFE-->>Browser: navigate to /chat, token held in memory

    Note over CoreFE: a timer is scheduled ahead of the access token's expiry

    CoreFE->>CoreBE: POST /auth/refresh (cookie sent automatically)
    CoreBE-->>CoreFE: new access token, session stays alive

    Browser->>CoreFE: click Sign out
    CoreFE->>CoreBE: POST /auth/signout
    CoreBE-->>CoreFE: session and cookie cleared
    CoreFE-->>Browser: navigate to /signin
```

<br>

## Dependencies

- Core BE REST API: signup, signin, signout, refresh.
- Core BE WS WebSocket API: auth frame, conversation CRUD, streamed chat.
- No datastore, no secrets, and no build-time dependency on either other service being reachable, only a runtime one.
