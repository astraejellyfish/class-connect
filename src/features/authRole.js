import { supabase } from "../lib/supabase";

export async function getCurrentAccount() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user || null;

  if (userError || !user) {
    return {
      user: null,
      role: "",
      teacherProfile: null,
      studentProfile: null,
      error: userError,
    };
  }

  // Check the profile tables because the browser session can change between tabs.
  const [{ data: teacherProfile }, { data: studentProfile }] = await Promise.all([
    supabase
      .from("teachers")
      .select("id, name, email, avatar_url")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("students")
      .select("id, name, email, student_id, avatar_url")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const metadataRole = user.user_metadata?.role || "";
  const role = teacherProfile
    ? "teacher"
    : studentProfile
      ? "student"
      : metadataRole;

  return {
    user,
    role,
    teacherProfile: teacherProfile || null,
    studentProfile: studentProfile || null,
    error: null,
  };
}

export async function requireTeacher(navigate) {
  const account = await getCurrentAccount();

  if (!account.user) {
    navigate("/login");
    return null;
  }

  if (account.role !== "teacher") {
    navigate("/student/classes");
    return null;
  }

  return account;
}

export async function requireStudent(navigate) {
  const account = await getCurrentAccount();

  if (!account.user) {
    navigate("/login");
    return null;
  }

  if (account.role !== "student") {
    navigate("/teacher/dashboard");
    return null;
  }

  return account;
}
