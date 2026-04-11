export const GAME_TITLE = "Arc Blitz";

export const CARD_COLORS = ["crimson", "cyan", "lime", "gold"] as const;
export const PENALTY_KINDS = ["draw_two", "wild_draw_four"] as const;

export type CardColor = (typeof CARD_COLORS)[number];
export type PenaltyKind = (typeof PENALTY_KINDS)[number];
export type CardKind = "number" | "skip" | "reverse" | PenaltyKind | "wild";
export type MatchPhase = "waiting" | "playing" | "finished";

export interface Card {
  id: string;
  color: CardColor | "wild";
  kind: CardKind;
  value: number | "skip" | "reverse" | "draw2" | "wild" | "wild4";
}

export interface RoomSettings {
  brutalStacking: boolean;
  autoDrawOnStall: boolean;
}

export interface PlayerProfile {
  id: string;
  sessionId: string;
  socketId: string | null;
  name: string;
  isHost: boolean;
  connected: boolean;
  handCount: number;
  rank: number | null;
}

export interface LogEntry {
  id: string;
  type:
    | "system"
    | "play"
    | "draw"
    | "penalty"
    | "turn"
    | "join"
    | "leave"
    | "win";
  message: string;
  createdAt: number;
}

export interface ServerPlayerState extends PlayerProfile {
  hand: Card[];
}

export interface ServerGameState {
  id: string;
  phase: MatchPhase;
  players: ServerPlayerState[];
  drawPile: Card[];
  discardPile: Card[];
  currentColor: CardColor;
  turnIndex: number;
  direction: 1 | -1;
  pendingDraw: number;
  pendingPenaltyKind: PenaltyKind | null;
  winnerId: string | null;
  lastAction: string | null;
  log: LogEntry[];
}

export interface RoomState {
  code: string;
  hostId: string;
  createdAt: number;
  settings: RoomSettings;
  players: PlayerProfile[];
  game: ServerGameState | null;
}

export interface PlayerSeatView {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  handCount: number;
  isCurrentTurn: boolean;
  rank: number | null;
}

export interface ClientGameSnapshot {
  roomCode: string;
  phase: MatchPhase;
  settings: RoomSettings;
  selfId: string;
  selfName: string;
  isHost: boolean;
  hostId: string;
  players: PlayerSeatView[];
  localHand: Card[];
  discardTop: Card | null;
  currentColor: CardColor;
  drawPileCount: number;
  direction: 1 | -1;
  pendingDraw: number;
  pendingPenaltyKind: PenaltyKind | null;
  winnerId: string | null;
  log: LogEntry[];
  message: string;
}

export interface JoinRoomPayload {
  roomCode: string;
  playerName: string;
  sessionId: string;
}

export interface CreateRoomPayload {
  playerName: string;
  sessionId: string;
  settings: RoomSettings;
}

export interface StartGamePayload {
  roomCode: string;
}

export interface PlayCardPayload {
  roomCode: string;
  cardId: string;
  declaredColor?: CardColor;
}

export interface DrawCardPayload {
  roomCode: string;
}

export interface RoomJoinedPayload {
  roomCode: string;
  playerId: string;
}

export interface ServerMessagePayload {
  roomCode: string;
  severity: "info" | "error";
  text: string;
}

export interface SocketServerToClientEvents {
  "room:joined": (payload: RoomJoinedPayload) => void;
  "room:update": (snapshot: ClientGameSnapshot) => void;
  "game:state": (snapshot: ClientGameSnapshot) => void;
  "game:message": (payload: ServerMessagePayload) => void;
  "game:error": (payload: ServerMessagePayload) => void;
}

export interface SocketClientToServerEvents {
  "room:create": (payload: CreateRoomPayload) => void;
  "room:join": (payload: JoinRoomPayload) => void;
  "room:start": (payload: StartGamePayload) => void;
  "game:play-card": (payload: PlayCardPayload) => void;
  "game:draw-card": (payload: DrawCardPayload) => void;
  "game:leave": (payload: { roomCode: string }) => void;
}
