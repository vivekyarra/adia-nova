import { useEffect, useState } from "react";
import { RadialBarChart, RadialBar, ResponsiveContainer } from "recharts";

export default function VerdictPanel({ result }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (result) { const t = setTimeout(() => setVisible(true), 50); return () => clearTimeout(t); }
    setVisible(false);
  }, [result]);

  if (!result) return null;

  const { verdict, conviction_score, fatal_flaw, asymmetric_upside, executive_summary, key_risks, key_assets, recommended_action } = result;

  const verdictColor = verdict === "GO" ? "var(--green)" : verdict === "NO-GO" ? "var(--red)" : "var(--amber)";
  const glowVar = verdict === "GO" ? "var(--glow-green)" : verdict === "NO-GO" ? "var(--glow-red)" : "var(--glow-amber)";
  const pulseAnim = verdict === "GO" ? "pulseGreen 2s ease-in-out infinite" : verdict === "NO-GO" ? "pulseRed 2s ease-in-out infinite" : "none";
  const gaugeData = [{ value: conviction_score ?? 0, fill: verdictColor }];

  return (
    <div style={{ opacity:visible?1:0, transform:visible?"translateX(0)":"translateX(30px)", transition:"opacity 0.4s ease, transform 0.4s ease", height:"100%", overflowY:"auto", padding:"24px 20px 40px", display:"flex", flexDirection:"column", gap:20, borderLeft:"1px solid var(--border)" }}>

      {/* VERDICT */}
      <div style={{ textAlign:"center", paddingBottom:8 }}>
        <div style={{ fontFamily:"var(--display)", fontWeight:800, fontSize:"clamp(64px,8vw,92px)", color:verdictColor, textShadow:glowVar, lineHeight:1, animation:pulseAnim, letterSpacing:"0.04em" }}>
          {verdict}
        </div>

        {/* Gauge */}
        <div style={{ position:"relative", width:160, height:160, margin:"12px auto 0" }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart innerRadius="62%" outerRadius="86%" data={gaugeData} startAngle={90} endAngle={-270}>
              <RadialBar dataKey="value" cornerRadius={4} background={{ fill:"#111" }} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
            <span style={{ fontFamily:"var(--mono)", fontSize:32, fontWeight:500, color:verdictColor, lineHeight:1 }}>{conviction_score}</span>
            <span style={{ fontFamily:"var(--mono)", fontSize:9, color:"var(--muted)", letterSpacing:"0.35em", marginTop:4 }}>CONVICTION</span>
          </div>
        </div>
      </div>

      {/* FATAL FLAW */}
      {fatal_flaw && (
        <div style={{ borderLeft:"2px solid var(--red)", paddingLeft:14 }}>
          <div style={{ fontFamily:"var(--mono)", fontSize:9, color:"var(--red)", letterSpacing:"0.35em", marginBottom:6, textTransform:"uppercase" }}>▲ FATAL FLAW</div>
          <div style={{ fontSize:14, lineHeight:1.7, color:"var(--text)" }}>{fatal_flaw}</div>
        </div>
      )}

      {/* ASYMMETRIC UPSIDE */}
      {asymmetric_upside && (
        <div style={{ borderLeft:"2px solid var(--green)", paddingLeft:14 }}>
          <div style={{ fontFamily:"var(--mono)", fontSize:9, color:"var(--green)", letterSpacing:"0.35em", marginBottom:6, textTransform:"uppercase" }}>◆ ASYMMETRIC UPSIDE</div>
          <div style={{ fontSize:14, lineHeight:1.7, color:"var(--text)" }}>{asymmetric_upside}</div>
        </div>
      )}

      {/* KEY RISKS */}
      {key_risks?.length > 0 && (
        <div>
          <div style={{ fontFamily:"var(--mono)", fontSize:9, color:"var(--red)", letterSpacing:"0.35em", marginBottom:10, textTransform:"uppercase" }}>KEY RISKS</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {key_risks.map((r, i) => (
              <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                <span style={{ color:"var(--red)", fontSize:10, marginTop:3, flexShrink:0 }}>▸</span>
                <span style={{ fontSize:13, lineHeight:1.6, color:"#bbb" }}>{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KEY ASSETS */}
      {key_assets?.length > 0 && (
        <div>
          <div style={{ fontFamily:"var(--mono)", fontSize:9, color:"var(--green)", letterSpacing:"0.35em", marginBottom:10, textTransform:"uppercase" }}>KEY ASSETS</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {key_assets.map((a, i) => (
              <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                <span style={{ color:"var(--green)", fontSize:10, marginTop:3, flexShrink:0 }}>◆</span>
                <span style={{ fontSize:13, lineHeight:1.6, color:"#bbb" }}>{a}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RECOMMENDED ACTION */}
      {recommended_action && (
        <div style={{ background:"#0a0a0a", border:"1px solid var(--amber)", borderLeft:"3px solid var(--amber)", borderRadius:4, padding:"14px 16px" }}>
          <div style={{ fontFamily:"var(--mono)", fontSize:9, color:"var(--amber)", letterSpacing:"0.35em", marginBottom:8, textTransform:"uppercase" }}>RECOMMENDED ACTION</div>
          <div style={{ fontSize:13, lineHeight:1.7, color:"var(--text)" }}>{recommended_action}</div>
        </div>
      )}

      {/* EXECUTIVE SUMMARY */}
      {executive_summary && (
        <div>
          <div style={{ fontFamily:"var(--mono)", fontSize:9, color:"var(--muted-light)", letterSpacing:"0.35em", marginBottom:8, textTransform:"uppercase" }}>EXECUTIVE SUMMARY</div>
          <div style={{ fontSize:12, lineHeight:1.9, color:"var(--muted-light)" }}>{executive_summary}</div>
        </div>
      )}
    </div>
  );
}

