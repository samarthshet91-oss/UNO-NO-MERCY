import type { Card } from "@arc-blitz/shared";

const labelMap: Record<Card["kind"], string> = {
  number: "",
  skip: "SKIP",
  reverse: "FLIP",
  draw_two: "+2",
  wild: "PRISM",
  wild_draw_four: "+4",
  wild_draw_six: "+6",
  wild_draw_ten: "+10",
  wild_reverse_draw_four: "FLIP +4",
  wild_color_roulette: "COLOR ROULETTE",
  skip_everyone: "SKIP ALL",
  discard_all: "DISCARD ALL",
};

function getValue(card: Card) {
  return card.kind === "number" ? String(card.value) : labelMap[card.kind];
}

export function CardFace({ card, compact = false }: { card: Card; compact?: boolean }) {
  const className = `card-shell color-${card.color} ${compact ? "compact" : ""}`;
  return (
    <div className={className}>
      <div className="card-edge" />
      <div className="card-inner">
        <span className="card-corner">{getValue(card)}</span>
        <div className="card-glyph">{getValue(card)}</div>
        <span className="card-name">{card.kind === "number" ? card.color : labelMap[card.kind]}</span>
      </div>
    </div>
  );
}
