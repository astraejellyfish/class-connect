import { formatFullNameTitle } from "../../utils/studentDisplay";

function StudentParticipationPanel({
  students = [],
  selectedStudent = null,
  sessionOngoing = false,
  currentSelection = null,
  pendingSelection = null,
  respondingSelection = false,
  selectionMessage = "",
  canJoinSession = false,
  volunteering = false,
  volunteerLimitReached = false,
  alreadyVolunteered = false,
  sessionMessage = "",
  onSelectionResponse,
  onVolunteer,
}) {
  const selectionStatus = currentSelection?.status || "";
  const selectionPoints = currentSelection?.points || 0;
  const hasSelection = Boolean(currentSelection && selectedStudent);
  const selectedName = selectedStudent
    ? formatFullNameTitle(selectedStudent.name)
    : "No student selected";
  const resultKind =
    selectionStatus === "awarded"
      ? "awarded"
      : selectionStatus === "skipped"
        ? "skipped"
        : selectionStatus === "accepted"
          ? "accepted"
          : selectionStatus === "skip_requested"
            ? "skip_requested"
            : selectionStatus === "pending"
              ? "pending"
              : "";
  const resultTitle =
    resultKind === "awarded"
      ? "Points awarded"
      : resultKind === "skipped"
        ? "No points awarded"
        : resultKind === "accepted"
          ? "Accepted"
          : resultKind === "skip_requested"
            ? "Skip requested"
            : resultKind === "pending"
              ? "Selected"
              : "Selection status";
  const resultMeta =
    resultKind === "awarded"
      ? `+${selectionPoints} pt${selectionPoints === 1 ? "" : "s"}`
      : resultKind === "skipped"
        ? `0 pts, offered ${selectionPoints}`
        : resultKind === "accepted"
          ? "Waiting for your teacher to finish"
          : resultKind === "skip_requested"
            ? "Waiting for your teacher to confirm"
            : resultKind === "pending"
              ? `${selectionPoints} pt${selectionPoints === 1 ? "" : "s"} pending`
              : sessionOngoing
                ? "Waiting for your teacher's next selection"
                : "Start a live session to participate";

  return (
    <section className="participation-card participation-card-main student-readonly-participation">
      <div className="participation-head participation-head-row">
        <div>
          <h3>Participation</h3>
          <p className="participation-sub">
            Follow your selection status and volunteer when you want to participate.
          </p>
        </div>
        <div className="participation-toolbar">
          <div
            className={`session-status-pill ${sessionOngoing ? "active" : ""}`}
            title="Session status"
          >
            {sessionOngoing ? "Live" : "Off"}
          </div>
        </div>
      </div>

      <div className="placeholder-box spinner-box">
        {students.length === 0 ? (
          <span>No students in this class yet.</span>
        ) : (
          <div
            className={`student-selection-summary ${
              resultKind ? `student-selection-summary--${resultKind}` : ""
            }`}
          >
            <span className="student-class-kicker">{resultTitle}</span>
            <strong>{hasSelection ? selectedName : "No student selected"}</strong>
            <span>{resultMeta}</span>
          </div>
        )}
      </div>

      {pendingSelection && selectedStudent && (
        <div className="student-selection-response">
          <p className="student-class-kicker">You were selected</p>
          <h3>{formatFullNameTitle(selectedStudent.name)}</h3>
          <p>
            Accept to participate for <strong>{pendingSelection.points}</strong>{" "}
            pt{pendingSelection.points === 1 ? "" : "s"}, or request to skip when
            needed.
          </p>
          <strong className="student-selection-timer">Teacher controlled</strong>
          <div className="student-selection-actions">
            <button
              type="button"
              className="student-primary-btn"
              onClick={() => onSelectionResponse("accepted")}
              disabled={respondingSelection}
            >
              {respondingSelection ? "Sending..." : "Accept"}
            </button>
            <button
              type="button"
              className="student-selection-skip-btn"
              onClick={() => onSelectionResponse("skip_requested")}
              disabled={respondingSelection}
            >
              Request Skip
            </button>
          </div>
        </div>
      )}

      {selectionMessage && (
        <p className="student-selection-message">{selectionMessage}</p>
      )}

      {sessionOngoing && (
        <div className="student-volunteer-action">
          <button
            type="button"
            className="student-primary-btn student-volunteer-main-btn"
            onClick={onVolunteer}
            disabled={!canJoinSession || volunteering || volunteerLimitReached}
          >
            {alreadyVolunteered
              ? "Already in Queue"
              : volunteering
                  ? "Joining..."
                  : "Volunteer"}
          </button>
          {sessionMessage && <span>{sessionMessage}</span>}
        </div>
      )}
    </section>
  );
}

export default StudentParticipationPanel;
