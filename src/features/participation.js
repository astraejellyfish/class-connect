import { supabase } from "../lib/supabase";

export function recordParticipationPoints({ classId, studentId, points }) {
  return supabase.from("participation").insert({
    class_id: classId,
    student_id: studentId,
    points,
  });
}

export function createSelectionRequest({ classId, studentId, points, expiresAt }) {
  return supabase
    .from("participation_selection_requests")
    .insert({
      class_id: classId,
      student_id: studentId,
      points,
      status: "pending",
      expires_at: expiresAt,
    })
    .select("id, status, expires_at")
    .single();
}

export function resolveSelectionRequest(requestId, status) {
  return supabase
    .from("participation_selection_requests")
    .update({
      status,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", requestId);
}

export function updateSelectionResponse(requestId, status) {
  return supabase
    .from("participation_selection_requests")
    .update({
      status,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "pending");
}
