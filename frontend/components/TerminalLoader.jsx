import { useEffect, useRef, useState } from "react";

const DEFAULT_LINES = [
  { text: "Ingesting document corpus", accent: "#8b949e", delay: 0 },
  { text: "Extracting entities and risk signals", accent: "#8b949e", delay: 900 },
  { text: "Research Agent: identifying key factors", accent: "#58a6ff", delay: 2100 },
  { text: "Analysis Agent: extracting multimodal evidence", accent: "#d29922", delay: 3300 },
  { text: "Reasoning Agent: tool use — flag_fatal_flaw", accent: "#f85149", delay: 4200 },
  { text: "Amazon Nova streaming verdict", accent: "#3fb950", delay: 5200 },
];

export default function TerminalLoader({ isVisible, agents = [], streamingText = "" }) {
  const [states, setStates] = useState(DEFAULT_LINES.map(() => ({ typed: 0, done: false })));
  const [mounted, setMounted] = useState(false);
  const [opacity, setOpacity] = useState(0);
  const timersRef = useRef([]);
  const streamRef = useRef(null);

  const clear = () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; };

  useEffect(() => {
    if (isVisible) {
      setMounted(true);
      setStates(DEFAULT_LINES.map(() => ({ typed: 0, done: false })));
      setTimeout(() => setOpacity(1), 10);

      DEFAULT_LINES.forEach((line, li) => {
        const t = setTimeout(() => {
          let ch = 0;
          const iv = setInterval(() => {
            ch++;
            setStates(prev => {
              const n = [...prev];
              n[li] = { typed: ch, done: ch >= line.text.length };
              return n;
            });
            if (ch >= line.text.length) clearInterval(iv);
          }, 28);
          timersRef.current.push(iv);
        }, line.delay);
        timersRef.current.push(t);
      });
    } else {
      setOpacity(0);
      const t = setTimeout(() => { setMounted(false); clear(); }, 350);
      timersRef.current.push(t);
    }
    return clear;
  }, [isVisible]);

  // Auto-scroll streaming text
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [streamingText]);

  if (!mounted) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(8,12,16,0.96)",
      display: "flex", alignItems: "center", justifyContent: "center",
      opacity, transition: "opacity 0.35s ease",
      backdropFilter: "blur(4px)",
    }}>
      <div style={{
        width: "100%", maxWidth: 580,
        background: "var(--bg-2)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: "0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)",
      }}>
        {/* Window chrome */}
        <div style={{
          display: "flex", alignItems: "center", gap: 7,
          padding: "11px 16px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-3)",
        }}>
          {["#ff5f57","#febc2e","#28c840"].map((c,i) => (
            <div key={i} style={{ width: 11, height: 11, borderRadius: "50%", background: c, opacity: 0.8 }} />
          ))}
          <span style={{
            marginLeft: 10, fontFamily: "var(--mono)", fontSize: 11,
            color: "var(--text-3)", letterSpacing: "0.08em",
          }}>
            adia — 4-agent intelligence pipeline
          </span>
        </div>

        {/* Terminal body */}
        <div style={{ padding: "20px 20px 12px", minHeight: 188 }}>
          {DEFAULT_LINES.map((line, li) => {
            const st = states[li];
            const started = st.typed > 0;
            if (!started) return null;
            const isLast = li === DEFAULT_LINES.length - 1;
            const text = line.text.slice(0, st.typed);

            return (
              <div key={li} style={{
                display: "flex", alignItems: "center", gap: 10,
                marginBottom: 10, fontFamily: "var(--mono)", fontSize: 12.5,
                animation: "fadeUp 0.2s ease both",
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                  background: st.done ? line.accent : "var(--border-2)",
                  boxShadow: st.done ? `0 0 6px ${line.accent}` : "none",
                  transition: "all 0.3s",
                }} />
                <span style={{ color: "var(--text-3)", userSelect: "none" }}>›</span>
                <span style={{ color: st.done ? line.accent : "var(--text-2)", flex: 1 }}>
                  {text}
                  {!st.done && (
                    <span style={{
                      display: "inline-block", width: 1.5, height: 13,
                      background: "var(--blue)", marginLeft: 2, verticalAlign: "middle",
                      animation: "blink 0.9s step-start infinite",
                    }} />
                  )}
                </span>
                {st.done && !isLast && (
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-3)", letterSpacing: "0.05em" }}>done</span>
                )}
                {isLast && st.done && (
                  <span style={{
                    fontFamily: "var(--mono)", fontSize: 10,
                    color: "var(--green)", letterSpacing: "0.05em",
                    animation: "blink 1s step-start infinite",
                  }}>running</span>
                )}
              </div>
            );
          })}

          {/* Live agent status from SSE */}
          {agents.length > 0 && (
            <div style={{ marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
              {agents.map((a, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  marginBottom: 6, fontFamily: "var(--mono)", fontSize: 11,
                }}>
                  <div style={{
                    width: 5, height: 5, borderRadius: "50%",
                    background: a.status === "done" ? "var(--green)" : a.status === "streaming" ? "var(--blue)" : "var(--amber)",
                    boxShadow: a.status === "done" ? "0 0 4px var(--green)" : a.status === "streaming" ? "0 0 4px var(--blue)" : "none",
                    animation: a.status === "streaming" ? "blink 1.2s ease-in-out infinite" : "none",
                  }} />
                  <span style={{ color: "var(--text-3)" }}>›</span>
                  <span style={{
                    color: a.status === "done" ? "var(--green)" : a.status === "streaming" ? "var(--blue)" : "var(--text-2)",
                  }}>
                    {a.agent}
                  </span>
                  <span style={{
                    fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-3)",
                    letterSpacing: "0.05em",
                  }}>
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Streaming text preview */}
        {streamingText && (
          <div
            ref={streamRef}
            style={{
              borderTop: "1px solid var(--border)",
              padding: "12px 20px 16px",
              maxHeight: 140, overflowY: "auto",
              fontFamily: "var(--mono)", fontSize: 10.5, lineHeight: 1.7,
              color: "var(--text-3)", whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}
          >
            <div style={{
              fontFamily: "var(--mono)", fontSize: 9, color: "var(--blue)",
              letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6,
            }}>
              Nova Streaming Output
            </div>
            {streamingText.slice(-400)}
            <span style={{
              display: "inline-block", width: 2, height: 12,
              background: "var(--green)", marginLeft: 1, verticalAlign: "middle",
              animation: "blink 0.7s step-start infinite",
            }} />
          </div>
        )}
      </div>
    </div>
  );
}
