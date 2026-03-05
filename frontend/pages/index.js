import { useEffect, useMemo, useState } from "react";
import AgentPipeline from "../components/AgentPipeline";
import DecisionForm from "../components/DecisionForm";
import ResultsDashboard from "../components/ResultsDashboard";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
const THINKING_STEPS = [
  "Researching market signals...",
  "Analyzing uploaded documents...",
  "Evaluating risks and opportunities...",
  "Generating decision report..."
];

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [problem, setProblem] = useState("");
  const [thinkingIndex, setThinkingIndex] = useState(0);

  const hasResult = useMemo(() => Boolean(result), [result]);

  useEffect(() => {
    if (!loading) {
      setThinkingIndex(0);
      return undefined;
    }

    setThinkingIndex(0);
    const intervalId = setInterval(() => {
      setThinkingIndex((current) => {
        if (current >= THINKING_STEPS.length - 1) {
          return current;
        }
        return current + 1;
      });
    }, 1600);

    return () => clearInterval(intervalId);
  }, [loading]);

  async function handleAnalyze(inputProblem, files) {
    setLoading(true);
    setError("");
    setProblem(inputProblem);

    try {
      const endpoint = files.length > 0 ? "/analyze-with-docs" : "/analyze";
      const url = `${API_BASE}${endpoint}`;

      let response;
      if (files.length > 0) {
        const formData = new FormData();
        formData.append("problem", inputProblem);
        formData.append("include_reasoning", "true");
        files.forEach((file) => formData.append("files", file));

        response = await fetch(url, {
          method: "POST",
          body: formData
        });
      } else {
        response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ problem: inputProblem, include_reasoning: true })
        });
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || "Request failed.");
      }

      const payload = await response.json();
      setResult(payload);
    } catch (requestError) {
      setResult(null);
      setError(requestError.message || "Unable to analyze this request.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="hero-panel">
        <p className="eyebrow">ADIA</p>
        <h1>Autonomous Decision Intelligence Agent</h1>
        <p>
          Evaluate startup decisions with agentic reasoning powered by Amazon Nova and grounded in your
          uploaded evidence.
        </p>
      </section>

      <DecisionForm onAnalyze={handleAnalyze} loading={loading} />

      {loading ? (
        <section className="thinking-panel" aria-live="polite">
          <p className="thinking-title">ADIA is thinking</p>
          <ul className="thinking-list">
            {THINKING_STEPS.map((step, index) => (
              <li
                key={step}
                className={
                  index < thinkingIndex
                    ? "thinking-item thinking-complete"
                    : index === thinkingIndex
                      ? "thinking-item thinking-active"
                      : "thinking-item"
                }
              >
                {step}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {error ? <p className="error-banner">{error}</p> : null}

      {(loading || hasResult) ? (
        <AgentPipeline loading={loading} currentStepIndex={thinkingIndex} hasResult={hasResult} />
      ) : null}

      {hasResult ? (
        <ResultsDashboard result={result} problem={problem} />
      ) : (
        <section className="empty-state">
          <h3>Ready for analysis</h3>
          <p>Enter a decision question, upload optional supporting files, and run ADIA.</p>
        </section>
      )}
    </main>
  );
}


