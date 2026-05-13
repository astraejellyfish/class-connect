import { supabase } from "../lib/supabase";

const NOTIFICATION_COLUMNS =
  "id, teacher_id, title, message, type, is_read, created_at, read_at";

export async function getTeacherNotifications(teacherId, limit = 50) {
  if (!teacherId) return { data: [], error: null };

  return supabase
    .from("notifications")
    .select(NOTIFICATION_COLUMNS)
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function createTeacherNotification({
  teacherId,
  title,
  message,
  type = "activity",
}) {
  if (!teacherId || !title) {
    return { data: null, error: new Error("teacherId and title are required.") };
  }

  return supabase
    .from("notifications")
    .insert({
      teacher_id: teacherId,
      title,
      message,
      type,
    })
    .select(NOTIFICATION_COLUMNS)
    .single();
}

export async function markNotificationRead(notificationId) {
  if (!notificationId) return { data: null, error: null };

  return supabase
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("id", notificationId)
    .select(NOTIFICATION_COLUMNS)
    .single();
}

export async function markAllNotificationsRead(teacherId) {
  if (!teacherId) return { data: [], error: null };

  return supabase
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("teacher_id", teacherId)
    .eq("is_read", false)
    .select(NOTIFICATION_COLUMNS);
}
