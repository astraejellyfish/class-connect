import { useCallback } from "react";
import {
  createSelectionRequest,
  recordParticipationPoints,
  resolveSelectionRequest,
} from "../features/participation";
import { supabase } from "../lib/supabase";
import {
  formatFullNameTitle,
  formatStudentShort,
} from "../utils/studentDisplay";

export function useTeacherParticipationActions({
  classId,
  students,
  spinning,
  pendingPick,
  awardPointsInput,
  teacherSettings,
  sessionSelectedStudentIds,
  volunteerQueue,
  savingVolunteer,
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
}) {
  const resolvePick = useCallback(
    async (confirmed, resolutionStatus = confirmed ? "awarded" : "skipped") => {
      if (!pendingPick) return;

      const { student, pts } = pendingPick;
      const short = formatStudentShort(student.name);
      const fullName = formatFullNameTitle(student.name);

      if (confirmed) {
        setResolvingPick(true);
        const { error } = await recordParticipationPoints({
          classId,
          studentId: student.id,
          points: pts,
        });
        setResolvingPick(false);

        if (error) {
          console.error(error);
          addLog(`Could not record points for ${short}. Please try again.`);
          return;
        }

        setStudents((prev) =>
          prev.map((s) =>
            s.id === student.id ? { ...s, points: (s.points || 0) + pts } : s
          )
        );
        playAcceptSound();
        addLog(
          `${short} ( ${fullName} ) is selected for ${pts} pt${
            pts === 1 ? "" : "s"
          } - accepted`
        );
        setPickOutcome({ kind: "Yes", pts });
      } else {
        addLog(
          `${short} ( ${fullName} ) is selected - ${
            resolutionStatus === "expired" ? "expired" : "skip requested"
          } (0 pts; offered ${pts}).`
        );
        setPickOutcome({ kind: "No", offered: pts });
        playSkipSound();
      }

      if (pendingPick.requestId) {
        const { error: requestError } = await resolveSelectionRequest(
          pendingPick.requestId,
          resolutionStatus
        );

        if (requestError) {
          console.warn("Could not update selection request:", requestError);
        }
      }

      setPendingPick(null);
    },
    [
      addLog,
      classId,
      pendingPick,
      playAcceptSound,
      playSkipSound,
      setPendingPick,
      setPickOutcome,
      setResolvingPick,
      setStudents,
    ]
  );

  const spinStudent = useCallback(() => {
    const maxWheelSegments = 40;
    const wheelStudents = students.slice(0, maxWheelSegments);
    const presentStudents = wheelStudents.filter(
      (s) => s.present && !sessionSelectedStudentIds.has(s.id)
    );
    if (presentStudents.length === 0 || spinning || pendingPick) return;

    const parsed = parseInt(String(awardPointsInput).trim(), 10);
    const pts = Number.isFinite(parsed)
      ? Math.min(99, Math.max(1, parsed))
      : 1;

    const weighted = presentStudents.map((student) => ({
      ...student,
      weight: 1 / ((student.points || 0) + 1),
    }));

    const totalWeight = weighted.reduce((sum, s) => sum + s.weight, 0);
    let r = Math.random() * totalWeight;
    let chosen = weighted[0];

    for (const s of weighted) {
      r -= s.weight;
      if (r <= 0) {
        chosen = s;
        break;
      }
    }

    const chosenIndex = Math.max(
      0,
      wheelStudents.findIndex((student) => student.id === chosen.id)
    );
    const segment = 360 / (wheelStudents.length || 1);
    const chosenCenterAngle = chosenIndex * segment + segment / 2;
    const targetModulo = (360 - chosenCenterAngle) % 360;

    setSpinning(true);
    setPickOutcome(null);
    setPendingPick(null);
    requestAnimationFrame(() => {
      setSpinRotation((prev) => {
        const currentModulo = ((prev % 360) + 360) % 360;
        const delta = (targetModulo - currentModulo + 360) % 360;

        return prev + 1440 + delta;
      });
    });

    setTimeout(async () => {
      setSelectedStudent(chosen);
      setSessionSelectedStudentIds((prev) => new Set(prev).add(chosen.id));
      setSpinning(false);
      const { data, error } = await createSelectionRequest({
        classId,
        studentId: chosen.id,
        points: pts,
      });

      if (error) {
        console.warn("Selection request table is unavailable:", error);
        setSelectionRequestUnavailable(true);
        setPendingPick({
          student: chosen,
          pts,
          responseStatus: "teacher_confirmation",
        });
        addLog(
          `${formatStudentShort(chosen.name)} selected. Selection request table is unavailable, use teacher confirmation.`
        );
        playResultSound();
        return;
      }

      setSelectionRequestUnavailable(false);
      setPendingPick({
        student: chosen,
        pts,
        requestId: data.id,
        responseStatus: data.status,
        expiresAt: data.expires_at,
      });
      addLog(`${formatStudentShort(chosen.name)} selected. Waiting for student response.`);
      playResultSound();
    }, 1200);
  }, [
    addLog,
    awardPointsInput,
    classId,
    pendingPick,
    playResultSound,
    sessionSelectedStudentIds,
    setPendingPick,
    setPickOutcome,
    setSelectedStudent,
    setSelectionRequestUnavailable,
    setSessionSelectedStudentIds,
    setSpinRotation,
    setSpinning,
    spinning,
    students,
  ]);

  const acceptVolunteer = useCallback(async () => {
    const volunteer = volunteerQueue[0];
    if (!teacherSettings.allowVolunteers || !volunteer || savingVolunteer) return;

    const parsed = parseInt(String(awardPointsInput).trim(), 10);
    const pts = Number.isFinite(parsed)
      ? Math.min(99, Math.max(1, parsed))
      : 1;
    const short = formatStudentShort(volunteer.name);
    const fullName = formatFullNameTitle(volunteer.name);

    setSavingVolunteer(true);
    const { error: pointsError } = await recordParticipationPoints({
      classId,
      studentId: volunteer.id,
      points: pts,
    });

    const { error: queueError } = volunteer.queueId
      ? await supabase
          .from("volunteer_queue")
          .update({ status: "accepted", resolved_at: new Date().toISOString() })
          .eq("id", volunteer.queueId)
      : { error: null };
    setSavingVolunteer(false);

    if (pointsError || queueError) {
      console.error(pointsError || queueError);
      addLog(`Could not record volunteer points for ${short}. Please try again.`);
      return;
    }

    setStudents((prev) =>
      prev.map((student) =>
        student.id === volunteer.id
          ? { ...student, points: (student.points || 0) + pts }
          : student
      )
    );
    setVolunteerQueue((prev) =>
      prev.filter((item) =>
        volunteer.queueId ? item.queueId !== volunteer.queueId : item.id !== volunteer.id
      )
    );
    addLog(
      `${short} ( ${fullName} ) accepted as volunteer for ${pts} pt${
        pts === 1 ? "" : "s"
      }.`
    );
    playAcceptSound();
  }, [
    addLog,
    awardPointsInput,
    classId,
    playAcceptSound,
    savingVolunteer,
    setSavingVolunteer,
    setStudents,
    setVolunteerQueue,
    teacherSettings.allowVolunteers,
    volunteerQueue,
  ]);

  const skipVolunteer = useCallback(() => {
    const volunteer = volunteerQueue[0];
    if (!teacherSettings.allowVolunteers || !volunteer || savingVolunteer) return;

    async function skipCurrentVolunteer() {
      setSavingVolunteer(true);
      const { error } = volunteer.queueId
        ? await supabase
            .from("volunteer_queue")
            .update({ status: "skipped", resolved_at: new Date().toISOString() })
            .eq("id", volunteer.queueId)
        : { error: null };
      setSavingVolunteer(false);

      if (error) {
        console.error(error);
        addLog(`Could not skip ${formatStudentShort(volunteer.name)}. Please try again.`);
        return;
      }

      setVolunteerQueue((prev) =>
        prev.filter((item) =>
          volunteer.queueId ? item.queueId !== volunteer.queueId : item.id !== volunteer.id
        )
      );
      addLog(`${formatStudentShort(volunteer.name)} skipped in volunteer queue.`);
      playSkipSound();
    }

    skipCurrentVolunteer();
  }, [
    addLog,
    playSkipSound,
    savingVolunteer,
    setSavingVolunteer,
    setVolunteerQueue,
    teacherSettings.allowVolunteers,
    volunteerQueue,
  ]);

  return {
    resolvePick,
    spinStudent,
    acceptVolunteer,
    skipVolunteer,
  };
}
