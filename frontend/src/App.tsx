import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type {
  Card,
  CardColor,
  ClientGameSnapshot,
  RoomSettings,
  ServerMessagePayload,
} from "@arc-blitz/shared";
import { GAME_TITLE } from "@arc-blitz/shared";
import { io, type Socket } from "socket.io-client";
import { CardFace } from "./components/CardFace";
import "./styles/app.css";

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3001";
const STORAGE_KEY = "arc-blitz-session";

type Notice = { kind: "info" | "error"; text: string } | null;

const defaultSettings: RoomSettings = {
  brutalStacking: true,
  autoDrawOnStall: true,
};

function createSessionId() {
  return `session_${Math.random().toString(36).slice(2, 12)}`;
}

function getSessionId() {
  const current = window.localStorage.getItem(STORAGE_KEY);
  if (current) {
    return current;
  }
  const next = createSessionId();
  window.localStorage.setItem(STORAGE_KEY, next);
  return next;
}

function sortHand(hand: Card[]) {
  const colorOrder = ["red", "blue", "green", "yellow", "wild"];
  return [...hand].sort((a, b) => {
    const colorDelta = colorOrder.indexOf(a.color) - colorOrder.indexOf(b.color);
    if (colorDelta !== 0) {
      return colorDelta;
    }
    return String(a.value).localeCompare(String(b.value));
  });
}

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [playerName, setPlayerName] = useState("Player");
  const [joinCode, setJoinCode] = useState("");
  const [settings, setSettings] = useState<RoomSettings>(defaultSettings);
  const [snapshot, setSnapshot] = useState<ClientGameSnapshot | null>(null);
  const [playerId, setPlayerId] = useState<string>("");
  const [notice, setNotice] = useState<Notice>(null);
  const [wildSelection, setWildSelection] = useState<CardColor>("red");

  useEffect(() => {
    const sessionId = getSessionId();
    const nextSocket = io(SERVER_URL, {
      transports: ["websocket"],
    });

    nextSocket.on("room:joined", ({ playerId: joinedPlayerId }) => {
      setPlayerId(joinedPlayerId);
    });
    nextSocket.on("room:update", (state) => setSnapshot(state));
    nextSocket.on("game:state", (state) => setSnapshot(state));
    nextSocket.on("game:message", (message: ServerMessagePayload) =>
      setNotice({ kind: message.severity, text: message.text }),
    );
    nextSocket.on("game:error", (message: ServerMessagePayload) =>
      setNotice({ kind: "error", text: message.text }),
    );

    setSocket(nextSocket);

    return () => {
      nextSocket.disconnect();
      window.localStorage.setItem(STORAGE_KEY, sessionId);
    };
  }, []);

  useEffect(() => {
    if (!notice) {
      return;
    }
    const timer = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const currentPlayer = snapshot?.players.find((player) => player.id === playerId);
  const canStart = snapshot?.phase === "waiting" && snapshot.isHost && (snapshot.players.length ?? 0) >= 2;
  const canDraw =
    snapshot?.phase === "playing" &&
    currentPlayer?.isCurrentTurn;
  const sortedHand = useMemo(() => sortHand(snapshot?.localHand ?? []), [snapshot?.localHand]);

  const createRoom = () => {
    const sessionId = getSessionId();
    socket?.emit("room:create", {
      playerName,
      sessionId,
      settings,
    });
  };

  const joinRoom = () => {
    socket?.emit("room:join", {
      roomCode: joinCode,
      playerName,
      sessionId: getSessionId(),
    });
  };

  const playCard = (card: Card) => {
    if (!snapshot) {
      return;
    }
    socket?.emit("game:play-card", {
      roomCode: snapshot.roomCode,
      cardId: card.id,
      declaredColor: card.color === "wild" ? wildSelection : undefined,
    });
  };

  const drawCard = () => {
    if (!snapshot) {
      return;
    }
    socket?.emit("game:draw-card", { roomCode: snapshot.roomCode });
  };

  const topCard = snapshot?.discardTop ?? null;
  const accentStyle = topCard
    ? ({ ["--active-color" as string]: `var(--${snapshot?.currentColor})` } as CSSProperties)
    : undefined;

  return (
    <div className="shell" style={accentStyle}>
      <div className="background-glow background-glow-a" />
      <div className="background-glow background-glow-b" />
      <main className="app-frame">
        <header className="hero-panel">
          <div>
            <p className="eyebrow">Original multiplayer shedding chaos</p>
            <h1>{GAME_TITLE}</h1>
            <p className="hero-copy">
              Match by color or signal, stack penalties, pivot with wild cards, and burn through your hand
              before the table can bury you.
            </p>
          </div>
          <div className="room-chip">
            <span>Room</span>
            <strong>{snapshot?.roomCode ?? "----"}</strong>
          </div>
        </header>

        {!snapshot && (
          <section className="landing-grid">
            <article className="panel">
              <h2>Enter the arena</h2>
              <label className="field">
                <span>Name</span>
                <input value={playerName} maxLength={18} onChange={(event) => setPlayerName(event.target.value)} />
              </label>
              <div className="toggle-row">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={settings.brutalStacking}
                    onChange={(event) =>
                      setSettings((current) => ({ ...current, brutalStacking: event.target.checked }))
                    }
                  />
                  <span>Brutal stacking</span>
                </label>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={settings.autoDrawOnStall}
                    onChange={(event) =>
                      setSettings((current) => ({ ...current, autoDrawOnStall: event.target.checked }))
                    }
                  />
                  <span>Auto-draw when stuck</span>
                </label>
              </div>
              <button className="primary-btn" onClick={createRoom}>
                Create room
              </button>
            </article>

            <article className="panel">
              <h2>Join by code</h2>
              <label className="field">
                <span>Room code</span>
                <input
                  value={joinCode}
                  maxLength={4}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                />
              </label>
              <button className="secondary-btn" onClick={joinRoom}>
                Join room
              </button>
              <div className="rules-note">
                <strong>How it plays</strong>
                <p>
                  The server owns every move, so cards are validated against the live discard, active color, turn,
                  and penalty stack before the table updates.
                </p>
              </div>
            </article>
          </section>
        )}

        {snapshot && snapshot.phase === "waiting" && (
          <section className="table-grid">
            <article className="panel lobby-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Lobby</p>
                  <h2>Players connected</h2>
                </div>
                <div className="rule-badges">
                  <span>{snapshot.settings.brutalStacking ? "Brutal stack" : "Classic stack"}</span>
                  <span>{snapshot.settings.autoDrawOnStall ? "Auto draw" : "Manual draw"}</span>
                </div>
              </div>

              <div className="player-list">
                {snapshot.players.map((player) => (
                  <div className="player-row" key={player.id}>
                    <div>
                      <strong>{player.name}</strong>
                      <span>{player.isHost ? "Host" : "Player"}</span>
                    </div>
                    <em className={player.connected ? "online" : "offline"}>
                      {player.connected ? "Connected" : "Disconnected"}
                    </em>
                  </div>
                ))}
              </div>

              {canStart ? (
                <button className="primary-btn" onClick={() => socket?.emit("room:start", { roomCode: snapshot.roomCode })}>
                  Start match
                </button>
              ) : (
                <p className="helper-copy">Host can start once at least two players are in the room.</p>
              )}
            </article>

            <article className="panel">
              <h2>Match preview</h2>
              <p>{snapshot.message}</p>
              <div className="stack-legend">
                <span className="legend-card legend-red">red</span>
                <span className="legend-card legend-blue">blue</span>
                <span className="legend-card legend-green">green</span>
                <span className="legend-card legend-yellow">yellow</span>
                <span className="legend-card legend-wild">wild</span>
              </div>
            </article>
          </section>
        )}

        {snapshot && snapshot.phase !== "waiting" && (
          <section className="battlefield">
            <aside className="side-panel panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Table state</p>
                  <h2>{snapshot.message}</h2>
                </div>
              </div>
              <div className="stats-grid">
                <div className="stat-tile">
                  <span>Direction</span>
                  <strong>{snapshot.direction === 1 ? "Clockwise" : "Counter"}</strong>
                </div>
                <div className="stat-tile">
                  <span>Current color</span>
                  <strong className={`tone-${snapshot.currentColor}`}>{snapshot.currentColor}</strong>
                </div>
                <div className="stat-tile">
                  <span>Draw pile</span>
                  <strong>{snapshot.drawPileCount}</strong>
                </div>
                <div className="stat-tile danger">
                  <span>Penalty stack</span>
                  <strong>{snapshot.pendingDraw}</strong>
                </div>
              </div>

              <div className="player-list compact">
                {snapshot.players.map((player) => (
                  <div className={`player-row ${player.isCurrentTurn ? "active" : ""}`} key={player.id}>
                    <div>
                      <strong>{player.name}</strong>
                      <span>{player.handCount} cards</span>
                    </div>
                    <em>{player.rank ? `#${player.rank}` : player.connected ? "Live" : "Away"}</em>
                  </div>
                ))}
              </div>

              <div className="history-block">
                <h3>Action log</h3>
                <div className="history-list">
                  {snapshot.log.map((entry) => (
                    <div key={entry.id} className={`history-item type-${entry.type}`}>
                      {entry.message}
                    </div>
                  ))}
                </div>
              </div>
            </aside>

            <section className="table-panel">
              <div className="table-center panel">
                <div className="pile-stack">
                  <button className="draw-pile" disabled={!canDraw} onClick={drawCard}>
                    <span>Draw</span>
                    <strong>{snapshot.drawPileCount}</strong>
                  </button>
                  <div className="discard-slot">
                    {topCard ? <CardFace card={topCard} compact /> : <div className="card-shell empty-card">Empty</div>}
                  </div>
                </div>
                <div className="wild-picker">
                  <span>wild color</span>
                  <div className="swatches">
                    {(["red", "blue", "green", "yellow"] as CardColor[]).map((color) => (
                      <button
                        key={color}
                        className={`swatch swatch-${color} ${wildSelection === color ? "selected" : ""}`}
                        onClick={() => setWildSelection(color)}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="hand-panel panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Your hand</p>
                    <h2>{snapshot.phase === "finished" ? "Match complete" : "Play a card"}</h2>
                  </div>
                  <div className="rule-badges">
                    <span>{sortedHand.length} cards</span>
                    {snapshot.pendingDraw > 0 && <span>Stack live</span>}
                  </div>
                </div>
                <div className="hand-grid">
                  {sortedHand.map((card) => (
                    <button
                      key={card.id}
                      className="card-button"
                      disabled={snapshot.phase !== "playing" || !currentPlayer?.isCurrentTurn}
                      onClick={() => playCard(card)}
                    >
                      <CardFace card={card} />
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </section>
        )}

        {notice && <div className={`toast toast-${notice.kind}`}>{notice.text}</div>}
      </main>
    </div>
  );
}

export default App;
