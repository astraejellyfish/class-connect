import { useCallback } from "react";
import { supabase } from "../lib/supabase";

export function useTeacherClassSession({
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
  endedLogRetentionMs,
}) {
  const handleStartSession = useCallback(async () => {
    const startedAt = new Date().toISOString();
    const { error } = await supabase
      .from("classes")
      .update({ session_active: true, session_started_at: startedAt })
      .eq("id", classId);

    if (error) {
      console.error(error);
      addLog("Could not start session. Please try again.");
      return;
    }

    // Reset confirmations for the new live session.
    await supabase
      .from("class_members")
      .update({ entry_confirmed: false })
      .eq("class_id", classId);

    setSessionActive(true);
    setClassData((prev) =>
      prev
        ? {
            ...prev,
            sessionActive: true,
            sessionStartedAt: startedAt,
          }
        : prev
    );
    setStudents((prev) =>
      prev.map((student) => ({
        ...student,
        entryConfirmed: false,
        present: false,
      }))
    );
    setSessionSelectedStudentIds(new Set());
    addLog("Session started. Students can enter within 15 minutes.", {
      sessionStartedAt: startedAt,
    });
    restartSessionMusic();
  }, [
    addLog,
    classId,
    restartSessionMusic,
    setClassData,
    setSessionActive,
    setSessionSelectedStudentIds,
    setStudents,
  ]);

  const handleEndSession = useCallback(async () => {
    const { error } = await supabase
      .from("classes")
      .update({ session_active: false })
      .eq("id", classId);

    if (error) {
      console.error(error);
      addLog("Could not end session. Please try again.");
      return;
    }

    setSessionActive(false);
    setClassData((prev) =>
      prev
        ? {
            ...prev,
            sessionActive: false,
          }
        : prev
    );
    setSelectedStudent(null);
    setPendingPick(null);
    setPickOutcome(null);
    setSessionSelectedStudentIds(new Set());
    setVolunteerQueue([]);
    addLog("Session ended.");
    window.setTimeout(() => {
      setLogs([]);
    }, endedLogRetentionMs);
    pauseSessionMusic();
  }, [
    addLog,
    classId,
    endedLogRetentionMs,
    pauseSessionMusic,
    setClassData,
    setLogs,
    setPendingPick,
    setPickOutcome,
    setSelectedStudent,
    setSessionActive,
    setSessionSelectedStudentIds,
    setVolunteerQueue,
  ]);

  return {
    handleStartSession,
    handleEndSession,
  };
}
