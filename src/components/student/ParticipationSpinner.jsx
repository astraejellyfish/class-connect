import {
  formatFullNameTitle,
  formatStudentShort,
} from "../../utils/studentDisplay";

const PALETTE = [
  "#2f7a45",
  "#ffe06b",
  "#e93f4f",
  "#4b82f0",
  "#c084fc",
  "#14b8a6",
  "#f97316",
  "#64748b",
];

function ParticipationSpinner({
  students,
  selectedStudent,
  spinning,
  pendingPick = null,
  pickOutcome = null,
  spinRotation = 0,
}) {
  const maxSegments = 40;
  const visibleStudents = students.slice(0, maxSegments);
  const n = visibleStudents.length || 1;

  const wheelPx = Math.min(440, Math.max(200, 130 + n * 7.5));
  const radius = wheelPx / 2;
  const labelRadius = Math.max(radius - 26, 52);

  const segment = 360 / n;
  const selectedName = selectedStudent
    ? formatFullNameTitle(selectedStudent.name)
    : "No student selected";

  const getFontSizePx = (label) => {
    const len = label.length;
    if (n >= 32) return len > 14 ? 6 : len > 10 ? 7 : 8;
    if (n >= 24) return len > 14 ? 7 : len > 10 ? 8 : 9;
    if (n >= 16) return len > 14 ? 8 : len > 10 ? 9 : 10;
    if (n >= 10) return len > 12 ? 9 : 11;
    return len > 14 ? 10 : len > 10 ? 11 : 12;
  };

  const gradient = visibleStudents
    .map((_, index) => {
      const start = index * segment;
      const end = (index + 1) * segment;
      const color = PALETTE[index % PALETTE.length];
      return `${color} ${start}deg ${end}deg`;
    })
    .join(", ");

  return (
    <div
      className="wheel-wrap"
      style={{ "--wheel-size": `${wheelPx}px`, "--label-r": `${labelRadius}px` }}
    >
      <div className="wheel-pointer" aria-hidden>
        ▼
      </div>

      <div
        className={`wheel ${spinning ? "wheel-spinning" : ""}`}
        style={{
          width: wheelPx,
          height: wheelPx,
          background: `conic-gradient(${gradient})`,
          transform: `rotate(${spinRotation}deg)`,
        }}
      >
        {visibleStudents.map((student, index) => {
          const label = formatStudentShort(student.name);
          const fontSize = getFontSizePx(label);

          return (
            <span
              className="wheel-name"
              key={student.id}
              style={{
                fontSize: `${fontSize}px`,
                transform: `translate(-50%, -50%) rotate(${
                  index * segment + segment / 2
                }deg) translateY(calc(-1 * var(--label-r))) rotate(90deg)`,
              }}
            >
              {label}
            </span>
          );
        })}

        <div className="wheel-center" />
      </div>

      <div
        className={`selection-status ${
          pendingPick
            ? "selection-status--pending"
            : pickOutcome
              ? `selection-status--${pickOutcome.kind.toLowerCase()}`
              : ""
        }`}
      >
        <span className="selection-status-kicker">
          {spinning
            ? "Selecting"
            : pendingPick
              ? "Waiting for teacher confirmation"
              : pickOutcome
                ? pickOutcome.kind === "Yes"
                  ? "Points awarded"
                  : "No points awarded"
                : "Selection status"}
        </span>
        <strong>
          {spinning
            ? "Spinning..."
            : selectedStudent
              ? selectedName
              : "No student selected"}
        </strong>
        <span className="selection-status-meta">
          {pendingPick
            ? `${pendingPick.pts} pt${pendingPick.pts === 1 ? "" : "s"} pending`
            : pickOutcome
              ? pickOutcome.kind === "Yes"
                ? `+${pickOutcome.pts} pt${pickOutcome.pts === 1 ? "" : "s"}`
                : `0 pts, offered ${pickOutcome.offered}`
              : "Watch for your teacher's next selection"}
        </span>
      </div>

      {students.length > maxSegments && (
        <p className="wheel-cap-note">
          Showing first {maxSegments} students on the wheel.
        </p>
      )}
    </div>
  );
}

export default ParticipationSpinner;
