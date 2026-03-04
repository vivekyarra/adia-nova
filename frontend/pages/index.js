import { useMemo, useState } from "react";
import DecisionForm from "../components/DecisionForm";
import ResultsDashboard from "../components/ResultsDashboard";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [problem, setProblem] = useState("");

  const hasResult = useMemo(() => Boolean(result), [result]);

  async function handleAnalyze(inputProblem, files) {
    setLoading(true);
    setError("");
    setProblem(inputProblem);

    try {
      const endpoint = files.length > 0 ? "/analyze-with-docs" : "/analyze";
      const url = `${API_BASE_URL}${endpoint}`;

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

      {error ? <p className="error-banner">{error}</p> : null}

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
