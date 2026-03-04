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

export default function ResultsDashboard({ result, problem }) {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);

  const viabilityScore = Number(result?.viability_score ?? 0);
  const risks = Array.isArray(result?.risks) ? result.risks : [];
  const opportunities = Array.isArray(result?.opportunities) ? result.opportunities : [];
  const reasoningSteps = Array.isArray(result?.reasoning_steps) ? result.reasoning_steps : [];
  const warnings = Array.isArray(result?.metadata?.warnings) ? result.metadata.warnings : [];

  const barData = useMemo(
    () => [
      { label: "Risks", value: risks.length, color: "#b3372e" },
      { label: "Opportunities", value: opportunities.length, color: "#1f8f64" }
    ],
    [risks.length, opportunities.length]
  );

  const radialData = useMemo(
    () => [{ name: "Viability", value: viabilityScore, fill: scoreColor(viabilityScore) }],
    [viabilityScore]
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
        <h2>Viability Score</h2>
        <p className="score-text" style={{ color: scoreColor(viabilityScore) }}>
          {viabilityScore.toFixed(1)} / 100
        </p>
        {isClient ? (
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={260}>
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="95%"
                barSize={20}
                data={radialData}
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

      {reasoningSteps.length ? (
        <article className="card-panel card-span-12">
          <h2>Reasoning Timeline</h2>
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
