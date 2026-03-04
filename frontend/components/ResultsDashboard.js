import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

function scoreColor(score) {
  if (score >= 70) return "#1f8f64";
  if (score >= 45) return "#e07a22";
  return "#b3372e";
}

function riskLevelFromScores(viabilityScore, confidenceScore) {
  if (viabilityScore >= 70 && confidenceScore >= 70) {
    return "Low";
  }
  if (viabilityScore >= 45 && confidenceScore >= 55) {
    return "Medium";
  }
  return "High";
}

function riskClassName(level) {
  if (level === "Low") return "risk-low";
  if (level === "Medium") return "risk-medium";
  return "risk-high";
}

export default function ResultsDashboard({ result, problem }) {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);

  const viabilityScore = Number(result?.viability_score ?? 0);
  const confidenceScore = Number(result?.confidence_score ?? 0);
  const risks = Array.isArray(result?.risks) ? result.risks : [];
  const opportunities = Array.isArray(result?.opportunities) ? result.opportunities : [];
  const reasoningSteps = Array.isArray(result?.reasoning_steps) ? result.reasoning_steps : [];
  const warnings = Array.isArray(result?.metadata?.warnings) ? result.metadata.warnings : [];
  const riskLevel = riskLevelFromScores(viabilityScore, confidenceScore);

  const barData = useMemo(
    () => [
      { label: "Risks", value: risks.length, color: "#b3372e" },
      { label: "Opportunities", value: opportunities.length, color: "#1f8f64" }
    ],
    [risks.length, opportunities.length]
  );

  const viabilityRadialData = useMemo(
    () => [{ name: "Viability", value: viabilityScore, fill: scoreColor(viabilityScore) }],
    [viabilityScore]
  );
  const confidenceRadialData = useMemo(
    () => [{ name: "Confidence", value: confidenceScore, fill: scoreColor(confidenceScore) }],
    [confidenceScore]
  );

  return (
    <section className="dashboard-grid">
      <article className="card-panel card-span-6">
        <h2>Decision Report</h2>
        <p className="muted">Problem</p>
        <p>{problem}</p>
        <p className="muted">Summary</p>
        <p>{result?.summary || "No summary generated."}</p>
        <p className="muted">Recommended Strategy</p>
        <p>{result?.recommended_strategy || "No strategy generated."}</p>
      </article>

      <article className="card-panel card-span-6">
        <h2>Scoring Engine</h2>
        <div className="score-grid">
          <div className="score-card">
            <p className="muted">Viability Score</p>
            <p className="score-text" style={{ color: scoreColor(viabilityScore) }}>
              {viabilityScore.toFixed(1)}%
            </p>
            {isClient ? (
              <div className="chart-box score-chart">
                <ResponsiveContainer width="100%" height={220}>
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="55%"
                    outerRadius="95%"
                    barSize={20}
                    data={viabilityRadialData}
                    startAngle={180}
                    endAngle={0}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar dataKey="value" cornerRadius={10} />
                    <Tooltip />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </div>

          <div className="score-card" data-testid="confidence-score-card">
            <p className="muted">Confidence Score</p>
            <p className="score-text" style={{ color: scoreColor(confidenceScore) }}>
              {confidenceScore.toFixed(1)}%
            </p>
            {isClient ? (
              <div className="chart-box score-chart">
                <ResponsiveContainer width="100%" height={220}>
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="55%"
                    outerRadius="95%"
                    barSize={20}
                    data={confidenceRadialData}
                    startAngle={180}
                    endAngle={0}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar dataKey="value" cornerRadius={10} />
                    <Tooltip />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </div>
        </div>
        <p className={`risk-badge ${riskClassName(riskLevel)}`}>Risk Level: {riskLevel}</p>
        <p className="muted">Nova calls used: {result?.metadata?.nova_calls_used ?? 0} / 3</p>
      </article>

      <article className="card-panel card-span-4">
        <h2>Risk vs Opportunity</h2>
        {isClient ? (
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {barData.map((entry) => (
                    <Cell key={entry.label} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </article>

      <article className="card-panel card-span-4">
        <h2>Key Risks</h2>
        <ul className="insight-list">
          {risks.length ? risks.map((risk) => <li key={risk}>{risk}</li>) : <li>No major risks identified.</li>}
        </ul>
      </article>

      <article className="card-panel card-span-4">
        <h2>Key Opportunities</h2>
        <ul className="insight-list">
          {opportunities.length ? (
            opportunities.map((opportunity) => <li key={opportunity}>{opportunity}</li>)
          ) : (
            <li>No opportunities identified.</li>
          )}
        </ul>
      </article>

      <article className="card-panel card-span-6">
        <h2>Decision Process Timeline</h2>
        <ol className="process-timeline">
          <li className="process-step">Step 1 - Market signals analyzed</li>
          <li className="process-step">Step 2 - Document insights extracted</li>
          <li className="process-step">Step 3 - Risks evaluated</li>
          <li className="process-step">Step 4 - Strategy generated</li>
        </ol>
      </article>

      {reasoningSteps.length ? (
        <article className="card-panel card-span-6">
          <h2>Model Reasoning Details</h2>
          <ol className="timeline-list">
            {reasoningSteps.map((step) => (
              <li key={step}>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </article>
      ) : null}

      {warnings.length ? (
        <article className="card-panel card-span-12">
          <h2>Upload Notes</h2>
          <ul className="insight-list">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </article>
      ) : null}
    </section>
  );
}
