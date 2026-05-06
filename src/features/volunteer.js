export function getCurrentVolunteer(queue = []) {
  // The first student in the queue is always the current volunteer.
  return queue[0] || null;
}

export function canUseVolunteerActions({
  queue = [],
  disabled = false,
  saving = false,
} = {}) {
  // Buttons should work only when a volunteer is ready and the UI is not busy.
  return Boolean(getCurrentVolunteer(queue)) && !disabled && !saving;
}
