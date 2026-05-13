function TeacherNotificationPanel({
  notifications = [],
  unreadNotifications = 0,
  loadingNotifications = false,
  notificationsUnavailable = false,
  onMarkAllRead,
  onReadNotification,
}) {
  return (
    <div className="notification-panel">
      <div className="notification-panel-head">
        <h3>Notifications</h3>
        <button
          type="button"
          onClick={onMarkAllRead}
          disabled={unreadNotifications === 0 || notificationsUnavailable}
        >
          Mark all read
        </button>
      </div>

      {notificationsUnavailable ? (
        <p className="notification-empty">Notifications table is not ready yet.</p>
      ) : loadingNotifications ? (
        <p className="notification-empty">Loading notifications...</p>
      ) : notifications.length === 0 ? (
        <p className="notification-empty">No notifications yet.</p>
      ) : (
        <div className="notification-list">
          {notifications.map((notification) => (
            <button
              type="button"
              key={notification.id}
              className={`notification-item ${notification.is_read ? "" : "is-unread"}`}
              onClick={() => onReadNotification(notification)}
            >
              <span>
                <strong>{notification.title}</strong>
                <small>{notification.type || "activity"}</small>
              </span>
              <p>{notification.message || "No details provided."}</p>
              <time>
                {notification.created_at
                  ? new Date(notification.created_at).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Just now"}
              </time>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default TeacherNotificationPanel;
