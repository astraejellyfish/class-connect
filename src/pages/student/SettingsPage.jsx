import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { requireStudent } from "../../features/authRole";
import { supabase } from "../../lib/supabase";
import {
  defaultAudioSettings,
  getAudioSettings,
  saveAudioSetting,
} from "../../lib/audioPreferences";
import ConfirmModal from "../../components/common/ConfirmModal";
import ProfilePhotoUpload from "../../components/common/ProfilePhotoUpload";
import BottomNav, { studentBottomNavItems } from "../../components/shared/BottomNav";
import MobileHeader from "../../components/shared/MobileHeader";
import StudentNotificationPanel from "../../components/student/StudentNotificationPanel";
import {
  cropProfilePhotoToSquare,
  getProfilePhotoError,
  updateProfilePhoto,
  uploadProfilePhoto,
} from "../../features/profilePhoto";
import { useStudentNotifications } from "../../hooks/useStudentNotifications";
import "../../styles/student/myclasses.css";
import "../../styles/student/settings.css";

const STORAGE_KEY = "class-connect-student-settings";

const defaultSettings = {
  activityAlerts: true,
  volunteerAlerts: true,
  sessionAlerts: true,
  classConnectNotifications: true,
};

function isPasswordStrong(password) {
  return (
    password.length >= 6 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

function ToggleRow({ title, description, checked, onChange }) {
  return (
    <label className="settings-toggle-row">
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="settings-toggle" aria-hidden="true" />
    </label>
  );
}

function SettingsSection({ id, title, openSection, setOpenSection, children }) {
  const isOpen = openSection === id;

  return (
    <section className={`settings-section ${isOpen ? "is-open" : ""}`}>
      <button
        type="button"
        className="settings-section-trigger"
        onClick={() => setOpenSection(isOpen ? "" : id)}
        aria-expanded={isOpen}
      >
        <span>{title}</span>
        <span className="settings-chevron" aria-hidden="true" />
      </button>
      {isOpen && <div className="settings-section-body">{children}</div>}
    </section>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const [openSection, setOpenSection] = useState("account");
  const [settings, setSettings] = useState(defaultSettings);
  const [audioSettings, setAudioSettings] = useState(defaultAudioSettings);
  const [studentUserId, setStudentUserId] = useState("");
  const [studentName, setStudentName] = useState("Student");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState("");
  const [profilePhotoError, setProfilePhotoError] = useState("");
  const [profilePhotoMessage, setProfilePhotoMessage] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [securityMessage, setSecurityMessage] = useState("");
  const [securityError, setSecurityError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const {
    notifications,
    unreadNotifications,
    loadingNotifications,
    notificationsReadAt,
    handleMarkAllRead,
  } = useStudentNotifications(studentUserId);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setSettings((prev) => ({ ...prev, ...JSON.parse(saved) }));
    }
    setAudioSettings(getAudioSettings());

    async function loadAccount() {
      const account = await requireStudent(navigate);
      if (!account) return;

      const { user, studentProfile } = account;

      setStudentUserId(user.id);
      setStudentName(
        studentProfile?.name ||
          user.user_metadata?.name ||
          user.user_metadata?.full_name ||
          "Student"
      );
      setStudentEmail(studentProfile?.email || user.email || "");
      setStudentNumber(studentProfile?.student_id || "");
      setAvatarUrl(
        studentProfile?.avatar_url ||
          user.user_metadata?.avatar_url ||
          user.user_metadata?.picture ||
          ""
      );
    }

    loadAccount();
  }, [navigate]);

  const updateSetting = (key, value) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(
        new CustomEvent("class-connect-student-settings-change", { detail: next })
      );
      return next;
    });
  };

  const updateAudioSetting = (key, value) => {
    setAudioSettings(saveAudioSetting(key, value));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleProfilePhotoChange = async (file) => {
    if (profilePhotoPreview) {
      URL.revokeObjectURL(profilePhotoPreview);
    }

    setProfilePhoto(null);
    setProfilePhotoPreview("");
    setProfilePhotoMessage("");

    const photoError = getProfilePhotoError(file);
    if (!file || photoError) {
      setProfilePhotoError(photoError);
      return;
    }

    try {
      const croppedFile = await cropProfilePhotoToSquare(file);
      setProfilePhoto(croppedFile);
      setProfilePhotoPreview(URL.createObjectURL(croppedFile));
      setProfilePhotoError("");
    } catch (error) {
      setProfilePhotoError(error.message || "Could not crop profile photo.");
    }
  };

  const handleUploadProfilePhoto = async () => {
    setProfilePhotoMessage("");
    const photoError = getProfilePhotoError(profilePhoto);
    if (!profilePhoto || photoError) {
      setProfilePhotoError(photoError || "Choose a JPG or PNG profile photo first.");
      return;
    }

    setUploadingPhoto(true);
    const { publicUrl, error: uploadError } = await uploadProfilePhoto({
      file: profilePhoto,
      userId: studentUserId,
      role: "student",
    });

    if (uploadError) {
      setUploadingPhoto(false);
      setProfilePhotoError(uploadError.message || "Could not upload profile photo.");
      return;
    }

    const { error: updateError } = await updateProfilePhoto({
      userId: studentUserId,
      role: "student",
      avatarUrl: publicUrl,
    });
    setUploadingPhoto(false);

    if (updateError) {
      setProfilePhotoError(updateError.message || "Could not save profile photo.");
      return;
    }

    setAvatarUrl(publicUrl);
    setProfilePhoto(null);
    setProfilePhotoPreview("");
    setProfilePhotoError("");
    setProfilePhotoMessage("Profile photo updated.");
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    setSecurityMessage("");
    setSecurityError("");

    if (!isPasswordStrong(newPassword)) {
      setSecurityError(
        "Password must be at least 6 characters and include uppercase, lowercase, and a number."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setSecurityError("Passwords do not match.");
      return;
    }

    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);

    if (error) {
      setSecurityError(error.message || "Could not update password.");
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setSecurityMessage("Password updated successfully.");
  };

  return (
    <div className="student-dashboard student-dashboard--settings">
      <MobileHeader
        notificationOpen={notificationsOpen}
        onToggleNotifications={() => setNotificationsOpen((open) => !open)}
        notificationCount={unreadNotifications}
        onProfileClick={() => setOpenSection("account")}
        profileContent={
          avatarUrl ? <img src={avatarUrl} alt="Profile" /> : studentName.charAt(0).toUpperCase()
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
          className="student-settings-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`student-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="student-side-brand">
          <img src="/leaf-logo.png" alt="Class Connect" />
          <h2>Class Connect</h2>
        </div>

        <button type="button" onClick={() => navigate("/student/classes")}>
          <img src="/icons/myclasses.png" alt="" />
          <span>My Classes</span>
        </button>

        <button type="button" className="student-side-active">
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

      <main className="student-main settings-main">
        <header className="student-topbar">
          <div>
            <h3>Settings</h3>
          </div>
        </header>

        <div className="settings-layout">
          <SettingsSection
            id="account"
            title="Account"
            openSection={openSection}
            setOpenSection={setOpenSection}
          >
            <div className="settings-account-card">
              <div className="settings-avatar">
                {avatarUrl ? <img src={avatarUrl} alt="Profile" /> : studentName.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3>{studentName}</h3>
                <p>{studentEmail || "No email available"}</p>
                <small>{studentNumber || "No student ID available"}</small>
              </div>
              <button
                type="button"
                className="settings-edit-profile-btn"
                onClick={() => setProfileEditorOpen((open) => !open)}
                aria-label="Edit profile photo"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 20h4.8L19.2 9.6a2.1 2.1 0 0 0 0-3L17.4 4.8a2.1 2.1 0 0 0-3 0L4 15.2V20Zm2-2v-2l9.8-9.8 2 2L8 18H6Zm11.2-11.2-2-2 .6-.6 2 2-.6.6Z" />
                </svg>
              </button>
            </div>
            {profileEditorOpen && (
              <ProfilePhotoUpload
                name={studentName}
                avatarUrl={avatarUrl}
                previewUrl={profilePhotoPreview}
                uploading={uploadingPhoto}
                error={profilePhotoError}
                message={profilePhotoMessage}
                onFileChange={handleProfilePhotoChange}
                onUpload={handleUploadProfilePhoto}
              />
            )}
          </SettingsSection>

          <SettingsSection
            id="notifications"
            title="Notifications"
            openSection={openSection}
            setOpenSection={setOpenSection}
          >
            <ToggleRow
              title="Activity Alerts"
              description="Notify you when class participation activity changes."
              checked={settings.activityAlerts}
              onChange={(value) => updateSetting("activityAlerts", value)}
            />
            <ToggleRow
              title="Volunteer Alerts"
              description="Notify you when your volunteer queue status changes."
              checked={settings.volunteerAlerts}
              onChange={(value) => updateSetting("volunteerAlerts", value)}
            />
            <ToggleRow
              title="Session Alerts"
              description="Notify you about live sessions and entry reminders."
              checked={settings.sessionAlerts}
              onChange={(value) => updateSetting("sessionAlerts", value)}
            />
            <ToggleRow
              title="Class Connect Notifications"
              description="Receive important product and classroom updates."
              checked={settings.classConnectNotifications}
              onChange={(value) => updateSetting("classConnectNotifications", value)}
            />
          </SettingsSection>

          <SettingsSection
            id="sound"
            title="Sound"
            openSection={openSection}
            setOpenSection={setOpenSection}
          >
            <ToggleRow
              title="Session Music"
              description="Play background music while a class session is active."
              checked={audioSettings.sessionMusic}
              onChange={(value) => updateAudioSetting("sessionMusic", value)}
            />
            <ToggleRow
              title="Notification Sound"
              description="Play sounds for session and class activity alerts."
              checked={audioSettings.notificationSound}
              onChange={(value) => updateAudioSetting("notificationSound", value)}
            />
          </SettingsSection>

          <SettingsSection
            id="security"
            title="Security"
            openSection={openSection}
            setOpenSection={setOpenSection}
          >
            <form className="settings-password-form" onSubmit={handleChangePassword}>
              <label>
                New Password
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </label>
              <label>
                Confirm Password
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </label>
              {securityError && <p className="settings-error">{securityError}</p>}
              {securityMessage && <p className="settings-success">{securityMessage}</p>}
              <button type="submit" disabled={savingPassword}>
                {savingPassword ? "Updating..." : "Change Password"}
              </button>
            </form>
          </SettingsSection>

          <SettingsSection
            id="logout"
            title="Logout"
            openSection={openSection}
            setOpenSection={setOpenSection}
          >
            <div className="settings-logout-card">
              <div>
                <strong>End your current session</strong>
                <p>Sign out of this student account on this device.</p>
              </div>
              <button type="button" onClick={() => setShowLogoutConfirm(true)}>
                Logout
              </button>
            </div>
          </SettingsSection>

          <SettingsSection
            id="about"
            title="About"
            openSection={openSection}
            setOpenSection={setOpenSection}
          >
            <div className="settings-about-list">
              <article>
                <h3>About Class Connect</h3>
                <p>
                  Class Connect helps students join class sessions, volunteer for
                  participation, view activity records, and track points awarded by
                  instructors.
                </p>
              </article>
              <article>
                <h3>Terms and Conditions</h3>
                <p>
                  Review the full Class Connect terms, privacy notes, and student
                  responsibilities.
                </p>
                <button
                  type="button"
                  className="settings-about-button"
                  onClick={() => setShowTermsModal(true)}
                >
                  View Terms
                </button>
              </article>
              <article>
                <h3>How System Works</h3>
                <p>
                  Your instructor manages sessions, spinner selections, volunteer
                  approvals, and final point awards. Student views update as those
                  records change.
                </p>
              </article>
              <article>
                <h3>Contacts</h3>
                <p>
                  For support, contact your instructor, Class Connect administrator, or
                  school system manager.
                </p>
              </article>
            </div>
          </SettingsSection>
        </div>
      </main>

      {showTermsModal && (
        <div
          className="settings-modal-overlay"
          onClick={() => setShowTermsModal(false)}
        >
          <div
            className="settings-terms-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="settings-modal-bar" />
            <div className="settings-terms-content">
              <h2>ClassConnect Terms and Conditions</h2>
              <p className="terms-updated">Last updated: May 2026</p>

              <p>
                Welcome to Class Connect, an educational classroom participation
                system designed for Gordon College - College of Computer Studies.
                By creating an account, you agree to use the system responsibly and
                only for academic purposes.
              </p>

              <h3>1. Purpose of the System</h3>
              <p>
                Class Connect supports fair classroom participation through class
                sessions, student selection, volunteer queues, participation records,
                point tracking, and instructor-managed activities.
              </p>

              <h3>2. Account Registration</h3>
              <p>
                Users must provide accurate information. Students must enter their
                correct student ID number and use their Gordon College domain account.
                Each user should maintain only one account.
              </p>

              <h3>3. Proper Use</h3>
              <p>
                Users must not share accounts, impersonate another user, submit false
                information, bypass system restrictions, or interfere with class
                session records.
              </p>

              <h3>4. Participation and Points</h3>
              <p>
                Participation records, volunteer queues, and points are managed by
                the instructor. The system records and organizes participation data
                based on class activities and instructor input.
              </p>

              <h3>5. Data Collection</h3>
              <p>
                Class Connect may collect and store full name, institutional email,
                student ID number, user role, class membership, participation
                history, volunteer activity, session records, and points earned.
              </p>

              <h3>6. Data Privacy</h3>
              <p>
                Personal information is used only for educational participation
                tracking and system functionality. The system follows the principles
                of Republic Act No. 10173, also known as the Data Privacy Act of
                2012.
                <a
                  href="https://privacy.gov.ph/data-privacy-act/"
                  target="_blank"
                  rel="noreferrer"
                >
                  {" "}
                  Read the Data Privacy Act.
                </a>
              </p>

              <h3>7. User Responsibility</h3>
              <p>
                Users are responsible for keeping login credentials private and
                reporting incorrect records, unauthorized access, or suspicious
                activity.
              </p>

              <h3>8. System Limitations</h3>
              <p>
                Class Connect assists classroom participation management, but it may
                still depend on internet connection, device compatibility, instructor
                input, and correct student information.
              </p>

              <h3>9. Agreement</h3>
              <p>
                By using the system, you confirm that you have read, understood, and
                agreed to these Terms and Conditions.
              </p>
              <button
                type="button"
                className="settings-modal-close"
                onClick={() => setShowTermsModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      <BottomNav items={studentBottomNavItems} />
    </div>
  );
}

