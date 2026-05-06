import { useCallback, useEffect, useRef, useState } from "react";
import { getAudioSettings } from "../lib/audioPreferences";

export function useAudioControls({ sessionActive = false, countdownSeconds = 10 } = {}) {
  const [audioSettings, setAudioSettings] = useState(getAudioSettings);
  const [skipFxActive, setSkipFxActive] = useState(false);
  const bgmRef = useRef(null);
  const notificationAudioRef = useRef(null);
  const resultAudioRef = useRef(null);
  const acceptAudioRef = useRef(null);
  const skipAudioRef = useRef(null);
  const countdownAudioRef = useRef(null);
  const countdownStopTimeoutRef = useRef(null);

  useEffect(() => {
    bgmRef.current = new Audio("/bgm.wav");
    bgmRef.current.loop = true;
    bgmRef.current.volume = 0.22;
    bgmRef.current.addEventListener("ended", () => {
      if (bgmRef.current) {
        bgmRef.current.currentTime = 0;
        bgmRef.current.play().catch(() => {});
      }
    });

    notificationAudioRef.current = new Audio("/notification.wav");
    notificationAudioRef.current.volume = 0.65;

    resultAudioRef.current = new Audio("/result.wav");
    resultAudioRef.current.volume = 0.75;

    acceptAudioRef.current = new Audio("/accept.wav");
    acceptAudioRef.current.volume = 0.75;

    skipAudioRef.current = new Audio("/skip.wav");
    skipAudioRef.current.volume = 0.75;

    countdownAudioRef.current = new Audio("/countdown.wav");
    countdownAudioRef.current.volume = 0.72;

    return () => {
      window.clearTimeout(countdownStopTimeoutRef.current);
      bgmRef.current?.pause();
      bgmRef.current = null;
      notificationAudioRef.current = null;
      resultAudioRef.current = null;
      acceptAudioRef.current = null;
      skipAudioRef.current = null;
      countdownAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handleSettingsChange = (event) => {
      setAudioSettings(event.detail || getAudioSettings());
    };

    window.addEventListener("class-connect-audio-settings-change", handleSettingsChange);
    window.addEventListener("storage", handleSettingsChange);

    return () => {
      window.removeEventListener(
        "class-connect-audio-settings-change",
        handleSettingsChange
      );
      window.removeEventListener("storage", handleSettingsChange);
    };
  }, []);

  useEffect(() => {
    const bgm = bgmRef.current;
    if (!bgm) return;

    if (sessionActive && audioSettings.sessionMusic) {
      bgm.play().catch(() => {
        // Browsers may block audio until the first user gesture.
      });
      return;
    }

    bgm.pause();
  }, [audioSettings.sessionMusic, sessionActive]);

  const playSound = useCallback(
    (audioRef) => {
      if (!audioSettings.notificationSound || !audioRef.current) return;

      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        // Browsers may block audio until the first user gesture.
      });
    },
    [audioSettings.notificationSound]
  );

  const playNotificationSound = useCallback(() => {
    playSound(notificationAudioRef);
  }, [playSound]);

  const playResultSound = useCallback(() => {
    playSound(resultAudioRef);
  }, [playSound]);

  const playAcceptSound = useCallback(() => {
    playSound(acceptAudioRef);
  }, [playSound]);

  const playSkipSound = useCallback(() => {
    playSound(skipAudioRef);
    setSkipFxActive(true);
    window.setTimeout(() => setSkipFxActive(false), 650);
  }, [playSound]);

  const playCountdownSound = useCallback(() => {
    if (!audioSettings.notificationSound || !countdownAudioRef.current) return;

    window.clearTimeout(countdownStopTimeoutRef.current);
    countdownAudioRef.current.currentTime = 0;
    countdownAudioRef.current.play().catch(() => {});
    countdownStopTimeoutRef.current = window.setTimeout(() => {
      if (!countdownAudioRef.current) return;
      countdownAudioRef.current.pause();
      countdownAudioRef.current.currentTime = 0;
    }, countdownSeconds * 1000);
  }, [audioSettings.notificationSound, countdownSeconds]);

  const restartSessionMusic = useCallback(() => {
    if (!audioSettings.sessionMusic || !bgmRef.current) return;
    bgmRef.current.currentTime = 0;
    bgmRef.current.play().catch(() => {});
  }, [audioSettings.sessionMusic]);

  const pauseSessionMusic = useCallback(() => {
    bgmRef.current?.pause();
  }, []);

  return {
    audioSettings,
    skipFxActive,
    playNotificationSound,
    playResultSound,
    playAcceptSound,
    playSkipSound,
    playCountdownSound,
    restartSessionMusic,
    pauseSessionMusic,
  };
}
