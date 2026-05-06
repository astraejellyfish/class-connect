function Toast({ message, kind = "info", className = "" }) {
  if (!message) return null;

  return (
    <div className={`toast toast-${kind} ${className}`.trim()} role="status">
      {message}
    </div>
  );
}

export default Toast;
