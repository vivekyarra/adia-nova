import { useState } from "react";

const ACCEPTED_FILE_TYPES = ".pdf,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp";
const MAX_FILES = 8;
const SAMPLE_SCENARIOS = [
  "Should a startup launch a food delivery app in Hyderabad?",
  "Should an EV startup expand into rural India?",
  "Should a SaaS company adopt usage-based pricing?"
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
              key={scenario}
              type="button"
              className="scenario-chip"
              onClick={() => {
                setProblem(scenario);
                setValidationError("");
              }}
            >
              {scenario}
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
