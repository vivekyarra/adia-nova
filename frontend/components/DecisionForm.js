import { useState } from "react";

const ACCEPTED_FILE_TYPES = ".pdf,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp";
const MAX_FILES = 8;
const SAMPLE_SCENARIOS = [
  {
    label: "Startup Market Expansion",
    prompt: "Should a startup pursue market expansion into a new metro in the next 12 months?"
  },
  {
    label: "EV Charging Network Expansion",
    prompt: "Should an EV startup expand charging infrastructure into tier-2 and rural regions?"
  },
  {
    label: "AI SaaS Pricing Strategy",
    prompt: "Should an AI SaaS company adopt usage-based pricing for growth?"
  },
  {
    label: "Food Delivery Launch in Hyderabad",
    prompt: "Should a startup launch a food delivery app in Hyderabad?"
  }
];

export default function DecisionForm({ onAnalyze, loading }) {
  const [problem, setProblem] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [validationError, setValidationError] = useState("");

  function handleFiles(event) {
    const files = Array.from(event.target.files || []);
    if (files.length > MAX_FILES) {
      setValidationError(`Please upload up to ${MAX_FILES} files.`);
      setSelectedFiles(files.slice(0, MAX_FILES));
      return;
    }
    setValidationError("");
    setSelectedFiles(files);
  }

  async function submit(event) {
    event.preventDefault();
    const trimmed = problem.trim();
    if (trimmed.length < 10) {
      setValidationError("Please enter a clearer decision question (minimum 10 characters).");
      return;
    }
    setValidationError("");
    await onAnalyze(trimmed, selectedFiles);
  }

  return (
    <section className="card-panel">
      <h2>Decision Input</h2>
      <form onSubmit={submit}>
        <label className="form-label">Sample scenarios</label>
        <div className="sample-buttons">
          {SAMPLE_SCENARIOS.map((scenario) => (
            <button
              key={scenario.label}
              type="button"
              className="scenario-chip"
              onClick={() => {
                setProblem(scenario.prompt);
                setValidationError("");
              }}
            >
              {scenario.label}
            </button>
          ))}
        </div>

        <label className="form-label" htmlFor="problem">
          Problem statement
        </label>
        <textarea
          id="problem"
          className="text-area"
          value={problem}
          onChange={(event) => setProblem(event.target.value)}
          placeholder="Should a startup launch a food delivery app in Hyderabad?"
          rows={5}
        />

        <label className="form-label" htmlFor="files">
          Upload supporting files (optional)
        </label>
        <input
          id="files"
          className="file-input"
          type="file"
          multiple
          accept={ACCEPTED_FILE_TYPES}
          onChange={handleFiles}
        />

        {selectedFiles.length > 0 ? (
          <ul className="file-list">
            {selectedFiles.map((file) => (
              <li key={`${file.name}-${file.size}`}>{file.name}</li>
            ))}
          </ul>
        ) : null}

        {validationError ? <p className="error-inline">{validationError}</p> : null}

        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? "Analyzing..." : "Analyze"}
        </button>
      </form>
    </section>
  );
}
