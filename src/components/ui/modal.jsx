function Modal({
  children,
  open = true,
  onClose,
  closeOnBackdrop = true,
  overlayClassName = "modal",
  contentClassName = "modal-content",
  role = "dialog",
  ariaModal = true,
}) {
  if (!open) return null;

  const handleBackdropClick = () => {
    if (closeOnBackdrop) {
      onClose?.();
    }
  };

  return (
    <div className={overlayClassName} onClick={handleBackdropClick}>
      <div
        className={contentClassName}
        role={role}
        aria-modal={ariaModal}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export default Modal;
