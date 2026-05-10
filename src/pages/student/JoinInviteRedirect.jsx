import { Navigate, useParams } from "react-router-dom";

export default function JoinInviteRedirect() {
  const { classCode = "" } = useParams();
  const inviteCode = encodeURIComponent(classCode.trim());

  return <Navigate to={`/student/classes?join=${inviteCode}`} replace />;
}
