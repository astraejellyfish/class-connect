import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { requireTeacher } from "../../features/authRole";
import { supabase } from "../../lib/supabase";
import ConfirmModal from "../../components/common/ConfirmModal";
import AppLoadingScreen from "../../components/shared/AppLoadingScreen";
import BottomNav, { teacherBottomNavItems } from "../../components/shared/BottomNav";
import TeacherSidebar from "../../components/shared/TeacherSidebar";
import "../../styles/teacher/dashboard.css";

export default function MyClassesTeacher() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [deleteMode, setDeleteMode] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [teacherName, setTeacherName] = useState("Teacher");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    setLoading(true);
    const account = await requireTeacher(navigate);
    if (!account) {
      return;
    }
    setTeacherName(
      account.teacherProfile?.name ||
        account.user.user_metadata?.name ||
        account.user.user_metadata?.full_name ||
        "Teacher"
    );

    const { data } = await supabase
      .from("classes")
      .select("*")
      .eq("teacher_id", account.user.id)
      .order("created_at", { ascending: false });

    const classRows = data || [];
    const classIds = classRows.map((cls) => cls.id).filter(Boolean);
    const { data: memberRows } = classIds.length
      ? await supabase
          .from("class_members")
          .select("class_id")
          .in("class_id", classIds)
      : { data: [] };

    const joinedByClassId = (memberRows || []).reduce((acc, row) => {
      acc[row.class_id] = (acc[row.class_id] || 0) + 1;
      return acc;
    }, {});

    setClasses(
      classRows.map((cls) => ({
        ...cls,
        joinedCount: joinedByClassId[cls.id] || 0,
      }))
    );
    setSelectedIds(new Set());
    setLoading(false);
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleOpenDelete = () => {
    if (!deleteMode) {
      setDeleteMode(true);
      setSelectedIds(new Set());
      return;
    }
    if (selectedIds.size === 0) return;
    setShowDeleteModal(true);
  };

  const handleDeleteSelected = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;

    setIsDeleting(true);
    const { error } = await supabase.from("classes").delete().in("id", ids);
    setIsDeleting(false);
    if (error) {
      alert(error.message);
      return;
    }

    setSelectedIds(new Set());
    setDeleteMode(false);
    setShowDeleteModal(false);
    loadClasses();
  };

  const filteredClasses = classes.filter((cls) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;

    return (
      String(cls.class_name || "").toLowerCase().includes(q) ||
      String(cls.subject_code || "").toLowerCase().includes(q) ||
      String(cls.class_code || "").toLowerCase().includes(q) ||
      String(cls.program || "").toLowerCase().includes(q)
    );
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (loading) {
    return <AppLoadingScreen title="Loading classes" />;
  }

  return (
    <div className="teacher-dashboard teacher-dashboard--two-col">
      <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
        <img src="/icons/menu.png" alt="Menu" />
      </button>
      <div className="mobile-notification-wrap">
        <button
          type="button"
          className="mobile-notification-btn"
          onClick={() => setNotificationsOpen((open) => !open)}
          aria-label="Open notifications"
        >
          <img src="/icons/notification.png" alt="" />
        </button>
        {notificationsOpen && (
          <div className="notification-panel mobile-notification-panel">
            <p className="notification-empty">No notifications yet.</p>
          </div>
        )}
      </div>
      <button
        className="mobile-profile-btn"
        onClick={() => navigate("/settings/account")}
        aria-label="Open profile"
      >
        {teacherName.charAt(0).toUpperCase()}
      </button>

      {sidebarOpen && (
        <div
          className="mobile-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      <TeacherSidebar
        open={sidebarOpen}
        active="classes"
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
          <div>
            <h1>My Classes</h1>
          </div>
        </div>

        <section className="classes-section">
          <div className="section-head myclasses-head">
            <h2>All Classes</h2>
            <div className="myclasses-actions">
              <label className="myclasses-search-wrap">
                <img
                  className="myclasses-search-icon"
                  src="/icons/search.png"
                  alt=""
                  width={20}
                  height={20}
                />
                <input
                  className="myclasses-search"
                  type="search"
                  placeholder="Search subject, class code, or program"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <div className="myclasses-toolbar-buttons">
                {deleteMode && (
                  <span className="myclasses-selection-pill">
                    {selectedIds.size} selected
                  </span>
                )}
                <button
                  type="button"
                  className="myclasses-create-btn"
                  onClick={() => navigate("/teacher/dashboard")}
                >
                  Create Class
                </button>
                <button
                  type="button"
                  className="myclasses-delete-btn"
                  disabled={deleteMode && selectedIds.size === 0}
                  onClick={handleOpenDelete}
                >
                  {deleteMode ? "Delete Selected" : "Delete"}
                </button>
                {deleteMode && (
                  <button
                    type="button"
                    className="myclasses-cancel-btn"
                    onClick={() => {
                      setDeleteMode(false);
                      setSelectedIds(new Set());
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>

          {filteredClasses.length === 0 ? (
            <div className="empty-state">
              <p>
                {classes.length === 0
                  ? "No classes yet."
                  : "No matching classes found."}
              </p>
            </div>
          ) : (
            <div className="class-grid myclasses-grid">
              {filteredClasses.map((cls) => (
                <div
                  className={`class-card myclasses-class-card ${
                    selectedIds.has(cls.id) ? "is-selected" : ""
                  }`}
                  key={cls.id}
                >
                  <div className="class-card-header">
                    {deleteMode && (
                      <label className="class-card-select">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(cls.id)}
                          onChange={() => toggleSelect(cls.id)}
                        />
                        <span className="class-card-checkmark" aria-hidden="true" />
                        <span className="sr-only">Select class</span>
                      </label>
                    )}
                    <h3>{cls.class_name || cls.subject_code}</h3>
                  </div>
                  <div className="class-card-top">
                    <div className="class-card-meta-row">
                      <div>
                        <span>Subject Code: {cls.subject_code || "N/A"}</span>
                        <span>Class Code: {cls.class_code || "N/A"}</span>
                        <p className="class-program">{cls.program || "No program/year/block"}</p>
                        <span>No. of Students: {cls.joinedCount || 0} joined</span>
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

      {showDeleteModal && (
        <div className="modal">
          <div className="modal-content">
            <h3>Delete Class{selectedIds.size > 1 ? "es" : ""}?</h3>
            <p>
              {selectedIds.size > 1
                ? `Are you sure you want to delete ${selectedIds.size} selected classes?`
                : "Are you sure you want to delete this class?"}
            </p>
            <button onClick={handleDeleteSelected} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Yes"}
            </button>
            <button
              onClick={() => setShowDeleteModal(false)}
              disabled={isDeleting}
            >
              No
            </button>
          </div>
        </div>
      )}
      <BottomNav items={teacherBottomNavItems} />
    </div>
  );
}
