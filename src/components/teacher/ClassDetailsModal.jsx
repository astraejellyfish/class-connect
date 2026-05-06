import Button from "../ui/button";
import Input from "../ui/input";
import Modal from "../ui/modal";

function ClassDetailsModal({
  form,
  error = "",
  saving = false,
  onChange,
  onSubmit,
  onCancel,
}) {
  return (
    <Modal closeOnBackdrop={!saving} onClose={onCancel}>
      <form
        className="class-details-modal"
        onSubmit={onSubmit}
      >
        <h3>Edit Class Details</h3>

        {error && <div className="error-box modal-inline-error">{error}</div>}

        <label>
          Subject name
          <Input
            value={form.subject}
            onChange={(event) => onChange("subject", event.target.value)}
          />
        </label>
        <label>
          Subject code
          <Input
            value={form.subjectCode}
            onChange={(event) => onChange("subjectCode", event.target.value)}
          />
        </label>
        <label>
          Class code
          <Input
            value={form.classCode}
            onChange={(event) => onChange("classCode", event.target.value)}
          />
        </label>
        <label>
          Program, year, block
          <Input
            value={form.programBlock}
            onChange={(event) => onChange("programBlock", event.target.value)}
          />
        </label>

        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
        <Button disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
      </form>
    </Modal>
  );
}

export default ClassDetailsModal;
