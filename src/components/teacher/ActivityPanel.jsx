function ActivityPanel({
  logs,
  sessionSlot = null,
}) {
  return (
    <aside className="activity-panel">
      {sessionSlot ? (
        <div className="activity-session-slot">{sessionSlot}</div>
      ) : null}

      <div className="activity-head">
        <h3>Activity Log</h3>
        <span>{logs.length}</span>
      </div>

      <div className="activity-list">
        {logs.length === 0 ? (
          <p className="empty-log">No activity yet.</p>
        ) : (
          logs.map((log, index) => (
            <div className="activity-item" key={index}>
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
