function StudentNotificationPanel({
  notifications = [],
  unreadNotifications = 0,
  loadingNotifications = false,
  notificationsReadAt = new Date(0).toISOString(),
  onMarkAllRead,
}) {
  return (
    <div className="student-notification-panel">
      <div className="student-notification-panel-head">
        <h3>Notifications</h3>
        <button
          type="button"
          onClick={onMarkAllRead}
          disabled={unreadNotifications === 0}
        >
          Mark all read
        </button>
      </div>

      {loadingNotifications ? (
        <p className="student-notification-empty">Loading notifications...</p>
      ) : notifications.length === 0 ? (
        <p className="student-notification-empty">No notifications yet.</p>
      ) : (
        <div className="student-notification-list">
          {notifications.map((notification) => (
            <article
              key={notification.id}
              className={`student-notification-item ${
                new Date(notification.createdAt).getTime() >
                new Date(notificationsReadAt).getTime()
                  ? "is-unread"
                  : ""
              }`}
            >
              <span>
                <strong>{notification.title}</strong>
                <small>{notification.type || "activity"}</small>
              </span>
              <p>{notification.message || "No details provided."}</p>
              <time>
                {notification.createdAt
                  ? new Date(notification.createdAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Just now"}
              </time>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default StudentNotificationPanel;
