# Arc Blitz

Arc Blitz is an original, real-time multiplayer browser card game inspired by high-chaos shedding games. It uses a React + TypeScript frontend, a Node.js + Express + Socket.IO backend, and a shared TypeScript rules package so the server stays authoritative and the client stays honest.

## Project Structure

```text
.
|-- backend
|   `-- src
|-- frontend
|   `-- src
|-- shared
|   `-- src
|-- package.json
`-- tsconfig.base.json
```

## MVP Features

- Room creation and joining with short codes
- 2 to 6 player live multiplayer sessions
- Server-authoritative card validation and turn order
- Reconnect support using a browser session id
- Draw stacking, reverse, skip, wild cards, and optional brutal house rules
- Auto-draw-on-stall option
- Responsive match layout, move history, and animated card UI

## Setup

Prerequisite: Node.js 20+ and npm 10+ installed locally.

1. Install dependencies:

```bash
npm install
```

2. Start the app in development:

```bash
npm run dev
```

3. Open the frontend in two or more browser tabs. By default:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

## Local Multiplayer Test

1. Open one tab and create a room.
2. Copy the room code.
3. Open extra tabs or windows and join with different player names.
4. Start the match from the host tab when at least 2 players are in the room.
5. Test reconnect by refreshing a tab. The same browser keeps its session id and rejoins the same seat.

## Architecture Summary

- `shared`: game types, socket contracts, room settings, and serializable state models
- `backend`: room registry, authoritative game engine, and Socket.IO event handlers
- `frontend`: lobby flow, match UI, hand interactions, and live socket state hydration

The backend validates every play request against the current top discard, active color, pending draw stack, turn direction, and room rules before mutating state. Clients only send intentions such as "play this card" or "draw now".

## Socket Event Flow

Client to server:

- `room:create`
- `room:join`
- `room:start`
- `game:play-card`
- `game:draw-card`
- `game:leave`

Server to client:

- `room:joined`
- `room:update`
- `game:state`
- `game:message`
- `game:error`

More detail lives in [docs/ARCHITECTURE.md](/E:/ATM_PROJECT/uno%20no%20mercy/docs/ARCHITECTURE.md).
