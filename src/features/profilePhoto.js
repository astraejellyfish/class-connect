import { supabase } from "../lib/supabase";

export const PROFILE_PHOTO_BUCKET = "avatars";
export const PROFILE_PHOTO_TYPES = ["image/jpeg", "image/png"];

export function isValidProfilePhoto(file) {
  return file && PROFILE_PHOTO_TYPES.includes(file.type);
}

export function getProfilePhotoError(file) {
  if (!file) return "";
  if (!isValidProfilePhoto(file)) {
    return "Profile photo must be a JPG or PNG file.";
  }
  return "";
}

export async function uploadProfilePhoto({ file, userId, role }) {
  if (!file) return { publicUrl: "", error: null };

  const extension = file.name.split(".").pop()?.toLowerCase() || "png";
  const safeExtension = extension === "jpg" || extension === "jpeg" ? "jpg" : "png";
  const path = `${role}/${userId}-${Date.now()}.${safeExtension}`;

  const { error } = await supabase.storage
    .from(PROFILE_PHOTO_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: true,
    });

  if (error) {
    return { publicUrl: "", error };
  }

  const { data } = supabase.storage.from(PROFILE_PHOTO_BUCKET).getPublicUrl(path);
  return { publicUrl: data.publicUrl, error: null };
}

export async function updateProfilePhoto({ userId, role, avatarUrl }) {
  const table = role === "teacher" ? "teachers" : "students";
  return supabase.from(table).update({ avatar_url: avatarUrl }).eq("id", userId);
}
