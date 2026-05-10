import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { requireTeacher } from "../../features/authRole";

import "../../styles/teacher/dashboard.css";
import "../../styles/teacher/classpage.css";

import ActivityPanel from "../../components/teacher/ActivityPanel";
import AiToolsCard from "../../components/teacher/AiToolsCard";
import AskAiModal from "../../components/teacher/AskAiModal";
import ClassDetailsModal from "../../components/teacher/ClassDetailsModal";
import ClassPageHeader from "../../components/teacher/ClassPageHeader";
import ClassStudentList from "../../components/teacher/ClassStudentList";
import ConfirmModal from "../../components/common/ConfirmModal";
import AppLoadingScreen from "../../components/shared/AppLoadingScreen";
import BottomNav, { teacherBottomNavItems } from "../../components/shared/BottomNav";
import JoinRequestsCard from "../../components/teacher/JoinRequestsCard";
import TeacherSidebar from "../../components/shared/TeacherSidebar";
import TeacherParticipationPanel from "../../components/teacher/TeacherParticipationPanel";
import SummaryPreviewModal from "../../components/common/SummaryPreviewModal";
import { useAudioControls } from "../../hooks/useAudioControls";
import { useTeacherParticipationActions } from "../../hooks/UseParticipation";
import { useTeacherClassSession } from "../../hooks/useSession";
import { useTeacherSettings } from "../../hooks/useTeacherSettings";
import {
  formatFullNameTitle,
  formatStudentShort,
} from "../../utils/studentDisplay";

const PICK_RESPONSE_SECONDS = 10;
const ENDED_SESSION_LOG_RETENTION_MS = 2 * 60 * 60 * 1000;
const AI_LOG_PATTERNS = [/^AI summary/i, /^Ask AI/i];

function isAiToolLog(message) {
  return AI_LOG_PATTERNS.some((pattern) => pattern.test(String(message || "")));
}

function getLastNameSortKey(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const last = parts.length > 1 ? parts[parts.length - 1] : parts[0] || "";
  return `${last} ${parts.join(" ")}`.toLowerCase();
}

function mapClassMember(row, pointsByStudentId) {
  const student = Array.isArray(row.students) ? row.students[0] : row.students;

  const displayName =
    student?.name ||
    student?.full_name ||
    [student?.first_name, student?.last_name].filter(Boolean).join(" ") ||
    student?.email ||
    student?.student_id ||
    "Unnamed student";

  return {
    id: row.student_id,
    membershipId: row.id,
    name: displayName,
    studentId: student?.student_id,
    email: student?.email,
    points: pointsByStudentId[row.student_id] ?? 0,
    joinedAt: row.joined_at,
    entryConfirmed: row.entry_confirmed ?? false,
    present: row.entry_confirmed === true,
  };
}

function mapVolunteerRow(row, studentsById) {
  const student = Array.isArray(row.students) ? row.students[0] : row.students;
  const displayName =
    student?.name ||
    student?.full_name ||
    [student?.first_name, student?.last_name].filter(Boolean).join(" ") ||
    student?.email ||
    student?.student_id ||
    "Unnamed student";
  const rosterStudent = studentsById[row.student_id];

  return {
    id: row.student_id,
    queueId: row.id,
    name: displayName,
    studentId: student?.student_id,
    email: student?.email,
    points: rosterStudent?.points ?? 0,
    present: rosterStudent?.present ?? false,
    createdAt: row.created_at,
  };
}

function buildLocalAiSummary(classData, logs, students, volunteerQueue) {
  const ranked = [...students].sort((a, b) => (b.points || 0) - (a.points || 0));
  const activeStudents = ranked
    .filter((student) => (student.points || 0) > 0)
    .slice(0, 5)
    .map((student) => formatFullNameTitle(student.name));
  const lowStudents = ranked
    .filter((student) => (student.points || 0) === 0)
    .map((student) => formatFullNameTitle(student.name));

  return {
    summary:
      logs.length > 0
        ? `${logs.length} class activity item${logs.length === 1 ? "" : "s"} recorded for ${
            classData?.subject || "this session"
          }.`
        : "No session activity has been recorded yet.",
    active_students: activeStudents,
    low_participation_students: lowStudents,
    volunteer_activity:
      volunteerQueue.length > 0
        ? `${volunteerQueue.length} student${volunteerQueue.length === 1 ? "" : "s"} currently in the volunteer queue.`
        : "No active volunteer queue entries.",
    recommendation:
      lowStudents.length > 0
        ? "Give the low/no participation students the first opportunity in the next activity."
        : "Participation looks balanced. Continue rotating questions across the class.",
    suggested_question:
      "Can someone explain the main idea from today's discussion in their own words?",
  };
}

function buildSummarySessionData({
  classData,
  teacherName,
  students,
  volunteerQueue,
  logs,
  participationStatsByStudentId,
  joinRequests,
  sessionActive,
}) {
  const totalPoints = students.reduce((sum, student) => sum + (student.points || 0), 0);
  const studentLines = students.map((student) => {
    const stats = participationStatsByStudentId[student.id] || {};
    return [
      formatFullNameTitle(student.name),
      `present: ${student.present ? "yes" : "no"}`,
      `times called: ${stats.timesCalled || 0}`,
      `points: ${stats.points ?? student.points ?? 0}`,
    ].join(", ");
  });

  return [
    `Teacher: ${teacherName}`,
    `Subject: ${classData?.subject || "N/A"}`,
    `Subject Code: ${classData?.subjectCode || "N/A"}`,
    `Class Code: ${classData?.classCode || "N/A"}`,
    `Program/Block: ${classData?.programBlock || "N/A"}`,
    `Session Active: ${sessionActive ? "Yes" : "No"}`,
    `Total Students: ${students.length}`,
    `Present Students: ${students.filter((student) => student.present).length}`,
    `Late/Pending Join Requests: ${joinRequests.length}`,
    `Total Points Given: ${totalPoints}`,
    "",
    "Students:",
    studentLines.length ? studentLines.join("\n") : "No students loaded.",
    "",
    "Volunteer Queue:",
    volunteerQueue.length
      ? volunteerQueue.map((item) => formatFullNameTitle(item.name)).join("\n")
      : "No active volunteer queue entries.",
    "",
    "Recent Session Logs:",
    logs.length
      ? logs.map((log) => `${log.time || ""} ${log.message}`.trim()).join("\n")
      : "No session activity logs recorded.",
  ].join("\n");
}

function normalizeAiSummaryResponse(summary) {
  if (!summary) return null;
  if (typeof summary === "string") {
    return {
      summary,
      volunteer_activity: "",
      recommendation: "",
      suggested_question: "",
    };
  }
  return summary;
}

function ClassPage() {
  const navigate = useNavigate();
  const { classId } = useParams();

  const [classData, setClassData] = useState(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [logs, setLogs] = useState([]);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummaryError, setAiSummaryError] = useState("");
  const [participationStatsByStudentId, setParticipationStatsByStudentId] = useState({});
  const [teacherName, setTeacherName] = useState("Teacher");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [spinRotation, setSpinRotation] = useState(0);
  const [students, setStudents] = useState([]);
  const [resolvingPick, setResolvingPick] = useState(false);
  const [savingVolunteer, setSavingVolunteer] = useState(false);
  const [volunteerQueue, setVolunteerQueue] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [awardPointsInput, setAwardPointsInput] = useState("1");
  const [inviteStatus, setInviteStatus] = useState("");
  const [classActionsOpen, setClassActionsOpen] = useState(false);
  const [showEditClassModal, setShowEditClassModal] = useState(false);
  const [savingClassDetails, setSavingClassDetails] = useState(false);
  const [classDetailsError, setClassDetailsError] = useState("");
  const [classDetailsForm, setClassDetailsForm] = useState({
    subject: "",
    subjectCode: "",
    classCode: "",
    programBlock: "",
  });
  const [selectedStudentIds, setSelectedStudentIds] = useState(() => new Set());
  const [studentRemoveMode, setStudentRemoveMode] = useState(false);
  const [showRemoveStudentsModal, setShowRemoveStudentsModal] = useState(false);
  const [removingStudents, setRemovingStudents] = useState(false);
  const [studentListOpen, setStudentListOpen] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showAskAiModal, setShowAskAiModal] = useState(false);
  const [askAiPrompt, setAskAiPrompt] = useState("");
  const [askAiAnswer, setAskAiAnswer] = useState("");
  const [askAiLoading, setAskAiLoading] = useState(false);
  const [askAiError, setAskAiError] = useState("");
  const [showClassSaveConfirm, setShowClassSaveConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  /** After spin: wait for selected student accept / skip response before awarding pts. */
  const [pendingPick, setPendingPick] = useState(null);
  /** Last resolved pick for spinner footer */
  const [pickOutcome, setPickOutcome] = useState(null);
  const [selectionRequestUnavailable, setSelectionRequestUnavailable] = useState(false);
  const teacherSettings = useTeacherSettings();
  const [sessionSelectedStudentIds, setSessionSelectedStudentIds] = useState(
    () => new Set()
  );
  const {
    skipFxActive,
    playNotificationSound,
    playResultSound,
    playAcceptSound,
    playSkipSound,
    playCountdownSound,
    restartSessionMusic,
    pauseSessionMusic,
  } = useAudioControls({
    sessionActive,
    countdownSeconds: PICK_RESPONSE_SECONDS,
  });

  const addLog = useCallback((message, options = {}) => {
    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    setLogs((prev) => [{ time, message, createdAt: new Date().toISOString() }, ...prev]);

    supabase
      .from("class_session_logs")
      .insert({
        class_id: classId,
        teacher_id: classData?.teacherId,
        session_started_at: options.sessionStartedAt || classData?.sessionStartedAt,
        message,
      })
      .then(({ error }) => {
        if (error) {
          console.warn("Could not save session log:", error);
        }
      });
  }, [classData?.sessionStartedAt, classData?.teacherId, classId]);

  const { handleStartSession, handleEndSession } = useTeacherClassSession({
    classId,
    addLog,
    restartSessionMusic,
    pauseSessionMusic,
    setSessionActive,
    setClassData,
    setStudents,
    setSelectedStudent,
    setPendingPick,
    setPickOutcome,
    setSessionSelectedStudentIds,
    setVolunteerQueue,
    setLogs,
    endedLogRetentionMs: ENDED_SESSION_LOG_RETENTION_MS,
  });

  const { resolvePick, spinStudent, acceptVolunteer, skipVolunteer } =
    useTeacherParticipationActions({
      classId,
      students,
      spinning,
      pendingPick,
      awardPointsInput,
      teacherSettings,
      sessionSelectedStudentIds,
      volunteerQueue,
      savingVolunteer,
      pickResponseSeconds: PICK_RESPONSE_SECONDS,
      addLog,
      setResolvingPick,
      setStudents,
      setPickOutcome,
      setPendingPick,
      setSpinning,
      setSpinRotation,
      setSelectedStudent,
      setSessionSelectedStudentIds,
      setSelectionRequestUnavailable,
      setSavingVolunteer,
      setVolunteerQueue,
      playAcceptSound,
      playSkipSound,
      playResultSound,
      playCountdownSound,
    });

  useEffect(() => {
    let cancelled = false;

    async function fetchClass() {
      setLoading(true);
      setLoadError("");

      const account = await requireTeacher(navigate);
      if (!account || cancelled) {
        return;
      }
      setTeacherName(
        account.teacherProfile?.name ||
          account.user.user_metadata?.name ||
          account.user.user_metadata?.full_name ||
          "Teacher"
      );

      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .eq("id", classId)
        .eq("teacher_id", account.user.id)
        .single();

      if (cancelled) return;

      if (error) {
        console.error(error);
        setLoadError("Could not load this class.");
        setLoading(false);
        return;
      }

      setClassData({
        id: data.id,
        subject: data.class_name,
        className: data.class_name,
        subjectCode: data.subject_code,
        classCode: data.class_code,
        programBlock: data.program,
        program: data.program,
        teacherId: data.teacher_id,
        sessionActive: Boolean(data.session_active),
        sessionStartedAt: data.session_started_at,
      });
      setClassDetailsForm({
        subject: data.class_name || "",
        subjectCode: data.subject_code || "",
        classCode: data.class_code || "",
        programBlock: data.program || "",
      });
      setSessionActive(Boolean(data.session_active));

      const [
        { data: memberRows, error: membersError },
        { data: participationRows, error: participationError },
        { data: volunteerRows, error: volunteerError },
        { data: requestRows, error: requestError },
        { data: selectionRows, error: selectionError },
        { data: logRows, error: logError },
        { data: summaryRows, error: summaryError },
      ] = await Promise.all([
        supabase
          .from("class_members")
          .select("id, class_id, student_id, joined_at, entry_confirmed, students(id, name, email, student_id)")
          .eq("class_id", classId),
        supabase
          .from("participation")
          .select("student_id, points")
          .eq("class_id", classId),
        supabase
          .from("volunteer_queue")
          .select("id, class_id, student_id, status, created_at, students(id, name, email, student_id)")
          .eq("class_id", classId)
          .eq("status", "waiting")
          .order("created_at", { ascending: true }),
        supabase
          .from("session_join_requests")
          .select("id, class_id, student_id, membership_id, status, created_at, students(id, name, email, student_id)")
          .eq("class_id", classId)
          .eq("status", "pending")
          .order("created_at", { ascending: true }),
        supabase
          .from("participation_selection_requests")
          .select("id, class_id, student_id, points, status, created_at, expires_at")
          .eq("class_id", classId)
          .in("status", ["pending", "accepted", "skip_requested"])
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("class_session_logs")
          .select("message, created_at")
          .eq("class_id", classId)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("ai_summaries")
          .select("*")
          .eq("class_id", classId)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      if (cancelled) return;

      if (membersError) {
        console.error(membersError);
        setLoadError("Could not load class members.");
        setLoading(false);
        return;
      }

      if (participationError) {
        console.error(participationError);
        setLoadError("Could not load participation points.");
        setLoading(false);
        return;
      }

      if (volunteerError) {
        console.warn("Volunteer queue is unavailable:", volunteerError);
      }

      if (requestError) {
        console.warn("Join requests are unavailable:", requestError);
      }

      if (selectionError) {
        console.warn("Selection requests are unavailable:", selectionError);
        setSelectionRequestUnavailable(true);
      }

      if (logError) {
        console.warn("Session logs are unavailable:", logError);
      }

      if (summaryError) {
        console.warn("AI summaries are unavailable:", summaryError);
      }

      const pointsByStudentId = (participationRows || []).reduce((acc, row) => {
        acc[row.student_id] = (acc[row.student_id] || 0) + (row.points || 0);
        return acc;
      }, {});
      const statsByStudentId = (participationRows || []).reduce((acc, row) => {
        const current = acc[row.student_id] || { timesCalled: 0, points: 0 };
        acc[row.student_id] = {
          timesCalled: current.timesCalled + 1,
          points: current.points + (row.points || 0),
        };
        return acc;
      }, {});

      const roster = (memberRows || [])
        .map((row) => mapClassMember(row, pointsByStudentId))
        .sort((a, b) => getLastNameSortKey(a.name).localeCompare(getLastNameSortKey(b.name)));
      const studentsById = roster.reduce((acc, student) => {
        acc[student.id] = student;
        return acc;
      }, {});

      setStudents(roster);
      setParticipationStatsByStudentId(statsByStudentId);
      const latestEndLog = (logRows || []).find((row) => row.message === "Session ended.");
      const endedAt = latestEndLog
        ? new Date(latestEndLog.created_at).getTime()
        : Number.NaN;
      const logsExpired =
        !data.session_active &&
        Number.isFinite(endedAt) &&
        Date.now() - endedAt > ENDED_SESSION_LOG_RETENTION_MS;
      const visibleLogRows = logError || logsExpired ? [] : logRows || [];

      setLogs(
        visibleLogRows.map((row) => ({
              time: new Date(row.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
              message: row.message,
              isAiTool: isAiToolLog(row.message),
              createdAt: row.created_at,
            }))
      );
      setAiSummary(summaryError ? null : summaryRows?.[0] || null);
      setVolunteerQueue(
        volunteerError
          ? []
          : (volunteerRows || []).map((row) => mapVolunteerRow(row, studentsById))
      );
      setJoinRequests(requestError ? [] : requestRows || []);
      const activeSelection = selectionRows?.[0];
      if (!selectionError && activeSelection) {
        const selected = studentsById[activeSelection.student_id];
        if (selected) {
          setSelectedStudent(selected);
          setPendingPick({
            student: selected,
            pts: activeSelection.points,
            requestId: activeSelection.id,
            responseStatus: activeSelection.status,
            expiresAt: activeSelection.expires_at,
          });
        }
      }

      setLoading(false);
    }

    fetchClass();
    return () => {
      cancelled = true;
    };
  }, [classId, navigate]);

  const handleGenerateAiSummary = async () => {
    setAiSummaryLoading(true);
    setAiSummaryError("");

    const sessionData = buildSummarySessionData({
      classData,
      teacherName,
      students,
      volunteerQueue,
      logs,
      participationStatsByStudentId,
      joinRequests,
      sessionActive,
    });

    const { data, error } = await supabase.functions.invoke("generate-summary", {
      body: { sessionData },
    });

    setAiSummaryLoading(false);

    if (error) {
      console.error(error);
      let details = error.message || "Please check the Edge Function deployment.";
      try {
        const contextData = await error.context?.json?.();
        details =
          contextData?.details ||
          (contextData?.error === "Gemini request failed" ? "" : contextData?.error) ||
          details;
      } catch {
        // Keep the Supabase client error message.
      }

      setAiSummary(buildLocalAiSummary(classData, logs, students, volunteerQueue));
      setShowSummaryModal(true);
      setAiSummaryError(`AI service unavailable: ${details}. Showing a local summary.`);
      return;
    }

    setAiSummary(normalizeAiSummaryResponse(data?.summary));
    setShowSummaryModal(true);
  };

  const confirmStudentEntry = async (student) => {
    if (!student?.membershipId) return;

    const { error } = await supabase
      .from("class_members")
      .update({ entry_confirmed: true })
      .eq("id", student.membershipId);

    if (error) {
      console.error(error);
      addLog(`Could not confirm entry for ${formatStudentShort(student.name)}.`);
      return;
    }

    setStudents((prev) =>
      prev.map((item) =>
        item.membershipId === student.membershipId
          ? { ...item, entryConfirmed: true, present: true }
          : item
      )
    );
    addLog(`${formatStudentShort(student.name)} entry confirmed.`);
  };

  const approveJoinRequest = async (request) => {
    if (!request?.membership_id) return;

    const [{ error: memberError }, { error: requestError }] = await Promise.all([
      supabase
        .from("class_members")
        .update({ entry_confirmed: true })
        .eq("id", request.membership_id),
      supabase
        .from("session_join_requests")
        .update({
          status: "approved",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", request.id),
    ]);

    if (memberError || requestError) {
      console.error(memberError || requestError);
      addLog("Could not approve join request. Please try again.");
      return;
    }

    setStudents((prev) =>
      prev.map((student) =>
        student.membershipId === request.membership_id
          ? { ...student, entryConfirmed: true, present: true }
          : student
      )
    );
    setJoinRequests((prev) => prev.filter((item) => item.id !== request.id));
    addLog("Join request approved.");
    playAcceptSound();
  };

  const handleCopyInvite = async () => {
    const link = `${window.location.origin}/student/join/${classData.classCode}`;

    try {
      await navigator.clipboard.writeText(link);
      setInviteStatus("Invite link copied");
    } catch (error) {
      console.error(error);
      setInviteStatus("Unable to copy invite link");
    }

    setTimeout(() => setInviteStatus(""), 2200);
  };

  const handleClassDetailsChange = (field, value) => {
    setClassDetailsForm((prev) => ({ ...prev, [field]: value }));
  };

  const validateClassDetails = () => {
    setClassDetailsError("");

    const nextDetails = {
      class_name: classDetailsForm.subject.trim(),
      subject_code: classDetailsForm.subjectCode.trim(),
      class_code: classDetailsForm.classCode.trim(),
      program: classDetailsForm.programBlock.trim(),
    };

    if (
      !nextDetails.class_name ||
      !nextDetails.subject_code ||
      !nextDetails.class_code ||
      !nextDetails.program
    ) {
      setClassDetailsError("Please fill in all class details.");
      return null;
    }

    return nextDetails;
  };

  const handleSaveClassDetails = (event) => {
    event.preventDefault();
    if (!validateClassDetails()) return;
    setShowClassSaveConfirm(true);
  };

  const confirmSaveClassDetails = async () => {
    const nextDetails = validateClassDetails();
    if (!nextDetails) return;

    setSavingClassDetails(true);
    const { data, error } = await supabase
      .from("classes")
      .update(nextDetails)
      .eq("id", classId)
      .select("id, class_name, subject_code, class_code, program, teacher_id, session_active, session_started_at")
      .single();
    setSavingClassDetails(false);

    if (error) {
      console.error(error);
      setClassDetailsError("Could not update class details.");
      return;
    }

    setClassData((prev) => ({
      ...prev,
      id: data.id,
      subject: data.class_name,
      className: data.class_name,
      subjectCode: data.subject_code,
      classCode: data.class_code,
      programBlock: data.program,
      program: data.program,
      teacherId: data.teacher_id,
      sessionActive: Boolean(data.session_active),
      sessionStartedAt: data.session_started_at,
    }));
    setClassDetailsForm({
      subject: data.class_name || "",
      subjectCode: data.subject_code || "",
      classCode: data.class_code || "",
      programBlock: data.program || "",
    });
    setShowEditClassModal(false);
    setShowClassSaveConfirm(false);
    addLog("Class details updated.");
  };

  const toggleStudentSelection = (studentId) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const handleOpenRemoveStudentsModal = () => {
    const selectedStudents = students.filter((student) =>
      selectedStudentIds.has(student.id)
    );
    if (selectedStudents.length === 0 || removingStudents) return;
    setShowRemoveStudentsModal(true);
  };

  const handleRemoveSelectedStudents = async () => {
    const selectedStudents = students.filter((student) =>
      selectedStudentIds.has(student.id)
    );
    if (selectedStudents.length === 0 || removingStudents) return;
    const studentIds = selectedStudents.map((student) => student.id);
    const membershipIds = selectedStudents
      .map((student) => student.membershipId)
      .filter(Boolean);

    setRemovingStudents(true);
    const [
      { error: queueError },
      { error: requestError },
      { error: selectionError },
      { error: memberError },
    ] = await Promise.all([
      supabase.from("volunteer_queue").delete().eq("class_id", classId).in("student_id", studentIds),
      supabase.from("session_join_requests").delete().eq("class_id", classId).in("student_id", studentIds),
      supabase.from("participation_selection_requests").delete().eq("class_id", classId).in("student_id", studentIds),
      supabase.from("class_members").delete().in("id", membershipIds),
    ]);
    setRemovingStudents(false);

    const error = memberError || queueError || requestError || selectionError;
    if (error) {
      console.error(error);
      addLog("Could not remove selected students.");
      return;
    }

    setSelectedStudentIds(new Set());
    setStudentRemoveMode(false);
    setShowRemoveStudentsModal(false);
    setStudents((prev) => prev.filter((item) => !selectedStudentIds.has(item.id)));
    setVolunteerQueue((prev) => prev.filter((item) => !selectedStudentIds.has(item.id)));
    setJoinRequests((prev) =>
      prev.filter((item) => !selectedStudentIds.has(item.student_id))
    );
    addLog(
      selectedStudents.length === 1
        ? `${formatStudentShort(selectedStudents[0].name)} removed from class.`
        : `${selectedStudents.length} students removed from class.`
    );
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleAskAi = async () => {
    const prompt = askAiPrompt.trim();
    const fallbackPrompt =
      prompt ||
      `Give me classroom question suggestions for ${classData?.subject || "this class"}.`;
    const lowStudents = students
      .filter((student) => (student.points || 0) === 0)
      .slice(0, 5)
      .map((student) => formatStudentShort(student.name));
    const topStudent = topScorers[0];
    const question = [
      fallbackPrompt,
      "",
      "Class context:",
      `Subject: ${classData?.subject || "N/A"}`,
      `Subject code: ${classData?.subjectCode || "N/A"}`,
      `Program/block: ${classData?.programBlock || "N/A"}`,
      `Session active: ${sessionActive ? "yes" : "no"}`,
      `Present students: ${presentCount} of ${students.length}`,
      lowStudents.length
        ? `Low/no participation: ${lowStudents.join(", ")}`
        : "Low/no participation: none recorded",
      topStudent
        ? `Top scorer: ${formatStudentShort(topStudent.name)} with ${
            topStudent.points || 0
          } point${topStudent.points === 1 ? "" : "s"}`
        : "Top scorer: none yet",
    ].join("\n");

    setAskAiLoading(true);
    setAskAiError("");

    const { data, error } = await supabase.functions.invoke("ask-ai", {
      body: { question },
    });

    setAskAiLoading(false);

    if (error) {
      console.error(error);
      let details = error.message || "Please check the Edge Function deployment.";
      try {
        const contextData = await error.context?.json?.();
        details = contextData?.error || contextData?.details || details;
      } catch {
        // Keep the Supabase client error message.
      }

      setAskAiAnswer("");
      setAskAiError(`AI service unavailable: ${details}`);
      return;
    }

    setAskAiAnswer(data?.answer || "No answer generated.");
  };

  const presentCount = useMemo(
    () => students.filter((s) => s.present).length,
    [students]
  );

  const eligiblePresentCount = useMemo(
    () =>
      students.filter(
        (s) =>
          s.present &&
          (teacherSettings.repeatSelection || !sessionSelectedStudentIds.has(s.id))
      ).length,
    [students, teacherSettings.repeatSelection, sessionSelectedStudentIds]
  );

  const latestEndLog = useMemo(
    () => logs.find((log) => log.message === "Session ended."),
    [logs]
  );

  const topScorers = useMemo(
    () =>
      [...students]
        .sort((a, b) => (b.points || 0) - (a.points || 0))
        .slice(0, 5),
    [students]
  );

  const aiSummarySections = useMemo(() => {
    if (!aiSummary) return [];

    const startedAt = classData?.sessionStartedAt
      ? new Date(classData.sessionStartedAt)
      : null;
    const endedAt =
      !sessionActive && latestEndLog?.createdAt ? new Date(latestEndLog.createdAt) : null;
    const formatDate = (date) =>
      date && Number.isFinite(date.getTime()) ? date.toLocaleDateString() : "N/A";
    const formatTime = (date) =>
      date && Number.isFinite(date.getTime())
        ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "N/A";
    const duration =
      startedAt &&
      endedAt &&
      Number.isFinite(startedAt.getTime()) &&
      Number.isFinite(endedAt.getTime())
        ? `${Math.max(1, Math.round((endedAt - startedAt) / 60000))} min`
        : sessionActive
          ? "Ongoing"
          : "N/A";
    const activeParticipants = students
      .filter((student) => (participationStatsByStudentId[student.id]?.timesCalled || 0) > 0)
      .map((student) => {
        const stats = participationStatsByStudentId[student.id] || {};
        return `${formatFullNameTitle(student.name)} | ${
          stats.timesCalled || 0
        } | ${stats.points || 0} pt${stats.points === 1 ? "" : "s"}`;
      });
    const lowParticipants = students
      .filter((student) => (participationStatsByStudentId[student.id]?.timesCalled || 0) === 0)
      .map((student) => `${formatFullNameTitle(student.name)} | Not Called`);
    const totalPoints = students.reduce((sum, student) => sum + (student.points || 0), 0);
    const averagePoints =
      students.length > 0 ? (totalPoints / students.length).toFixed(1) : "0";
    const highest = topScorers[0];
    const volunteerNames = volunteerQueue.map((item) => formatFullNameTitle(item.name));

    return [
      {
        label: "Class Connect",
        value: `Class Connect - LEVEL UP YOUR CLASS\nInstitution: Gordon College - College of Computer Studies\nInstructor: ${teacherName}\nSubject: ${
          classData?.subject || "N/A"
        }\nClass Code: ${classData?.classCode || "N/A"}\nProgram/Block: ${
          classData?.programBlock || "N/A"
        }`,
      },
      {
        label: "Session Details",
        value: `Session Title: Recitation 1\nDate: ${formatDate(
          startedAt || new Date()
        )}\nTime Started: ${formatTime(startedAt)}\nTime Ended: ${formatTime(
          endedAt
        )}\nDuration: ${duration}\nTotal Students Present: ${presentCount}\nLate Entries (after 15 min): ${joinRequests.length}`,
      },
      {
        label: "Overall Participation Summary (AI Generated)",
        value: aiSummary.summary || "No overview available.",
      },
      {
        label: "Participation Breakdown - Active Participants",
        table: {
          headers: ["Student Name", "Times Called", "Points Earned"],
          rows: activeParticipants.length
            ? students
                .filter(
                  (student) =>
                    (participationStatsByStudentId[student.id]?.timesCalled || 0) > 0
                )
                .map((student) => {
                  const stats = participationStatsByStudentId[student.id] || {};
                  return [
                    formatFullNameTitle(student.name),
                    stats.timesCalled || 0,
                    `${stats.points || 0} pt${stats.points === 1 ? "" : "s"}`,
                  ];
                })
            : [["No active participants recorded.", "-", "-"]],
        },
      },
      {
        label: "Participation Breakdown - Low / No Participation",
        table: {
          headers: ["Student Name", "Status"],
          rows: lowParticipants.length
            ? students
                .filter(
                  (student) =>
                    (participationStatsByStudentId[student.id]?.timesCalled || 0) === 0
                )
                .map((student) => [formatFullNameTitle(student.name), "Not Called"])
            : [["No low participation students listed.", "-"]],
        },
      },
      {
        label: "Volunteer Activity",
        value: `${volunteerNames.length ? volunteerNames.join("\n") : "No volunteer activity noted."}\n\nAI Insight: ${
          aiSummary.volunteer_activity ||
          "Volunteer activity can indicate willingness to participate."
        }`,
      },
      {
        label: "Point Distribution",
        value: `Total Points Given: ${totalPoints}\nAverage Points per Student: ${averagePoints}\nHighest Points Earned: ${
          highest
            ? `${formatFullNameTitle(highest.name)} - ${highest.points || 0} pts`
            : "N/A"
        }`,
      },
      {
        label: "Engagement Analysis (AI)",
        value:
          aiSummary.recommendation ||
          "The class engagement level can be reviewed after more participation is recorded.",
      },
      {
        label: "Recommendations (AI Generated)",
        value: `Prioritize students with low participation in the next session\nEncourage quieter students using the volunteer feature\nMaintain current pacing and question difficulty\n${aiSummary.suggested_question ? `Suggested question: ${aiSummary.suggested_question}` : ""}`,
      },
      {
        label: "System Notes",
        value:
          "Weighted Random Selection was used to ensure fairness\nVolunteer queue was recorded and prioritized\nParticipation tracking is based on real-time session logs",
      },
      {
        label: "Generated By",
        value: `Generated by Class Connect AI Assistant\nDate Generated: ${new Date().toLocaleString()}`,
      },
    ];
  }, [
    aiSummary,
    classData,
    joinRequests.length,
    latestEndLog,
    participationStatsByStudentId,
    presentCount,
    sessionActive,
    students,
    teacherName,
    topScorers,
    volunteerQueue,
  ]);

  const refreshRosterState = useCallback(async () => {
    const [{ data: memberRows, error: membersError }, { data: participationRows }] =
      await Promise.all([
        supabase
          .from("class_members")
          .select("id, class_id, student_id, joined_at, entry_confirmed, students(id, name, email, student_id)")
          .eq("class_id", classId),
        supabase
          .from("participation")
          .select("student_id, points")
          .eq("class_id", classId),
      ]);

    if (membersError) {
      console.warn("Could not refresh roster:", membersError);
      return;
    }

    const pointsByStudentId = (participationRows || []).reduce((acc, row) => {
      acc[row.student_id] = (acc[row.student_id] || 0) + (row.points || 0);
      return acc;
    }, {});
    const statsByStudentId = (participationRows || []).reduce((acc, row) => {
      const current = acc[row.student_id] || { timesCalled: 0, points: 0 };
      acc[row.student_id] = {
        timesCalled: current.timesCalled + 1,
        points: current.points + (row.points || 0),
      };
      return acc;
    }, {});

    setStudents(
      (memberRows || [])
        .map((row) => mapClassMember(row, pointsByStudentId))
        .sort((a, b) => getLastNameSortKey(a.name).localeCompare(getLastNameSortKey(b.name)))
    );
    setParticipationStatsByStudentId(statsByStudentId);
  }, [classId]);

  const refreshVolunteerQueue = useCallback(async () => {
    const { data, error } = await supabase
      .from("volunteer_queue")
      .select("id, class_id, student_id, status, created_at, students(id, name, email, student_id)")
      .eq("class_id", classId)
      .eq("status", "waiting")
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("Could not refresh volunteer queue:", error);
      return;
    }

    const studentsById = students.reduce((acc, student) => {
      acc[student.id] = student;
      return acc;
    }, {});

    setVolunteerQueue((data || []).map((row) => mapVolunteerRow(row, studentsById)));
  }, [classId, students]);

  const refreshJoinRequests = useCallback(async () => {
    const { data, error } = await supabase
      .from("session_join_requests")
      .select("id, class_id, student_id, membership_id, status, created_at, students(id, name, email, student_id)")
      .eq("class_id", classId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("Could not refresh join requests:", error);
      return;
    }

    setJoinRequests(data || []);
  }, [classId]);

  const refreshSelectionRequest = useCallback(async () => {
    const { data, error } = await supabase
      .from("participation_selection_requests")
      .select("id, class_id, student_id, points, status, created_at, expires_at")
      .eq("class_id", classId)
      .in("status", ["pending", "accepted", "skip_requested"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.warn("Could not refresh selection request:", error);
      setSelectionRequestUnavailable(true);
      return;
    }

    const request = data?.[0];
    if (!request) return;

    const student = students.find((item) => item.id === request.student_id);
    if (!student) return;

    if (request.status === "accepted") {
      setPendingPick((current) =>
        current?.requestId === request.id
          ? { ...current, responseStatus: request.status }
          : {
              student,
              pts: request.points,
              requestId: request.id,
              responseStatus: request.status,
              expiresAt: request.expires_at,
            }
      );
      return;
    }

    if (request.status === "skip_requested") {
      setPendingPick((current) =>
        current?.requestId === request.id
          ? { ...current, responseStatus: request.status }
          : {
              student,
              pts: request.points,
              requestId: request.id,
              responseStatus: request.status,
              expiresAt: request.expires_at,
            }
      );
      return;
    }

    setSelectedStudent(student);
    setPendingPick((current) =>
      current?.requestId === request.id
        ? { ...current, responseStatus: request.status, expiresAt: request.expires_at }
        : {
            student,
            pts: request.points,
            requestId: request.id,
            responseStatus: request.status,
            expiresAt: request.expires_at,
          }
    );
  }, [classId, students]);

  useEffect(() => {
    if (loading || loadError || !classId) return undefined;

    const memberChannel = supabase
      .channel(`teacher-class-members-${classId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "class_members",
          filter: `class_id=eq.${classId}`,
        },
        () => {
          refreshRosterState();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(memberChannel);
    };
  }, [classId, loading, loadError, refreshRosterState]);

  useEffect(() => {
    if (loading || loadError || !classId) return undefined;

    const channel = supabase
      .channel(`teacher-volunteer-queue-${classId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "volunteer_queue",
          filter: `class_id=eq.${classId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            playNotificationSound();
          }
          refreshVolunteerQueue();
        }
      )
      .subscribe();

    const intervalId = window.setInterval(refreshVolunteerQueue, 3000);

    return () => {
      window.clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [classId, loading, loadError, refreshVolunteerQueue, playNotificationSound]);

  useEffect(() => {
    if (loading || loadError || !classId) return undefined;

    const channel = supabase
      .channel(`teacher-join-requests-${classId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "session_join_requests",
          filter: `class_id=eq.${classId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            playNotificationSound();
          }
          refreshJoinRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [classId, loading, loadError, refreshJoinRequests, playNotificationSound]);

  useEffect(() => {
    if (loading || loadError || !classId) return undefined;

    const channel = supabase
      .channel(`teacher-selection-requests-${classId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participation_selection_requests",
          filter: `class_id=eq.${classId}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            if (payload.new?.status === "accepted") {
              playAcceptSound();
            } else if (payload.new?.status === "skip_requested") {
              playSkipSound();
            } else {
              playNotificationSound();
            }
          }
          refreshSelectionRequest();
        }
      )
      .subscribe();

    const intervalId = window.setInterval(refreshSelectionRequest, 1500);

    return () => {
      window.clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [
    classId,
    loading,
    loadError,
    refreshSelectionRequest,
    playNotificationSound,
    playAcceptSound,
    playSkipSound,
  ]);

  useEffect(() => {
    if (!pendingPick || resolvingPick) return;

    if (pendingPick.responseStatus === "accepted") {
      resolvePick(true, "awarded");
      return;
    }

    if (pendingPick.responseStatus === "skip_requested") {
      resolvePick(false, "skipped");
      return;
    }

    if (!pendingPick.expiresAt) return;

    const expiresAt = new Date(pendingPick.expiresAt).getTime();
    if (!Number.isFinite(expiresAt)) return;

    const delay = Math.max(0, expiresAt - Date.now());
    const timeoutId = window.setTimeout(() => {
      resolvePick(false, "expired");
    }, delay);

    return () => window.clearTimeout(timeoutId);
  }, [pendingPick, resolvingPick, resolvePick]);

  if (loading) {
    return <AppLoadingScreen title="Loading class" />;
  }

  if (loadError || !classData) {
    return (
      <div className="loading-screen">
        <div>
          <img src="/bird.png" className="loading-bird" alt="Class not found" />
          <h2>{loadError || "Class not found."}</h2>
          <button type="button" className="start-session-btn" onClick={() => navigate(-1)}>
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="teacher-dashboard teacher-dashboard--two-col">
      <button type="button" className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
        <img src="/icons/menu.png" alt="Menu" />
      </button>

      {sidebarOpen && (
        <div
          className="mobile-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <TeacherSidebar
        open={sidebarOpen}
        active="classes"
        onNavigate={navigate}
        onLogout={() => setShowLogoutConfirm(true)}
      />

      <main className="dash-main class-main">
        <ClassPageHeader
          classData={classData}
          actionsOpen={classActionsOpen}
          inviteStatus={inviteStatus}
          onBack={() => navigate(-1)}
          onToggleActions={() => setClassActionsOpen((open) => !open)}
          onEditClass={() => {
            setClassActionsOpen(false);
            setClassDetailsForm({
              subject: classData.subject || "",
              subjectCode: classData.subjectCode || "",
              classCode: classData.classCode || "",
              programBlock: classData.programBlock || "",
            });
            setClassDetailsError("");
            setShowEditClassModal(true);
          }}
          onCopyInvite={() => {
            setClassActionsOpen(false);
            handleCopyInvite();
          }}
        />

        <section className="class-session-grid">
          <TeacherParticipationPanel
            students={students}
            sessionActive={sessionActive}
            spinning={spinning}
            pendingPick={pendingPick}
            pickOutcome={pickOutcome}
            spinRotation={spinRotation}
            selectedStudent={selectedStudent}
            resolvingPick={resolvingPick}
            selectionRequestUnavailable={selectionRequestUnavailable}
            eligiblePresentCount={eligiblePresentCount}
            awardPointsInput={awardPointsInput}
            volunteerQueue={volunteerQueue}
            savingVolunteer={savingVolunteer}
            volunteersEnabled={teacherSettings.allowVolunteers}
            skipFxActive={skipFxActive}
            onStartSession={handleStartSession}
            onEndSession={handleEndSession}
            onAwardPointsChange={setAwardPointsInput}
            onSpin={spinStudent}
            onResolvePick={resolvePick}
            onAcceptVolunteer={acceptVolunteer}
            onSkipVolunteer={skipVolunteer}
          />

          <div className="class-side-stack">
            <ActivityPanel logs={logs} />

            <section className="top-scorers-card">
              <div className="top-scorers-head">
                <h3>Top 5 Scorers</h3>
                <span>{topScorers.length}</span>
              </div>
              <ol className="top-scorers-list">
                {topScorers.length === 0 ? (
                  <li>No scores yet.</li>
                ) : (
                  topScorers.map((student, index) => (
                    <li key={student.id}>
                      <span>{index + 1}</span>
                      <strong>{formatStudentShort(student.name)}</strong>
                      <small>
                        {student.points || 0} pt{student.points === 1 ? "" : "s"}
                      </small>
                    </li>
                  ))
                )}
              </ol>
            </section>

            <AiToolsCard
              summary={aiSummary}
              error={aiSummaryError}
              loading={aiSummaryLoading}
              onGenerate={handleGenerateAiSummary}
              onAskAi={() => {
                setAskAiError("");
                setAskAiAnswer("");
                setShowAskAiModal(true);
              }}
              onPreview={() => setShowSummaryModal(true)}
            />
          </div>
        </section>

        <JoinRequestsCard requests={joinRequests} onApprove={approveJoinRequest} />

        <ClassStudentList
          students={students}
          sessionActive={sessionActive}
          presentCount={presentCount}
          isOpen={studentListOpen}
          removeMode={studentRemoveMode}
          selectedStudentIds={selectedStudentIds}
          onToggleOpen={() => setStudentListOpen((open) => !open)}
          onRemoveClick={() => {
            if (!studentRemoveMode) {
              setStudentRemoveMode(true);
              setSelectedStudentIds(new Set());
              return;
            }
            handleOpenRemoveStudentsModal();
          }}
          onCancelRemove={() => {
            setStudentRemoveMode(false);
            setSelectedStudentIds(new Set());
          }}
          onToggleStudentSelection={toggleStudentSelection}
        />

        {showEditClassModal && (
          <ClassDetailsModal
            form={classDetailsForm}
            error={classDetailsError}
            saving={savingClassDetails}
            onChange={handleClassDetailsChange}
            onSubmit={handleSaveClassDetails}
            onCancel={() => {
              setShowEditClassModal(false);
              setClassDetailsError("");
            }}
          />
        )}

        {showClassSaveConfirm && (
          <ConfirmModal
            title="Save Class Details?"
            message="Apply these updated class details?"
            confirmLabel="Save"
            loading={savingClassDetails}
            onConfirm={confirmSaveClassDetails}
            onCancel={() => !savingClassDetails && setShowClassSaveConfirm(false)}
          />
        )}

        {showSummaryModal && aiSummary && (
          <SummaryPreviewModal
            title={`AI Class Summary - ${classData.subject || "Class"}`}
            subtitle={`${classData.subjectCode || ""} ${classData.classCode || ""}`.trim()}
            sections={aiSummarySections}
            onClose={() => setShowSummaryModal(false)}
          />
        )}

        {showAskAiModal && (
          <AskAiModal
            prompt={askAiPrompt}
            answer={askAiAnswer}
            error={askAiError}
            loading={askAiLoading}
            onPromptChange={setAskAiPrompt}
            onGenerate={handleAskAi}
            onClose={() => setShowAskAiModal(false)}
          />
        )}

        {showRemoveStudentsModal && (
          <ConfirmModal
            title="Remove Students?"
            message={`Remove ${selectedStudentIds.size} selected student${
              selectedStudentIds.size === 1 ? "" : "s"
            } from this class?`}
            confirmLabel="Remove"
            loading={removingStudents}
            onConfirm={handleRemoveSelectedStudents}
            onCancel={() => !removingStudents && setShowRemoveStudentsModal(false)}
          />
        )}

        {showLogoutConfirm && (
          <ConfirmModal
            title="Log Out?"
            message="Are you sure you want to log out?"
            confirmLabel="Log Out"
            onConfirm={handleLogout}
            onCancel={() => setShowLogoutConfirm(false)}
          />
        )}

      </main>
      <BottomNav items={teacherBottomNavItems} />
    </div>
  );
}
export default ClassPage;
