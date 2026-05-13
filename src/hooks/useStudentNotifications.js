import { useEffect, useMemo, useState } from "react";
import { canEnterClass, getStudentClassMemberships } from "../features/studentClasses";
import { supabase } from "../lib/supabase";

function mapMembership(row) {
  const classRow = Array.isArray(row.classes) ? row.classes[0] : row.classes;
  return {
    ...row,
    classData: classRow || {},
  };
}

function getClassTitle(classData) {
  return classData?.class_name || classData?.subject_code || "Class";
}

export function useStudentNotifications(studentId) {
  const [memberships, setMemberships] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationsReadAt, setNotificationsReadAt] = useState(() =>
    new Date(0).toISOString()
  );

  useEffect(() => {
    const saved = studentId
      ? localStorage.getItem(`class-connect-student-notifications-read-at-${studentId}`)
      : "";
    if (saved) setNotificationsReadAt(saved);
  }, [studentId]);

  useEffect(() => {
    let cancelled = false;

    async function loadNotifications() {
      if (!studentId) {
        setMemberships([]);
        return;
      }

      setLoadingNotifications(true);
      const { data, error } = await getStudentClassMemberships(studentId);
      if (cancelled) return;
      setLoadingNotifications(false);

      if (error) {
        console.warn("STUDENT NOTIFICATIONS UNAVAILABLE:", error);
        setMemberships([]);
        return;
      }

      setMemberships((data || []).map(mapMembership));
    }

    loadNotifications();

    return () => {
      cancelled = true;
    };
  }, [studentId]);

  useEffect(() => {
    if (!studentId) return undefined;

    const reload = async () => {
      const { data, error } = await getStudentClassMemberships(studentId);
      if (error) {
        console.warn("STUDENT NOTIFICATIONS REFRESH ERROR:", error);
        return;
      }
      setMemberships((data || []).map(mapMembership));
    };

    const channel = supabase
      .channel(`student-notifications-${studentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "class_members",
          filter: `student_id=eq.${studentId}`,
        },
        reload
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "classes",
        },
        reload
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentId]);

  const notifications = useMemo(() => {
    const items = [];

    memberships.forEach((membership) => {
      const classData = membership.classData || {};
      if (!classData.id) return;

      if (classData.session_active) {
        const locked = !canEnterClass(membership);
        items.push({
          id: `session-${classData.id}`,
          title: locked ? "Entry needs confirmation" : "Live session",
          message: locked
            ? `${getClassTitle(classData)} needs instructor confirmation before you enter.`
            : `${getClassTitle(classData)} is currently live.`,
          type: locked ? "entry" : "session",
          createdAt: classData.session_started_at || membership.joined_at || new Date().toISOString(),
        });
      }
    });

    return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [memberships]);

  const unreadNotifications = notifications.filter(
    (item) => new Date(item.createdAt).getTime() > new Date(notificationsReadAt).getTime()
  ).length;

  const handleMarkAllRead = () => {
    const nextReadAt = new Date().toISOString();
    setNotificationsReadAt(nextReadAt);
    if (studentId) {
      localStorage.setItem(
        `class-connect-student-notifications-read-at-${studentId}`,
        nextReadAt
      );
    }
  };

  return {
    notifications,
    unreadNotifications,
    loadingNotifications,
    notificationsReadAt,
    handleMarkAllRead,
  };
}
