function ClassPageHeader({
  classData,
  actionsOpen = false,
  inviteStatus = "",
  onBack,
  onToggleActions,
  onEditClass,
  onCopyInvite,
}) {
  return (
    <div className="dash-top class-top">
      <div className="class-title-row">
        <button type="button" className="class-back-btn" onClick={onBack}>
          <img src="/back.png" alt="Back" />
        </button>

        <div>
          <h1>{classData.subject}</h1>
          <p>
            {classData.subjectCode} | {classData.classCode}
          </p>
          <span>{classData.programBlock}</span>
          <div className="class-session-info">
            <p className="activity-session-title">Session &amp; invites</p>
            <p className="activity-session-note">
              Students can join within <strong>15 minutes</strong> after you press{" "}
              <strong>Start</strong>.
            </p>
          </div>
        </div>
      </div>

      <div className="class-invite-actions">
        <button
          type="button"
          className="class-actions-toggle"
          onClick={onToggleActions}
          aria-expanded={actionsOpen}
          aria-label="Open class actions"
        >
          <span className="sr-only">Class actions</span>
        </button>
        <div className={`class-actions-menu ${actionsOpen ? "open" : ""}`}>
          <button
            type="button"
            className="activity-copy-invite-btn class-top-invite-btn"
            onClick={onEditClass}
          >
            Edit class details
          </button>
          <button
            type="button"
            className="activity-copy-invite-btn class-top-invite-btn"
            onClick={onCopyInvite}
          >
            Copy invite link
          </button>
        </div>
        {inviteStatus && <span>{inviteStatus}</span>}
      </div>
    </div>
  );
}

export default ClassPageHeader;
