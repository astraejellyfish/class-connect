import ParticipationSpinner from "./ParticipationSpinner";
import { formatFullNameTitle } from "../../utils/studentDisplay";

function StudentParticipationPanel({
  students = [],
  selectedStudent = null,
  sessionOngoing = false,
  pendingSelection = null,
  selectionCountdown = 0,
  pickResponseSeconds = 10,
  respondingSelection = false,
  selectionMessage = "",
  canJoinSession = false,
  volunteering = false,
  volunteerLimitReached = false,
  alreadyVolunteered = false,
  volunteerAttempts = 0,
  maxVolunteerAttempts = 1,
  sessionMessage = "",
  onSelectionResponse,
  onVolunteer,
}) {
  return (
    <section className="participation-card participation-card-main student-readonly-participation">
      <div className="participation-head participation-head-row">
        <div>
          <h3>Participation</h3>
          <p className="participation-sub">
            Watch the class spinner and volunteer when you want to participate.
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
          <ParticipationSpinner
            students={students}
            selectedStudent={selectedStudent}
            spinning={false}
            pendingPick={
              pendingSelection
                ? {
                    student: selectedStudent,
                    pts: pendingSelection.points,
                  }
                : null
            }
            pickOutcome={null}
            spinRotation={0}
          />
        )}
      </div>

      {pendingSelection && selectedStudent && (
        <div className="student-selection-response">
          <p className="student-class-kicker">You were selected</p>
          <h3>{formatFullNameTitle(selectedStudent.name)}</h3>
          <p>
            Accept to participate for <strong>{pendingSelection.points}</strong>{" "}
            pt{pendingSelection.points === 1 ? "" : "s"}, or request to skip.
          </p>
          <strong className="student-selection-timer">{selectionCountdown}s</strong>
          <div
            className="student-countdown-visual"
            style={{
              "--countdown-progress": `${
                Math.max(0, Math.min(1, selectionCountdown / pickResponseSeconds)) *
                100
              }%`,
            }}
            aria-hidden="true"
          >
            <span />
          </div>
          <div className="student-selection-actions">
            <button
              type="button"
              className="student-primary-btn"
              onClick={() => onSelectionResponse("accepted")}
              disabled={respondingSelection || selectionCountdown <= 0}
            >
              {respondingSelection ? "Sending..." : "Accept"}
            </button>
            <button
              type="button"
              className="student-selection-skip-btn"
              onClick={() => onSelectionResponse("skip_requested")}
              disabled={respondingSelection || selectionCountdown <= 0}
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
              : volunteerAttempts >= maxVolunteerAttempts
                ? "Volunteer Used"
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
