import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const labelMap = {
    number: "",
    skip: "SKIP",
    reverse: "FLIP",
    draw_two: "+2",
    wild: "PRISM",
    wild_draw_four: "+4",
};
function getValue(card) {
    return card.kind === "number" ? String(card.value) : labelMap[card.kind];
}
export function CardFace({ card, compact = false }) {
    const className = `card-shell color-${card.color} ${compact ? "compact" : ""}`;
    return (_jsxs("div", { className: className, children: [_jsx("div", { className: "card-edge" }), _jsxs("div", { className: "card-inner", children: [_jsx("span", { className: "card-corner", children: getValue(card) }), _jsx("div", { className: "card-glyph", children: getValue(card) }), _jsx("span", { className: "card-name", children: card.kind === "number" ? card.color : labelMap[card.kind] })] })] }));
}
