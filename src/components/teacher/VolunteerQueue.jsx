import { formatFullNameTitle, formatStudentShort } from "../../utils/studentDisplay";
import { canUseVolunteerActions, getCurrentVolunteer } from "../../features/volunteer";

function VolunteerQueue({
  queue = [],
  onAcceptVolunteer,
  onSkipVolunteer,
  disabled = false,
  saving = false,
  skipFxActive = false,
}) {
  const currentVolunteer = getCurrentVolunteer(queue);
  const actionsEnabled = canUseVolunteerActions({ queue, disabled, saving });

  return (
    <section className="volunteer-card">
      <div className="volunteer-head">
        <div>
          <h3>Volunteer Queue</h3>
        </div>
        <span>{queue.length}</span>
      </div>

      <div className="volunteer-current">
        <p className="volunteer-label">Current volunteer</p>
        <strong>
          {currentVolunteer
            ? formatFullNameTitle(currentVolunteer.name)
            : "No volunteer selected"}
        </strong>
        <span>
          {currentVolunteer
            ? `${currentVolunteer.points || 0} pt${
                currentVolunteer.points === 1 ? "" : "s"
              }`
            : "Queue is empty"}
        </span>
      </div>

      <div className="volunteer-actions">
        <button
          type="button"
          className="volunteer-accept-btn"
          onClick={onAcceptVolunteer}
          disabled={!actionsEnabled}
        >
          {saving ? "Saving..." : "Accept Volunteer"}
        </button>
        <button
          type="button"
          className={`volunteer-skip-btn ${skipFxActive ? "is-skip-fx" : ""}`}
          onClick={onSkipVolunteer}
          disabled={!actionsEnabled}
        >
          Skip
        </button>
      </div>

      <ol className="volunteer-list">
        {queue.length === 0 ? (
          <li className="volunteer-empty">No volunteers in queue.</li>
        ) : (
          queue.map((student, index) => (
            <li key={student.id}>
              <span>{index + 1}</span>
              <div>
                <strong title={student.name}>
                  {formatStudentShort(student.name)}
                </strong>
                <small>{formatFullNameTitle(student.name)}</small>
              </div>
            </li>
          ))
        )}
      </ol>
    </section>
  );
}

export default VolunteerQueue;
