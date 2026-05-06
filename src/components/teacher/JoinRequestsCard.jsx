import { formatFullNameTitle } from "../../utils/studentDisplay";

function JoinRequestsCard({ requests = [], onApprove }) {
  if (requests.length === 0) return null;

  return (
    <section className="join-request-card">
      <div className="student-list-head">
        <div>
          <h3>Join Requests</h3>
          <p>Students who missed the 15-minute entry window.</p>
        </div>
      </div>

      <div className="join-request-list">
        {requests.map((request) => {
          const student = Array.isArray(request.students)
            ? request.students[0]
            : request.students;
          const studentName = student?.name || student?.email || "Student";

          return (
            <div className="join-request-row" key={request.id}>
              <div>
                <strong>{formatFullNameTitle(studentName)}</strong>
                <span>Requesting to join the live session.</span>
              </div>
              <button type="button" onClick={() => onApprove(request)}>
                Approve
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default JoinRequestsCard;
