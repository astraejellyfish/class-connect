import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { requireTeacher } from "../../features/authRole";
import {
  createTeacherNotification,
  getTeacherNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../features/notifications";
import ConfirmModal from "../../components/common/ConfirmModal";
import AppLoadingScreen from "../../components/shared/AppLoadingScreen";
import BottomNav, { teacherBottomNavItems } from "../../components/shared/BottomNav";
import MobileHeader from "../../components/shared/MobileHeader";
import TeacherSidebar from "../../components/shared/TeacherSidebar";
import "../../styles/teacher/dashboard.css";

export default function DashboardTeacher() {
  const navigate = useNavigate();

  const [classes, setClasses] = useState([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [teacherName, setTeacherName] = useState("Teacher");
  const [teacherAvatar, setTeacherAvatar] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modalError, setModalError] = useState("");
  const [isCreatingClass, setIsCreatingClass] = useState(false);
  const [teacherId, setTeacherId] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [notificationsUnavailable, setNotificationsUnavailable] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const [subjectName, setSubjectName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [classCode, setClassCode] = useState("");
  const [program, setProgram] = useState("");

  const openCreateClassModal = () => {
    setModalError("");
    setShowModal(true);
  };

  const closeCreateClassModal = () => {
    setModalError("");
    setShowModal(false);
  };

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    setLoading(true);

    const account = await requireTeacher(navigate);
    if (!account) {
      return;
    }

    const { user, teacherProfile } = account;

    setTeacherId(user.id);
    loadNotifications(user.id);
    setTeacherName(
      teacherProfile?.name ||
        user.user_metadata?.name ||
        user.user_metadata?.full_name ||
        "Teacher"
    );

    setTeacherAvatar(
      teacherProfile?.avatar_url ||
        user.user_metadata?.avatar_url ||
        user.user_metadata?.picture ||
        ""
    );

    const { data, error } = await supabase
      .from("classes")
      .select("*")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("LOAD CLASSES ERROR:", error);
    }

    const classRows = data || [];
    const classIds = classRows.map((cls) => cls.id).filter(Boolean);
    const { data: memberRows, error: membersError } = classIds.length
      ? await supabase
          .from("class_members")
          .select("class_id, student_id")
          .in("class_id", classIds)
      : { data: [], error: null };

    if (membersError) {
      console.error("LOAD CLASS MEMBER COUNTS ERROR:", membersError);
    }

    const joinedByClassId = (memberRows || []).reduce((acc, row) => {
      acc[row.class_id] = (acc[row.class_id] || 0) + 1;
      return acc;
    }, {});
    const classRowsWithCounts = classRows.map((cls) => ({
      ...cls,
      joinedCount: joinedByClassId[cls.id] || 0,
    }));
    const uniqueStudentTotal = new Set(
      (memberRows || []).map((row) => row.student_id).filter(Boolean)
    ).size;
    const storedRosterTotal = classRows.reduce(
      (sum, cls) =>
        sum +
        Number(
          cls.student_count ||
            cls.students_count ||
            cls.enrolled_count ||
            cls.total_students ||
            0
        ),
      0
    );

    setClasses(classRowsWithCounts);
    setTotalStudents(uniqueStudentTotal || storedRosterTotal);
    setLoading(false);
  };

  const loadNotifications = async (currentTeacherId) => {
    setLoadingNotifications(true);
    const { data, error } = await getTeacherNotifications(currentTeacherId);
    setLoadingNotifications(false);

    if (error) {
      console.warn("NOTIFICATIONS UNAVAILABLE:", error);
      setNotificationsUnavailable(true);
      setNotifications([]);
      return;
    }

    // Keep old duplicate welcome messages from showing twice.
    const seenWelcome = new Set();
    const cleanNotifications = (data || []).filter((item) => {
      if (item.title !== "Welcome to Class Connect") return true;

      const key = `${item.title}-${item.message}-${item.type}`;
      if (seenWelcome.has(key)) return false;
      seenWelcome.add(key);
      return true;
    });

    // Keep the list clean. New notifications are made by real activity.
    setNotifications(cleanNotifications);
  };

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

  const handleAddClass = async () => {
    setModalError("");

    if (!subjectName || !subjectCode || !classCode || !program) {
      setModalError("Please fill in all fields.");
      return;
    }

    const normalizedSubjectCode = subjectCode.trim().toUpperCase();
    const normalizedClassCode = classCode.trim();

    if (!/^\d+$/.test(normalizedClassCode)) {
      setModalError("Class code must be numbers only.");
      return;
    }

    const account = await requireTeacher(navigate);
    if (!account) {
      setModalError("Please sign in with a teacher account.");
      return;
    }
    const { user } = account;

    const hasDuplicateLocal = classes.some(
      (cls) =>
        String(cls.class_code || "").trim() === normalizedClassCode ||
        String(cls.subject_code || "").trim().toUpperCase() === normalizedSubjectCode
    );

    if (hasDuplicateLocal) {
      setModalError("A class with this class code or subject code already exists.");
      return;
    }

    const { data: duplicateRows, error: duplicateError } = await supabase
      .from("classes")
      .select("id")
      .eq("teacher_id", user.id)
      .or(`class_code.eq.${normalizedClassCode},subject_code.eq.${normalizedSubjectCode}`)
      .limit(1);

    if (duplicateError) {
      console.error("DUPLICATE CHECK ERROR:", duplicateError);
      setModalError("Could not verify class codes. Try again in a moment.");
      return;
    }

    if (duplicateRows && duplicateRows.length > 0) {
      setModalError("A class with this class code or subject code already exists.");
      return;
    }

    setIsCreatingClass(true);
    const { error } = await supabase.from("classes").insert([
      {
        teacher_id: user.id,
        class_name: subjectName,
        subject_code: normalizedSubjectCode,
        class_code: normalizedClassCode,
        program,
      },
    ]);
    setIsCreatingClass(false);

    if (error) {
      console.error("INSERT ERROR:", error);
      setModalError(error.message || "Could not create class.");
      return;
    }

    setSubjectName("");
    setSubjectCode("");
    setClassCode("");
    setProgram("");
    setShowModal(false);

    await createTeacherNotification({
      teacherId: user.id,
      title: "Class created",
      message: `${subjectName} was added to your classes.`,
      type: "activity",
    });

    loadClasses();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const recentClasses = classes.slice(0, 5);
  const unreadNotifications = notifications.filter((item) => !item.is_read).length;
  const getClassProgramLabel = (cls) => {
    if (cls?.program) return cls.program;

    const yearBlock = [cls?.year_level || cls?.year, cls?.block || cls?.section]
      .filter(Boolean)
      .join("-");

    if (cls?.course && yearBlock) return `${cls.course} ${yearBlock}`;
    if (cls?.course) return cls.course;
    if (yearBlock) return yearBlock;
    if (cls?.year_block) return cls.year_block;
    if (cls?.yr_block) return cls.yr_block;

    return "No program/year/block";
  };

  if (loading) {
    return <AppLoadingScreen title="Loading dashboard" />;
  }

  return (
    <div className="teacher-dashboard teacher-dashboard--two-col">
      <MobileHeader
        notificationOpen={notificationsOpen}
        onToggleNotifications={() => setNotificationsOpen((open) => !open)}
        notificationCount={unreadNotifications}
        onProfileClick={() => navigate("/settings/account")}
        profileContent={
          teacherAvatar ? (
            <img src={teacherAvatar} alt="Profile" />
          ) : (
            teacherName.charAt(0).toUpperCase()
          )
        }
        notificationPanel={
          <div className="notification-panel">
            <div className="notification-panel-head">
              <h3>Notifications</h3>
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={unreadNotifications === 0 || notificationsUnavailable}
              >
                Mark all read
              </button>
            </div>

            {notificationsUnavailable ? (
              <p className="notification-empty">Notifications table is not ready yet.</p>
            ) : loadingNotifications ? (
              <p className="notification-empty">Loading notifications...</p>
            ) : notifications.length === 0 ? (
              <p className="notification-empty">No notifications yet.</p>
            ) : (
              <div className="notification-list">
                {notifications.map((notification) => (
                  <button
                    type="button"
                    key={notification.id}
                    className={`notification-item ${
                      notification.is_read ? "" : "is-unread"
                    }`}
                    onClick={() => handleReadNotification(notification)}
                  >
                    <span>
                      <strong>{notification.title}</strong>
                      <small>{notification.type || "activity"}</small>
                    </span>
                    <p>{notification.message || "No details provided."}</p>
                    <time>
                      {notification.created_at
                        ? new Date(notification.created_at).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Just now"}
                    </time>
                  </button>
                ))}
              </div>
            )}
          </div>
        }
      />

      {sidebarOpen && (
        <div
          className="mobile-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      <TeacherSidebar
        open={sidebarOpen}
        active="dashboard"
        onNavigate={navigate}
        onLogout={() => setShowLogoutConfirm(true)}
      />

      {showLogoutConfirm && (
        <ConfirmModal
          title="Log Out?"
          message="Are you sure you want to log out?"
          confirmLabel="Log Out"
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}

      <main className="dash-main">
        <div className="dash-top">
          <div className="dash-top-text">
            <h1>Teacher Dashboard</h1>
          </div>
          <div className="dash-top-side">
            <div className="notification-wrap">
              <button
                type="button"
                className="notification-btn"
                onClick={() => setNotificationsOpen((open) => !open)}
                aria-expanded={notificationsOpen}
                aria-label="Open notifications"
              >
                <img src="/icons/notification.png" alt="" />
                {unreadNotifications > 0 && (
                  <strong>{unreadNotifications > 9 ? "9+" : unreadNotifications}</strong>
                )}
              </button>

              {notificationsOpen && (
                <div className="notification-panel">
                  <div className="notification-panel-head">
                    <h3>Notifications</h3>
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      disabled={unreadNotifications === 0 || notificationsUnavailable}
                    >
                      Mark all read
                    </button>
                  </div>

                  {notificationsUnavailable ? (
                    <p className="notification-empty">
                      Notifications table is not ready yet.
                    </p>
                  ) : loadingNotifications ? (
                    <p className="notification-empty">Loading notifications...</p>
                  ) : notifications.length === 0 ? (
                    <p className="notification-empty">No notifications yet.</p>
                  ) : (
                    <div className="notification-list">
                      {notifications.map((notification) => (
                        <button
                          type="button"
                          key={notification.id}
                          className={`notification-item ${
                            notification.is_read ? "" : "is-unread"
                          }`}
                          onClick={() => handleReadNotification(notification)}
                        >
                          <span>
                            <strong>{notification.title}</strong>
                            <small>{notification.type || "activity"}</small>
                          </span>
                          <p>{notification.message || "No details provided."}</p>
                          <time>
                            {notification.created_at
                              ? new Date(notification.created_at).toLocaleString([], {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Just now"}
                          </time>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div
              className="profile-card clickable dash-top-profile"
              onClick={() => navigate("/settings/account")}
            >
              <div className="avatar">
                {teacherAvatar ? (
                  <img src={teacherAvatar} alt="Profile" />
                ) : (
                  teacherName.charAt(0).toUpperCase()
                )}
              </div>
              <h3>{teacherName}</h3>
              <p>Teacher Account</p>
            </div>

            <div className="calendar-card dash-top-date">
              <h3>Today</h3>
              <p>{new Date().toDateString()}</p>
            </div>
          </div>
        </div>

        <section className="hero-card">
          <div>
            <p className="hero-label">CLASS CONNECT</p>
            <h2>Welcome, {teacherName}!</h2>
            <p>
              Start a class session, track participation, and manage student
              engagement in one place.
            </p>
          </div>

          <img src="/bird.png" alt="Clacoo" />
        </section>

        <section className="stats-grid">
          <div className="stat-box">
            <h3>{classes.length}</h3>
            <p>Total Classes</p>
          </div>

          <div className="stat-box">
            <h3>{totalStudents}</h3>
            <p>Total Students</p>
          </div>
        </section>

        <section className="classes-section">
          <div className="section-head">
            <h2>Recent Classes</h2>
            <button type="button" onClick={openCreateClassModal}>
              Create Class
            </button>
          </div>

          {recentClasses.length === 0 ? (
            <div className="empty-state">
              <p>No recent classes yet. Click “Create Class” to add your first class.</p>
            </div>
          ) : (
            <div className="class-grid">
              {recentClasses.map((cls) => (
                <div className="class-card" key={cls.id}>
                  <div className="class-card-top">
                    <div className="class-card-header">
                      <h3>{cls.class_name || cls.subject_name || cls.subject_code}</h3>
                    </div>

                    <div className="class-card-meta-row">
                      <div>
                        <span>Subject Code: {cls.subject_code || "N/A"}</span>
                        <span>Class Code: {cls.class_code || "N/A"}</span>
                        <p className="class-program">{getClassProgramLabel(cls)}</p>
                        <span>No. of Students: {cls.joinedCount} joined</span>
                      </div>
                      <span className={`class-status-badge ${cls.session_active ? "is-live" : ""}`}>
                        {cls.session_active ? "Live" : "No session"}
                      </span>
                    </div>
                  </div>

                  <button onClick={() => navigate(`/teacher/class/${cls.id}`)}>
                    Enter Class
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <h3>Add Class</h3>

            {modalError ? (
              <div className="error-box modal-inline-error">{modalError}</div>
            ) : null}

            <input
              placeholder="Subject Name"
              value={subjectName}
              onChange={(e) => {
                setModalError("");
                setSubjectName(e.target.value);
              }}
              disabled={isCreatingClass}
            />

            <input
              placeholder="Subject Code"
              value={subjectCode}
              onChange={(e) => {
                setModalError("");
                setSubjectCode(e.target.value);
              }}
              disabled={isCreatingClass}
            />

            <input
              placeholder="Class Code (numbers only)"
              value={classCode}
              onChange={(e) => {
                setModalError("");
                setClassCode(e.target.value);
              }}
              disabled={isCreatingClass}
            />

            <input
              placeholder="Program / Year / Block (BSCS 2-A)"
              value={program}
              onChange={(e) => {
                setModalError("");
                setProgram(e.target.value);
              }}
              disabled={isCreatingClass}
            />

            <button type="button" onClick={handleAddClass} disabled={isCreatingClass}>
              {isCreatingClass ? "Creating…" : "Create Class"}
            </button>
            <button type="button" onClick={closeCreateClassModal} disabled={isCreatingClass}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <BottomNav items={teacherBottomNavItems} />
    </div>
  );
}
