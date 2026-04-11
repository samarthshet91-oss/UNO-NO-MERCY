# Arc Blitz Architecture

## Overview

Arc Blitz is split into three packages:

- `frontend`: React client with a responsive lobby and match table
- `backend`: Express + Socket.IO server that owns rooms, turns, validation, and reconnect logic
- `shared`: game contracts and state interfaces consumed by both packages

## Server-Authoritative Turn Flow

1. A client emits a move intent such as `game:play-card`.
2. The backend looks up the room, the connected player seat, and the current turn.
3. The engine verifies:
   - the game is active
   - it is the acting player's turn
   - the card exists in that player's hand
   - the card matches current color, symbol, or stack rules
   - wild selections are valid
4. If valid, the backend mutates game state, appends a log entry, resolves action effects, and broadcasts a fresh player-specific snapshot.
5. If invalid, the backend emits `game:error` to only that socket.

## Reconnect Handling

- Each browser stores a `sessionId` in `localStorage`.
- Rooms index players by `sessionId`, not just socket id.
- On reconnect or refresh, the server reattaches the socket to the same seat if the room still exists.

## State Schema

Shared state centers around these structures:

- `RoomState`: room metadata, settings, players, and current `game`
- `ServerGameState`: full deck, discard, turn, and private hands
- `ClientGameSnapshot`: player-safe view with the local hand plus opponent hand counts

See [shared/src/index.ts](/E:/ATM_PROJECT/uno%20no%20mercy/shared/src/index.ts).

## Upgrade Paths

- Redis-backed room persistence and scaling
- AI bot seats for practice lobbies
- Spectator mode
- Matchmaking
- Ranked rulesets and analytics
- MongoDB match history and player profiles
