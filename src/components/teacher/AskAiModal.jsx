import Button from "../ui/button";
import Modal from "../ui/modal";

function AskAiModal({
  prompt,
  answer,
  error = "",
  loading = false,
  onPromptChange,
  onGenerate,
  onClose,
}) {
  return (
    <Modal onClose={onClose} contentClassName="modal-content ask-ai-modal">
        <h3>Ask AI</h3>
        <p>
          Generate a quick teaching prompt, question idea, or participation advice
          from the current class state.
        </p>
        <textarea
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder="Example: Give me a medium difficulty recitation question"
          disabled={loading}
        />
        <Button onClick={onGenerate} disabled={loading}>
          {loading ? "Generating..." : "Generate"}
        </Button>
        {error && <p className="ask-ai-error">{error}</p>}
        {answer && <pre>{answer}</pre>}
        <Button onClick={onClose} disabled={loading}>
          Close
        </Button>
    </Modal>
  );
}

export default AskAiModal;
