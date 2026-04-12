import {
  
  type Card,
  type CardColor,
  type CardKind,
  type ClientGameSnapshot,
  type LogEntry,
  type PenaltyKind,
  type PlayerProfile,
  type RoomSettings,
  type ServerGameState,
  type ServerPlayerState,
} from "../../../shared/dist/index";
const CARD_COLORS: CardColor[]=["crimson","cyan","lime"];

const STARTING_HAND_SIZE = 7;
const MAX_PLAYERS = 6;

const actionValues: Record<Exclude<CardKind, "number">, Card["value"]> = {
  skip: "skip",
  reverse: "reverse",
  draw_two: "draw2",
  wild: "wild",
  wild_draw_four: "wild4",
};

export class GameRuleError extends Error {}

export function generateId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function generateRoomCode(existing: Set<string>) {
  let code = "";
  do {
    code = Math.random().toString(36).slice(2, 6).toUpperCase();
  } while (existing.has(code));
  return code;
}

export function canRoomStart(players: PlayerProfile[]) {
  return players.length >= 2 && players.length <= MAX_PLAYERS;
}

function createCard(color: CardColor | "wild", kind: CardKind, numberValue?: number): Card {
  return {
    id: generateId("card"),
    color,
    kind,
    value: kind === "number" ? numberValue ?? 0 : actionValues[kind],
  };
}

function shuffle<T>(items: T[]) {
  const clone = [...items];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

export function createDeck() {
  const cards: Card[] = [];

  for (const color of CARD_COLORS) {
    for (let value = 0; value <= 9; value += 1) {
      cards.push(createCard(color, "number", value));
      if (value !== 0) {
        cards.push(createCard(color, "number", value));
      }
    }

    for (let count = 0; count < 2; count += 1) {
      cards.push(createCard(color, "skip"));
      cards.push(createCard(color, "reverse"));
      cards.push(createCard(color, "draw_two"));
    }
  }

  for (let count = 0; count < 4; count += 1) {
    cards.push(createCard("wild", "wild"));
    cards.push(createCard("wild", "wild_draw_four"));
  }

  return shuffle(cards);
}

function nextIndexFrom(current: number, total: number, direction: 1 | -1, distance = 1) {
  return (current + direction * distance + total * 10) % total;
}

function addLog(game: ServerGameState, type: LogEntry["type"], message: string) {
  game.log.unshift({
    id: generateId("log"),
    type,
    message,
    createdAt: Date.now(),
  });
  game.log = game.log.slice(0, 30);
}

function drawIntoHand(game: ServerGameState, player: ServerPlayerState, amount: number) {
  for (let i = 0; i < amount; i += 1) {
    if (game.drawPile.length === 0) {
      reshuffleDiscard(game);
    }
    const nextCard = game.drawPile.pop();
    if (!nextCard) {
      return;
    }
    player.hand.push(nextCard);
  }
  player.handCount = player.hand.length;
}

function reshuffleDiscard(game: ServerGameState) {
  if (game.discardPile.length <= 1) {
    return;
  }
  const top = game.discardPile.pop()!;
  game.drawPile = shuffle(game.discardPile);
  game.discardPile = [top];
  addLog(game, "system", "The discard storm was reshuffled into a fresh draw pile.");
}

function pickOpeningDiscard(deck: Card[]) {
  let card = deck.pop();
  while (card && (card.kind === "wild" || card.kind === "wild_draw_four")) {
    deck.unshift(card);
    card = deck.pop();
  }
  return card ?? createCard("crimson", "number", 0);
}

function resolveEliminatedPlayer(game: ServerGameState, player: ServerPlayerState) {
  if (player.hand.length === 0 && player.rank === null) {
    const nextRank = game.players.filter((entry) => entry.rank !== null).length + 1;
    player.rank = nextRank;
    addLog(game, "win", `${player.name} blasted out of cards and locked rank #${nextRank}.`);
    if (nextRank === 1) {
      game.winnerId = player.id;
      game.phase = "finished";
      game.players
        .filter((entry) => entry.rank === null && entry.id !== player.id)
        .forEach((entry, index) => {
          entry.rank = nextRank + index + 1;
        });
    }
  }
}

export function initializeGame(players: PlayerProfile[]) {
  const deck = createDeck();
  const serverPlayers: ServerPlayerState[] = players.map((player) => ({
    ...player,
    hand: [],
    handCount: 0,
    rank: null,
  }));

  for (let i = 0; i < STARTING_HAND_SIZE; i += 1) {
    serverPlayers.forEach((player) => {
      const card = deck.pop();
      if (card) {
        player.hand.push(card);
      }
    });
  }

  serverPlayers.forEach((player) => {
    player.handCount = player.hand.length;
  });

  const openingDiscard = pickOpeningDiscard(deck);
  const game: ServerGameState = {
    id: generateId("game"),
    phase: "playing",
    players: serverPlayers,
    drawPile: deck,
    discardPile: [openingDiscard],
    currentColor: openingDiscard.color === "wild" ? "crimson" : openingDiscard.color,
    turnIndex: 0,
    direction: 1,
    pendingDraw: 0,
    pendingPenaltyKind: null,
    winnerId: null,
    lastAction: null,
    log: [],
  };

  addLog(game, "system", "The Arc Blitz match has started.");
  addLog(game, "play", `Opening discard: ${describeCard(openingDiscard)}.`);
  if (openingDiscard.kind !== "number") {
    applyActionCard(game, openingDiscard, serverPlayers[0], "Opening discard");
  }
  addLog(game, "turn", `It is ${game.players[game.turnIndex].name}'s turn.`);
  return game;
}

function canStackPenalty(card: Card, game: ServerGameState, settings: RoomSettings) {
  if (game.pendingDraw === 0 || (card.kind !== "draw_two" && card.kind !== "wild_draw_four")) {
    return false;
  }
  if (settings.brutalStacking) {
    return true;
  }
  return card.kind === game.pendingPenaltyKind;
}

function matchesCurrent(card: Card, game: ServerGameState) {
  const top = game.discardPile[game.discardPile.length - 1];
  if (card.kind === "wild" || card.kind === "wild_draw_four") {
    return true;
  }
  if (!top) {
    return true;
  }
  return (
    card.color === game.currentColor ||
    card.kind === top.kind ||
    card.value === top.value
  );
}

export function getPlayableCards(
  hand: Card[],
  game: ServerGameState,
  settings: RoomSettings,
) {
  return hand.filter((card) => {
    if (game.pendingDraw > 0) {
      return canStackPenalty(card, game, settings);
    }
    return matchesCurrent(card, game);
  });
}

function advanceTurn(game: ServerGameState, skipDistance = 1) {
  game.turnIndex = nextIndexFrom(game.turnIndex, game.players.length, game.direction, skipDistance);
  addLog(game, "turn", `It is ${game.players[game.turnIndex].name}'s turn.`);
}

function applyActionCard(
  game: ServerGameState,
  card: Card,
  actor: ServerPlayerState,
  label = `${actor.name} played ${describeCard(card)}.`,
) {
  switch (card.kind) {
    case "reverse":
      game.direction = game.direction === 1 ? -1 : 1;
      addLog(game, "play", `${label} Turn flow flipped.`);
      if (game.players.length === 2) {
        advanceTurn(game, 2);
      } else {
        advanceTurn(game);
      }
      return;
    case "skip":
      addLog(game, "play", `${label} The next player was skipped.`);
      advanceTurn(game, 2);
      return;
    case "draw_two":
      game.pendingDraw += 2;
      game.pendingPenaltyKind = "draw_two";
      addLog(game, "penalty", `${label} Penalty stack is now ${game.pendingDraw}.`);
      advanceTurn(game);
      return;
    case "wild_draw_four":
      game.pendingDraw += 4;
      game.pendingPenaltyKind = "wild_draw_four";
      addLog(game, "penalty", `${label} Penalty stack is now ${game.pendingDraw}.`);
      advanceTurn(game);
      return;
    case "wild":
      addLog(game, "play", label);
      advanceTurn(game);
      return;
    default:
      addLog(game, "play", label);
      advanceTurn(game);
  }
}

export function describeCard(card: Card) {
  const colorPart = card.color === "wild" ? "Prism" : card.color[0].toUpperCase() + card.color.slice(1);
  if (card.kind === "number") {
    return `${colorPart} ${card.value}`;
  }
  const labelMap: Record<Exclude<CardKind, "number">, string> = {
    skip: "Skip",
    reverse: "Reverse",
    draw_two: "Draw Two",
    wild: "Wild",
    wild_draw_four: "Wild Draw Four",
  };
  return `${colorPart} ${labelMap[card.kind]}`;
}

export function playCard(
  game: ServerGameState,
  actingPlayerId: string,
  cardId: string,
  settings: RoomSettings,
  declaredColor?: CardColor,
) {
  if (game.phase !== "playing") {
    throw new GameRuleError("The match is no longer active.");
  }

  const currentPlayer = game.players[game.turnIndex];
  if (!currentPlayer || currentPlayer.id !== actingPlayerId) {
    throw new GameRuleError("It is not your turn.");
  }

  const cardIndex = currentPlayer.hand.findIndex((card) => card.id === cardId);
  if (cardIndex === -1) {
    throw new GameRuleError("That card is not in your hand.");
  }

  const card = currentPlayer.hand[cardIndex];
  const playableCards = getPlayableCards(currentPlayer.hand, game, settings);
  const isPlayable = playableCards.some((entry) => entry.id === card.id);
  if (!isPlayable) {
    throw new GameRuleError("That card cannot be played right now.");
  }

  if (card.color === "wild" && !declaredColor) {
    throw new GameRuleError("A wild card needs a declared color.");
  }

  currentPlayer.hand.splice(cardIndex, 1);
  currentPlayer.handCount = currentPlayer.hand.length;
  game.discardPile.push(card);
  game.lastAction = `${currentPlayer.name} played ${describeCard(card)}.`;
  game.currentColor =
    card.color === "wild"
      ? declaredColor ?? "crimson"
      : card.color;

  game.pendingPenaltyKind = game.pendingDraw > 0 && (card.kind === "draw_two" || card.kind === "wild_draw_four")
    ? (card.kind as PenaltyKind)
    : game.pendingPenaltyKind;

  resolveEliminatedPlayer(game, currentPlayer);


  if (card.kind === "number") {
    addLog(game, "play", game.lastAction);
    advanceTurn(game);
  } else {
    applyActionCard(game, card, currentPlayer);
  }
}

export function drawForPlayer(
  game: ServerGameState,
  actingPlayerId: string,
  settings: RoomSettings,
) {
  if (game.phase !== "playing") {
    throw new GameRuleError("The match is no longer active.");
  }

  const currentPlayer = game.players[game.turnIndex];
  if (!currentPlayer || currentPlayer.id !== actingPlayerId) {
    throw new GameRuleError("It is not your turn.");
  }

  const playable = getPlayableCards(currentPlayer.hand, game, settings);
  if (playable.length > 0 && game.pendingDraw === 0 && !settings.autoDrawOnStall) {
    throw new GameRuleError("You already have a playable card.");
  }

  const drawAmount = game.pendingDraw > 0 ? game.pendingDraw : 1;
  drawIntoHand(game, currentPlayer, drawAmount);
  addLog(
    game,
    game.pendingDraw > 0 ? "penalty" : "draw",
    `${currentPlayer.name} drew ${drawAmount} card${drawAmount === 1 ? "" : "s"}.`,
  );
  game.pendingDraw = 0;
  game.pendingPenaltyKind = null;
  advanceTurn(game);
}

export function maybeAutoDraw(game: ServerGameState, settings: RoomSettings) {
  if (game.phase !== "playing" || !settings.autoDrawOnStall) {
    return;
  }

  let loopGuard = 0;
  while (loopGuard < game.players.length && game.phase === "playing") {
    const player = game.players[game.turnIndex];
    if (!player) {
      return;
    }
    const playable = getPlayableCards(player.hand, game, settings);
    if (game.pendingDraw > 0 || playable.length > 0) {
      return;
    }

    drawIntoHand(game, player, 1);
    addLog(game, "draw", `${player.name} had no match and auto-drew.`);
    const followUpPlayable = getPlayableCards(player.hand, game, settings);
    if (followUpPlayable.length > 0) {
      return;
    }
    addLog(game, "system", `${player.name} still had no match, so the turn passed.`);
    advanceTurn(game);
    loopGuard += 1;
  }
}

export function createSnapshot(
  roomCode: string,
  hostId: string,
  settings: RoomSettings,
  game: ServerGameState | null,
  viewerId: string,
): ClientGameSnapshot {
  if (!game) {
    return {
      roomCode,
      phase: "waiting",
      settings,
      selfId: viewerId,
      selfName: "",
      isHost: viewerId === hostId,
      hostId,
      players: [],
      localHand: [],
      discardTop: null,
      currentColor: "crimson",
      drawPileCount: 0,
      direction: 1,
      pendingDraw: 0,
      pendingPenaltyKind: null,
      winnerId: null,
      log: [],
      message: "Waiting for the host to start the match.",
    };
  }

  const viewer = game.players.find((player) => player.id === viewerId);
  return {
    roomCode,
    phase: game.phase,
    settings,
    selfId: viewerId,
    selfName: viewer?.name ?? "",
    isHost: viewerId === hostId,
    hostId,
    players: game.players.map((player, index) => ({
      id: player.id,
      name: player.name,
      isHost: player.id === hostId,
      connected: player.connected,
      handCount: player.hand.length,
      isCurrentTurn: game.phase === "playing" && index === game.turnIndex,
      rank: player.rank,
    })),
    localHand: viewer?.hand ?? [],
    discardTop: game.discardPile[game.discardPile.length - 1] ?? null,
    currentColor: game.currentColor,
    drawPileCount: game.drawPile.length,
    direction: game.direction,
    pendingDraw: game.pendingDraw,
    pendingPenaltyKind: game.pendingPenaltyKind,
    winnerId: game.winnerId,
    log: game.log,
    message:
      game.phase === "finished"
        ? `${game.players.find((player) => player.id === game.winnerId)?.name ?? "A player"} wins the match.`
        : game.pendingDraw > 0
          ? `${game.players[game.turnIndex].name} must answer a ${game.pendingDraw}-card penalty or draw it.`
          : `${game.players[game.turnIndex].name}'s turn.`,
  };
}
