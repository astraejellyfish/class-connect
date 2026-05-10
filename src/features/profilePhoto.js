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

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not load profile photo for cropping."));
    };

    image.src = objectUrl;
  });
}

function canvasToBlob(canvas, type) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Could not crop profile photo."));
        }
      },
      type,
      0.92
    );
  });
}

export async function cropProfilePhotoToSquare(file) {
  const photoError = getProfilePhotoError(file);
  if (photoError) {
    throw new Error(photoError);
  }

  const image = await loadImageFromFile(file);
  const size = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = Math.floor((image.naturalWidth - size) / 2);
  const sourceY = Math.floor((image.naturalHeight - size) / 2);
  const canvas = document.createElement("canvas");

  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not crop profile photo.");
  }

  context.drawImage(image, sourceX, sourceY, size, size, 0, 0, size, size);

  const blob = await canvasToBlob(canvas, file.type);
  return new File([blob], file.name, {
    type: file.type,
    lastModified: Date.now(),
  });
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
