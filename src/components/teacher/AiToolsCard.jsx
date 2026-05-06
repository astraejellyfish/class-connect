function AiToolsCard({
  summary,
  error = "",
  loading = false,
  onGenerate,
  onAskAi,
  onPreview,
}) {
  return (
    <section className="teacher-ai-tools-card">
      <div className="teacher-ai-tools-copy">
        <p className="activity-session-title">AI Tools</p>
        <h3>Class Summary</h3>
        {error ? <p className="teacher-ai-error">{error}</p> : null}
        {summary ? (
          <p className="teacher-ai-summary-preview">
            {summary.summary || "Summary generated. Open the preview for details."}
          </p>
        ) : null}
      </div>
      <div className="teacher-ai-tools-actions">
        <button type="button" onClick={onGenerate} disabled={loading}>
          {loading ? "Generating..." : "Generate"}
        </button>
        <button type="button" className="teacher-ask-ai-btn" onClick={onAskAi}>
          Ask AI
        </button>
      </div>
      {summary && (
        <button type="button" onClick={onPreview}>
          Preview PDF
        </button>
      )}
    </section>
  );
}

export default AiToolsCard;
