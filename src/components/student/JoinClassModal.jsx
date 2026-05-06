import Button from "../ui/button";
import Input from "../ui/input";
import Modal from "../ui/modal";

function JoinClassModal({
  joinCode,
  joinError = "",
  joinSuccess = "",
  joining = false,
  onJoinCodeChange,
  onSubmit,
  onClose,
}) {
  return (
    <Modal
      overlayClassName="student-modal-overlay"
      contentClassName="student-join-modal"
      onClose={onClose}
    >
      <form
        onSubmit={onSubmit}
      >
        <h2>Join Class</h2>
        <Input
          value={joinCode}
          onChange={(event) => onJoinCodeChange(event.target.value)}
          placeholder="Enter class code"
          disabled={joining}
        />
        {joinError && <div className="student-alert student-alert-error">{joinError}</div>}
        {joinSuccess && (
          <div className="student-alert student-alert-success">{joinSuccess}</div>
        )}
        <Button type="submit" disabled={joining}>
          {joining ? "Joining..." : "Join Class"}
        </Button>
        <Button onClick={onClose} disabled={joining}>
          Cancel
        </Button>
      </form>
    </Modal>
  );
}

export default JoinClassModal;
