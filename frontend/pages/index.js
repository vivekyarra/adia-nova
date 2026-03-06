import { useState } from "react";
import TerminalLoader from "../components/TerminalLoader";
import VerdictPanel from "../components/VerdictPanel";
import KnowledgeGraph from "../components/KnowledgeGraph";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://adia-nova.onrender.com";

async function runScenario(endpoint, setResult, setError, setIsLoading) {
  setIsLoading(true);
  setResult(null);
  setError(null);
  try {
    const [data] = await Promise.all([
      fetch(`${API_BASE}${endpoint}`, { method: "POST" }).then((r) => r.json()),
      new Promise((resolve) => setTimeout(resolve, 6000)),
    ]);
    setResult(data);
  } catch (e) {
    setError("Analysis failed. Please try again or use a demo scenario.");
  } finally {
    setIsLoading(false);
  }
}

async function runFreeTextAnalysis(text, setResult, setError, setIsLoading) {
  setIsLoading(true);
  setResult(null);
  setError(null);
  try {
    const [data] = await Promise.all([
      fetch(`${API_BASE}/demo/analyze_text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      }).then((r) => r.json()),
      new Promise((resolve) => setTimeout(resolve, 6000)),
    ]);
    setResult(data);
  } catch (e) {
    setError("Analysis failed. Please try again or use a demo scenario.");
  } finally {
    setIsLoading(false);
  }
}

export default function HomePage() {
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [freeText, setFreeText] = useState("");

  const hasResult = Boolean(result);

  const handleNewAnalysis = () => {
    setResult(null);
    setError(null);
    setFreeText("");
  };

  const handleAnalyzeClick = async () => {
    if (!freeText.trim()) return;
    await runFreeTextAnalysis(freeText.trim(), setResult, setError, setIsLoading);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <TerminalLoader isVisible={isLoading} />

      <header
        style={{
          padding: "20px 32px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            fontFamily: "var(--display)",
            fontWeight: 800,
            fontSize: 24,
            letterSpacing: "0.3em",
            color: "var(--green)",
            textShadow: "var(--glow-green)",
          }}
        >
          ADIA
        </div>
        {hasResult && (
          <button
            type="button"
            onClick={handleNewAnalysis}
            style={{
              border: "1px solid var(--border-active)",
              background: "transparent",
              color: "var(--text)",
              fontFamily: "var(--mono)",
              fontSize: 12,
              letterSpacing: "0.18em",
              padding: "8px 16px",
              cursor: "pointer",
              textTransform: "uppercase",
            }}
          >
            ← NEW ANALYSIS
          </button>
        )}
      </header>

      {!hasResult && (
        <main
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px 16px 40px",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div
              style={{
                fontFamily: "var(--display)",
                fontWeight: 800,
                fontSize: 80,
                letterSpacing: "0.08em",
                color: "var(--green)",
                textShadow: "var(--glow-green)",
              }}
            >
              ADIA
            </div>
            <div
              style={{
                marginTop: 8,
                fontFamily: "var(--mono)",
                fontSize: 11,
                letterSpacing: "0.4em",
                color: "#333",
              }}
            >
              AUTONOMOUS DECISION INTELLIGENCE AGENT
            </div>
            <div
              style={{
                marginTop: 6,
                fontFamily: "var(--mono)",
                fontSize: 10,
                letterSpacing: "0.3em",
                color: "#555",
              }}
            >
              POWERED BY AMAZON NOVA
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 16,
              marginBottom: 24,
              opacity: isLoading ? 0.3 : 1,
              pointerEvents: isLoading ? "none" : "auto",
            }}
          >
            <button
              type="button"
              onClick={() => runScenario("/demo/scenario_a", setResult, setError, setIsLoading)}
              style={{
                width: 240,
                padding: "20px 16px",
                background: "#060606",
                border: "1px solid #1e1e1e",
                cursor: "pointer",
                transition: "all 0.2s ease",
                textAlign: "left",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = "var(--green)";
                e.currentTarget.style.boxShadow = "var(--glow-green)";
                e.currentTarget.style.background = "#0a0a0a";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = "#1e1e1e";
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.background = "#060606";
              }}
            >
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 9,
                  letterSpacing: "0.3em",
                  color: "var(--green)",
                  marginBottom: 8,
                }}
              >
                GO CANDIDATE
              </div>
              <div
                style={{
                  fontFamily: "var(--display)",
                  fontWeight: 600,
                  fontSize: 16,
                  color: "var(--text)",
                  marginBottom: 4,
                }}
              >
                SCENARIO: AI SAAS
              </div>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "#444",
                }}
              >
                VectorMind AI · Series A
              </div>
            </button>

            <button
              type="button"
              onClick={() => runScenario("/demo/scenario_b", setResult, setError, setIsLoading)}
              style={{
                width: 240,
                padding: "20px 16px",
                background: "#060606",
                border: "1px solid #1e1e1e",
                cursor: "pointer",
                transition: "all 0.2s ease",
                textAlign: "left",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = "var(--red)";
                e.currentTarget.style.boxShadow = "var(--glow-red)";
                e.currentTarget.style.background = "#0a0a0a";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = "#1e1e1e";
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.background = "#060606";
              }}
            >
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 9,
                  letterSpacing: "0.3em",
                  color: "var(--red)",
                  marginBottom: 8,
                }}
              >
                NO-GO CANDIDATE
              </div>
              <div
                style={{
                  fontFamily: "var(--display)",
                  fontWeight: 600,
                  fontSize: 16,
                  color: "var(--text)",
                  marginBottom: 4,
                }}
              >
                SCENARIO: CRYPTO SCAM
              </div>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "#444",
                }}
              >
                MoonChain Protocol · Pre-seed
              </div>
            </button>

            <button
              type="button"
              onClick={() => runScenario("/demo/scenario_c", setResult, setError, setIsLoading)}
              style={{
                width: 240,
                padding: "20px 16px",
                background: "#060606",
                border: "1px solid #1e1e1e",
                cursor: "pointer",
                transition: "all 0.2s ease",
                textAlign: "left",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = "var(--amber)";
                e.currentTarget.style.boxShadow = "var(--glow-amber)";
                e.currentTarget.style.background = "#0a0a0a";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = "#1e1e1e";
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.background = "#060606";
              }}
            >
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 9,
                  letterSpacing: "0.3em",
                  color: "var(--amber)",
                  marginBottom: 8,
                }}
              >
                CONDITIONAL
              </div>
              <div
                style={{
                  fontFamily: "var(--display)",
                  fontWeight: 600,
                  fontSize: 16,
                  color: "var(--text)",
                  marginBottom: 4,
                }}
              >
                SCENARIO: HARDWARE BURN
              </div>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "#444",
                }}
              >
                NeuralChip Systems · Series B
              </div>
            </button>
          </div>

          <div
            style={{
              width: "100%",
              maxWidth: 780,
              opacity: isLoading ? 0.3 : 1,
              pointerEvents: isLoading ? "none" : "auto",
            }}
          >
            <div
              style={{
                height: 1,
                background: "#1a1a1a",
                marginBottom: 16,
              }}
            />
            <textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              rows={4}
              placeholder="Or paste a pitch deck / business description..."
              style={{
                width: "100%",
                background: "#060606",
                border: "1px solid #1e1e1e",
                color: "var(--text)",
                fontFamily: "var(--mono)",
                fontSize: 13,
                padding: "12px 14px",
                borderRadius: 4,
                resize: "vertical",
                outline: "none",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--green)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#1e1e1e";
              }}
            />
            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={handleAnalyzeClick}
                style={{
                  fontFamily: "var(--display)",
                  fontWeight: 600,
                  fontSize: 14,
                  padding: "12px 32px",
                  borderRadius: 4,
                  border: "1px solid var(--green)",
                  background: "transparent",
                  color: "var(--green)",
                  letterSpacing: "0.2em",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  transition: "background 0.15s ease",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "rgba(0,255,157,0.08)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                ANALYZE →
              </button>
            </div>
            {error && (
              <div
                style={{
                  marginTop: 10,
                  fontFamily: "var(--mono)",
                  fontSize: 12,
                  color: "var(--red)",
                }}
              >
                {error}
              </div>
            )}
          </div>
        </main>
      )}

      {hasResult && (
        <main
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "row",
            minHeight: 0,
          }}
        >
          <div
            style={{
              flexBasis: "55%",
              minWidth: 0,
              padding: 24,
              opacity: result ? 1 : 0,
              transition: "opacity 300ms ease-out 200ms",
            }}
          >
            <KnowledgeGraph novaResult={result} />
          </div>
          <div
            style={{
              flexBasis: "45%",
              minWidth: 0,
              transform: result ? "translateX(0)" : "translateX(60px)",
              opacity: result ? 1 : 0,
              transition: "all 400ms ease-out",
              borderLeft: "1px solid var(--border)",
            }}
          >
            <VerdictPanel result={result} />
          </div>
        </main>
      )}
    </div>
  );
}

