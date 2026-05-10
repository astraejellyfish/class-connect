function MobileHeader({
  notificationOpen = false,
  onToggleNotifications,
  notificationCount = 0,
  notificationPanel = null,
  profileContent,
  onProfileClick,
  profileLabel = "Open account settings",
}) {
  return (
    <header className="mobile-app-header">
      <div className="mobile-app-brand" aria-label="Class Connect">
        <img src="/leaf-logo.png" alt="Class Connect" />
      </div>

      <div className="mobile-app-actions">
        <div className="mobile-app-notification-wrap">
          <button
            type="button"
            className="mobile-app-icon-btn"
            onClick={onToggleNotifications}
            aria-expanded={notificationOpen}
            aria-label="Open notifications"
          >
            <img src="/icons/notification.png" alt="" />
            {notificationCount > 0 && (
              <strong>{notificationCount > 9 ? "9+" : notificationCount}</strong>
            )}
          </button>
          {notificationOpen && notificationPanel}
        </div>

        <button
          type="button"
          className="mobile-app-profile-btn"
          onClick={onProfileClick}
          aria-label={profileLabel}
        >
          {profileContent}
        </button>
      </div>
    </header>
  );
}

export default MobileHeader;
