import Button from "../ui/button";
import Modal from "../ui/modal";

function ConfirmModal({
  title,
  message,
  confirmLabel = "Yes",
  cancelLabel = "Cancel",
  loading = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      overlayClassName="modal confirm-modal"
      contentClassName="modal-content confirm-modal-content"
      closeOnBackdrop={!loading}
      onClose={onCancel}
    >
      <h3>{title}</h3>
      <p>{message}</p>
      <Button onClick={onConfirm} disabled={loading}>
        {loading ? "Please wait..." : confirmLabel}
      </Button>
      <Button onClick={onCancel} disabled={loading}>
        {cancelLabel}
      </Button>
    </Modal>
  );
}

export default ConfirmModal;
