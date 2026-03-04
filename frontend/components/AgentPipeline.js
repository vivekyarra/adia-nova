const AGENT_STAGES = [
  "Research Agent",
  "Analysis Agent",
  "Reasoning Agent",
  "Report Agent"
];

export default function AgentPipeline({ loading, currentStepIndex, hasResult }) {
  function stageStatus(index) {
    if (hasResult && !loading) {
      return "completed";
    }
    if (!loading) {
      return "pending";
    }
    if (index < currentStepIndex) {
      return "completed";
    }
    if (index === currentStepIndex) {
      return "running";
    }
    return "pending";
  }

  return (
    <section className="card-panel pipeline-panel" data-testid="agent-pipeline">
      <h2>Agent Pipeline</h2>
      <ol className="pipeline-list">
        {AGENT_STAGES.map((stage, index) => {
          const status = stageStatus(index);
          return (
            <li key={stage} className={`pipeline-item pipeline-${status}`}>
              <span className={`pipeline-dot pipeline-dot-${status}`} />
              <div className="pipeline-content">
                <p className="pipeline-title">{stage}</p>
                <p className="pipeline-status">{status}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
