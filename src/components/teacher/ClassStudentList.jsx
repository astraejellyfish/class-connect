import { formatStudentShort } from "../../utils/studentDisplay";

function ClassStudentList({
  students = [],
  sessionActive = false,
  presentCount = 0,
  isOpen = false,
  removeMode = false,
  selectedStudentIds,
  onToggleOpen,
  onRemoveClick,
  onCancelRemove,
  onToggleStudentSelection,
}) {
  return (
    <section className="student-list-card">
      <div className="student-list-head">
        <div>
          <h3>Students in class</h3>
          {sessionActive && <p>{`Present: ${presentCount} / ${students.length}`}</p>}
        </div>
        <div className="student-list-actions">
          <button
            type="button"
            className="student-list-toggle"
            onClick={onToggleOpen}
            aria-expanded={isOpen}
          >
            {isOpen ? "Hide" : "Show"}
          </button>
          <button
            type="button"
            className="student-remove-selected-btn"
            onClick={onRemoveClick}
            disabled={removeMode && selectedStudentIds.size === 0}
          >
            {removeMode
              ? selectedStudentIds.size > 0
                ? `Remove (${selectedStudentIds.size})`
                : "Select students"
              : "Remove"}
          </button>
          {removeMode && (
            <button
              type="button"
              className="student-list-toggle"
              onClick={onCancelRemove}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className={`student-list ${isOpen ? "is-open" : ""}`}>
        {students.length === 0 ? (
          <div className="student-row student-row-empty">
            <div>
              <strong>No student users yet</strong>
              <span className="student-full-name">
                Students who join this class will appear here.
              </span>
            </div>
          </div>
        ) : (
          students.map((student) => (
            <div
              className={`student-row ${
                selectedStudentIds.has(student.id) ? "is-selected" : ""
              }`}
              key={student.id}
            >
              {removeMode && (
                <label className="student-select-check">
                  <input
                    type="checkbox"
                    checked={selectedStudentIds.has(student.id)}
                    onChange={() => onToggleStudentSelection(student.id)}
                  />
                  <span>Select</span>
                </label>
              )}
              <div>
                <strong title={student.name}>{formatStudentShort(student.name)}</strong>
                <span className="student-full-name">{student.name}</span>
                <span>Points: {student.points ?? 0}</span>
              </div>

              {sessionActive && (
                <span className={student.present ? "present-badge" : "absent-badge"}>
                  {student.present ? "Present" : "Absent"}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default ClassStudentList;
