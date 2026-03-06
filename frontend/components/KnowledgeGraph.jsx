import { useEffect, useRef, useState } from "react";

function buildPositions(result, w, h) {
  if (!result) return { nodes: [], edges: [] };
  const { verdict, key_assets = [], key_risks = [] } = result;

  const cx = w / 2;
  const topY = 72;
  const midY = 190;
  const botY = 310;

  const nodes = [];
  const edges = [];

  // Central verdict node
  nodes.push({ id: "v", label: verdict || "VERDICT", type: "verdict", x: cx, y: topY });

  const assets = key_assets.slice(0, 3);
  const risks = key_risks.slice(0, 3);

  // Assets — left side
  assets.forEach((a, i) => {
    const total = assets.length;
    const spread = Math.min(w * 0.32, 180);
    const x = cx - spread + (i * spread / Math.max(total - 1, 1));
    const y = total > 1 ? midY + (i % 2 === 0 ? 0 : 30) : midY;
    const id = `a${i}`;
    nodes.push({ id, label: a, type: "asset", x: cx * 0.42 + i * (cx * 0.28), y: midY + i * 8 });
    edges.push({ from: "v", to: id, color: "#3fb950" });
  });

  // Risks — right side
  risks.forEach((r, i) => {
    const id = `r${i}`;
    nodes.push({ id, label: r, type: "risk", x: cx + cx * 0.1 + i * (cx * 0.28), y: botY - i * 8 });
    edges.push({ from: "v", to: id, color: "#f85149" });
  });

  return { nodes, edges };
}

const NODE_W = { verdict: 120, asset: 160, risk: 160 };
const NODE_H = { verdict: 36, asset: 46, risk: 46 };

const COLORS = {
  verdict: { bg: "#161b22", border: "#8b949e", text: "#e6edf3", glow: "rgba(139,148,158,0.2)" },
  asset:   { bg: "#0d1117", border: "#238636", text: "#3fb950", glow: "rgba(63,185,80,0.15)" },
  risk:    { bg: "#0d1117", border: "#da3633", text: "#f85149", glow: "rgba(248,81,73,0.15)" },
};

function truncate(s, n = 28) { return s && s.length > n ? s.slice(0, n - 1) + "…" : s; }

export default function KnowledgeGraph({ result }) {
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ w: 560, h: 420 });

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) => {
      setDims({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const { nodes, edges } = buildPositions(result, dims.w, dims.h);
  const posMap = Object.fromEntries(nodes.map(n => [n.id, n]));

  if (!result) return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", background: "var(--bg-2)" }} />
  );

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative", background: "var(--bg-2)" }}>
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
        {/* Dot grid */}
        <defs>
          <pattern id="g" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="0.8" cy="0.8" r="0.8" fill="#21262d" />
          </pattern>
          {nodes.map(n => {
            const c = COLORS[n.type];
            return (
              <filter key={`f${n.id}`} id={`glow-${n.id}`}>
                <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={c.border} floodOpacity="0.4" />
              </filter>
            );
          })}
        </defs>
        <rect width="100%" height="100%" fill="url(#g)" />

        {/* Edges */}
        {edges.map((e, i) => {
          const s = posMap[e.from];
          const t = posMap[e.to];
          if (!s || !t) return null;
          const mx = (s.x + t.x) / 2;
          const my = (s.y + t.y) / 2 - 20;
          return (
            <path
              key={i}
              d={`M${s.x},${s.y} Q${mx},${my} ${t.x},${t.y}`}
              stroke={e.color} strokeWidth="1" strokeOpacity="0.3"
              fill="none" strokeDasharray="4 4"
            />
          );
        })}

        {/* Nodes */}
        {nodes.map(n => {
          const c = COLORS[n.type];
          const nw = NODE_W[n.type] || 140;
          const nh = NODE_H[n.type] || 40;
          const x = n.x - nw / 2;
          const y = n.y - nh / 2;

          return (
            <g key={n.id} style={{ animation: "fadeIn 0.4s ease both" }}>
              <rect x={x} y={y} width={nw} height={nh}
                rx="6" fill={c.bg}
                stroke={c.border} strokeWidth="1"
                filter={`url(#glow-${n.id})`}
              />
              <text
                x={n.x} y={n.y + 1}
                textAnchor="middle" dominantBaseline="middle"
                fill={c.text}
                fontFamily="JetBrains Mono, monospace"
                fontSize={n.type === "verdict" ? 13 : 10}
                fontWeight={n.type === "verdict" ? "600" : "400"}
              >
                {truncate(n.label, n.type === "verdict" ? 16 : 24)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{
        position: "absolute", bottom: 14, left: 16,
        display: "flex", gap: 16, alignItems: "center",
      }}>
        {[["#3fb950","ASSETS"],["#f85149","RISKS"]].map(([c,l]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: 2, background: c, opacity: 0.7 }} />
            <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-3)", letterSpacing: "0.15em" }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
