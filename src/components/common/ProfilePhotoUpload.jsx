function ProfilePhotoUpload({
  name = "User",
  avatarUrl = "",
  previewUrl = "",
  disabled = false,
  uploading = false,
  error = "",
  message = "",
  onFileChange,
  onUpload,
}) {
  const displayUrl = previewUrl || avatarUrl;

  return (
    <div className="profile-photo-upload">
      <div className="profile-photo-preview">
        {displayUrl ? (
          <img src={displayUrl} alt="Profile preview" />
        ) : (
          <span>{name.charAt(0).toUpperCase()}</span>
        )}
      </div>

      <div className="profile-photo-controls">
        <strong>2x2 Profile Photo</strong>
        <p>JPG or PNG only. Strongly recommended: use a clear formal 2x2 picture.</p>
        <input
          type="file"
          accept="image/png,image/jpeg"
          onChange={(event) => onFileChange(event.target.files?.[0] || null)}
          disabled={disabled || uploading}
        />
        {onUpload && (
          <button type="button" onClick={onUpload} disabled={disabled || uploading}>
            {uploading ? "Uploading..." : "Upload Photo"}
          </button>
        )}
        {error && <small className="profile-photo-error">{error}</small>}
        {message && <small className="profile-photo-success">{message}</small>}
      </div>
    </div>
  );
}

export default ProfilePhotoUpload;
