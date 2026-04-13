import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { GAME_TITLE } from "@arc-blitz/shared";
import { io } from "socket.io-client";
import { CardFace } from "./components/CardFace";
import "./styles/app.css";
const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3001";
console.log("SERVER_URL", SERVER_URL);
const STORAGE_KEY = "arc-blitz-session";
const defaultSettings = {
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
function sortHand(hand) {
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
    const [socket, setSocket] = useState(null);
    const [playerName, setPlayerName] = useState("Player");
    const [joinCode, setJoinCode] = useState("");
    const [settings, setSettings] = useState(defaultSettings);
    const [snapshot, setSnapshot] = useState(null);
    const [playerId, setPlayerId] = useState("");
    const [notice, setNotice] = useState(null);
    const [wildSelection, setWildSelection] = useState("red");
    useEffect(() => {
        const sessionId = getSessionId();
        const nextSocket = io(SERVER_URL, {
            transports: ["polling","websocket"],
            withCredentials:true,
        });
        nextSocket.on("room:joined", ({ playerId: joinedPlayerId }) => {
            setPlayerId(joinedPlayerId);
        });
        nextSocket.on("room:update", (state) => setSnapshot(state));
        nextSocket.on("game:state", (state) => setSnapshot(state));
        nextSocket.on("game:message", (message) => setNotice({ kind: message.severity, text: message.text }));
        nextSocket.on("game:error", (message) => setNotice({ kind: "error", text: message.text }));
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
    const canDraw = snapshot?.phase === "playing" &&
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
    const playCard = (card) => {
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
        ? { ["--active-color"]: `var(--${snapshot?.currentColor})` }
        : undefined;
    return (_jsxs("div", { className: "shell", style: accentStyle, children: [_jsx("div", { className: "background-glow background-glow-a" }), _jsx("div", { className: "background-glow background-glow-b" }), _jsxs("main", { className: "app-frame", children: [_jsxs("header", { className: "hero-panel", children: [_jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: "Original multiplayer shedding chaos" }), _jsx("h1", { children: GAME_TITLE }), _jsx("p", { className: "hero-copy", children: "Match by color or signal, stack penalties, pivot with wild cards, and burn through your hand before the table can bury you." })] }), _jsxs("div", { className: "room-chip", children: [_jsx("span", { children: "Room" }), _jsx("strong", { children: snapshot?.roomCode ?? "----" })] })] }), !snapshot && (_jsxs("section", { className: "landing-grid", children: [_jsxs("article", { className: "panel", children: [_jsx("h2", { children: "Enter the arena" }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Name" }), _jsx("input", { value: playerName, maxLength: 18, onChange: (event) => setPlayerName(event.target.value) })] }), _jsxs("div", { className: "toggle-row", children: [_jsxs("label", { className: "toggle", children: [_jsx("input", { type: "checkbox", checked: settings.brutalStacking, onChange: (event) => setSettings((current) => ({ ...current, brutalStacking: event.target.checked })) }), _jsx("span", { children: "Brutal stacking" })] }), _jsxs("label", { className: "toggle", children: [_jsx("input", { type: "checkbox", checked: settings.autoDrawOnStall, onChange: (event) => setSettings((current) => ({ ...current, autoDrawOnStall: event.target.checked })) }), _jsx("span", { children: "Auto-draw when stuck" })] })] }), _jsx("button", { className: "primary-btn", onClick: createRoom, children: "Create room" })] }), _jsxs("article", { className: "panel", children: [_jsx("h2", { children: "Join by code" }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Room code" }), _jsx("input", { value: joinCode, maxLength: 4, onChange: (event) => setJoinCode(event.target.value.toUpperCase()) })] }), _jsx("button", { className: "secondary-btn", onClick: joinRoom, children: "Join room" }), _jsxs("div", { className: "rules-note", children: [_jsx("strong", { children: "How it plays" }), _jsx("p", { children: "The server owns every move, so cards are validated against the live discard, active color, turn, and penalty stack before the table updates." })] })] })] })), snapshot && snapshot.phase === "waiting" && (_jsxs("section", { className: "table-grid", children: [_jsxs("article", { className: "panel lobby-panel", children: [_jsxs("div", { className: "panel-heading", children: [_jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: "Lobby" }), _jsx("h2", { children: "Players connected" })] }), _jsxs("div", { className: "rule-badges", children: [_jsx("span", { children: snapshot.settings.brutalStacking ? "Brutal stack" : "Classic stack" }), _jsx("span", { children: snapshot.settings.autoDrawOnStall ? "Auto draw" : "Manual draw" })] })] }), _jsx("div", { className: "player-list", children: snapshot.players.map((player) => (_jsxs("div", { className: "player-row", children: [_jsxs("div", { children: [_jsx("strong", { children: player.name }), _jsx("span", { children: player.isHost ? "Host" : "Player" })] }), _jsx("em", { className: player.connected ? "online" : "offline", children: player.connected ? "Connected" : "Disconnected" })] }, player.id))) }), canStart ? (_jsx("button", { className: "primary-btn", onClick: () => socket?.emit("room:start", { roomCode: snapshot.roomCode }), children: "Start match" })) : (_jsx("p", { className: "helper-copy", children: "Host can start once at least two players are in the room." }))] }), _jsxs("article", { className: "panel", children: [_jsx("h2", { children: "Match preview" }), _jsx("p", { children: snapshot.message }), _jsxs("div", { className: "stack-legend", children: [_jsx("span", { className: "legend-card legend-red", children: "red" }), _jsx("span", { className: "legend-card legend-blue", children: "blue" }), _jsx("span", { className: "legend-card legend-green", children: "green" }), _jsx("span", { className: "legend-card legend-yellow", children: "yellow" }), _jsx("span", { className: "legend-card legend-wild", children: "wild" })] })] })] })), snapshot && snapshot.phase !== "waiting" && (_jsxs("section", { className: "battlefield", children: [_jsxs("aside", { className: "side-panel panel", children: [_jsx("div", { className: "panel-heading", children: _jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: "Table state" }), _jsx("h2", { children: snapshot.message })] }) }), _jsxs("div", { className: "stats-grid", children: [_jsxs("div", { className: "stat-tile", children: [_jsx("span", { children: "Direction" }), _jsx("strong", { children: snapshot.direction === 1 ? "Clockwise" : "Counter" })] }), _jsxs("div", { className: "stat-tile", children: [_jsx("span", { children: "Current color" }), _jsx("strong", { className: `tone-${snapshot.currentColor}`, children: snapshot.currentColor })] }), _jsxs("div", { className: "stat-tile", children: [_jsx("span", { children: "Draw pile" }), _jsx("strong", { children: snapshot.drawPileCount })] }), _jsxs("div", { className: "stat-tile danger", children: [_jsx("span", { children: "Penalty stack" }), _jsx("strong", { children: snapshot.pendingDraw })] })] }), _jsx("div", { className: "player-list compact", children: snapshot.players.map((player) => (_jsxs("div", { className: `player-row ${player.isCurrentTurn ? "active" : ""}`, children: [_jsxs("div", { children: [_jsx("strong", { children: player.name }), _jsxs("span", { children: [player.handCount, " cards"] })] }), _jsx("em", { children: player.rank ? `#${player.rank}` : player.connected ? "Live" : "Away" })] }, player.id))) }), _jsxs("div", { className: "history-block", children: [_jsx("h3", { children: "Action log" }), _jsx("div", { className: "history-list", children: snapshot.log.map((entry) => (_jsx("div", { className: `history-item type-${entry.type}`, children: entry.message }, entry.id))) })] })] }), _jsxs("section", { className: "table-panel", children: [_jsxs("div", { className: "table-center panel", children: [_jsxs("div", { className: "pile-stack", children: [_jsxs("button", { className: "draw-pile", disabled: !canDraw, onClick: drawCard, children: [_jsx("span", { children: "Draw" }), _jsx("strong", { children: snapshot.drawPileCount })] }), _jsx("div", { className: "discard-slot", children: topCard ? _jsx(CardFace, { card: topCard, compact: true }) : _jsx("div", { className: "card-shell empty-card", children: "Empty" }) })] }), _jsxs("div", { className: "wild-picker", children: [_jsx("span", { children: "wild color" }), _jsx("div", { className: "swatches", children: ["red", "blue", "green", "yellow"].map((color) => (_jsx("button", { className: `swatch swatch-${color} ${wildSelection === color ? "selected" : ""}`, onClick: () => setWildSelection(color) }, color))) })] })] }), _jsxs("div", { className: "hand-panel panel", children: [_jsxs("div", { className: "panel-heading", children: [_jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: "Your hand" }), _jsx("h2", { children: snapshot.phase === "finished" ? "Match complete" : "Play a card" })] }), _jsxs("div", { className: "rule-badges", children: [_jsxs("span", { children: [sortedHand.length, " cards"] }), snapshot.pendingDraw > 0 && _jsx("span", { children: "Stack live" })] })] }), _jsx("div", { className: "hand-grid", children: sortedHand.map((card) => (_jsx("button", { className: "card-button", disabled: snapshot.phase !== "playing" || !currentPlayer?.isCurrentTurn, onClick: () => playCard(card), children: _jsx(CardFace, { card: card }) }, card.id))) })] })] })] })), notice && _jsx("div", { className: `toast toast-${notice.kind}`, children: notice.text })] })] }));
}
export default App;
