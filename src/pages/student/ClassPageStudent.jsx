import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { requireStudent } from "../../features/authRole";
import { canEnterClass } from "../../features/studentClasses";
import { updateSelectionResponse } from "../../features/participation";
import { useAudioControls } from "../../hooks/useAudioControls";
import {
  formatFullNameTitle,
  formatStudentShort,
} from "../../utils/studentDisplay";
import ConfirmModal from "../../components/common/ConfirmModal";
import BottomNav, { studentBottomNavItems } from "../../components/shared/BottomNav";
import MobileHeader from "../../components/shared/MobileHeader";
import StudentNotificationPanel from "../../components/student/StudentNotificationPanel";
import { useStudentNotifications } from "../../hooks/useStudentNotifications";
import "../../styles/teacher/classpage.css";
import "../../styles/student/myclasses.css";
import "../../styles/student/classpageS.css";

const MAX_JOIN_REQUEST_ATTEMPTS = 3;

const PARTICIPATION_SELECTION_SELECT =
  "id, class_id, student_id, points, status, created_at, expires_at, students(id, name, email, student_id)";

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

  const text = String(value);
  const hasTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(text);
  const date = new Date(hasTimezone ? text : `${text}Z`);
  if (Number.isNaN(date.getTime())) return "";

  const dateStr = date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${dateStr} ${timeStr}`;
}

function getSelectedNameFromLog(message) {
  const text = String(message || "").trim();
  const match =
    text.match(/^(.+?)\s+was selected\.?$/i) ||
    text.match(/^(.+?)\s+selected\. Waiting for student response\.?$/i) ||
    text.match(/^(.+?)\s+selected\. Selection request table is unavailable.*$/i);

  return match ? formatFullNameTitle(match[1]) : "";
}

function getLatestSelectionFromLogs(logRows = [], roster = []) {
  for (const row of logRows) {
    const selectedName = getSelectedNameFromLog(row.message);
    if (!selectedName) continue;

    const selectedKey = selectedName.toLowerCase();
    const student = roster.find(
      (item) => formatFullNameTitle(item.name).toLowerCase() === selectedKey
    );

    if (!student) continue;

    return {
      id: `log-${row.id || row.created_at}`,
      class_id: row.class_id,
      student_id: student.id,
      points: null,
      status: "selected",
      created_at: row.created_at,
      fromLog: true,
    };
  }

  return null;
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
    text.match(/^(?:Teacher|Instructor) awarded\s+(\d+)\s+points?\s+to\s+(.+?)\.?$/i) ||
    text.match(/^(.+?)\s+\(\s*(.+?)\s*\)\s+is selected for\s+(\d+)\s+pts?\s+- accepted\.?$/i);
  if (awardedMatch) {
    const points = awardedMatch[3] || awardedMatch[1];
    const name = awardedMatch[2];
    return `Instructor awarded ${points} point${Number(points) === 1 ? "" : "s"} to ${formatFullNameTitle(name)}.`;
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
  const [studentId, setStudentId] = useState("");
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
  const [joinRequestMessage, setJoinRequestMessage] = useState("");
  const [sessionMessage, setSessionMessage] = useState("");
  const [status, setStatus] = useState("Loading class...");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingSelection, setPendingSelection] = useState(null);
  const [currentSelection, setCurrentSelection] = useState(null);
  const [selectionMessage, setSelectionMessage] = useState("");
  const [respondingSelection, setRespondingSelection] = useState(false);
  const [selectionPopup, setSelectionPopup] = useState(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const previousPendingSelectionIdRef = useRef(null);
  const previousLogSelectionIdRef = useRef(null);
  const logSelectionWatcherReadyRef = useRef(false);
  const lastPickedPopupRef = useRef({ studentId: "", shownAt: 0 });
  const sessionAlertTimeoutRef = useRef(null);
  const selectionPopupTimeoutRef = useRef(null);
  const activityListRef = useRef(null);
  const studentsRef = useRef([]);
  const studentNameRef = useRef(studentName);
  const sessionEventsRef = useRef([]);
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
  const {
    notifications,
    unreadNotifications,
    loadingNotifications,
    notificationsReadAt,
    handleMarkAllRead,
  } = useStudentNotifications(studentId);

  const showSessionAlert = useCallback((message) => {
    window.clearTimeout(sessionAlertTimeoutRef.current);
    setSessionAlert(message);
    sessionAlertTimeoutRef.current = window.setTimeout(() => {
      setSessionAlert("");
    }, 4500);
  }, []);

  useEffect(() => {
    return () => {
      window.clearTimeout(sessionAlertTimeoutRef.current);
      window.clearTimeout(selectionPopupTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    studentsRef.current = students;
  }, [students]);

  useEffect(() => {
    studentNameRef.current = studentName;
  }, [studentName]);

  useEffect(() => {
    sessionEventsRef.current = sessionEvents;
  }, [sessionEvents]);

  useEffect(() => {
    async function loadClass() {
      // Only logged-in students can open a student class page.
      const account = await requireStudent(navigate);
      if (!account) {
        return;
      }
      const studentUserId = account.user.id;
      setStudentId(studentUserId);
      setStudentName(
        account.studentProfile?.name ||
          account.user.user_metadata?.name ||
          account.user.user_metadata?.full_name ||
          "Student"
      );
      setStudentAvatar(
        account.studentProfile?.avatar_url ||
          account.user.user_metadata?.avatar_url ||
          account.user.user_metadata?.picture ||
          ""
      );

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
            "id, class_id, student_id, joined_at, entry_confirmed, classes!inner(id, class_name, subject_code, class_code, program, teacher_id, session_active, session_started_at)"
          )
          .eq("class_id", classId)
          .eq("student_id", studentUserId)
          .maybeSingle(),
        supabase
          .from("participation")
          .select("id, student_id, points, created_at, students!inner(id, name, email, student_id)")
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
          .select("id, student_id, entry_confirmed, students!inner(id, name, email, student_id)")
          .eq("class_id", classId),
        supabase
          .from("volunteer_queue")
          .select("id, class_id, student_id, status, created_at, students!inner(id, name, email, student_id)")
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
          .select(PARTICIPATION_SELECTION_SELECT)
          .eq("class_id", classId)
          .in("status", ["pending", "accepted", "skip_requested", "awarded", "skipped"])
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
      const roster = (memberRows || [])
        .map((item) => mapRosterStudent(item, pointsByStudentId))
        .sort((a, b) => getLastNameSortKey(a.name).localeCompare(getLastNameSortKey(b.name)));
      setStudents(roster);
      setVolunteerQueue(
        classRow.session_active
          ? (queueRows || [])
              .filter(
                (row) =>
                  !classRow.session_started_at ||
                  new Date(row.created_at) >= new Date(classRow.session_started_at)
              )
              .map(mapQueueRow)
          : []
      );
      setJoinRequest(requestRow || null);

      const { data: selectionRow, error: selectionError } = await supabase
        .from("participation_selection_requests")
        .select(PARTICIPATION_SELECTION_SELECT)
        .eq("class_id", classId)
        .eq("student_id", studentUserId)
        .eq("status", "pending")
        .maybeSingle();

      if (!selectionError) {
        setPendingSelection(selectionRow || null);
      }
      const latestSelection = currentSelectionRows?.[0];
      const latestSelectionInSession =
        latestSelection &&
        (!classRow.session_started_at ||
          new Date(latestSelection.created_at) >= new Date(classRow.session_started_at))
          ? latestSelection
          : null;
      setCurrentSelection(
        classRow.session_active
          ? latestSelectionInSession ||
              selectionRow ||
              getLatestSelectionFromLogs(
                classRow.session_started_at
                  ? (logRows || []).filter(
                      (row) =>
                        new Date(row.created_at) >= new Date(classRow.session_started_at)
                    )
                  : logRows || [],
                roster
              )
          : null
      );
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

  const pointsByStudentIdFromActivity = useMemo(
    () =>
      activity.reduce((acc, row) => {
        acc[row.student_id] = (acc[row.student_id] || 0) + (row.points || 0);
        return acc;
      }, {}),
    [activity]
  );

  const selectedStudent = useMemo(() => {
    if (!currentSelection?.student_id) return null;
    const sid = currentSelection.student_id;
    const fromRoster = students.find((student) => student.id === sid);
    if (fromRoster) return fromRoster;
    const joined = currentSelection.students;
    const st = Array.isArray(joined) ? joined[0] : joined;
    if (st?.name) {
      return {
        id: sid,
        name: st.name,
        points: pointsByStudentIdFromActivity[sid] || 0,
        present: true,
      };
    }
    return null;
  }, [currentSelection, students, pointsByStudentIdFromActivity]);

  const topScorers = useMemo(
    () =>
      [...students]
        .sort((a, b) => (b.points || 0) - (a.points || 0))
        .slice(0, 5),
    [students]
  );
  const currentStudent = useMemo(
    () => students.find((student) => student.id === membership?.student_id) || null,
    [membership?.student_id, students]
  );

  const activityFeed = useMemo(() => {
    if (!classData?.session_active || !classData?.session_started_at) return [];

    const sessionStartedAt = new Date(classData.session_started_at);
    const sessionActivity = activity.filter(
      (row) => new Date(row.created_at) >= sessionStartedAt
    );
    const sessionLogs = sessionEvents.filter(
      (row) => new Date(row.created_at) >= sessionStartedAt
    );

    const pointItems = sessionActivity.map((row) => {
      const student = Array.isArray(row.students) ? row.students[0] : row.students;
      const name = formatFullNameTitle(student?.name || "Student");

      return {
        id: `points-${row.id}`,
        createdAt: row.created_at,
        message: `Instructor awarded ${row.points} point${
          row.points === 1 ? "" : "s"
        } to ${name}.`,
      };
    });

    const sessionItems = sessionLogs
      .map((row) => ({
        id: `session-${row.id}`,
        createdAt: row.created_at,
        message: cleanSessionMessage(row.message),
      }))
      .filter(
        (row) =>
          row.message &&
          !/^(?:Teacher|Instructor) awarded \d+ point/i.test(row.message) &&
          !/ volunteered\.?$/i.test(row.message)
      );

    const seen = new Set();
    return [...pointItems, ...sessionItems]
      .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .filter((item) => {
        const key = `${item.message}-${formatLocalActivityTime(item.createdAt)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [activity, classData?.session_active, classData?.session_started_at, sessionEvents]);
  useEffect(() => {
    if (activityListRef.current) {
      activityListRef.current.scrollTop = 0;
    }
  }, [activityFeed.length]);

  const showPickedPopup = useCallback(
    (selection) => {
      if (!selection?.id) return;
      const now = Date.now();
      const duplicateRecentPopup =
        selection.student_id &&
        lastPickedPopupRef.current.studentId === selection.student_id &&
        now - lastPickedPopupRef.current.shownAt < 4000;

      if (duplicateRecentPopup) return;

      lastPickedPopupRef.current = {
        studentId: selection.student_id || "",
        shownAt: now,
      };
  
      playResultSound();
  
      const joinedStudent = Array.isArray(selection.students)
        ? selection.students[0]
        : selection.students;
      const rosterStudent = studentsRef.current.find(
        (student) => student.id === selection.student_id
      );
  
      setSelectionPopup({
        name: formatFullNameTitle(
          rosterStudent?.name || joinedStudent?.name || studentNameRef.current
        ),
        points: selection.points == null ? null : Number(selection.points),
      });
  
      window.clearTimeout(selectionPopupTimeoutRef.current);
      selectionPopupTimeoutRef.current = window.setTimeout(() => {
        setSelectionPopup(null);
      }, 3000);
    },
    [playResultSound]
  );

  useEffect(() => {
    if (!pendingSelection?.id) return;
  
    if (previousPendingSelectionIdRef.current === pendingSelection.id) return;
  
    previousPendingSelectionIdRef.current = pendingSelection.id;
    showPickedPopup(pendingSelection);
  }, [pendingSelection, showPickedPopup]);

  useEffect(() => {
    if (
      pendingSelection ||
      !currentSelection?.fromLog ||
      currentSelection.student_id !== membership?.student_id
    ) {
      return;
    }

    if (previousLogSelectionIdRef.current === currentSelection.id) return;

    previousLogSelectionIdRef.current = currentSelection.id;
    showPickedPopup(currentSelection);
  }, [currentSelection, membership?.student_id, pendingSelection, showPickedPopup]);


  const handleJoinSession = async () => {
    if (!canJoinSession) {
      setStatus("Entry window expired. Please wait for instructor confirmation.");
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
    const sessionStartedAt = classData?.session_started_at;
    const activeSession = Boolean(classData?.session_active && sessionStartedAt);
    
    // Only run queries if session is active or if we need basic data
    if (!activeSession && students.length > 0) {
      return;
    }

    const ownSelectionQuery = membership?.student_id
      ? supabase
          .from("participation_selection_requests")
          .select(PARTICIPATION_SELECTION_SELECT)
          .eq("class_id", classId)
          .eq("student_id", membership.student_id)
          .eq("status", "pending")
          .maybeSingle()
      : { data: null };
    const currentSelectionQuery = activeSession
      ? supabase
          .from("participation_selection_requests")
          .select(PARTICIPATION_SELECTION_SELECT)
          .eq("class_id", classId)
          .in("status", ["pending", "accepted", "skip_requested", "awarded", "skipped"])
          .gte("created_at", sessionStartedAt)
          .order("created_at", { ascending: false })
          .limit(1)
      : { data: [] };

    const queries = [
      supabase
        .from("participation")
        .select("id, student_id, points, created_at, students!inner(id, name, email, student_id)")
        .eq("class_id", classId)
        .order("created_at", { ascending: false }),
      supabase
        .from("class_members")
        .select("id, student_id, entry_confirmed, students!inner(id, name, email, student_id)")
        .eq("class_id", classId),
    ];

    // Only include volunteer queue query for active sessions
    if (activeSession) {
      queries.push(
        supabase
          .from("volunteer_queue")
          .select("id, class_id, student_id, status, created_at, students!inner(id, name, email, student_id)")
          .eq("class_id", classId)
          .eq("status", "waiting")
          .order("created_at", { ascending: true })
      );
    }

    queries.push(ownSelectionQuery, currentSelectionQuery);

    const [
      { data: activityRows },
      { data: memberRows },
      ...restQueries
    ] = await Promise.all(queries);

    const { data: queueRows } = activeSession ? restQueries[0] : { data: [] };
    const { data: selectionRow } = activeSession ? restQueries[1] : restQueries[0];
    const { data: currentSelectionRows } = activeSession ? restQueries[2] : restQueries[1];

    setActivity(activityRows || []);
    const pointsByStudentId = (activityRows || []).reduce((acc, item) => {
      acc[item.student_id] = (acc[item.student_id] || 0) + (item.points || 0);
      return acc;
    }, {});
    const roster = (memberRows || [])
      .map((item) => mapRosterStudent(item, pointsByStudentId))
      .sort((a, b) => getLastNameSortKey(a.name).localeCompare(getLastNameSortKey(b.name)));
    setStudents(roster);
    setVolunteerQueue(
      activeSession
        ? (queueRows || [])
            .filter((row) => !sessionStartedAt || new Date(row.created_at) >= new Date(sessionStartedAt))
            .map(mapQueueRow)
        : []
    );
    setPendingSelection(selectionRow || null);
    setCurrentSelection(
      activeSession
        ? currentSelectionRows?.[0] ||
            selectionRow ||
            getLatestSelectionFromLogs(
              sessionStartedAt
                ? sessionEventsRef.current.filter(
                    (row) => new Date(row.created_at) >= new Date(sessionStartedAt)
                  )
                : sessionEventsRef.current,
              roster
            )
        : null
    );
  }, [classData?.session_active, classData?.session_started_at, classId, membership?.student_id]);

  const refreshSessionEvents = useCallback(async () => {
    if (!classData?.session_active || !classData?.session_started_at) {
      setSessionEvents([]);
      return;
    }

    const { data, error } = await supabase
      .from("class_session_logs")
      .select("id, message, created_at")
      .eq("class_id", classId)
      .gte("created_at", classData.session_started_at)
      .order("created_at", { ascending: false })
      .limit(40);

    if (error) {
      console.warn("Could not refresh session events:", error);
      return;
    }

    const nextEvents = data || [];
    setSessionEvents(nextEvents);
    const fallbackSelection = getLatestSelectionFromLogs(nextEvents, studentsRef.current);
    if (fallbackSelection) {
      setCurrentSelection((current) => current || fallbackSelection);
    }
  }, [classData?.session_active, classData?.session_started_at, classId]);

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
      setSessionEvents([]);
    }
  }, [classId]);

  const refreshLiveSessionStateRef = useRef(null);
  refreshLiveSessionStateRef.current = () => {
    refreshClassStatus();
    refreshParticipationState();
    refreshSessionEvents();
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const refreshLiveSessionState = useCallback(() => {
    refreshLiveSessionStateRef.current?.();
  }, []);

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
          if (
            payload.eventType === "INSERT" &&
            payload.new?.student_id === membership?.student_id
          ) {
            setPendingSelection(payload.new);
            setCurrentSelection(payload.new);
          } else if (payload.eventType === "INSERT") {
            playNotificationSound();
          } else if (
            payload.eventType === "UPDATE" &&
            payload.new?.student_id === membership?.student_id
          ) {
            if (payload.new?.status === "accepted") {
              playAcceptSound();
            } else if (payload.new?.status === "skip_requested") {
              playSkipSound();
            } else if (payload.new?.status === "awarded") {
              playAcceptSound();
            } else if (payload.new?.status === "skipped") {
              playSkipSound();
            } else {
              playNotificationSound();
            }
          }
          // Keep currentSelection updated for all relevant statuses,
          // including resolved ones so the outcome is visible to the student.
          if (
            payload.new &&
            ["pending", "accepted", "skip_requested", "awarded", "skipped"].includes(
              payload.new.status
            )
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
          if (cleanMessage && !/was selected\.?$/i.test(String(cleanMessage).trim())) {
            showSessionAlert(cleanMessage);
          }
          const fallbackSelection = getLatestSelectionFromLogs(
            payload.new ? [payload.new] : [],
            studentsRef.current
          );
          if (fallbackSelection) {
            if (
              fallbackSelection.student_id === membership?.student_id &&
              previousLogSelectionIdRef.current !== fallbackSelection.id
            ) {
              previousLogSelectionIdRef.current = fallbackSelection.id;
              showPickedPopup(fallbackSelection);
            }
            setCurrentSelection(fallbackSelection);
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
    playSkipSound,
    refreshParticipationState,
    refreshSessionEvents,
    showPickedPopup,
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
            setSessionEvents([]);
          }
          showSessionAlert(
            payload.new?.session_active ? "Session started." : "Session ended."
          );
          playNotificationSound();
          refreshParticipationState();
          if (payload.new?.session_active) {
            refreshSessionEvents();
          }
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
    setJoinRequestMessage("Request sent. Please wait for instructor approval.");
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
        ? "Accepted. Waiting for your instructor to award points."
        : "Skip request sent to your instructor."
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
        notificationCount={unreadNotifications}
        onProfileClick={() => navigate("/student/settings")}
        profileContent={
          studentAvatar ? (
            <img src={studentAvatar} alt="Profile" />
          ) : (
            studentName.charAt(0).toUpperCase()
          )
        }
        notificationPanel={
          <StudentNotificationPanel
            notifications={notifications}
            unreadNotifications={unreadNotifications}
            loadingNotifications={loadingNotifications}
            notificationsReadAt={notificationsReadAt}
            onMarkAllRead={handleMarkAllRead}
          />
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
                    Instructor: {classData.teacher?.name || "Instructor name unavailable"}
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

        {selectionPopup && (
          <div className="student-picked-popup" role="status" aria-live="polite">
            <div className="student-picked-popup-card">
              <span className="student-class-kicker">You were picked</span>
              <strong>{selectionPopup.name}</strong>
              <p>
                Get ready to participate for <b>{selectionPopup.points ?? "assigned"}</b> pt
                {selectionPopup.points === 1 ? "" : "s"}.
              </p>
            </div>
          </div>
        )}

        {status ? (
          <section className="student-session-card student-class-status-card">
            <h2>{status}</h2>
            <p>Students must enter within 15 minutes unless the instructor confirms entry.</p>
          </section>
        ) : (
          <>
            <section className="student-class-session-grid">
              <section className="student-session-card student-own-points-card">
                <div className="student-own-points-row">
                  <span className="student-class-kicker">My points</span>
                  <strong>
                    {studentOwnPoints} pt{studentOwnPoints === 1 ? "" : "s"}
                  </strong>
                </div>
                <p>
                  {currentStudent?.present
                    ? "Points update in real-time as your instructor awards participation."
                    : sessionOngoing
                      ? "Join the live session to be marked present."
                      : "Points update after your instructor records participation."}
                </p>

                {pendingSelection && selectedStudent && (
                  <div className="student-selection-response">
                    <p className="student-class-kicker">You were selected</p>
                    <h3>{formatFullNameTitle(selectedStudent.name)}</h3>
                    <p>
                      Accept to participate for <strong>{pendingSelection.points}</strong>{" "}
                      pt{pendingSelection.points === 1 ? "" : "s"}, or request to skip when
                      needed.
                    </p>
                    <div className="student-selection-actions">
                      <button
                        type="button"
                        className="student-primary-btn"
                        onClick={() => handleSelectionResponse("accepted")}
                        disabled={respondingSelection}
                      >
                        {respondingSelection ? "Sending..." : "Accept"}
                      </button>
                      <button
                        type="button"
                        className="student-selection-skip-btn"
                        onClick={() => handleSelectionResponse("skip_requested")}
                        disabled={respondingSelection}
                      >
                        Request Skip
                      </button>
                    </div>
                  </div>
                )}

                {selectionMessage && (
                  <p className="student-selection-message">{selectionMessage}</p>
                )}
              </section>

              <section className="student-session-card student-activity-card">
                <div className="student-activity-session-slot">
                  <p className="student-class-kicker">Session &amp; invites</p>
                  <p>
                    Students can join within <strong>15 minutes</strong> after the instructor starts.
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

                <div className="student-activity-queue">
                  <div className="student-activity-queue-head">
                    <h3>Volunteer Queue</h3>
                    {sessionOngoing && (
                      <button
                        type="button"
                        className="student-primary-btn student-volunteer-inline-btn"
                        onClick={handleVolunteer}
                        disabled={!canJoinSession || volunteering || volunteerLimitReached}
                      >
                        {alreadyVolunteered
                          ? "Already in Queue"
                          : volunteering
                            ? "Joining..."
                            : "Volunteer"}
                      </button>
                    )}
                  </div>

                  {sessionMessage && <p className="student-selection-message">{sessionMessage}</p>}

                  <ol className="student-volunteer-list">
                    {volunteerQueue.length === 0 ? (
                      <li className="student-volunteer-empty">No volunteers in queue.</li>
                    ) : (
                      volunteerQueue.map((item, index) => (
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
                      <li
                        className={
                          student.id === membership?.student_id ? "is-current-student" : ""
                        }
                        key={student.id}
                      >
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
            </section>

          </>
        )}
      </main>
      <BottomNav items={studentBottomNavItems} />
    </div>
  );
}

