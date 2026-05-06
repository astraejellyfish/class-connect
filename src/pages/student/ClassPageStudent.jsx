import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { requireStudent } from "../../features/authRole";
import { canEnterClass } from "../../features/studentClasses";
import { updateSelectionResponse } from "../../features/participation";
import StudentParticipationPanel from "../../components/student/StudentParticipationPanel";
import VolunteerQueue from "../../components/student/VolunteerQueue";
import { useAudioControls } from "../../hooks/useAudioControls";
import SummaryPreviewModal from "../../components/common/SummaryPreviewModal";
import {
  formatFullNameTitle,
  formatStudentShort,
} from "../../utils/studentDisplay";
import ConfirmModal from "../../components/common/ConfirmModal";
import BottomNav, { studentBottomNavItems } from "../../components/shared/BottomNav";
import "../../styles/student/myclasses.css";
import "../../styles/student/classpageS.css";

const MAX_JOIN_REQUEST_ATTEMPTS = 3;
const MAX_VOLUNTEER_ATTEMPTS = 1;
const PICK_RESPONSE_SECONDS = 10;

function getLastNameSortKey(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const last = parts.length > 1 ? parts[parts.length - 1] : parts[0] || "";
  return `${last} ${parts.join(" ")}`.toLowerCase();
}

function mapRosterStudent(row, pointsByStudentId) {
  const student = Array.isArray(row.students) ? row.students[0] : row.students;
  const name =
    student?.name ||
    student?.email ||
    student?.student_id ||
    "Student";

  return {
    id: row.student_id,
    name,
    points: pointsByStudentId[row.student_id] || 0,
    present: row.entry_confirmed === true,
  };
}

function mapQueueRow(row) {
  const student = Array.isArray(row.students) ? row.students[0] : row.students;

  return {
    id: row.student_id,
    queueId: row.id,
    name: student?.name || student?.email || "Student",
    createdAt: row.created_at,
  };
}

export default function ClassPageStudent() {
  const navigate = useNavigate();
  const { classId } = useParams();
  const [classData, setClassData] = useState(null);
  const [membership, setMembership] = useState(null);
  const [activity, setActivity] = useState([]);
  const [students, setStudents] = useState([]);
  const [volunteerQueue, setVolunteerQueue] = useState([]);
  const [joinedSession, setJoinedSession] = useState(false);
  const [joinRequest, setJoinRequest] = useState(null);
  const [requestingJoin, setRequestingJoin] = useState(false);
  const [volunteering, setVolunteering] = useState(false);
  const [joinRequestAttempts, setJoinRequestAttempts] = useState(0);
  const [volunteerAttempts, setVolunteerAttempts] = useState(0);
  const [joinRequestMessage, setJoinRequestMessage] = useState("");
  const [sessionMessage, setSessionMessage] = useState("");
  const [status, setStatus] = useState("Loading class...");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [pendingSelection, setPendingSelection] = useState(null);
  const [selectionCountdown, setSelectionCountdown] = useState(0);
  const [selectionMessage, setSelectionMessage] = useState("");
  const [respondingSelection, setRespondingSelection] = useState(false);
  const [studentListOpen, setStudentListOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const previousPendingSelectionIdRef = useRef(null);
  const sessionOngoing = Boolean(classData?.session_active);
  const {
    playNotificationSound,
    playResultSound,
    playAcceptSound,
    playSkipSound,
    playCountdownSound,
  } = useAudioControls({
    sessionActive: sessionOngoing,
    countdownSeconds: PICK_RESPONSE_SECONDS,
  });

  useEffect(() => {
    async function loadClass() {
      // Only logged-in students can open a student class page.
      const account = await requireStudent(navigate);
      if (!account) {
        return;
      }
      const studentUserId = account.user.id;

      // Make sure the student really joined this class.
      const [
        { data, error },
        { data: activityRows },
        { data: requestRow },
        { data: memberRows },
        { data: queueRows },
      ] = await Promise.all([
        supabase
          .from("class_members")
          .select(
            "id, class_id, student_id, joined_at, entry_confirmed, classes(id, class_name, subject_code, class_code, program, teacher_id, session_active, session_started_at)"
          )
          .eq("class_id", classId)
          .eq("student_id", studentUserId)
          .maybeSingle(),
        supabase
          .from("participation")
          .select("id, student_id, points, created_at, students(id, name, email, student_id)")
          .eq("class_id", classId)
          .order("created_at", { ascending: false }),
        supabase
          .from("session_join_requests")
          .select("id, status, created_at")
          .eq("class_id", classId)
          .eq("student_id", studentUserId)
          .eq("status", "pending")
          .maybeSingle(),
        supabase
          .from("class_members")
          .select("id, student_id, entry_confirmed, students(id, name, email, student_id)")
          .eq("class_id", classId),
        supabase
          .from("volunteer_queue")
          .select("id, class_id, student_id, status, created_at, students(id, name, email, student_id)")
          .eq("class_id", classId)
          .eq("status", "waiting")
          .order("created_at", { ascending: true }),
      ]);

      if (error || !data) {
        setStatus("You are not joined in this class.");
        return;
      }

      const row = Array.isArray(data.classes) ? data.classes[0] : data.classes;
      const { data: teacherRow } = row?.teacher_id
        ? await supabase
            .from("teachers")
            .select("id, name, email")
            .eq("id", row.teacher_id)
            .maybeSingle()
        : { data: null };
      const classRow = row
        ? {
            ...row,
            teacher: teacherRow || null,
          }
        : row;

      const sessionStartedAt = classRow?.session_started_at;
      let requestAttemptsQuery = supabase
        .from("session_join_requests")
        .select("id", { count: "exact", head: true })
        .eq("class_id", classId)
        .eq("student_id", studentUserId);
      let volunteerAttemptsQuery = supabase
        .from("volunteer_queue")
        .select("id", { count: "exact", head: true })
        .eq("class_id", classId)
        .eq("student_id", studentUserId);

      if (sessionStartedAt) {
        requestAttemptsQuery = requestAttemptsQuery.gte("created_at", sessionStartedAt);
        volunteerAttemptsQuery = volunteerAttemptsQuery.gte("created_at", sessionStartedAt);
      }

      const [
        { count: requestAttemptCount, error: requestAttemptError },
        { count: volunteerAttemptCount, error: volunteerAttemptError },
      ] = await Promise.all([requestAttemptsQuery, volunteerAttemptsQuery]);

      if (!requestAttemptError) {
        setJoinRequestAttempts(requestAttemptCount || 0);
      }
      if (!volunteerAttemptError) {
        setVolunteerAttempts(volunteerAttemptCount || 0);
      }

      setClassData(classRow);
      setMembership({
        ...data,
        classes: classRow,
      });
      setJoinedSession(Boolean(data.entry_confirmed));
      setActivity(activityRows || []);
      const pointsByStudentId = (activityRows || []).reduce((acc, item) => {
        acc[item.student_id] = (acc[item.student_id] || 0) + (item.points || 0);
        return acc;
      }, {});
      setStudents(
        (memberRows || [])
          .map((item) => mapRosterStudent(item, pointsByStudentId))
          .sort((a, b) => getLastNameSortKey(a.name).localeCompare(getLastNameSortKey(b.name)))
      );
      setVolunteerQueue((queueRows || []).map(mapQueueRow));
      setJoinRequest(requestRow || null);

      const { data: selectionRow, error: selectionError } = await supabase
        .from("participation_selection_requests")
        .select("id, class_id, student_id, points, status, created_at, expires_at")
        .eq("class_id", classId)
        .eq("student_id", studentUserId)
        .eq("status", "pending")
        .maybeSingle();

      if (!selectionError) {
        setPendingSelection(selectionRow || null);
      }
      setStatus("");
    }

    loadClass();
  }, [classId, navigate]);

  const canJoinSession = membership ? canEnterClass(membership) : false;
  const totalPoints = activity.reduce((sum, row) => sum + (row.points || 0), 0);
  const studentOwnPoints = activity
    .filter((row) => row.student_id === membership?.student_id)
    .reduce((sum, row) => sum + (row.points || 0), 0);
  const alreadyVolunteered = volunteerQueue.some(
    (item) => item.id === membership?.student_id
  );
  const joinRequestLimitReached = joinRequestAttempts >= MAX_JOIN_REQUEST_ATTEMPTS;
  const volunteerLimitReached =
    alreadyVolunteered || volunteerAttempts >= MAX_VOLUNTEER_ATTEMPTS;
  const selectedStudent = pendingSelection
    ? students.find((student) => student.id === pendingSelection.student_id) || null
    : null;
  const presentCount = students.filter((student) => student.present).length;
  const aiStats = useMemo(() => {
    const ranked = [...students]
      .map((student) => ({
        ...student,
        pts: student.points ?? 0,
      }))
      .sort((a, b) => b.pts - a.pts);
    const maxPts = Math.max(...ranked.map((student) => student.pts), 1);
    const top = ranked.slice(0, 8);
    const least = ranked.length > 0 ? ranked[ranked.length - 1] : null;
    const leastPts = least?.pts ?? 0;
    const leastStudents = ranked.filter((student) => student.pts === leastPts);
    const presentCount = students.filter((student) => student.present !== false).length;
    const absentCount = students.length - presentCount;

    return {
      ranked,
      maxPts,
      top,
      least,
      leastPts,
      leastStudents,
      presentCount,
      absentCount,
    };
  }, [students]);

  const topScorers = useMemo(
    () =>
      [...students]
        .sort((a, b) => (b.points || 0) - (a.points || 0))
        .slice(0, 5),
    [students]
  );

  useEffect(() => {
    if (!pendingSelection?.id) {
      previousPendingSelectionIdRef.current = null;
      return;
    }

    if (previousPendingSelectionIdRef.current !== pendingSelection.id) {
      previousPendingSelectionIdRef.current = pendingSelection.id;
      playResultSound();
      playCountdownSound();
    }
  }, [pendingSelection?.id, playResultSound, playCountdownSound]);

  const handleJoinSession = async () => {
    if (!canJoinSession) {
      setStatus("Entry window expired. Please wait for teacher confirmation.");
      return;
    }

    setStatus("");
    const { error } = await supabase
      .from("class_members")
      .update({ entry_confirmed: true })
      .eq("id", membership.id);

    if (error) {
      setStatus("Could not join session. Please try again.");
      return;
    }

    setJoinedSession(true);
    setMembership((prev) =>
      prev
        ? {
            ...prev,
            entry_confirmed: true,
          }
        : prev
    );
    setStudents((prev) =>
      prev.map((student) =>
        student.id === membership.student_id ? { ...student, present: true } : student
      )
    );
    playNotificationSound();
  };

  const refreshParticipationState = useCallback(async () => {
    const [
      { data: activityRows },
      { data: memberRows },
      { data: queueRows },
      { data: selectionRow },
    ] =
      await Promise.all([
        supabase
          .from("participation")
          .select("id, student_id, points, created_at, students(id, name, email, student_id)")
          .eq("class_id", classId)
          .order("created_at", { ascending: false }),
        supabase
          .from("class_members")
          .select("id, student_id, entry_confirmed, students(id, name, email, student_id)")
          .eq("class_id", classId),
        supabase
          .from("volunteer_queue")
          .select("id, class_id, student_id, status, created_at, students(id, name, email, student_id)")
          .eq("class_id", classId)
          .eq("status", "waiting")
          .order("created_at", { ascending: true }),
        membership?.student_id
          ? supabase
              .from("participation_selection_requests")
              .select("id, class_id, student_id, points, status, created_at, expires_at")
              .eq("class_id", classId)
              .eq("student_id", membership.student_id)
              .eq("status", "pending")
              .maybeSingle()
          : { data: null },
      ]);

    setActivity(activityRows || []);
    const pointsByStudentId = (activityRows || []).reduce((acc, item) => {
      acc[item.student_id] = (acc[item.student_id] || 0) + (item.points || 0);
      return acc;
    }, {});
    setStudents(
      (memberRows || [])
        .map((item) => mapRosterStudent(item, pointsByStudentId))
        .sort((a, b) => getLastNameSortKey(a.name).localeCompare(getLastNameSortKey(b.name)))
    );
    setVolunteerQueue((queueRows || []).map(mapQueueRow));
    setPendingSelection(selectionRow || null);
  }, [classId, membership?.student_id]);

  useEffect(() => {
    if (!classData || status) return undefined;

    const participationChannel = supabase
      .channel(`student-participation-${classId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participation",
          filter: `class_id=eq.${classId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            playNotificationSound();
          }
          refreshParticipationState();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "volunteer_queue",
          filter: `class_id=eq.${classId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            playNotificationSound();
          }
          refreshParticipationState();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participation_selection_requests",
          filter: `class_id=eq.${classId}`,
        },
        (payload) => {
          if (
            payload.eventType === "INSERT" &&
            payload.new?.student_id === membership?.student_id
          ) {
            playResultSound();
          } else if (
            payload.eventType === "UPDATE" &&
            payload.new?.student_id === membership?.student_id
          ) {
            if (payload.new?.status === "accepted") {
              playAcceptSound();
            } else if (payload.new?.status === "skip_requested") {
              playSkipSound();
            } else {
              playNotificationSound();
            }
          }
          refreshParticipationState();
        }
      )
      .subscribe();

    const intervalId = window.setInterval(refreshParticipationState, 3000);

    return () => {
      window.clearInterval(intervalId);
      supabase.removeChannel(participationChannel);
    };
  }, [
    classData,
    classId,
    membership?.student_id,
    playNotificationSound,
    playAcceptSound,
    playResultSound,
    playSkipSound,
    refreshParticipationState,
    status,
  ]);

  useEffect(() => {
    if (!classData || status || !classId) return undefined;

    const channel = supabase
      .channel(`student-class-status-${classId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "classes",
          filter: `id=eq.${classId}`,
        },
        (payload) => {
          const nextClass = {
            ...payload.new,
            teacher: classData.teacher || null,
          };
          setClassData(nextClass);
          setMembership((prev) =>
            prev
              ? {
                  ...prev,
                  classes: nextClass,
                }
              : prev
          );
          if (!payload.new?.session_active) {
            setJoinedSession(false);
            setPendingSelection(null);
          }
          refreshParticipationState();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [classData, classId, refreshParticipationState, status]);

  const handleVolunteer = async () => {
    if (!membership || !sessionOngoing || !canJoinSession || volunteerLimitReached) {
      if (volunteerLimitReached) {
        setSessionMessage("Volunteer attempt limit reached for this session.");
      }
      return;
    }

    setVolunteering(true);
    setSessionMessage("");
    const { data, error } = await supabase
      .from("volunteer_queue")
      .insert({
        class_id: classId,
        student_id: membership.student_id,
        status: "waiting",
      })
      .select("id, class_id, student_id, status, created_at, students(id, name, email, student_id)")
      .single();
    setVolunteering(false);

    if (error) {
      setSessionMessage("Could not join volunteer queue.");
      return;
    }

    setVolunteerQueue((prev) => [...prev, mapQueueRow(data)]);
    setVolunteerAttempts((prev) => prev + 1);
    setSessionMessage("You joined the volunteer queue.");
    playNotificationSound();
  };

  const handleRequestJoin = async () => {
    if (!membership) return;
    if (joinRequestLimitReached) {
      setJoinRequestMessage("Join request attempt limit reached for this session.");
      return;
    }

    setRequestingJoin(true);
    setJoinRequestMessage("");
    const { data, error } = await supabase
      .from("session_join_requests")
      .insert({
        class_id: classId,
        student_id: membership.student_id,
        membership_id: membership.id,
        status: "pending",
      })
      .select("id, status, created_at")
      .single();
    setRequestingJoin(false);

    if (error) {
      setJoinRequestMessage("Could not send join request. Please try again.");
      return;
    }

    setJoinRequest(data);
    setJoinRequestAttempts((prev) => prev + 1);
    setJoinRequestMessage("Request sent. Please wait for teacher approval.");
    playNotificationSound();
  };

  useEffect(() => {
    if (!pendingSelection?.expires_at) {
      setSelectionCountdown(0);
      return undefined;
    }

    const updateCountdown = () => {
      const expiresAt = new Date(pendingSelection.expires_at).getTime();
      if (!Number.isFinite(expiresAt)) {
        setSelectionCountdown(0);
        return;
      }

      setSelectionCountdown(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    };

    updateCountdown();
    const intervalId = window.setInterval(updateCountdown, 500);
    return () => window.clearInterval(intervalId);
  }, [pendingSelection?.expires_at]);

  useEffect(() => {
    if (!pendingSelection?.expires_at || respondingSelection) return;

    const expiresAt = new Date(pendingSelection.expires_at).getTime();
    if (!Number.isFinite(expiresAt) || Date.now() < expiresAt) return;

    async function expireSelection() {
      await updateSelectionResponse(pendingSelection.id, "skip_requested");
      setSelectionMessage("Time expired. A skip request was sent.");
      setPendingSelection(null);
    }

    expireSelection();
  }, [pendingSelection, selectionCountdown, respondingSelection]);

  const handleSelectionResponse = async (nextStatus) => {
    if (!pendingSelection || respondingSelection) return;

    setRespondingSelection(true);
    setSelectionMessage("");
    const { error } = await updateSelectionResponse(pendingSelection.id, nextStatus);
    setRespondingSelection(false);

    if (error) {
      setSelectionMessage("Could not send your response. Please try again.");
      return;
    }

    setSelectionMessage(
      nextStatus === "accepted"
        ? "Accepted. Waiting for your teacher to award points."
        : "Skip request sent to your teacher."
    );
    if (nextStatus === "accepted") {
      playAcceptSound();
    } else {
      playSkipSound();
    }
    setPendingSelection(null);
  };

  const buildLocalSummary = () => {
    const spread =
      aiStats.ranked.length > 1
        ? aiStats.ranked[0].pts - aiStats.ranked[aiStats.ranked.length - 1].pts
        : 0;
    const leastLabel = aiStats.leastStudents.length
      ? `${aiStats.leastStudents.length} student${
          aiStats.leastStudents.length === 1 ? "" : "s"
        } at ${aiStats.leastPts} pt${aiStats.leastPts === 1 ? "" : "s"}`
      : "No students";

    return {
      title: `Participation Report - ${classData?.class_name || "Class"}`,
      overview: `${activity.length} activity item${
        activity.length === 1 ? "" : "s"
      } logged with ${totalPoints} total point${
        totalPoints === 1 ? "" : "s"
      } across ${students.length} student${students.length === 1 ? "" : "s"}.`,
      attendance: `${aiStats.presentCount} present, ${aiStats.absentCount} absent.`,
      yourPoints: `You currently have ${studentOwnPoints} point${
        studentOwnPoints === 1 ? "" : "s"
      }.`,
      least: leastLabel,
      leastList: aiStats.leastStudents.map((student) => ({
        id: student.id,
        name: formatFullNameTitle(student.name),
        points: student.pts,
      })),
      spread,
      recommendation:
        studentOwnPoints > 0
          ? "Keep joining live activities when you are ready to participate."
          : "No points yet. Volunteer or wait for the teacher selection during a live session.",
    };
  };

  const handleGenerateSummary = () => {
    setSummaryLoading(true);

    const localSummary = buildLocalSummary();
    setTimeout(() => {
      setSummary(localSummary);
      setShowSummaryModal(true);
      setSummaryLoading(false);
    }, 700);
  };

  const summarySections = useMemo(() => {
    if (!summary) return [];

    const startedAt = classData?.session_started_at
      ? new Date(classData.session_started_at)
      : null;
    const formatDate = (date) =>
      date && Number.isFinite(date.getTime()) ? date.toLocaleDateString() : "N/A";
    const formatTime = (date) =>
      date && Number.isFinite(date.getTime())
        ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "N/A";
    const statsByStudentId = activity.reduce((acc, row) => {
      const current = acc[row.student_id] || { timesCalled: 0, points: 0 };
      acc[row.student_id] = {
        timesCalled: current.timesCalled + 1,
        points: current.points + (row.points || 0),
      };
      return acc;
    }, {});
    const activeParticipants = students
      .filter((student) => (statsByStudentId[student.id]?.timesCalled || 0) > 0)
      .map((student) => {
        const stats = statsByStudentId[student.id] || {};
        return `${formatFullNameTitle(student.name)} | ${
          stats.timesCalled || 0
        } | ${stats.points || 0} pt${stats.points === 1 ? "" : "s"}`;
      });
    const lowParticipants = students
      .filter((student) => (statsByStudentId[student.id]?.timesCalled || 0) === 0)
      .map((student) => `${formatFullNameTitle(student.name)} | Not Called`);
    const volunteerNames = volunteerQueue.map((item) => formatFullNameTitle(item.name));
    const highest = topScorers[0];
    const averagePoints =
      students.length > 0 ? (totalPoints / students.length).toFixed(1) : "0";

    return [
      {
        label: "Class Connect",
        value: `Class Connect - LEVEL UP YOUR CLASS\nInstitution: Gordon College - College of Computer Studies\nInstructor: ${
          classData?.teacher?.name || "Teacher"
        }\nSubject: ${classData?.class_name || "N/A"}\nClass Code: ${
          classData?.class_code || "N/A"
        }\nProgram/Block: ${classData?.program || "N/A"}`,
      },
      {
        label: "Session Details",
        value: `Session Title: Recitation 1\nDate: ${formatDate(
          startedAt || new Date()
        )}\nTime Started: ${formatTime(startedAt)}\nTime Ended: ${
          classData?.session_active ? "Ongoing" : "N/A"
        }\nDuration: ${classData?.session_active ? "Ongoing" : "N/A"}\nTotal Students Present: ${
          aiStats.presentCount
        }\nLate Entries (after 15 min): ${joinRequest ? 1 : 0}`,
      },
      {
        label: "Overall Participation Summary (Local)",
        value: summary.overview,
      },
      {
        label: "Participation Breakdown - Active Participants",
        table: {
          headers: ["Student Name", "Times Called", "Points Earned"],
          rows: activeParticipants.length
            ? students
                .filter((student) => (statsByStudentId[student.id]?.timesCalled || 0) > 0)
                .map((student) => {
                  const stats = statsByStudentId[student.id] || {};
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
                .filter((student) => (statsByStudentId[student.id]?.timesCalled || 0) === 0)
                .map((student) => [formatFullNameTitle(student.name), "Not Called"])
            : [["No low participation students listed.", "-"]],
        },
      },
      {
        label: "Volunteer Activity",
        value: `${volunteerNames.length ? volunteerNames.join("\n") : "No volunteer activity noted."}\n\nInsight: Volunteer activity indicates willingness to participate.`,
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
        label: "Engagement Analysis",
        value: `Points gap is ${summary.spread} pt${
          summary.spread === 1 ? "" : "s"
        }. ${summary.recommendation}`,
      },
      {
        label: "Recommendations",
        value:
          "Prioritize students with low participation in the next session\nEncourage quieter students using the volunteer feature\nMaintain current pacing and question difficulty",
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
    activity,
    aiStats.presentCount,
    classData,
    joinRequest,
    students,
    summary,
    topScorers,
    totalPoints,
    volunteerQueue,
  ]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="student-dashboard student-class-dashboard">
      <button
        type="button"
        className="student-class-mobile-menu"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open menu"
      >
        <img src="/icons/menu.png" alt="" />
      </button>

      {sidebarOpen && (
        <div
          className="student-class-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`student-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="student-side-brand">
          <img src="/leaf-logo.png" alt="Class Connect" />
          <h2>Class Connect</h2>
        </div>

        <button
          type="button"
          className="student-side-active"
          onClick={() => navigate("/student/classes")}
        >
          <img src="/icons/myclasses.png" alt="" />
          <span>My Classes</span>
        </button>

        <button type="button" onClick={() => navigate("/student/settings")}>
          <img src="/icons/settings.png" alt="" />
          <span>Settings</span>
        </button>

        <button type="button" onClick={() => setShowLogoutConfirm(true)} className="student-side-logout">
          <img src="/icons/logout.png" alt="" />
          <span>Logout</span>
        </button>
      </aside>

      {showLogoutConfirm && (
        <ConfirmModal
          title="Log Out?"
          message="Are you sure you want to log out?"
          confirmLabel="Log Out"
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}

      <main className="student-main student-class-main">
        <header className="student-topbar student-class-topbar">
          <div className="student-class-title-row">
            <button
              type="button"
              className="student-class-back-btn"
              onClick={() => navigate("/student/classes")}
            >
              <img src="/back.png" alt="Back" />
            </button>
            <div>
              <h1>{classData?.class_name || "Class"}</h1>
              {classData && (
                <>
                  <p>
                    {classData.subject_code} | {classData.class_code}
                  </p>
                  <span>{classData.program || "No program/year/block"}</span>
                  <small>
                    Teacher: {classData.teacher?.name || "Teacher name unavailable"}
                  </small>
                </>
              )}
            </div>
          </div>
          {!status && (
            <div className="student-class-top-actions">
              {sessionOngoing && canJoinSession && (
                <button
                  type="button"
                  className="student-primary-btn student-status-join-btn"
                  onClick={handleJoinSession}
                  disabled={joinedSession}
                >
                  {joinedSession ? "Joined" : "Join Session"}
                </button>
              )}
              {sessionOngoing && !canJoinSession && (
                <button
                  type="button"
                  className="student-primary-btn student-status-join-btn"
                  onClick={handleRequestJoin}
                  disabled={requestingJoin || !!joinRequest || joinRequestLimitReached}
                >
                  {joinRequest
                    ? "Request Sent"
                    : joinRequestLimitReached
                      ? "Limit Reached"
                      : requestingJoin
                        ? "Sending..."
                        : "Request Join"}
                </button>
              )}
              {joinRequestMessage && (
                <small className="student-class-top-message">{joinRequestMessage}</small>
              )}
            </div>
          )}
        </header>

        {status ? (
          <section className="student-session-card student-class-status-card">
            <h2>{status}</h2>
            <p>Students must enter within 15 minutes unless the teacher confirms entry.</p>
          </section>
        ) : (
          <>
            <section className="student-class-session-grid">
              <div className="student-class-primary-stack">
                <StudentParticipationPanel
                  students={students}
                  selectedStudent={selectedStudent}
                  sessionOngoing={sessionOngoing}
                  pendingSelection={pendingSelection}
                  selectionCountdown={selectionCountdown}
                  pickResponseSeconds={PICK_RESPONSE_SECONDS}
                  respondingSelection={respondingSelection}
                  selectionMessage={selectionMessage}
                  canJoinSession={canJoinSession}
                  volunteering={volunteering}
                  volunteerLimitReached={volunteerLimitReached}
                  alreadyVolunteered={alreadyVolunteered}
                  volunteerAttempts={volunteerAttempts}
                  maxVolunteerAttempts={MAX_VOLUNTEER_ATTEMPTS}
                  sessionMessage={sessionMessage}
                  onSelectionResponse={handleSelectionResponse}
                  onVolunteer={handleVolunteer}
                />

                <VolunteerQueue queue={volunteerQueue} />
              </div>

              <aside className="student-side-stack">
                <section className="student-session-card student-top-scorers-card">
                  <div className="student-volunteer-head">
                    <div>
                      <h2>Top 5 Scorers</h2>
                    </div>
                    <span>{topScorers.length}</span>
                  </div>

                  <ol className="student-top-scorers-list">
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

                <section className="student-session-card student-activity-card">
                  <div className="student-activity-session-slot">
                    <p className="student-class-kicker">Session &amp; invites</p>
                    <p>
                      Students can join within <strong>15 minutes</strong> after the teacher starts.
                    </p>
                  </div>

                  <div className="student-activity-head">
                    <h2>Activity Log</h2>
                    <span>{activity.length}</span>
                  </div>

                  <div className="student-activity-list">
                    {activity.length === 0 ? (
                      <p>No activity yet.</p>
                    ) : (
                      activity.map((row) => {
                        const student = Array.isArray(row.students)
                          ? row.students[0]
                          : row.students;

                        return (
                          <article key={row.id}>
                            <strong>
                              {formatStudentShort(student?.name || "Student")} earned{" "}
                              {row.points} pt{row.points === 1 ? "" : "s"}
                            </strong>
                            <span>
                              {new Date(row.created_at).toLocaleString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </article>
                        );
                      })
                    )}
                  </div>
                </section>
              </aside>
            </section>

            <section className="student-session-card student-list-card">
              <div className="student-list-head">
                <div>
                  <h2>Students in class</h2>
                  <p>
                    {sessionOngoing
                      ? `Present: ${presentCount} / ${students.length} - `
                      : ""}
                    Your points update after your teacher records participation.
                  </p>
                </div>
                <button
                  type="button"
                  className="student-list-toggle"
                  onClick={() => setStudentListOpen((open) => !open)}
                  aria-expanded={studentListOpen}
                >
                  {studentListOpen ? "Hide" : "Show"}
                </button>
              </div>

              <div className={`student-list ${studentListOpen ? "is-open" : ""}`}>
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
                    <div className="student-row" key={student.id}>
                      <div>
                        <strong title={student.name}>{formatStudentShort(student.name)}</strong>
                        <span className="student-full-name">{student.name}</span>
                        <span>Points: {student.points ?? 0}</span>
                      </div>

                      {sessionOngoing && (
                        <span className={student.present ? "present-badge" : "absent-badge"}>
                          {student.present ? "Present" : "Absent"}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="student-session-card student-ai-summary-card">
              <div className="student-ai-summary-header">
                <div>
                  <p className="student-class-kicker">Local insights</p>
                  <h2>Class Summary</h2>
                </div>
                <button
                  type="button"
                  className="student-ai-generate-btn"
                  onClick={handleGenerateSummary}
                  disabled={summaryLoading}
                >
                  {summaryLoading ? "Generating..." : "Generate Preview"}
                </button>
              </div>

              <div className="student-ai-summary-grid">
                <article>
                  <strong>{totalPoints}</strong>
                  <span>Total points</span>
                </article>
                <article>
                  <strong>{activity.length}</strong>
                  <span>Selections logged</span>
                </article>
                <article>
                  <strong>{students.length}</strong>
                  <span>Students</span>
                </article>
                <article>
                  <strong>{aiStats.absentCount}</strong>
                  <span>Absent</span>
                </article>
                <article>
                  <strong>{aiStats.presentCount}</strong>
                  <span>Present students</span>
                </article>
              </div>

              <div className="student-ai-least-block">
                <div>
                  <h3>Least points students</h3>
                  <p>
                    {aiStats.least
                      ? `${aiStats.leastPts} pt${aiStats.leastPts === 1 ? "" : "s"}`
                      : "No points recorded yet."}
                  </p>
                </div>
                <div className="student-ai-least-list">
                  {aiStats.leastStudents.length === 0 ? (
                    <span>No students yet</span>
                  ) : (
                    aiStats.leastStudents.map((student) => (
                      <span key={student.id} title={student.name}>
                        {formatFullNameTitle(student.name)} - {student.pts} pt
                        {student.pts === 1 ? "" : "s"}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="student-ai-chart-block">
                <h3>Points by student</h3>
                <p className="student-ai-chart-hint">
                  Relative share of total points (top 8).
                </p>
                <div className="student-ai-bar-chart">
                  {aiStats.top.length === 0 ? (
                    <p className="student-ai-empty">No points recorded yet.</p>
                  ) : (
                    aiStats.top.map((student) => {
                      const pts = student.pts ?? 0;
                      const pct =
                        totalPoints > 0 ? Math.round((pts / totalPoints) * 100) : 0;
                      const barPct =
                        pts > 0 && aiStats.maxPts > 0
                          ? Math.round((pts / aiStats.maxPts) * 100)
                          : 0;

                      return (
                        <div className="student-ai-bar-row" key={student.id}>
                          <span className="student-ai-bar-name" title={student.name}>
                            {formatStudentShort(student.name)}
                          </span>
                          <div className="student-ai-bar-track">
                            {pts > 0 ? (
                              <div
                                className="student-ai-bar-fill"
                                style={{ width: `${barPct}%` }}
                              />
                            ) : null}
                          </div>
                          <span className="student-ai-bar-meta">
                            {pts} pt{pts === 1 ? "" : "s"} ({pct}%)
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="student-ai-timeline-block">
                <h3>Recent activity</h3>
                <div className="student-ai-timeline">
                  {activity.length === 0 ? (
                    <p className="student-ai-empty">No log entries yet.</p>
                  ) : (
                    activity.slice(0, 6).map((row) => {
                      const student = Array.isArray(row.students)
                        ? row.students[0]
                        : row.students;

                      return (
                        <div className="student-ai-timeline-row" key={row.id}>
                          <span className="student-ai-timeline-time">
                            {new Date(row.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span className="student-ai-timeline-msg">
                            {formatStudentShort(student?.name || "Student")} earned{" "}
                            {row.points} pt{row.points === 1 ? "" : "s"}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {summary && (
                <button
                  type="button"
                  className="student-ai-generate-btn student-ai-preview-btn"
                  onClick={() => setShowSummaryModal(true)}
                >
                  Preview PDF
                </button>
              )}
            </section>

            {showSummaryModal && summary && (
              <SummaryPreviewModal
                title={summary.title}
                subtitle={`${classData?.subject_code || ""} ${classData?.class_code || ""}`.trim()}
                sections={summarySections}
                onClose={() => setShowSummaryModal(false)}
              />
            )}
          </>
        )}
      </main>
      <BottomNav items={studentBottomNavItems} />
    </div>
  );
}
