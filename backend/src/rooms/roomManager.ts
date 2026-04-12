import type {
  ClientGameSnapshot,
  PlayerProfile,
  RoomSettings,
  RoomState,
} from "../../../shared/dist/index.js";
import {
  canRoomStart,
  createSnapshot,
  generateId,
  generateRoomCode,
  initializeGame,
  maybeAutoDraw,
} from "../game/engine.js";

export class RoomManager {
  private rooms = new Map<string, RoomState>();

  createRoom(playerName: string, sessionId: string, socketId: string, settings: RoomSettings) {
    const roomCode = generateRoomCode(new Set(this.rooms.keys()));
    const host: PlayerProfile = {
      id: generateId("player"),
      sessionId,
      socketId,
      name: playerName,
      isHost: true,
      connected: true,
      handCount: 0,
      rank: null,
    };

    const room: RoomState = {
      code: roomCode,
      hostId: host.id,
      createdAt: Date.now(),
      settings,
      players: [host],
      game: null,
    };
    this.rooms.set(roomCode, room);
    return { room, player: host };
  }

  joinRoom(roomCode: string, playerName: string, sessionId: string, socketId: string) {
    const room = this.rooms.get(roomCode);
    if (!room) {
      throw new Error("Room not found.");
    }
    if (room.game?.phase === "playing") {
      const reconnectSeat = room.game.players.find((player) => player.sessionId === sessionId);
      if (!reconnectSeat) {
        throw new Error("The match already started.");
      }
      reconnectSeat.socketId = socketId;
      reconnectSeat.connected = true;
      const lobbySeat = room.players.find((player) => player.id === reconnectSeat.id);
      if (lobbySeat) {
        lobbySeat.socketId = socketId;
        lobbySeat.connected = true;
      }
      return { room, player: reconnectSeat };
    }

    const existing = room.players.find((player) => player.sessionId === sessionId);
    if (existing) {
      existing.socketId = socketId;
      existing.connected = true;
      return { room, player: existing };
    }
    if (room.players.length >= 6) {
      throw new Error("Room is full.");
    }

    const player: PlayerProfile = {
      id: generateId("player"),
      sessionId,
      socketId,
      name: playerName,
      isHost: false,
      connected: true,
      handCount: 0,
      rank: null,
    };

    room.players.push(player);
    return { room, player };
  }

  startGame(roomCode: string, actingPlayerId: string) {
    const room = this.getRoom(roomCode);
    if (room.hostId !== actingPlayerId) {
      throw new Error("Only the host can start the match.");
    }
    if (!canRoomStart(room.players)) {
      throw new Error("A match needs between 2 and 6 players.");
    }
    room.game = initializeGame(room.players);
    maybeAutoDraw(room.game, room.settings);
    return room;
  }

  getRoom(roomCode: string) {
    const room = this.rooms.get(roomCode);
    if (!room) {
      throw new Error("Room not found.");
    }
    return room;
  }

  findPlayerRoom(playerId: string) {
    return [...this.rooms.values()].find((room) =>
      room.players.some((player) => player.id === playerId),
    );
  }

  markDisconnected(socketId: string) {
    const affected = new Set<string>();
    for (const room of this.rooms.values()) {
      for (const player of room.players) {
        if (player.socketId === socketId) {
          player.socketId = null;
          player.connected = false;
          affected.add(room.code);
        }
      }
      if (room.game) {
        for (const player of room.game.players) {
          if (player.socketId === socketId) {
            player.socketId = null;
            player.connected = false;
            affected.add(room.code);
          }
        }
      }
    }
    return [...affected];
  }

  removeEmptyRooms() {
    for (const [code, room] of this.rooms.entries()) {
      if (room.players.every((player) => !player.connected) && room.game?.phase !== "playing") {
        this.rooms.delete(code);
      }
    }
  }

  buildSnapshots(room: RoomState) {
    const sourcePlayers = room.game?.players ?? room.players;
    return sourcePlayers
      .filter((player) => player.socketId)
      .map((player) => ({
        socketId: player.socketId!,
        snapshot: createSnapshot(room.code, room.hostId, room.settings, room.game, player.id),
      }));
  }

  buildLobbySnapshot(room: RoomState, viewerId: string): ClientGameSnapshot {
    if (room.game) {
      return createSnapshot(room.code, room.hostId, room.settings, room.game, viewerId);
    }
    const viewer = room.players.find((player) => player.id === viewerId);
    return {
      roomCode: room.code,
      phase: "waiting",
      settings: room.settings,
      selfId: viewerId,
      selfName: viewer?.name ?? "",
      isHost: viewerId === room.hostId,
      hostId: room.hostId,
      players: room.players.map((player) => ({
        id: player.id,
        name: player.name,
        isHost: player.isHost,
        connected: player.connected,
        handCount: player.handCount,
        isCurrentTurn: false,
        rank: null,
      })),
      localHand: [],
      discardTop: null,
      currentColor: "crimson",
      drawPileCount: 0,
      direction: 1,
      pendingDraw: 0,
      pendingPenaltyKind: null,
      winnerId: null,
      log: [],
      message: "Waiting in the lobby.",
    };
  }
}
