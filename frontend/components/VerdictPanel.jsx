import { useEffect, useState } from "react";
import { RadialBarChart, RadialBar, ResponsiveContainer } from "recharts";

export default function VerdictPanel({ result }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (result) { const t = setTimeout(() => setVisible(true), 60); return () => clearTimeout(t); }
    setVisible(false);
  }, [result]);

  if (!result) return null;

  const { verdict, conviction_score, fatal_flaw, asymmetric_upside,
    executive_summary, key_risks, key_assets, recommended_action } = result;

  const isGo = verdict === "GO";
  const isNo = verdict === "NO-GO";
  const color = isGo ? "var(--green)" : isNo ? "var(--red)" : "var(--amber)";
  const glow = isGo ? "var(--green-glow)" : isNo ? "var(--red-glow)" : "var(--amber-glow)";
  const pulse = isGo ? "pulseGreen 2.5s ease-in-out infinite" : isNo ? "pulseRed 2.5s ease-in-out infinite" : "none";
  const gaugeData = [{ value: conviction_score ?? 0, fill: color }];

  const Section = ({ label, color: c, children }) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontFamily: "var(--mono)", fontSize: 10, fontWeight: 500,
        color: c || "var(--text-3)", letterSpacing: "0.12em",
        textTransform: "uppercase", marginBottom: 8,
      }}>{label}</div>
      {children}
    </div>
  );

  return (
    <div style={{
      height: "100%", overflowY: "auto",
      padding: "28px 24px 48px",
      opacity: visible ? 1 : 0,
      transform: visible ? "translateX(0)" : "translateX(20px)",
      transition: "opacity 0.4s ease, transform 0.4s ease",
      borderLeft: "1px solid var(--border)",
    }}>

      {/* ── VERDICT HERO ── */}
      <div style={{
        background: `linear-gradient(135deg, ${glow}, transparent)`,
        border: `1px solid ${color}22`,
        borderRadius: 12, padding: "24px 20px",
        marginBottom: 24, textAlign: "center",
        animation: pulse,
      }}>
        <div style={{
          fontFamily: "var(--display)", fontWeight: 800,
          fontSize: "clamp(52px,6vw,72px)",
          color, lineHeight: 1, letterSpacing: "-0.02em",
          marginBottom: 16,
        }}>
          {verdict}
        </div>

        {/* Gauge */}
        <div style={{ position: "relative", width: 120, height: 120, margin: "0 auto" }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart innerRadius="62%" outerRadius="88%" data={gaugeData} startAngle={90} endAngle={-270}>
              <RadialBar dataKey="value" cornerRadius={6} background={{ fill: "var(--bg-4)" }} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div style={{
            position: "absolute", inset: 0, display: "flex",
            flexDirection: "column", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 26, fontWeight: 500, color, lineHeight: 1 }}>
              {conviction_score}
            </span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 8, color: "var(--text-3)", letterSpacing: "0.2em", marginTop: 3 }}>
              CONVICTION
            </span>
          </div>
        </div>
      </div>

      {/* ── FATAL FLAW ── */}
      {fatal_flaw && (
        <div style={{
          background: "var(--red-glow)", border: "1px solid var(--red)22",
          borderLeft: "3px solid var(--red)", borderRadius: "0 8px 8px 0",
          padding: "14px 16px", marginBottom: 16,
        }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--red)", letterSpacing: "0.1em", marginBottom: 6 }}>
            ↑ FATAL FLAW
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--text)" }}>{fatal_flaw}</div>
        </div>
      )}

      {/* ── UPSIDE ── */}
      {asymmetric_upside && (
        <div style={{
          background: "var(--green-glow)", border: "1px solid var(--green)22",
          borderLeft: "3px solid var(--green)", borderRadius: "0 8px 8px 0",
          padding: "14px 16px", marginBottom: 24,
        }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--green)", letterSpacing: "0.1em", marginBottom: 6 }}>
            ◆ ASYMMETRIC UPSIDE
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--text)" }}>{asymmetric_upside}</div>
        </div>
      )}

      {/* ── RISKS ── */}
      {key_risks?.length > 0 && (
        <Section label="Key Risks" color="var(--red)">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {key_risks.map((r, i) => (
              <div key={i} style={{
                display: "flex", gap: 10, alignItems: "flex-start",
                background: "var(--bg-3)", border: "1px solid var(--border)",
                borderRadius: 7, padding: "9px 12px",
              }}>
                <span style={{ color: "var(--red)", fontSize: 11, marginTop: 1, flexShrink: 0 }}>✕</span>
                <span style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--text-2)" }}>{r}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── ASSETS ── */}
      {key_assets?.length > 0 && (
        <Section label="Key Assets" color="var(--green)">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {key_assets.map((a, i) => (
              <div key={i} style={{
                display: "flex", gap: 10, alignItems: "flex-start",
                background: "var(--bg-3)", border: "1px solid var(--border)",
                borderRadius: 7, padding: "9px 12px",
              }}>
                <span style={{ color: "var(--green)", fontSize: 11, marginTop: 1, flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--text-2)" }}>{a}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── RECOMMENDED ACTION ── */}
      {recommended_action && (
        <div style={{
          background: "var(--amber-glow)", border: "1px solid var(--amber)33",
          borderRadius: 8, padding: "14px 16px", marginBottom: 20,
        }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--amber)", letterSpacing: "0.1em", marginBottom: 6 }}>
            → RECOMMENDED ACTION
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.65, color: "var(--text)" }}>{recommended_action}</div>
        </div>
      )}

      {/* ── SUMMARY ── */}
      {executive_summary && (
        <Section label="Executive Summary" color="var(--text-3)">
          <div style={{ fontSize: 12.5, lineHeight: 1.85, color: "var(--text-2)" }}>
            {executive_summary}
          </div>
        </Section>
      )}
    </div>
  );
}
