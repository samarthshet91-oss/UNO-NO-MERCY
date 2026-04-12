import cors from "cors";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import type {
  CreateRoomPayload,
  DrawCardPayload,
  JoinRoomPayload,
  PlayCardPayload,
  SocketClientToServerEvents,
  SocketServerToClientEvents,
  StartGamePayload,
} from "../../shared/src/index";
import { drawForPlayer, maybeAutoDraw, playCard } from "./game/engine.js";
import { RoomManager } from "./rooms/roomManager.js";

const app = express();
app.get("/", (_req, res) => {
  res.send("Arc Blitz backend is running.");
});
const allowedOrigins =[
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "https://uno-no-mercy-frontend.vercel.app",
  "https://uno-no-mercy-frontend-no1istoth-samarthshet91-oss-projects.vercel.app",
  "https://implicate-anchovy-contently.ngrok-free.dev",
];
app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST"],
  credentials: true,
}));
app.use(express.json());

const server = http.createServer(app);
const io = new Server<SocketClientToServerEvents, SocketServerToClientEvents>(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["polling", "websocket"],
});

const roomManager = new RoomManager();

function broadcastRoom(roomCode: string) {
  const room = roomManager.getRoom(roomCode);
  if (room.game) {
    for (const { socketId, snapshot } of roomManager.buildSnapshots(room)) {
      io.to(socketId).emit("game:state", snapshot);
      io.to(socketId).emit("room:update", snapshot);
    }
  } else {
    room.players
      .filter((player) => player.socketId)
      .forEach((player) => {
        const snapshot = roomManager.buildLobbySnapshot(room, player.id);
        io.to(player.socketId!).emit("room:update", snapshot);
      });
  }
}

function safeAction(socketId: string, roomCode: string, fn: () => void) {
  try {
    fn();
    broadcastRoom(roomCode);
  } catch (error) {
    const text = error instanceof Error ? error.message : "Unexpected server error.";
    io.to(socketId).emit("game:error", {
      roomCode,
      severity: "error",
      text,
    });
  }
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, rooms: "active" });
});

io.on("connection", (socket) => {
  socket.on("room:create", (payload: CreateRoomPayload) => {
    try {
      const { room, player } = roomManager.createRoom(
        payload.playerName.trim().slice(0, 18) || "Player",
        payload.sessionId,
        socket.id,
        payload.settings,
      );
      socket.join(room.code);
      socket.emit("room:joined", { roomCode: room.code, playerId: player.id });
      broadcastRoom(room.code);
    } catch (error) {
      socket.emit("game:error", {
        roomCode: "",
        severity: "error",
        text: error instanceof Error ? error.message : "Could not create room.",
      });
    }
  });

  socket.on("room:join", (payload: JoinRoomPayload) => {
    try {
      const { room, player } = roomManager.joinRoom(
        payload.roomCode.trim().toUpperCase(),
        payload.playerName.trim().slice(0, 18) || "Player",
        payload.sessionId,
        socket.id,
      );
      socket.join(room.code);
      socket.emit("room:joined", { roomCode: room.code, playerId: player.id });
      socket.emit("game:message", {
        roomCode: room.code,
        severity: "info",
        text: room.game ? "Reconnected to your active match." : "Joined the lobby.",
      });
      broadcastRoom(room.code);
    } catch (error) {
      socket.emit("game:error", {
        roomCode: payload.roomCode,
        severity: "error",
        text: error instanceof Error ? error.message : "Could not join room.",
      });
    }
  });

  socket.on("room:start", (payload: StartGamePayload) => {
    safeAction(socket.id, payload.roomCode, () => {
      const room = roomManager.getRoom(payload.roomCode);
      const player = room.players.find((entry) => entry.socketId === socket.id);
      if (!player) {
        throw new Error("You are not seated in this room.");
      }
      roomManager.startGame(payload.roomCode, player.id);
      io.to(socket.id).emit("game:message", {
        roomCode: payload.roomCode,
        severity: "info",
        text: "Match started.",
      });
    });
  });

  socket.on("game:play-card", (payload: PlayCardPayload) => {
    safeAction(socket.id, payload.roomCode, () => {
      const room = roomManager.getRoom(payload.roomCode);
      const game = room.game;
      if (!game) {
        throw new Error("Match not started.");
      }
      const player = game.players.find((entry) => entry.socketId === socket.id);
      if (!player) {
        throw new Error("You are not seated in this match.");
      }
      playCard(game, player.id, payload.cardId, room.settings, payload.declaredColor);
      maybeAutoDraw(game, room.settings);
    });
  });

  socket.on("game:draw-card", (payload: DrawCardPayload) => {
    safeAction(socket.id, payload.roomCode, () => {
      const room = roomManager.getRoom(payload.roomCode);
      const game = room.game;
      if (!game) {
        throw new Error("Match not started.");
      }
      const player = game.players.find((entry) => entry.socketId === socket.id);
      if (!player) {
        throw new Error("You are not seated in this match.");
      }
      drawForPlayer(game, player.id, room.settings);
      maybeAutoDraw(game, room.settings);
    });
  });

  socket.on("game:leave", ({ roomCode }) => {
    const affectedRooms = roomManager.markDisconnected(socket.id);
    socket.leave(roomCode);
    affectedRooms.forEach((code) => broadcastRoom(code));
  });

  socket.on("disconnect", () => {
    const affectedRooms = roomManager.markDisconnected(socket.id);
    affectedRooms.forEach((code) => broadcastRoom(code));
    roomManager.removeEmptyRooms();
  });
});

const PORT = Number(process.env.PORT ?? 3001);
server.listen(PORT, () => {
  console.log(`Arc Blitz backend listening on http://localhost:${PORT}`);
});
