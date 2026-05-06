/**
 * Display label: last name + first letter of first name (e.g. "Parazo S.").
 */
export function formatFullNameLower(fullName) {
  return String(fullName || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function formatFullNameTitle(fullName) {
  return String(fullName || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatStudentShort(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    const only = parts[0];
    return only.length > 14 ? `${only.slice(0, 12)}…` : only;
  }

  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  const initial = firstName.charAt(0).toUpperCase();
  const last =
    lastName.length > 12 ? `${lastName.slice(0, 10)}…` : lastName;

  return `${last} ${initial}.`;
}
