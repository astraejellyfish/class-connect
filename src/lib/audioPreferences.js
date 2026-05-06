export const AUDIO_SETTINGS_KEY = "class-connect-audio-settings";

export const defaultAudioSettings = {
  sessionMusic: true,
  notificationSound: true,
};

export function getAudioSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(AUDIO_SETTINGS_KEY) || "{}");
    return { ...defaultAudioSettings, ...saved };
  } catch {
    return defaultAudioSettings;
  }
}

export function saveAudioSetting(key, value) {
  const next = { ...getAudioSettings(), [key]: value };
  localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(next));
  window.dispatchEvent(
    new CustomEvent("class-connect-audio-settings-change", { detail: next })
  );
  return next;
}
