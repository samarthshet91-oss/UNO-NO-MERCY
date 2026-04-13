import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const labelMap = {
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
};
function getValue(card) {
    return card.kind === "number" ? String(card.value) : labelMap[card.kind];
}
export function CardFace({ card, compact = false }) {
    const className = `card${card.color} ${compact ? "compact" : ""}`;
    const value = getValue(card);
    return(
         <div className={`card color-${card.color}`}>
      <div className="card-corner top-left">{value}</div>
      <div className="card-glyph">{value}</div>
      <div className="card-corner bottom-right">{value}</div>
      <div className="card-name">{card.kind}</div> 
    </div>
  );
}    

        

    
