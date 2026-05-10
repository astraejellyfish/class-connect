import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { requireStudent } from "../../features/authRole";
import { canEnterClass } from "../../features/studentClasses";
import { updateSelectionResponse } from "../../features/participation";
import StudentParticipationPanel from "../../components/student/StudentParticipationPanel";
import VolunteerQueue from "../../components/student/VolunteerQueue";
import { useAudioControls } from "../../hooks/useAudioControls";
import {
  formatFullNameTitle,
  formatStudentShort,
} from "../../utils/studentDisplay";
import ConfirmModal from "../../components/common/ConfirmModal";
import BottomNav, { studentBottomNavItems } from "../../components/shared/BottomNav";
import MobileHeader from "../../components/shared/MobileHeader";
import "../../styles/teacher/classpage.css";
import "../../styles/student/myclasses.css";
import "../../styles/student/classpageS.css";

const MAX_JOIN_REQUEST_ATTEMPTS = 3;

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

function formatLocalActivityTime(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function cleanSessionMessage(message) {
  const text = String(message || "").trim();
  if (!text) return "";

  const selectedMatch =
    text.match(/^(.+?)\s+was selected\.?$/i) ||
    text.match(/^(.+?)\s+selected\. Waiting for student response\.?$/i) ||
    text.match(/^(.+?)\s+selected\. Selection request table is unavailable.*$/i);
  if (selectedMatch) {
    return `${formatFullNameTitle(selectedMatch[1])} was selected.`;
  }

  const awardedMatch =
    text.match(/^Teacher awarded\s+(\d+)\s+points?\s+to\s+(.+?)\.?$/i) ||
    text.match(/^(.+?)\s+\(\s*(.+?)\s*\)\s+is selected for\s+(\d+)\s+pts?\s+- accepted\.?$/i);
  if (awardedMatch) {
    const points = awardedMatch[3] || awardedMatch[1];
    const name = awardedMatch[2];
    return `Teacher awarded ${points} point${Number(points) === 1 ? "" : "s"} to ${formatFullNameTitle(name)}.`;
  }

  const rawSkipMatch = text.match(
    /^(.+?)\s+\(\s*(.+?)\s*\)\s+is selected\s+-\s+(?:skip requested|expired).*/i
  );
  if (rawSkipMatch) {
    return `${formatFullNameTitle(rawSkipMatch[2])} requested to skip.`;
  }

  const simpleSkipMatch = text.match(/^(.+?)\s+requested to skip\.?$/i);
  if (simpleSkipMatch) {
    return `${formatFullNameTitle(simpleSkipMatch[1])} requested to skip.`;
  }

  const volunteerMatch = text.match(/^(.+?)\s+volunteered\.?$/i);
  if (volunteerMatch) {
    return `${formatFullNameTitle(volunteerMatch[1])} volunteered.`;
  }

  const skippedVolunteerMatch = text.match(/^(.+?)\s+was skipped in the volunteer queue\.?$/i);
  if (skippedVolunteerMatch) {
    return `${formatFullNameTitle(skippedVolunteerMatch[1])} was skipped in the volunteer queue.`;
  }

  const allowedSystemMessages = new Set([
    "Session started. Students can enter within 15 minutes.",
    "Session ended.",
    "Join request approved.",
  ]);

  if (allowedSystemMessages.has(text)) return text;
  if (/Could not|unavailable|removed from class|Class details updated/i.test(text)) return "";

  return text;
}

export default function ClassPageStudent() {
  const navigate = useNavigate();
  const { classId } = useParams();
  const [classData, setClassData] = useState(null);
  const [membership, setMembership] = useState(null);
  const [studentName, setStudentName] = useState("Student");
  const [studentAvatar, setStudentAvatar] = useState("");
  const [activity, setActivity] = useState([]);
  const [sessionEvents, setSessionEvents] = useState([]);
  const [sessionAlert, setSessionAlert] = useState("");
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
  const [pendingSelection, setPendingSelection] = useState(null);
  const [currentSelection, setCurrentSelection] = useState(null);
  const [studentSpinnerSpinning, setStudentSpinnerSpinning] = useState(false);
  const [studentSpinRotation, setStudentSpinRotation] = useState(0);
  const [selectionMessage, setSelectionMessage] = useState("");
  const [respondingSelection, setRespondingSelection] = useState(false);
  const [studentListOpen, setStudentListOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const previousPendingSelectionIdRef = useRef(null);
  const previousSelectionIdRef = useRef(null);
  const sessionAlertTimeoutRef = useRef(null);
  const activityListRef = useRef(null);
  const studentsRef = useRef([]);
  const classLoaded = Boolean(classData);
  const sessionOngoing = Boolean(classData?.session_active);
  const {
    playNotificationSound,
    playResultSound,
    playAcceptSound,
    playSkipSound,
  } = useAudioControls({
    sessionActive: sessionOngoing,
  });

  const showSessionAlert = useCallback((message) => {
    window.clearTimeout(sessionAlertTimeoutRef.current);
    setSessionAlert(message);
    sessionAlertTimeoutRef.current = window.setTimeout(() => {
      setSessionAlert("");
    }, 4500);
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(sessionAlertTimeoutRef.current);
  }, []);

  useEffect(() => {
    studentsRef.current = students;
  }, [students]);

  useEffect(() => {
    async function loadClass() {
      // Only logged-in students can open a student class page.
      const account = await requireStudent(navigate);
      if (!account) {
        return;
      }
      const studentUserId = account.user.id;
      setStudentName(
        account.studentProfile?.name ||
          account.user.user_metadata?.name ||
          account.user.user_metadata?.full_name ||
          "Student"
      );
      setStudentAvatar(account.studentProfile?.avatar_url || "");

      // Make sure the student really joined this class.
      const [
        { data, error },
        { data: activityRows },
        { data: requestRow },
        { data: memberRows },
        { data: queueRows },
        { data: logRows },
        { data: currentSelectionRows },
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
        supabase
          .from("class_session_logs")
          .select("id, message, created_at")
          .eq("class_id", classId)
          .order("created_at", { ascending: false })
          .limit(40),
        supabase
          .from("participation_selection_requests")
          .select("id, class_id, student_id, points, status, created_at, expires_at")
          .eq("class_id", classId)
          .in("status", ["pending", "accepted", "skip_requested"])
          .order("created_at", { ascending: false })
          .limit(1),
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
      if (sessionStartedAt) {
        requestAttemptsQuery = requestAttemptsQuery.gte("created_at", sessionStartedAt);
      }

      const [
        { count: requestAttemptCount, error: requestAttemptError },
      ] = await Promise.all([requestAttemptsQuery]);

      if (!requestAttemptError) {
        setJoinRequestAttempts(requestAttemptCount || 0);
      }
      setVolunteerAttempts(0);

      setClassData(classRow);
      setMembership({
        ...data,
        classes: classRow,
      });
      setJoinedSession(Boolean(data.entry_confirmed));
      setActivity(activityRows || []);
      setSessionEvents(logRows || []);
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
      setCurrentSelection(currentSelectionRows?.[0] || selectionRow || null);
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
    alreadyVolunteered;
  const selectedStudent = currentSelection
    ? students.find((student) => student.id === currentSelection.student_id) || null
    : null;
  const selectionFeedback = currentSelection && selectedStudent
    ? {
        isSelf: currentSelection.student_id === membership?.student_id,
        name: formatFullNameTitle(selectedStudent.name),
        status: currentSelection.status,
        points: currentSelection.points,
      }
    : null;
  const presentCount = students.filter((student) => student.present).length;

  const topScorers = useMemo(
    () =>
      [...students]
        .sort((a, b) => (b.points || 0) - (a.points || 0))
        .slice(0, 5),
    [students]
  );

  const activityFeed = useMemo(() => {
    const pointItems = activity.map((row) => {
      const student = Array.isArray(row.students) ? row.students[0] : row.students;
      const name = formatFullNameTitle(student?.name || "Student");

      return {
        id: `points-${row.id}`,
        createdAt: row.created_at,
        message: `Teacher awarded ${row.points} point${
          row.points === 1 ? "" : "s"
        } to ${name}.`,
      };
    });

    const sessionItems = sessionEvents
      .map((row) => ({
        id: `session-${row.id}`,
        createdAt: row.created_at,
        message: cleanSessionMessage(row.message),
      }))
      .filter((row) => row.message && !/^Teacher awarded \d+ point/i.test(row.message));

    return [...pointItems, ...sessionItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [activity, sessionEvents]);

  useEffect(() => {
    if (activityListRef.current) {
      activityListRef.current.scrollTop = 0;
    }
  }, [activityFeed.length]);

  useEffect(() => {
    if (!pendingSelection?.id) {
      previousPendingSelectionIdRef.current = null;
      return;
    }

    if (previousPendingSelectionIdRef.current !== pendingSelection.id) {
      previousPendingSelectionIdRef.current = pendingSelection.id;
      playResultSound();
    }
  }, [pendingSelection?.id, playResultSound]);

  useEffect(() => {
    if (!currentSelection?.id || students.length === 0) return undefined;
    if (previousSelectionIdRef.current === currentSelection.id) return undefined;

    previousSelectionIdRef.current = currentSelection.id;

    const maxWheelSegments = 40;
    const wheelStudents = students.slice(0, maxWheelSegments);
    const chosenIndex = wheelStudents.findIndex(
      (student) => student.id === currentSelection.student_id
    );

    if (chosenIndex < 0) return undefined;

    const segment = 360 / (wheelStudents.length || 1);
    const chosenCenterAngle = chosenIndex * segment + segment / 2;
    const targetModulo = (360 - chosenCenterAngle) % 360;

    setStudentSpinnerSpinning(true);
    requestAnimationFrame(() => {
      setStudentSpinRotation((prev) => {
        const currentModulo = ((prev % 360) + 360) % 360;
        const delta = (targetModulo - currentModulo + 360) % 360;
        return prev + 1440 + delta;
      });
    });

    const timeoutId = window.setTimeout(() => {
      setStudentSpinnerSpinning(false);
    }, 1300);

    return () => window.clearTimeout(timeoutId);
  }, [currentSelection?.id, currentSelection?.student_id, students]);

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
      { data: currentSelectionRows },
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
        supabase
          .from("participation_selection_requests")
          .select("id, class_id, student_id, points, status, created_at, expires_at")
          .eq("class_id", classId)
          .in("status", ["pending", "accepted", "skip_requested"])
          .order("created_at", { ascending: false })
          .limit(1),
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
    setCurrentSelection(currentSelectionRows?.[0] || selectionRow || null);
  }, [classId, membership?.student_id]);

  const refreshSessionEvents = useCallback(async () => {
    const { data, error } = await supabase
      .from("class_session_logs")
      .select("id, message, created_at")
      .eq("class_id", classId)
      .order("created_at", { ascending: false })
      .limit(40);

    if (error) {
      console.warn("Could not refresh session events:", error);
      return;
    }

    setSessionEvents(data || []);
  }, [classId]);

  const refreshClassStatus = useCallback(async () => {
    const { data, error } = await supabase
      .from("classes")
      .select("id, class_name, subject_code, class_code, program, teacher_id, session_active, session_started_at")
      .eq("id", classId)
      .maybeSingle();

    if (error || !data) {
      if (error) console.warn("Could not refresh class status:", error);
      return;
    }

    setClassData((prev) => {
      const nextClass = {
        ...data,
        teacher: prev?.teacher || null,
      };
      return nextClass;
    });
    setMembership((prev) =>
      prev
        ? {
            ...prev,
            classes: {
              ...data,
              teacher: prev.classes?.teacher || null,
            },
          }
        : prev
    );
    if (!data.session_active) {
      setJoinedSession(false);
      setPendingSelection(null);
      setCurrentSelection(null);
    }
  }, [classId]);

  const refreshLiveSessionState = useCallback(() => {
    refreshClassStatus();
    refreshParticipationState();
    refreshSessionEvents();
  }, [refreshClassStatus, refreshParticipationState, refreshSessionEvents]);

  useEffect(() => {
    if (!classLoaded || status) return undefined;

    refreshLiveSessionState();
    const intervalId = window.setInterval(refreshLiveSessionState, 2000);

    return () => window.clearInterval(intervalId);
  }, [classLoaded, status, refreshLiveSessionState]);

  useEffect(() => {
    if (!classLoaded || status) return undefined;

    const participationChannel = supabase
      .channel(`student-participation-${classId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "class_members",
          filter: `class_id=eq.${classId}`,
        },
        (payload) => {
          if (payload.new?.student_id === membership?.student_id) {
            setJoinedSession(Boolean(payload.new?.entry_confirmed));
            setMembership((prev) =>
              prev
                ? {
                    ...prev,
                    entry_confirmed: Boolean(payload.new?.entry_confirmed),
                  }
                : prev
            );
            if (payload.new?.entry_confirmed) {
              setJoinRequest(null);
              showSessionAlert("Your session entry was confirmed.");
              playNotificationSound();
            }
          }
          refreshParticipationState();
        }
      )
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
          const selectionStudent = studentsRef.current.find(
            (student) => student.id === payload.new?.student_id
          );
          const selectionName = selectionStudent
            ? formatFullNameTitle(selectionStudent.name)
            : "A student";

          if (
            payload.eventType === "INSERT" &&
            payload.new?.student_id === membership?.student_id
          ) {
            playResultSound();
            showSessionAlert("You were picked!");
          } else if (payload.eventType === "INSERT") {
            showSessionAlert(`${selectionName} was picked.`);
            playNotificationSound();
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
          if (
            payload.new &&
            ["pending", "accepted", "skip_requested"].includes(payload.new.status)
          ) {
            setCurrentSelection(payload.new);
          }
          refreshParticipationState();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "class_session_logs",
          filter: `class_id=eq.${classId}`,
        },
        (payload) => {
          const cleanMessage = cleanSessionMessage(payload.new?.message);
          if (cleanMessage) {
            showSessionAlert(cleanMessage);
          }
          refreshSessionEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(participationChannel);
    };
  }, [
    classLoaded,
    classId,
    membership?.student_id,
    playNotificationSound,
    playAcceptSound,
    playResultSound,
    playSkipSound,
    refreshParticipationState,
    refreshSessionEvents,
    showSessionAlert,
    status,
  ]);

  useEffect(() => {
    if (!classLoaded || status || !classId) return undefined;

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
          setClassData((prev) => ({
            ...payload.new,
            teacher: prev?.teacher || null,
          }));
          setMembership((prev) =>
            prev
              ? {
                  ...prev,
                  classes: {
                    ...payload.new,
                    teacher: prev.classes?.teacher || null,
                  },
                }
              : prev
          );
          if (!payload.new?.session_active) {
            setJoinedSession(false);
            setPendingSelection(null);
            setCurrentSelection(null);
          }
          showSessionAlert(
            payload.new?.session_active ? "Session started." : "Session ended."
          );
          playNotificationSound();
          refreshParticipationState();
          refreshSessionEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    classLoaded,
    classId,
    playNotificationSound,
    refreshParticipationState,
    refreshSessionEvents,
    showSessionAlert,
    status,
  ]);

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
    const volunteerMessage = `${formatFullNameTitle(studentName)} volunteered.`;
    setSessionEvents((prev) => [
      {
        id: `local-volunteer-${data.id}`,
        message: volunteerMessage,
        created_at: data.created_at,
      },
      ...prev,
    ]);
    supabase
      .from("class_session_logs")
      .insert({
        class_id: classId,
        teacher_id: classData?.teacher_id,
        session_started_at: classData?.session_started_at,
        message: volunteerMessage,
      })
      .then(({ error: logError }) => {
        if (logError) {
          console.warn("Could not save volunteer log:", logError);
        }
      });
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="student-dashboard student-class-dashboard">
      <MobileHeader
        notificationOpen={notificationsOpen}
        onToggleNotifications={() => setNotificationsOpen((open) => !open)}
        onProfileClick={() => navigate("/student/settings")}
        profileContent={
          studentAvatar ? (
            <img src={studentAvatar} alt="Profile" />
          ) : (
            studentName.charAt(0).toUpperCase()
          )
        }
        notificationPanel={
          <div className="student-notification-panel">
            <p className="student-notification-empty">
              Session alerts appear on this class page as they happen.
            </p>
          </div>
        }
      />

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

        {sessionAlert && (
          <div className="class-session-alert student-class-session-alert" role="status">
            {sessionAlert}
          </div>
        )}

        {!status && selectionFeedback && (
          <section
            className={`student-picked-banner ${
              selectionFeedback.isSelf ? "is-self" : ""
            }`}
            role="status"
          >
            <p className="student-class-kicker">Spinner result</p>
            <h2>
              {selectionFeedback.isSelf
                ? "You were picked!"
                : `${selectionFeedback.name} was picked.`}
            </h2>
            <span>
              {selectionFeedback.status === "accepted"
                ? "Accepted. Waiting for teacher to award points."
                : selectionFeedback.status === "skip_requested"
                  ? "Skip requested."
                  : `${selectionFeedback.points} point${
                      selectionFeedback.points === 1 ? "" : "s"
                    } offered.`}
            </span>
          </section>
        )}

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
                  currentSelection={currentSelection}
                  spinning={studentSpinnerSpinning}
                  spinRotation={studentSpinRotation}
                  pendingSelection={pendingSelection}
                  respondingSelection={respondingSelection}
                  selectionMessage={selectionMessage}
                  canJoinSession={canJoinSession}
                  volunteering={volunteering}
                  volunteerLimitReached={volunteerLimitReached}
                  alreadyVolunteered={alreadyVolunteered}
                  volunteerAttempts={volunteerAttempts}
                  sessionMessage={sessionMessage}
                  onSelectionResponse={handleSelectionResponse}
                  onVolunteer={handleVolunteer}
                />

                <VolunteerQueue queue={volunteerQueue} />
              </div>

              <aside className="student-side-stack">
                <section className="student-session-card student-activity-card">
                  <div className="student-activity-session-slot">
                    <p className="student-class-kicker">Session &amp; invites</p>
                    <p>
                      Students can join within <strong>15 minutes</strong> after the teacher starts.
                    </p>
                  </div>

                  <div className="student-activity-head">
                    <h2>Activity Log</h2>
                    <span>{activityFeed.length}</span>
                  </div>

                  <div className="student-activity-list" ref={activityListRef}>
                    {activityFeed.length === 0 ? (
                      <p>No activity yet.</p>
                    ) : (
                      activityFeed.map((row) => (
                        <article key={row.id}>
                          <strong>{row.message}</strong>
                          <span>{formatLocalActivityTime(row.createdAt)}</span>
                        </article>
                      ))
                    )}
                  </div>
                </section>

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
          </>
        )}
      </main>
      <BottomNav items={studentBottomNavItems} />
    </div>
  );
}
