import { useEffect, useRef } from "react";

function ActivityPanel({
  logs,
  sessionSlot = null,
}) {
  const activityLogs = logs.filter((log) => !log.isAiTool);
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [activityLogs.length]);

  return (
    <aside className="activity-panel">
      {sessionSlot ? (
        <div className="activity-session-slot">{sessionSlot}</div>
      ) : null}

      <div className="activity-head">
        <h3>Activity Log</h3>
        <span>{activityLogs.length}</span>
      </div>

      <div className="activity-list" ref={listRef}>
        {activityLogs.length === 0 ? (
          <p className="empty-log">No activity yet.</p>
        ) : (
          activityLogs.map((log, index) => (
            <div className="activity-item" key={log.id || log.createdAt || index}>
              <strong>{log.time}</strong>
              <p>{log.message}</p>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

export default ActivityPanel;
