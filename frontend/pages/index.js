import { useState } from "react";
import TerminalLoader from "../components/TerminalLoader";
import VerdictPanel from "../components/VerdictPanel";
import KnowledgeGraph from "../components/KnowledgeGraph";

const rawApiBase = (process.env.NEXT_PUBLIC_API_URL || "")
  .trim()
  .replace(/^"|"$/g, "")
  .replace(/^'|'$/g, "");

const API_BASE = rawApiBase
  ? rawApiBase.replace(/\/$/, "")
  : process.env.NODE_ENV === "development"
  ? "http://localhost:8000"
  : "https://adia-nova.onrender.com";

const SCENARIOS = [
  {
    id: "a",
    endpoint: "/demo/scenario_a",
    badge: "GO CANDIDATE",
    badgeColor: "var(--green)",
    title: "SCENARIO: AI SAAS",
    sub: "VectorMind AI · Series A · $180K ARR",
    hoverBorder: "#00ff9d",
    hoverGlow: "0 0 16px rgba(0,255,157,0.2), 0 0 40px rgba(0,255,157,0.06)",
  },
  {
    id: "b",
    endpoint: "/demo/scenario_b",
    badge: "NO-GO CANDIDATE",
    badgeColor: "var(--red)",
    title: "SCENARIO: CRYPTO SCAM",
    sub: "MoonChain Protocol · Pre-seed · $0 ARR",
    hoverBorder: "#ff003c",
    hoverGlow: "0 0 16px rgba(255,0,60,0.2), 0 0 40px rgba(255,0,60,0.06)",
  },
  {
    id: "c",
    endpoint: "/demo/scenario_c",
    badge: "CONDITIONAL",
    badgeColor: "var(--amber)",
    title: "SCENARIO: HARDWARE BURN",
    sub: "NeuralChip Systems · Series B · $1.1M ARR",
    hoverBorder: "#ffb800",
    hoverGlow: "0 0 16px rgba(255,184,0,0.2), 0 0 40px rgba(255,184,0,0.06)",
  },
];

function ScenarioButton({ scenario, onClick, disabled }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={() => !disabled && onClick(scenario.endpoint)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={disabled}
      style={{
        width: 230,
        padding: "18px 16px",
        background: hovered ? "#0c0c0c" : "#060606",
        border: `1px solid ${hovered ? scenario.hoverBorder : "#1e1e1e"}`,
        borderRadius: 4,
        cursor: disabled ? "not-allowed" : "pointer",
        textAlign: "left",
        transition: "border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease",
        boxShadow: hovered ? scenario.hoverGlow : "none",
        opacity: disabled ? 0.35 : 1,
        outline: "none",
      }}
    >
      <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: scenario.badgeColor, letterSpacing: "0.3em", marginBottom: 8, textTransform: "uppercase" }}>
        {scenario.badge}
      </div>
      <div style={{ fontFamily: "var(--display)", fontWeight: 600, fontSize: 14, color: "#e8e8e8", marginBottom: 6 }}>
        {scenario.title}
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "#3a3a3a" }}>
        {scenario.sub}
      </div>
    </button>
  );
}

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [textInput, setTextInput] = useState("");
  const [file, setFile] = useState(null);

  const hasResult = Boolean(result);

  async function runEndpoint(endpoint) {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const [data] = await Promise.all([
        fetch(`${API_BASE}${endpoint}`, { method: "POST" }).then(async (r) => {
          if (!r.ok) {
            const payload = await r.json().catch(() => ({}));
            throw new Error(payload.error || payload.detail || "Request failed.");
          }
          return r.json();
        }),
        new Promise((resolve) => setTimeout(resolve, 6000)),
      ]);
      setResult(data);
    } catch (e) {
      setError("Analysis failed. Please try again or use a demo scenario.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyzeText() {
    if (!textInput.trim() || textInput.trim().length < 10) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      let fetchPromise;
      if (file) {
        const formData = new FormData();
        formData.append("problem", textInput.trim());
        formData.append("include_reasoning", "true");
        formData.append("files", file);
        fetchPromise = fetch(`${API_BASE}/analyze-with-docs`, { method: "POST", body: formData });
      } else {
        fetchPromise = fetch(`${API_BASE}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ problem: textInput.trim(), include_reasoning: true }),
        });
      }
      const [response] = await Promise.all([
        fetchPromise,
        new Promise((resolve) => setTimeout(resolve, 6000)),
      ]);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || payload.detail || "Request failed.");
      }
      const data = await response.json();
      setResult(data);
    } catch (e) {
      setError("Analysis failed. Please try again or use a demo scenario.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResult(null);
    setError("");
    setTextInput("");
    setFile(null);
  }

  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px);} to { opacity:1; transform:translateY(0);} }
        @keyframes blink { 0%,100%{opacity:1;} 50%{opacity:0;} }
        @keyframes pulseGreen { 0%,100%{text-shadow:var(--glow-green);} 50%{text-shadow:0 0 40px rgba(0,255,157,0.8),0 0 80px rgba(0,255,157,0.3);} }
        @keyframes pulseRed { 0%,100%{text-shadow:var(--glow-red);} 50%{text-shadow:0 0 40px rgba(255,0,60,0.8),0 0 80px rgba(255,0,60,0.3);} }
        textarea:focus { outline:none; border-color:var(--green) !important; }
        button:focus { outline:none; }
      `}</style>

      <TerminalLoader isVisible={loading} />

      {/* HEADER */}
      <div style={{ position:"fixed", top:0, left:0, right:0, height:52, background:"rgba(0,0,0,0.92)", borderBottom:"1px solid #1a1a1a", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 24px", zIndex:100, backdropFilter:"blur(8px)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontFamily:"var(--display)", fontWeight:800, fontSize:20, color:"var(--green)", textShadow:"0 0 12px rgba(0,255,157,0.5)", letterSpacing:"0.05em" }}>ADIA</span>
          <span style={{ fontFamily:"var(--mono)", fontSize:9, color:"#2a2a2a", letterSpacing:"0.3em" }}>AUTONOMOUS DECISION INTELLIGENCE</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <span style={{ fontFamily:"var(--mono)", fontSize:9, color:"#333", letterSpacing:"0.25em" }}>POWERED BY AMAZON NOVA</span>
          {hasResult && (
            <button onClick={reset} style={{ fontFamily:"var(--mono)", fontSize:11, color:"#555", background:"transparent", border:"1px solid #222", borderRadius:3, padding:"5px 12px", cursor:"pointer", letterSpacing:"0.1em" }}
              onMouseEnter={(e)=>{e.target.style.borderColor="#444";e.target.style.color="#888";}}
              onMouseLeave={(e)=>{e.target.style.borderColor="#222";e.target.style.color="#555";}}>
              ← NEW ANALYSIS
            </button>
          )}
        </div>
      </div>

      {/* MAIN */}
      <main style={{ paddingTop:52, height:"100vh", display:"flex", flexDirection:"column" }}>

        {/* STATE: NO RESULT */}
        {!hasResult && (
          <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 20px", animation:"fadeIn 0.5s ease both" }}>
            <div style={{ width:"100%", maxWidth:720 }}>

              {/* Hero */}
              <div style={{ textAlign:"center", marginBottom:40 }}>
                <div style={{ fontFamily:"var(--display)", fontWeight:800, fontSize:"clamp(48px,8vw,78px)", color:"var(--green)", textShadow:"var(--glow-green)", lineHeight:1, letterSpacing:"0.04em" }}>ADIA</div>
                <div style={{ fontFamily:"var(--mono)", fontSize:11, color:"#2e2e2e", letterSpacing:"0.4em", marginTop:10 }}>AUTONOMOUS DECISION INTELLIGENCE AGENT</div>
                <div style={{ fontFamily:"var(--mono)", fontSize:10, color:"#252525", letterSpacing:"0.3em", marginTop:6 }}>POWERED BY AMAZON NOVA</div>
              </div>

              {/* Scenario buttons */}
              <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap", marginBottom:28 }}>
                {SCENARIOS.map((s) => (
                  <ScenarioButton key={s.id} scenario={s} onClick={runEndpoint} disabled={loading} />
                ))}
              </div>

              {/* Divider */}
              <div style={{ height:1, background:"#111", margin:"0 0 24px" }} />

              {/* Text input */}
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Or paste a pitch deck / business description..."
                rows={4}
                style={{ width:"100%", background:"#060606", border:"1px solid #1e1e1e", borderRadius:4, padding:"12px 14px", color:"var(--text)", fontFamily:"var(--mono)", fontSize:13, lineHeight:1.7, resize:"vertical", transition:"border-color 0.15s" }}
              />

              {/* File + Analyze row */}
              <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:10, justifyContent:"space-between", flexWrap:"wrap" }}>
                <label style={{ fontFamily:"var(--mono)", fontSize:11, color:"#333", cursor:"pointer", display:"flex", alignItems:"center", gap:8, border:"1px dashed #1e1e1e", borderRadius:3, padding:"6px 12px" }}
                  onMouseEnter={(e)=>e.currentTarget.style.borderColor="#2e2e2e"}
                  onMouseLeave={(e)=>e.currentTarget.style.borderColor="#1e1e1e"}>
                  <input type="file" accept=".pdf" style={{ display:"none" }} onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  <span style={{ color:"#2a2a2a" }}>⊕</span>
                  {file ? <span style={{ color:"#555" }}>{file.name}</span> : <span>ATTACH PDF</span>}
                </label>
                <button onClick={handleAnalyzeText} disabled={loading || textInput.trim().length < 10}
                  style={{ fontFamily:"var(--display)", fontWeight:600, fontSize:13, color:"var(--green)", background:"transparent", border:"1px solid var(--green)", borderRadius:3, padding:"8px 28px", cursor:textInput.trim().length>=10?"pointer":"not-allowed", letterSpacing:"0.05em", opacity:textInput.trim().length>=10?1:0.3, transition:"background 0.15s" }}
                  onMouseEnter={(e)=>{if(textInput.trim().length>=10)e.target.style.background="rgba(0,255,157,0.06)";}}
                  onMouseLeave={(e)=>{e.target.style.background="transparent";}}>
                  ANALYZE →
                </button>
              </div>

              {error && (
                <div style={{ marginTop:16, fontFamily:"var(--mono)", fontSize:12, color:"var(--red)", border:"1px solid rgba(255,0,60,0.2)", borderRadius:3, padding:"10px 14px", background:"rgba(255,0,60,0.03)" }}>
                  ▲ {error}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STATE: RESULT */}
        {hasResult && (
          <div style={{ flex:1, display:"flex", overflow:"hidden", animation:"fadeIn 0.4s ease both" }}>
            <div style={{ flex:"0 0 55%", position:"relative", borderRight:"1px solid #111", overflow:"hidden" }}>
              <KnowledgeGraph result={result} />
            </div>
            <div style={{ flex:"0 0 45%", overflow:"hidden" }}>
              <VerdictPanel result={result} />
            </div>
          </div>
        )}
      </main>
    </>
  );
}

