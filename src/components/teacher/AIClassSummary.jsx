import { useState } from "react";

function AIClassSummary({ logs, classData }) {
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  
  const generateMockSummary = () => {
    setLoading(true);

    setTimeout(() => {
      if (logs.length === 0) {
        setSummary(
          "No class activity has been recorded yet. Start a session first to generate a participation summary."
        );
      } else {
        setSummary(
          `AI Summary for ${classData.subject}: The session has ${logs.length} recorded activity log(s). The teacher can use this summary to review participation, session flow, and student engagement.`
        );
      }

      setLoading(false);
    }, 700);
  };

  return (
    <section className="ai-summary-card">
      <div>
        <p className="label">AI Feature</p>
        <h2>Participation Summary</h2>
        <p>
          Generate a quick summary of the class session based on activity logs.
        </p>
      </div>

      <button onClick={generateMockSummary} disabled={loading}>
        {loading ? "Generating..." : "Generate Summary"}
      </button>

      {summary && <div className="ai-result">{summary}</div>}
    </section>
  );
}

export default AIClassSummary;