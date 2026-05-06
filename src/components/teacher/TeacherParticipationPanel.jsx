import ParticipationSpinner from "./ParticipationSpinner";
import VolunteerQueue from "./VolunteerQueue";
import { formatFullNameTitle } from "../../utils/studentDisplay";

function TeacherParticipationPanel({
  students = [],
  sessionActive = false,
  spinning = false,
  pendingPick = null,
  pickOutcome = null,
  spinRotation = 0,
  selectedStudent = null,
  resolvingPick = false,
  selectionRequestUnavailable = false,
  eligiblePresentCount = 0,
  awardPointsInput,
  volunteerQueue = [],
  savingVolunteer = false,
  volunteersEnabled = true,
  skipFxActive = false,
  onStartSession,
  onEndSession,
  onAwardPointsChange,
  onSpin,
  onResolvePick,
  onAcceptVolunteer,
  onSkipVolunteer,
}) {
  return (
    <div className="participation-stack">
      <section className="participation-card participation-card-main">
        <div className="participation-head participation-head-row">
          <h3>Participation</h3>
          <div className="participation-toolbar">
            <div
              className={`session-status-pill ${sessionActive ? "active" : ""}`}
              title="Session status"
            >
              {sessionActive ? "Live" : "Off"}
            </div>
            <button
              type="button"
              className="start-session-btn session-toolbar-btn"
              onClick={onStartSession}
              disabled={sessionActive}
            >
              Start
            </button>
            <button
              type="button"
              className="end-session-btn session-toolbar-btn"
              onClick={onEndSession}
              disabled={!sessionActive}
            >
              End
            </button>
            <label className="points-award-field">
              <span className="points-award-label">Pts / pick</span>
              <input
                type="number"
                min={1}
                max={99}
                value={awardPointsInput}
                onChange={(event) => onAwardPointsChange(event.target.value)}
                disabled={!sessionActive || spinning || !!pendingPick || resolvingPick}
              />
            </label>
          </div>
        </div>

        <p className="participation-sub">
          Weighted fairness: fewer total points means a higher chance to be picked.
          Set <strong>Pts / pick</strong>, then spin. The selected student must
          accept or request to skip before the timer ends.
        </p>

        <div className="placeholder-box spinner-box">
          {!sessionActive ? (
            <span className="spinner-placeholder-msg">Start the session to spin.</span>
          ) : students.length === 0 ? (
            <span className="spinner-placeholder-msg">
              No students have joined this class yet.
            </span>
          ) : (
            <ParticipationSpinner
              students={students}
              selectedStudent={selectedStudent}
              spinning={spinning}
              pendingPick={pendingPick}
              pickOutcome={pickOutcome}
              spinRotation={spinRotation}
            />
          )}
        </div>

        {sessionActive && pendingPick && !spinning && (
          <div className="pick-confirm-actions">
            <p className="pick-confirm-label">
              {selectionRequestUnavailable
                ? "Confirm selection"
                : "Waiting for student response"}
            </p>
            <p className="pick-confirm-hint">
              <strong>{formatFullNameTitle(pendingPick.student.name)}</strong>{" "}
              was offered <strong>{pendingPick.pts}</strong> pt
              {pendingPick.pts === 1 ? "" : "s"}. Status:{" "}
              <strong>
                {pendingPick.responseStatus === "accepted"
                  ? "Accepted"
                  : pendingPick.responseStatus === "skip_requested"
                    ? "Requested skip"
                    : selectionRequestUnavailable
                      ? "Teacher fallback"
                      : "Pending"}
              </strong>
            </p>
            {selectionRequestUnavailable && (
              <div className="pick-confirm-buttons">
                <button
                  type="button"
                  className="pick-got-btn"
                  onClick={() => onResolvePick(true)}
                  disabled={resolvingPick}
                >
                  {resolvingPick ? "Saving..." : "Award points"}
                </button>
                <button
                  type="button"
                  className={`pick-skip-btn ${skipFxActive ? "is-skip-fx" : ""}`}
                  onClick={() => onResolvePick(false)}
                  disabled={resolvingPick}
                >
                  Skip
                </button>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          className="select-student-btn"
          disabled={
            !sessionActive ||
            eligiblePresentCount === 0 ||
            spinning ||
            !!pendingPick ||
            resolvingPick
          }
          onClick={onSpin}
        >
          {spinning ? "Spinning..." : "Spin student"}
        </button>
      </section>

      <VolunteerQueue
        queue={volunteerQueue}
        onAcceptVolunteer={onAcceptVolunteer}
        onSkipVolunteer={onSkipVolunteer}
        disabled={!sessionActive || students.length === 0 || !volunteersEnabled}
        saving={savingVolunteer}
        skipFxActive={skipFxActive}
      />
    </div>
  );
}

export default TeacherParticipationPanel;
