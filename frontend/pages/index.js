import { useState, useRef, useCallback } from "react";
import TerminalLoader from "../components/TerminalLoader";
import VerdictPanel from "../components/VerdictPanel";
import KnowledgeGraph from "../components/KnowledgeGraph";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_URL || "https://adia-nova.onrender.com")
    .trim().replace(/\/$/, "");

const SCENARIOS = [
  {
    id: "a", endpoint: "/demo/scenario_a",
    tag: "GO CANDIDATE", tagColor: "var(--green)", tagBg: "var(--green-glow)",
    title: "AI SaaS", subtitle: "VectorMind AI · Series A · $180K ARR",
    accent: "var(--green)",
  },
  {
    id: "b", endpoint: "/demo/scenario_b",
    tag: "NO-GO CANDIDATE", tagColor: "var(--red)", tagBg: "var(--red-glow)",
    title: "Crypto Scam", subtitle: "MoonChain Protocol · Pre-seed · $0 ARR",
    accent: "var(--red)",
  },
  {
    id: "c", endpoint: "/demo/scenario_c",
    tag: "CONDITIONAL", tagColor: "var(--amber)", tagBg: "var(--amber-glow)",
    title: "Hardware Burn", subtitle: "NeuralChip Systems · Series B · $1.1M ARR",
    accent: "var(--amber)",
  },
];

function Badge({ color, bg, children }) {
  return (
    <span style={{
      fontFamily: "var(--mono)", fontSize: 10, fontWeight: 500,
      color, background: bg, border: `1px solid ${color}33`,
      borderRadius: 4, padding: "2px 8px", letterSpacing: "0.08em",
      textTransform: "uppercase", whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

function ScenarioCard({ s, onClick, disabled }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={() => !disabled && onClick(s.endpoint)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={disabled}
      style={{
        flex: "1 1 200px", minWidth: 180, maxWidth: 280,
        padding: "18px 18px 16px",
        background: hovered ? "var(--bg-3)" : "var(--bg-2)",
        border: `1px solid ${hovered ? s.accent + "55" : "var(--border)"}`,
        borderRadius: 10, cursor: disabled ? "not-allowed" : "pointer",
        textAlign: "left", transition: "all 0.18s ease",
        boxShadow: hovered ? `0 0 0 1px ${s.accent}22, 0 8px 24px rgba(0,0,0,0.3)` : "none",
        opacity: disabled ? 0.4 : 1, outline: "none",
      }}
    >
      <Badge color={s.tagColor} bg={s.tagBg}>{s.tag}</Badge>
      <div style={{
        fontFamily: "var(--display)", fontWeight: 700, fontSize: 16,
        color: "var(--text)", marginTop: 10, marginBottom: 4,
        letterSpacing: "-0.01em",
      }}>
        {s.title}
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-3)", lineHeight: 1.5 }}>
        {s.subtitle}
      </div>
    </button>
  );
}

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [file2, setFile2] = useState(null);
  const [streamingText, setStreamingText] = useState("");
  const [streamingAgents, setStreamingAgents] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // ── STREAMING FETCH ──
  const runStream = useCallback(async (textVal) => {
    setLoading(true); setResult(null); setError(""); setStreamingText(""); setStreamingAgents([]); setIsStreaming(true);
    try {
      const res = await fetch(`${API_BASE}/analyze-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem: textVal, include_reasoning: true }),
      });

      if (!res.ok) {
        const p = await res.json().catch(() => ({}));
        throw new Error(p.error || p.detail || "Stream request failed.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;

          try {
            const event = JSON.parse(payload);
            if (event.type === "agent") {
              setStreamingAgents(prev => {
                const existing = prev.find(a => a.agent === event.agent);
                if (existing) {
                  return prev.map(a => a.agent === event.agent ? { ...a, status: event.status } : a);
                }
                return [...prev, { agent: event.agent, status: event.status }];
              });
            } else if (event.type === "token") {
              setStreamingText(prev => prev + event.text);
            } else if (event.type === "result") {
              setResult(event.data);
            }
          } catch {}
        }
      }
    } catch (e) {
      setError("Streaming analysis failed. Please try again or use a demo scenario.");
    } finally {
      setLoading(false);
      setIsStreaming(false);
    }
  }, []);

  // ── STANDARD FETCH ──
  async function run(endpoint, isText = false, textVal = "") {
    setLoading(true); setResult(null); setError(""); setStreamingText(""); setStreamingAgents([]);
    try {
      let fetchP;
      if (isText && (file || file2)) {
        const fd = new FormData();
        fd.append("problem", textVal);
        fd.append("include_reasoning", "true");
        if (file) fd.append("files", file);
        if (file2) fd.append("files", file2);
        fetchP = fetch(`${API_BASE}/analyze-with-docs`, { method: "POST", body: fd });
      } else if (isText) {
        // Use streaming endpoint for text-only analysis
        return runStream(textVal);
      } else {
        fetchP = fetch(`${API_BASE}${endpoint}`, { method: "POST" });
      }

      const [res] = await Promise.all([
        fetchP,
        new Promise(r => setTimeout(r, 6000)),
      ]);

      if (!res.ok) {
        const p = await res.json().catch(() => ({}));
        throw new Error(p.error || p.detail || "Request failed.");
      }
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError("Analysis failed. Please try again or use a demo scenario.");
    } finally {
      setLoading(false);
    }
  }

  // ── VOICE RECORDING ──
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach(t => t.stop());

        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = reader.result.split(",")[1];
          try {
            const res = await fetch(`${API_BASE}/transcribe`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ audio_b64: base64, mime_type: "audio/webm" }),
            });
            const data = await res.json();
            if (data.transcript) {
              setText(prev => prev ? prev + "\n" + data.transcript : data.transcript);
            }
          } catch {}
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorder.start();
      setRecording(true);
    } catch {
      setError("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const reset = () => { setResult(null); setError(""); setText(""); setFile(null); setFile2(null); setStreamingText(""); setStreamingAgents([]); };

  return (
    <>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes pulseGreen{0%,100%{box-shadow:0 0 0 0 rgba(63,185,80,0)}50%{box-shadow:0 0 20px 4px rgba(63,185,80,0.2)}}
        @keyframes pulseRed{0%,100%{box-shadow:0 0 0 0 rgba(248,81,73,0)}50%{box-shadow:0 0 20px 4px rgba(248,81,73,0.2)}}
        @keyframes pulseRecord{0%,100%{box-shadow:0 0 0 0 rgba(248,81,73,0)}50%{box-shadow:0 0 12px 3px rgba(248,81,73,0.4)}}
        textarea:focus{outline:none;border-color:var(--blue)!important;box-shadow:0 0 0 3px var(--blue-glow)!important}
        button:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
      `}</style>

      <TerminalLoader isVisible={loading} agents={streamingAgents} streamingText={streamingText} />

      {/* ── TOPBAR ── */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 56,
        background: "rgba(8,12,16,0.88)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", zIndex: 200,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            fontFamily: "var(--display)", fontWeight: 800, fontSize: 18,
            color: "var(--green)", letterSpacing: "-0.02em",
          }}>
            ADIA
          </div>
          <div style={{ width: 1, height: 18, background: "var(--border)" }} />
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-3)", letterSpacing: "0.1em" }}>
            DECISION INTELLIGENCE
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-3)", letterSpacing: "0.08em" }}>
            Amazon Nova
          </span>
          {result && (
            <button onClick={reset} style={{
              fontFamily: "var(--sans)", fontSize: 12, fontWeight: 500,
              color: "var(--text-2)", background: "var(--bg-3)",
              border: "1px solid var(--border)", borderRadius: 6,
              padding: "5px 14px", cursor: "pointer", transition: "all 0.15s",
            }}
              onMouseEnter={e => { e.target.style.borderColor = "var(--border-2)"; e.target.style.color = "var(--text)"; }}
              onMouseLeave={e => { e.target.style.borderColor = "var(--border)"; e.target.style.color = "var(--text-2)"; }}
            >
              ← New Analysis
            </button>
          )}
        </div>
      </header>

      <main style={{ paddingTop: 56, height: "100vh", display: "flex", flexDirection: "column" }}>

        {/* ── IDLE STATE ── */}
        {!result && (
          <div style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 24px",
          }}>
            <div style={{ width: "100%", maxWidth: 760, animation: "fadeUp 0.5s ease both" }}>

              {/* Hero */}
              <div style={{ marginBottom: 40 }}>
                <div style={{
                  fontFamily: "var(--display)", fontWeight: 800,
                  fontSize: "clamp(36px,5vw,56px)",
                  color: "var(--text)", letterSpacing: "-0.03em", lineHeight: 1.1,
                  marginBottom: 12,
                }}>
                  Autonomous Decision{" "}
                  <span style={{ color: "var(--green)" }}>Intelligence</span>
                </div>
                <div style={{ fontFamily: "var(--sans)", fontSize: 15, color: "var(--text-2)", lineHeight: 1.6, maxWidth: 540 }}>
                  4-agent AI pipeline: Research → Analysis → Reasoning → Report. Amazon Nova arbitrates with tool use, multimodal understanding, and streaming verdicts.
                </div>
              </div>

              {/* Demo scenarios */}
              <div style={{ marginBottom: 10 }}>
                <div style={{
                  fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-3)",
                  letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14,
                }}>
                  Run a demo scenario
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {SCENARIOS.map(s => (
                    <ScenarioCard key={s.id} s={s} onClick={(ep) => run(ep)} disabled={loading} />
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0" }}>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-3)", letterSpacing: "0.1em" }}>
                  OR
                </span>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              </div>

              {/* Text input */}
              <div style={{ marginBottom: 12 }}>
                <label style={{
                  fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-3)",
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  display: "block", marginBottom: 10,
                }}>
                  Paste your pitch
                </label>
                <textarea id="pitch-text"
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Paste a pitch deck, business description, or investment memo..."
                  rows={5}
                  style={{
                    width: "100%", background: "var(--bg-2)",
                    border: "1px solid var(--border)", borderRadius: 8,
                    padding: "12px 14px", color: "var(--text)",
                    fontFamily: "var(--sans)", fontSize: 13.5, lineHeight: 1.65,
                    resize: "vertical", transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                />
              </div>

              {/* Actions row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {/* Primary PDF upload */}
                  <label style={{
                    display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                    fontFamily: "var(--mono)", fontSize: 11, color: file ? "var(--blue)" : "var(--text-3)",
                    background: "var(--bg-2)", border: "1px solid var(--border)",
                    borderRadius: 6, padding: "7px 14px", transition: "all 0.15s",
                  }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "var(--border-2)"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
                  >
                    <input id="pitch-file" type="file" accept=".pdf" style={{ display: "none" }}
                      onChange={e => setFile(e.target.files?.[0] || null)} />
                    <span style={{ fontSize: 13 }}>📎</span>
                    {file ? file.name.slice(0, 20) + (file.name.length > 20 ? "…" : "") : "Pitch PDF"}
                  </label>

                  {/* Competitor PDF upload */}
                  <label style={{
                    display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                    fontFamily: "var(--mono)", fontSize: 11, color: file2 ? "var(--amber)" : "var(--text-3)",
                    background: "var(--bg-2)", border: `1px solid ${file2 ? "var(--amber)33" : "var(--border)"}`,
                    borderRadius: 6, padding: "7px 14px", transition: "all 0.15s",
                  }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "var(--border-2)"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = file2 ? "var(--amber)33" : "var(--border)"}
                  >
                    <input type="file" accept=".pdf" style={{ display: "none" }}
                      onChange={e => setFile2(e.target.files?.[0] || null)} />
                    <span style={{ fontSize: 13 }}>📊</span>
                    {file2 ? file2.name.slice(0, 16) + "…" : "Competitor (opt.)"}
                  </label>

                  {/* Voice button */}
                  <button
                    onClick={recording ? stopRecording : startRecording}
                    disabled={loading}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      fontFamily: "var(--mono)", fontSize: 11,
                      color: recording ? "var(--red)" : "var(--text-3)",
                      background: recording ? "var(--red-glow)" : "var(--bg-2)",
                      border: `1px solid ${recording ? "var(--red)33" : "var(--border)"}`,
                      borderRadius: 6, padding: "7px 14px", cursor: "pointer",
                      transition: "all 0.15s",
                      animation: recording ? "pulseRecord 1.5s ease-in-out infinite" : "none",
                    }}
                  >
                    <span style={{ fontSize: 13 }}>{recording ? "⏹" : "🎤"}</span>
                    {recording ? "Stop" : "Voice"}
                  </button>
                </div>

                <button
                  onClick={() => text.trim().length >= 10 && run("", true, text.trim())}
                  disabled={loading || text.trim().length < 10}
                  style={{
                    fontFamily: "var(--sans)", fontWeight: 600, fontSize: 13,
                    color: text.trim().length >= 10 ? "#fff" : "var(--text-3)",
                    background: text.trim().length >= 10 ? "var(--green-dim)" : "var(--bg-3)",
                    border: `1px solid ${text.trim().length >= 10 ? "var(--green)" : "var(--border)"}`,
                    borderRadius: 7, padding: "8px 24px",
                    cursor: text.trim().length >= 10 ? "pointer" : "not-allowed",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { if (text.trim().length >= 10) { e.target.style.background = "var(--green)"; e.target.style.color = "#000"; }}}
                  onMouseLeave={e => { if (text.trim().length >= 10) { e.target.style.background = "var(--green-dim)"; e.target.style.color = "#fff"; }}}
                >
                  Analyze →
                </button>
              </div>

              {error && (
                <div style={{
                  marginTop: 16, fontFamily: "var(--sans)", fontSize: 13,
                  color: "var(--red)", background: "var(--red-glow)",
                  border: "1px solid var(--red)33", borderRadius: 7, padding: "10px 14px",
                }}>
                  {error}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── RESULT STATE ── */}
        {result && (
          <div style={{
            flex: 1, display: "flex", overflow: "hidden",
            animation: "fadeIn 0.35s ease both",
          }}>
            {/* Graph — left 55% */}
            <div data-testid="knowledge-graph-pane" style={{
              flex: "0 0 55%", overflow: "hidden",
              borderRight: "1px solid var(--border)",
              animation: "fadeIn 0.4s ease 0.1s both",
            }}>
              <KnowledgeGraph result={result} />
            </div>

            {/* Verdict — right 45% */}
            <div data-testid="verdict-panel-pane" style={{ flex: "0 0 45%", overflow: "hidden" }}>
              <VerdictPanel result={result} />
            </div>
          </div>
        )}
      </main>
    </>
  );
}
