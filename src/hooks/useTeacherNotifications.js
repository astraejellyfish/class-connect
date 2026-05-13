import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  getTeacherNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../features/notifications";

function cleanNotificationList(rows) {
  const seenWelcome = new Set();

  return (rows || []).filter((item) => {
    if (item.title !== "Welcome to Class Connect") return true;

    const key = `${item.title}-${item.message}-${item.type}`;
    if (seenWelcome.has(key)) return false;
    seenWelcome.add(key);
    return true;
  });
}

export function useTeacherNotifications(teacherId) {
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationsUnavailable, setNotificationsUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadNotifications() {
      if (!teacherId) {
        setNotifications([]);
        return;
      }

      setLoadingNotifications(true);
      const { data, error } = await getTeacherNotifications(teacherId);
      if (cancelled) return;
      setLoadingNotifications(false);

      if (error) {
        console.warn("NOTIFICATIONS UNAVAILABLE:", error);
        setNotificationsUnavailable(true);
        setNotifications([]);
        return;
      }

      setNotificationsUnavailable(false);
      setNotifications(cleanNotificationList(data));
    }

    loadNotifications();

    return () => {
      cancelled = true;
    };
  }, [teacherId]);

  useEffect(() => {
    if (!teacherId || notificationsUnavailable) return undefined;

    const channel = supabase
      .channel(`teacher-notifications-${teacherId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `teacher_id=eq.${teacherId}`,
        },
        (payload) => {
          if (!payload.new) return;
          setNotifications((prev) => {
            if (prev.some((item) => item.id === payload.new.id)) return prev;
            return [payload.new, ...prev].slice(0, 50);
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `teacher_id=eq.${teacherId}`,
        },
        (payload) => {
          if (!payload.new) return;
          setNotifications((prev) =>
            prev.map((item) => (item.id === payload.new.id ? payload.new : item))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [notificationsUnavailable, teacherId]);

  const unreadNotifications = notifications.filter((item) => !item.is_read).length;

  const handleReadNotification = async (notification) => {
    if (!notification || notification.is_read) return;

    const { data, error } = await markNotificationRead(notification.id);
    if (error) {
      console.warn("MARK NOTIFICATION READ ERROR:", error);
      return;
    }

    setNotifications((prev) =>
      prev.map((item) => (item.id === notification.id ? data : item))
    );
  };

  const handleMarkAllRead = async () => {
    const { error } = await markAllNotificationsRead(teacherId);
    if (error) {
      console.warn("MARK ALL NOTIFICATIONS READ ERROR:", error);
      return;
    }

    setNotifications((prev) =>
      prev.map((item) => ({
        ...item,
        is_read: true,
        read_at: item.read_at || new Date().toISOString(),
      }))
    );
  };

  return {
    notifications,
    unreadNotifications,
    loadingNotifications,
    notificationsUnavailable,
    handleReadNotification,
    handleMarkAllRead,
  };
}
