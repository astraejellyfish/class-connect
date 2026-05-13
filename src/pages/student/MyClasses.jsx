import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { requireStudent } from "../../features/authRole";
import { supabase } from "../../lib/supabase";
import {
  canEnterClass,
  getStudentClassMemberships,
  joinClassByCode,
} from "../../features/studentClasses";
import ConfirmModal from "../../components/common/ConfirmModal";
import JoinClassModal from "../../components/student/JoinClassModal";
import AppLoadingScreen from "../../components/shared/AppLoadingScreen";
import BottomNav, { studentBottomNavItems } from "../../components/shared/BottomNav";
import MobileHeader from "../../components/shared/MobileHeader";
import StudentNotificationPanel from "../../components/student/StudentNotificationPanel";
import { useStudentNotifications } from "../../hooks/useStudentNotifications";
import "../../styles/student/myclasses.css";

function mapMembership(row) {
  const classRow = Array.isArray(row.classes) ? row.classes[0] : row.classes;

  return {
    ...row,
    classData: classRow || {},
  };
}

export default function MyClasses() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("Student");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentAvatar, setStudentAvatar] = useState("");
  const [memberships, setMemberships] = useState([]);
  const [search, setSearch] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [joinSuccess, setJoinSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [now, setNow] = useState(new Date());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const {
    notifications,
    unreadNotifications,
    loadingNotifications,
    notificationsReadAt,
    handleMarkAllRead,
  } = useStudentNotifications(studentId);

  useEffect(() => {
    loadStudentPage();
  }, []);

  useEffect(() => {
    const inviteCode = searchParams.get("join");
    if (!inviteCode) return;

    setJoinCode(inviteCode);
    setJoinError("");
    setJoinSuccess("");
    setShowJoinModal(true);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!studentId) return undefined;

    const channel = supabase
      .channel(`student-myclasses-notifications-${studentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "class_members",
          filter: `student_id=eq.${studentId}`,
        },
        () => {
          loadStudentPage();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "classes",
        },
        () => {
          loadStudentPage();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentId]);

  async function loadStudentPage() {
    setLoading(true);

    // Check who is logged in before loading student data.
    const account = await requireStudent(navigate);
    if (!account) {
      return;
    }

    const { user, studentProfile } = account;
    setStudentId(user.id);

    const { data: rows, error: classError } = await getStudentClassMemberships(
      user.id
    );

    setStudentName(
      studentProfile?.name ||
        user.user_metadata?.name ||
        user.user_metadata?.full_name ||
        "Student"
    );
    setStudentEmail(studentProfile?.email || user.email || "");
    setStudentAvatar(
      studentProfile?.avatar_url ||
        user.user_metadata?.avatar_url ||
        user.user_metadata?.picture ||
        ""
    );

    if (classError) {
      console.error("LOAD STUDENT CLASSES ERROR:", classError);
      setMemberships([]);
    } else {
      setMemberships((rows || []).map(mapMembership));
    }

    setLoading(false);
  }

  const filteredMemberships = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return memberships;

    // Search by subject, code, class code, or program.
    return memberships.filter(({ classData }) => {
      return (
        String(classData.class_name || "").toLowerCase().includes(q) ||
        String(classData.subject_code || "").toLowerCase().includes(q) ||
        String(classData.class_code || "").toLowerCase().includes(q) ||
        String(classData.program || "").toLowerCase().includes(q)
      );
    });
  }, [memberships, search]);

  const handleJoinClass = async (event) => {
    event.preventDefault();
    setJoinError("");
    setJoinSuccess("");

    if (!joinCode.trim()) {
      setJoinError("Enter a class code.");
      return;
    }

    // Join the class using the instructor's class code.
    setJoining(true);
    const { data, error } = await joinClassByCode(studentId, joinCode);
    setJoining(false);

    if (error) {
      setJoinError(error.message || "Could not join this class.");
      return;
    }

    setMemberships((prev) => {
      const nextMembership = mapMembership(data);
      const alreadyShown = prev.some((item) => item.class_id === nextMembership.class_id);

      if (alreadyShown) return prev;
      return [nextMembership, ...prev];
    });
    setJoinCode("");
    setJoinSuccess("Class joined. You can enter within 15 minutes.");
  };

  const handleEnterClass = (membership) => {
    // Block entry after 15 minutes unless the instructor confirmed it.
    if (!canEnterClass(membership)) {
      setJoinError("Entry window expired. Please ask your instructor for confirmation.");
      return;
    }

    navigate(`/student/class/${membership.class_id}`);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (loading) {
    return <AppLoadingScreen title="Loading classes" />;
  }

  return (
    <div className="student-dashboard student-myclasses-dashboard">
      <MobileHeader
        notificationOpen={notificationsOpen}
        onToggleNotifications={() => setNotificationsOpen((open) => !open)}
        notificationCount={unreadNotifications}
        onProfileClick={() => navigate("/student/settings")}
        profileContent={
          studentAvatar ? (
            <img src={studentAvatar} alt="Profile" />
          ) : (
            studentName.charAt(0).toUpperCase()
          )
        }
        notificationPanel={
          <StudentNotificationPanel
            notifications={notifications}
            unreadNotifications={unreadNotifications}
            loadingNotifications={loadingNotifications}
            notificationsReadAt={notificationsReadAt}
            onMarkAllRead={handleMarkAllRead}
          />
        }
      />

      {sidebarOpen && (
        <div
          className="student-myclasses-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`student-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="student-side-brand">
          <img src="/leaf-logo.png" alt="Class Connect" />
          <h2>Class Connect</h2>
        </div>

        <button type="button" className="student-side-active">
          <img src="/icons/myclasses.png" alt="" />
          <span>My Classes</span>
        </button>

        <button type="button" onClick={() => navigate("/student/settings")}>
          <img src="/icons/settings.png" alt="" />
          <span>Settings</span>
        </button>

        <button type="button" onClick={() => setShowLogoutConfirm(true)} className="student-side-logout">
          <img src="/icons/logout.png" alt="" />
          <span>Logout</span>
        </button>
      </aside>

      {showLogoutConfirm && (
        <ConfirmModal
          title="Log Out?"
          message="Are you sure you want to log out?"
          confirmLabel="Log Out"
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}

      <main className="student-main">
        <header className="student-topbar">
          <div>
            <h1>My Classes</h1>
          </div>

          <div className="student-top-actions">
            <div className="student-notification-wrap">
              <button
                type="button"
                className="student-icon-btn"
                  onClick={() => setNotificationsOpen((open) => !open)}
                  aria-label="Open notifications"
                >
                  <img src="/icons/notification.png" alt="" />
                  {unreadNotifications > 0 && <span>{unreadNotifications}</span>}
                </button>

              {notificationsOpen && (
                <StudentNotificationPanel
                  notifications={notifications}
                  unreadNotifications={unreadNotifications}
                  loadingNotifications={loadingNotifications}
                  notificationsReadAt={notificationsReadAt}
                  onMarkAllRead={handleMarkAllRead}
                />
              )}
            </div>

            <div className="student-profile-card">
              <div className="student-avatar">
                {studentAvatar ? (
                  <img src={studentAvatar} alt="Profile" />
                ) : (
                  studentName.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <strong>{studentName}</strong>
                <span>{studentEmail || "Student Account"}</span>
              </div>
            </div>

            <div className="student-time-card">
              <strong>Today</strong>
              <span>
                {now.toLocaleDateString([], {
                  weekday: "short",
                  month: "short",
                  day: "2-digit",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
        </header>

        <section className="student-classes-section">
          <div className="student-section-head">
            <h2>Joined Classes</h2>
            <div className="student-toolbar">
              <label className="student-search">
                <img src="/icons/search.png" alt="" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search classes"
                />
              </label>

              <button
                type="button"
                className="student-primary-btn"
                onClick={() => {
                  setJoinError("");
                  setJoinSuccess("");
                  setShowJoinModal(true);
                }}
              >
                Join Class
              </button>
            </div>
          </div>

          {!showJoinModal && joinError && (
            <div className="student-alert student-alert-error">{joinError}</div>
          )}
          {!showJoinModal && joinSuccess && (
            <div className="student-alert student-alert-success">{joinSuccess}</div>
          )}

          <div className="student-classes-grid">
            {filteredMemberships.length === 0 ? (
              <div className="student-empty">
                <strong>No classes found</strong>
                <p>Join a class using the class code from your instructor.</p>
              </div>
            ) : (
              filteredMemberships.map((membership) => {
                const classData = membership.classData;
                const sessionOngoing = Boolean(classData.session_active);
                const entryAllowed = canEnterClass(membership);

                return (
                  <article className="student-class-card" key={membership.id}>
                    <div className="student-class-card-head">
                      <h2>{classData.class_name || classData.subject_code || "Class"}</h2>
                    </div>
                    <div className="student-class-card-body">
                      <div className="student-class-meta-row">
                        <div>
                          <span>Subject Code: {classData.subject_code || "N/A"}</span>
                          <span>Class Code: {classData.class_code || "N/A"}</span>
                          <p>{classData.program || "No program/year/block"}</p>
                        </div>
                        <span
                          className={`student-session-status ${
                            sessionOngoing ? "is-live" : ""
                          }`}
                        >
                          {sessionOngoing ? "Session ongoing" : "No session"}
                        </span>
                      </div>
                      <div className="student-class-teacher">
                        <strong>Instructor</strong>
                        <div>
                          <span>{classData.teacher?.name || "Instructor name unavailable"}</span>
                          <small>{classData.teacher?.email || "Instructor email unavailable"}</small>
                        </div>
                      </div>
                      {sessionOngoing && !entryAllowed && (
                        <small>Needs instructor confirmation after 15 minutes.</small>
                      )}
                      <button
                        type="button"
                        onClick={() => handleEnterClass(membership)}
                        disabled={!entryAllowed}
                      >
                        Enter Class
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </main>

      {showJoinModal && (
        <JoinClassModal
          joinCode={joinCode}
          joinError={joinError}
          joinSuccess={joinSuccess}
          joining={joining}
          onJoinCodeChange={(value) => {
            setJoinError("");
            setJoinSuccess("");
            setJoinCode(value);
          }}
          onSubmit={handleJoinClass}
          onClose={() => {
            setJoinError("");
            setJoinSuccess("");
            setShowJoinModal(false);
          }}
        />
      )}
      <BottomNav items={studentBottomNavItems} />
    </div>
  );
}

