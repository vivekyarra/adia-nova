import { useEffect, useRef, useState } from "react";

/**
 * Build node positions using a force-directed-style layout
 * that avoids overlaps and adapts to container size.
 */
function buildPositions(result, w, h) {
  if (!result) return { nodes: [], edges: [] };

  // Support both legacy (key_assets/key_risks) and new (opportunities/risks) formats
  const { verdict } = result;
  let rawAssets = result.key_assets || result.opportunities || [];
  let rawRisks = result.key_risks || result.risks || [];

  // Normalize to strings
  const getText = (item) =>
    typeof item === "string" ? item : item?.text || item?.description || JSON.stringify(item);

  const assets = rawAssets.slice(0, 4).map(getText);
  const risks = rawRisks.slice(0, 4).map(getText);

  const cx = w / 2;
  const topY = 60;
  const nodes = [];
  const edges = [];

  // Central verdict node
  nodes.push({ id: "v", label: verdict || "VERDICT", type: "verdict", x: cx, y: topY });

  // ── ASSETS: fan out on the LEFT side ──
  const assetStartY = 140;
  const assetSpacingY = 70;
  assets.forEach((a, i) => {
    const id = `a${i}`;
    const x = Math.max(130, cx * 0.35 + (i % 2) * 50);
    const y = assetStartY + i * assetSpacingY;
    nodes.push({ id, label: a, type: "asset", x, y });
    edges.push({ from: "v", to: id, color: "#3fb950" });
  });

  // ── RISKS: fan out on the RIGHT side ──
  const riskStartY = 140;
  const riskSpacingY = 70;
  risks.forEach((r, i) => {
    const id = `r${i}`;
    const x = Math.min(w - 130, cx + cx * 0.35 + (i % 2) * 50);
    const y = riskStartY + i * riskSpacingY;
    nodes.push({ id, label: r, type: "risk", x, y });
    edges.push({ from: "v", to: id, color: "#f85149" });
  });

  return { nodes, edges };
}

const NODE_W = { verdict: 130, asset: 220, risk: 220 };
const NODE_H = { verdict: 38, asset: 50, risk: 50 };

const COLORS = {
  verdict: { bg: "#161b22", border: "#8b949e", text: "#e6edf3", glow: "rgba(139,148,158,0.25)" },
  asset:   { bg: "#0d1117", border: "#238636", text: "#3fb950", glow: "rgba(63,185,80,0.18)" },
  risk:    { bg: "#0d1117", border: "#da3633", text: "#f85149", glow: "rgba(248,81,73,0.18)" },
};

function truncate(s, n = 36) {
  return s && s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export default function KnowledgeGraph({ result }) {
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ w: 640, h: 500 });
  const [hoveredNode, setHoveredNode] = useState(null);

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
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative", background: "var(--bg-2)", overflow: "hidden" }}>
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
        {/* Dot grid background */}
        <defs>
          <pattern id="g" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="0.8" cy="0.8" r="0.8" fill="#21262d" />
          </pattern>
          {nodes.map(n => {
            const c = COLORS[n.type];
            return (
              <filter key={`f${n.id}`} id={`glow-${n.id}`}>
                <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={c.border} floodOpacity="0.45" />
              </filter>
            );
          })}
        </defs>
        <rect width="100%" height="100%" fill="url(#g)" />

        {/* Edges — curved bezier lines */}
        {edges.map((e, i) => {
          const s = posMap[e.from];
          const t = posMap[e.to];
          if (!s || !t) return null;
          const mx = (s.x + t.x) / 2;
          const my = (s.y + t.y) / 2 - 30;
          return (
            <path
              key={i}
              d={`M${s.x},${s.y + 20} Q${mx},${my} ${t.x},${t.y - 20}`}
              stroke={e.color} strokeWidth="1.5" strokeOpacity="0.35"
              fill="none" strokeDasharray="5 4"
              style={{ animation: "fadeIn 0.5s ease both", animationDelay: `${0.1 + i * 0.08}s` }}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((n, idx) => {
          const c = COLORS[n.type];
          const nw = NODE_W[n.type] || 200;
          const nh = NODE_H[n.type] || 46;
          const x = n.x - nw / 2;
          const y = n.y - nh / 2;
          const isHovered = hoveredNode === n.id;
          const maxChars = n.type === "verdict" ? 16 : 34;

          return (
            <g
              key={n.id}
              style={{ animation: "fadeIn 0.45s ease both", animationDelay: `${0.15 + idx * 0.07}s`, cursor: "default" }}
              onMouseEnter={() => setHoveredNode(n.id)}
              onMouseLeave={() => setHoveredNode(null)}
            >
              <rect
                x={x} y={y} width={nw} height={nh}
                rx="8" fill={isHovered ? c.glow : c.bg}
                stroke={c.border} strokeWidth={isHovered ? "2" : "1"}
                filter={`url(#glow-${n.id})`}
                style={{ transition: "all 0.2s ease" }}
              />
              <text
                x={n.x} y={n.y + 1}
                textAnchor="middle" dominantBaseline="middle"
                fill={c.text}
                fontFamily="JetBrains Mono, monospace"
                fontSize={n.type === "verdict" ? 14 : 10.5}
                fontWeight={n.type === "verdict" ? "700" : "400"}
              >
                {truncate(n.label, maxChars)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Full-text tooltip on hover */}
      {hoveredNode && (() => {
        const node = posMap[hoveredNode];
        if (!node || node.type === "verdict") return null;
        const fullText = node.label;
        if (fullText.length <= 34) return null;
        return (
          <div style={{
            position: "absolute",
            left: Math.max(8, Math.min(node.x - 120, dims.w - 260)),
            top: node.y + 32,
            maxWidth: 260,
            background: "rgba(22, 27, 34, 0.97)",
            border: "1px solid var(--border-2)",
            borderRadius: 8,
            padding: "10px 13px",
            fontFamily: "var(--sans)",
            fontSize: 12,
            lineHeight: 1.65,
            color: "var(--text)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            zIndex: 100,
            pointerEvents: "none",
            animation: "fadeIn 0.15s ease",
          }}>
            {fullText}
          </div>
        );
      })()}

      {/* Legend */}
      <div style={{
        position: "absolute", bottom: 14, left: 16,
        display: "flex", gap: 18, alignItems: "center",
      }}>
        {[["#3fb950","ASSETS"],["#f85149","RISKS"]].map(([c,l]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: c, opacity: 0.8 }} />
            <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-3)", letterSpacing: "0.15em" }}>{l}</span>
          </div>
        ))}
      </div>

      {/* Title */}
      <div style={{
        position: "absolute", top: 14, left: 18,
        fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-3)",
        letterSpacing: "0.12em", textTransform: "uppercase",
      }}>
        Knowledge Graph — Nova Analysis
      </div>
    </div>
  );
}
