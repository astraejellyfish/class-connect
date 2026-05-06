import { supabase } from "../lib/supabase";

export async function getStudentProfile(studentId) {
  if (!studentId) return { data: null, error: null };

  return supabase
    .from("students")
    .select("id, name, email, student_id")
    .eq("id", studentId)
    .maybeSingle();
}

export async function getStudentClassMemberships(studentId) {
  if (!studentId) return { data: [], error: null };

  // Get every class the student already joined.
  const { data, error } = await supabase
    .from("class_members")
    .select(
      "id, class_id, student_id, joined_at, entry_confirmed, classes(id, class_name, subject_code, class_code, program, teacher_id, session_active, session_started_at)"
    )
    .eq("student_id", studentId)
    .order("joined_at", { ascending: false });

  if (error || !data) return { data: data || [], error };

  const teacherIds = [
    ...new Set(
      data
        .map((row) => {
          const classRow = Array.isArray(row.classes) ? row.classes[0] : row.classes;
          return classRow?.teacher_id;
        })
        .filter(Boolean)
    ),
  ];

  if (teacherIds.length === 0) return { data, error: null };

  const { data: teacherRows, error: teacherError } = await supabase
    .from("teachers")
    .select("id, name, email")
    .in("id", teacherIds);

  if (teacherError) return { data, error: null };

  const teachersById = (teacherRows || []).reduce((acc, teacher) => {
    acc[teacher.id] = teacher;
    return acc;
  }, {});

  return {
    data: data.map((row) => {
      const classRow = Array.isArray(row.classes) ? row.classes[0] : row.classes;
      const classWithTeacher = classRow
        ? {
            ...classRow,
            teacher: teachersById[classRow.teacher_id] || null,
          }
        : classRow;

      return {
        ...row,
        classes: Array.isArray(row.classes) ? [classWithTeacher] : classWithTeacher,
      };
    }),
    error: null,
  };
}

export async function joinClassByCode(studentId, classCode) {
  let normalizedCode = String(classCode || "").trim();

  // Accept either a plain code or a full invite link.
  if (normalizedCode.includes("/")) {
    const parts = normalizedCode.split("/").filter(Boolean);
    normalizedCode = parts[parts.length - 1] || "";
  }

  if (!studentId || !normalizedCode) {
    return { data: null, error: new Error("Student and class code are required.") };
  }

  // Find the class using the code given by the teacher.
  const { data: classRow, error: classError } = await supabase
    .from("classes")
    .select("id, class_name, subject_code, class_code, program, teacher_id, session_active, session_started_at")
    .eq("class_code", normalizedCode)
    .maybeSingle();

  if (classError) return { data: null, error: classError };
  if (!classRow) return { data: null, error: new Error("Class code was not found.") };

  const { data: teacherRow } = await supabase
    .from("teachers")
    .select("id, name, email")
    .eq("id", classRow.teacher_id)
    .maybeSingle();

  const classWithTeacher = {
    ...classRow,
    teacher: teacherRow || null,
  };

  // Stop duplicate joins for the same student and class.
  const { data: existing, error: existingError } = await supabase
    .from("class_members")
    .select("id, class_id, student_id, joined_at, entry_confirmed")
    .eq("class_id", classRow.id)
    .eq("student_id", studentId)
    .maybeSingle();

  if (existingError) return { data: null, error: existingError };
  if (existing) {
    return {
      data: {
        ...existing,
        classes: classWithTeacher,
      },
      error: null,
    };
  }

  // Save when the student joined so we can check the 15-minute entry rule.
  const { data: membership, error: joinError } = await supabase
    .from("class_members")
    .insert({
      class_id: classRow.id,
      student_id: studentId,
      joined_at: new Date().toISOString(),
      entry_confirmed: false,
    })
    .select("id, class_id, student_id, joined_at, entry_confirmed")
    .single();

  if (joinError) return { data: null, error: joinError };

  return {
    data: {
      ...membership,
      classes: classWithTeacher,
    },
    error: null,
  };
}

export function canEnterClass(membership) {
  const classData = membership?.classData || membership?.classes;
  const currentClass = Array.isArray(classData) ? classData[0] : classData;

  // Students can view class info when no live session is running.
  if (!currentClass?.session_active) return true;

  // Teacher confirmation always allows entry.
  if (membership?.entry_confirmed) return true;

  const sessionStartedAt = currentClass?.session_started_at;
  if (!sessionStartedAt) return false;

  const sessionStartTime = new Date(sessionStartedAt).getTime();
  if (!Number.isFinite(sessionStartTime)) return false;

  const fifteenMinutes = 15 * 60 * 1000;
  // During a live session, students can enter only within the first 15 minutes.
  return Date.now() - sessionStartTime <= fifteenMinutes;
}
