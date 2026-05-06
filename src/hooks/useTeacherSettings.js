import { useEffect, useState } from "react";

export const TEACHER_SETTINGS_KEY = "class-connect-teacher-settings";

const defaultTeacherSettings = {
  allowVolunteers: true,
  repeatSelection: false,
};

export function getTeacherSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(TEACHER_SETTINGS_KEY) || "{}");
    return { ...defaultTeacherSettings, ...saved };
  } catch {
    return defaultTeacherSettings;
  }
}

export function useTeacherSettings() {
  const [teacherSettings, setTeacherSettings] = useState(getTeacherSettings);

  useEffect(() => {
    const handleSettingsChange = (event) => {
      setTeacherSettings(event.detail || getTeacherSettings());
    };

    window.addEventListener("class-connect-teacher-settings-change", handleSettingsChange);
    window.addEventListener("storage", handleSettingsChange);

    return () => {
      window.removeEventListener(
        "class-connect-teacher-settings-change",
        handleSettingsChange
      );
      window.removeEventListener("storage", handleSettingsChange);
    };
  }, []);

  return teacherSettings;
}
