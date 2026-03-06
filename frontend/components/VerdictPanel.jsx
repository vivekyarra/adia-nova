import { useEffect, useState } from "react";
import { RadialBarChart, RadialBar } from "recharts";

export default function VerdictPanel({ result }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!result) return null;

  const verdict = result.verdict || "CONDITIONAL";
  const score = typeof result.conviction_score === "number" ? result.conviction_score : 0;

  let verdictColor = "var(--amber)";
  let glow = "var(--glow-amber)";
  if (verdict === "GO") {
    verdictColor = "var(--green)";
    glow = "var(--glow-green)";
  } else if (verdict === "NO-GO") {
    verdictColor = "var(--red)";
    glow = "var(--glow-red)";
  }

  const gaugeData = [{ value: score }];

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 24,
        padding: 24,
        background: "var(--panel)",
        borderLeft: "1px solid var(--border)",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          transform: mounted ? "scale(1)" : "scale(0.85)",
          opacity: mounted ? 1 : 0,
          transformOrigin: "top left",
          transition: "all 400ms ease-out",
        }}
      >
        <div
          style={{
            fontFamily: "var(--display)",
            fontWeight: 800,
            fontSize: 88,
            lineHeight: 0.9,
            color: verdictColor,
            textShadow: glow,
          }}
        >
          {verdict}
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 10,
            letterSpacing: "0.4em",
            color: "#666",
          }}
        >
          CONVICTION
        </div>
        <div
          style={{
            marginTop: 4,
            fontFamily: "var(--mono)",
            fontSize: 52,
            color: verdictColor,
          }}
        >
          {score}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 24,
          alignItems: "center",
        }}
      >
        <RadialBarChart
          width={160}
          height={160}
          innerRadius="65%"
          outerRadius="85%"
          startAngle={90}
          endAngle={-270}
          data={gaugeData}
        >
          <RadialBar
            minAngle={5}
            background
            clockWise
            dataKey="value"
            cornerRadius={999}
            fill={verdictColor}
          />
        </RadialBarChart>
        <div
          style={{
            position: "absolute",
            width: 160,
            height: 160,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--mono)",
            fontSize: 36,
            color: verdictColor,
          }}
        >
          {score}
        </div>
      </div>

      <div style={{ display: "grid", gap: 18 }}>
        <div
          style={{
            borderLeft: `2px solid var(--red)`,
            paddingLeft: 12,
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.35em",
              color: "var(--red)",
              marginBottom: 6,
            }}
          >
            ▲ FATAL FLAW
          </div>
          <div
            style={{
              fontSize: 15,
              lineHeight: 1.6,
              color: "var(--text)",
            }}
          >
            {result.fatal_flaw}
          </div>
        </div>

        <div
          style={{
            borderLeft: `2px solid var(--green)`,
            paddingLeft: 12,
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.35em",
              color: "var(--green)",
              marginBottom: 6,
            }}
          >
            ◆ ASYMMETRIC UPSIDE
          </div>
          <div
            style={{
              fontSize: 15,
              lineHeight: 1.6,
              color: "var(--text)",
            }}
          >
            {result.asymmetric_upside}
          </div>
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 4 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.25em",
              color: "var(--red)",
            }}
          >
            KEY RISKS
          </div>
          <div style={{ display: "grid", gap: 4, fontSize: 13 }}>
            {(result.key_risks || []).map((risk) => (
              <div key={risk} style={{ color: "var(--text)" }}>
                <span style={{ color: "var(--red)", marginRight: 6 }}>▸</span>
                {risk}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 4 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.25em",
              color: "var(--green)",
            }}
          >
            KEY ASSETS
          </div>
          <div style={{ display: "grid", gap: 4, fontSize: 13 }}>
            {(result.key_assets || []).map((asset) => (
              <div key={asset} style={{ color: "var(--text)" }}>
                <span style={{ color: "var(--green)", marginRight: 6 }}>◆</span>
                {asset}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            marginTop: 8,
            padding: 16,
            background: "#0a0a0a",
            border: "1px solid var(--amber)",
            borderLeftWidth: 3,
            borderLeftColor: "var(--amber)",
            borderRadius: 6,
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.35em",
              color: "var(--amber)",
              marginBottom: 8,
            }}
          >
            RECOMMENDED ACTION
          </div>
          <div
            style={{
              fontSize: 14,
              color: "var(--text)",
            }}
          >
            {result.recommended_action}
          </div>
        </div>

        <div
          style={{
            marginTop: 4,
            fontSize: 13,
            lineHeight: 1.8,
            color: "var(--muted)",
          }}
        >
          {result.executive_summary}
        </div>
      </div>
    </div>
  );
}

