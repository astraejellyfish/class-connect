import {
  formatFullNameTitle,
  formatStudentShort,
} from "../../utils/studentDisplay";

function VolunteerQueue({ queue = [] }) {
  return (
    <section className="student-session-card student-volunteer-card">
      <div className="student-volunteer-head">
        <div>
          <h2>Volunteer Queue</h2>
        </div>
        <span>{queue.length}</span>
      </div>

      <ol className="student-volunteer-list">
        {queue.length === 0 ? (
          <li className="student-volunteer-empty">No volunteers in queue.</li>
        ) : (
          queue.map((item, index) => (
            <li key={item.queueId}>
              <span>{index + 1}</span>
              <div>
                <strong>{formatStudentShort(item.name)}</strong>
                <small>{formatFullNameTitle(item.name)}</small>
              </div>
            </li>
          ))
        )}
      </ol>
    </section>
  );
}

export default VolunteerQueue;
