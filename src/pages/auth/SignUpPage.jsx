import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import ProfilePhotoUpload from "../../components/common/ProfilePhotoUpload";
import {
  cropProfilePhotoToSquare,
  getProfilePhotoError,
  uploadProfilePhoto,
} from "../../features/profilePhoto";

export default function SignUpPage() {
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [emailName, setEmailName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("");
  const [agree, setAgree] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState("");
  const [profilePhotoError, setProfilePhotoError] = useState("");

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isSigningUp, setIsSigningUp] = useState(false);

  const passwordRules = {
    length: password.length >= 6,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };

  const isPasswordValid =
    passwordRules.length &&
    passwordRules.uppercase &&
    passwordRules.lowercase &&
    passwordRules.number;

  const handleSignup = async () => {
    if (isSigningUp) return;

    setErrorMsg("");
    setSuccessMsg("");

    if (!firstName || !lastName || !emailName || !password) {
      setErrorMsg("Please fill in all fields.");
      return;
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

    if (role === "student" && !/^\d{9}$/.test(studentId)) {
      setErrorMsg("Student ID must be exactly 9 digits.");
      return;
    }

    if (!isPasswordValid) {
      setErrorMsg("Password does not meet requirements.");
      return;
    }

    if (!agree) {
      setErrorMsg("Please read and accept the Terms.");
      return;
    }

    if (!role) {
      setErrorMsg("Please select a role.");
      return;
    }

    const photoError = getProfilePhotoError(profilePhoto);
    if (photoError) {
      setProfilePhotoError(photoError);
      setErrorMsg(photoError);
      return;
    }

    const fullEmail = `${emailName}@gordoncollege.edu.ph`;

    setIsSigningUp(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: fullEmail,
        password,
        options: {
          data: {
            full_name: fullName,
            name: fullName,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            role: role,
          },
        },
      });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      const user = data.user;

      if (user) {
        const table = role === "teacher" ? "teachers" : "students";
        let avatarUrl = "";

        if (profilePhoto) {
          const { publicUrl, error: uploadError } = await uploadProfilePhoto({
            file: profilePhoto,
            userId: user.id,
            role,
          });

          if (uploadError) {
            setErrorMsg(uploadError.message || "Could not upload profile photo.");
            return;
          }

          avatarUrl = publicUrl;
        }

        const payload =
          role === "teacher"
            ? { id: user.id, name: fullName, email: fullEmail, avatar_url: avatarUrl || null }
            : {
                id: user.id,
                name: fullName,
                email: fullEmail,
                student_id: studentId,
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                avatar_url: avatarUrl || null,
              };

        const { error: profileError } = await supabase.from(table).insert(payload);

        if (profileError) {
          setErrorMsg(profileError.message);
          return;
        }
      }

      setSuccessMsg("Account created. Check your email.");

      setTimeout(() => navigate("/login"), 2000);
    } finally {
      setIsSigningUp(false);
    }
  };

  const handleProfilePhotoChange = async (file) => {
    if (profilePhotoPreview) {
      URL.revokeObjectURL(profilePhotoPreview);
    }

    setProfilePhoto(null);
    setProfilePhotoPreview("");

    const photoError = getProfilePhotoError(file);
    if (!file || photoError) {
      setProfilePhotoError(photoError);
      setErrorMsg(photoError);
      return;
    }

    try {
      const croppedFile = await cropProfilePhotoToSquare(file);
      setProfilePhoto(croppedFile);
      setProfilePhotoPreview(URL.createObjectURL(croppedFile));
      setProfilePhotoError("");
      setErrorMsg("");
    } catch (error) {
      const message = error.message || "Could not crop profile photo.";
      setProfilePhotoError(message);
      setErrorMsg(message);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-window">
        <div className="window-bar"></div>

        <div className="auth-content">
          <div className="auth-left">
            <img src="/gordon-logo.png" className="auth-school-logo" />

            <h2>Gordon College</h2>
            <p>College of Computer Studies</p>

            <div
              className="auth-brand"
              onClick={() => navigate("/")}
              style={{ cursor: "pointer" }}
            >
              <img src="/leaf-logo.png" />
              <h1>Class Connect</h1>
            </div>

            <span className="auth-tag">LEVEL UP YOUR CLASS</span>
          </div>

          <div className="auth-right">
            <div className="auth-card">
              <div className="solid-card-bar"></div>

              <h2>Sign Up</h2>
              <p className="auth-card-sub">
                Create your account using your Gordon College email.
              </p>

              <div className="auth-form-grid">
                <div className="auth-field">
                  <label>First name</label>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    autoComplete="given-name"
                    disabled={isSigningUp}
                  />
                </div>

                <div className="auth-field">
                  <label>Last name</label>
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                    autoComplete="family-name"
                    disabled={isSigningUp}
                  />
                </div>
              </div>

              <label>Role</label>
              <div className="select-wrapper">
                <select
                  className="role-select"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={isSigningUp}
                >
                  <option value="" disabled hidden>
                    Select a role
                  </option>
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                </select>
              </div>
              

              {role === "student" && (
                <>
                  <label>Student ID</label>
                  <input
                    maxLength="9"
                    onChange={(e) =>
                      setStudentId(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="9-digit ID"
                    disabled={isSigningUp}
                  />
                </>
              )}

              <label>Email</label>
              <div className="email-input">
                <input
                  value={emailName}
                  onChange={(e) => setEmailName(e.target.value)}
                  placeholder="username"
                  disabled={isSigningUp}
                />
                <span>@gordoncollege.edu.ph</span>
              </div>

              <label>Password</label>
              <div className="password-input-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  disabled={isSigningUp}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={isSigningUp}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              <div className="password-panel">
                <p>Password must contain:</p>
              
                <div className={passwordRules.length ? "rule ok" : "rule"}>
                  <span>{passwordRules.length ? "✓" : "○"}</span>
                  Minimum of 6 characters
                </div>
              
                <div className={passwordRules.uppercase ? "rule ok" : "rule"}>
                  <span>{passwordRules.uppercase ? "✓" : "○"}</span>
                  One uppercase letter
                </div>
              
                <div className={passwordRules.lowercase ? "rule ok" : "rule"}>
                  <span>{passwordRules.lowercase ? "✓" : "○"}</span>
                  One lowercase letter
                </div>
              
                <div className={passwordRules.number ? "rule ok" : "rule"}>
                  <span>{passwordRules.number ? "✓" : "○"}</span>
                  And a number/s
                </div>
              </div>

              <div className="auth-photo-row">
                <button
                  type="button"
                  className="auth-photo-trigger"
                  onClick={() => setShowPhotoModal(true)}
                  disabled={isSigningUp}
                >
                  <span className="auth-photo-thumb" aria-hidden="true">
                    {profilePhotoPreview ? (
                      <img src={profilePhotoPreview} alt="" />
                    ) : (
                      (firstName || "U").charAt(0).toUpperCase()
                    )}
                  </span>
                  <span className="auth-photo-copy">
                    <strong>2x2 Profile Photo</strong>
                    <small>{profilePhoto ? "Photo selected" : "Optional — add a photo"}</small>
                  </span>
                  <span className="auth-photo-cta">Upload</span>
                </button>
              </div>

              <div className="terms-row">
                <input type="checkbox" checked={agree} readOnly />
                <button onClick={() => setShowTerms(true)} disabled={isSigningUp}>
                  Terms and Conditions
                </button>
              </div>

              {errorMsg && <div className="error-box">{errorMsg}</div>}
              {successMsg && <div className="success-box">{successMsg}</div>}

              <button
                className="primary-btn"
                onClick={handleSignup}
                disabled={isSigningUp}
              >
                {isSigningUp ? "CREATING..." : "CREATE ACCOUNT"}
              </button>
              <div className="auth-switch">
                Already have an account?{" "}
                <button type="button" onClick={() => navigate("/login")}>
                  Log in
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showPhotoModal && (
        <div className="modal-overlay" onClick={() => setShowPhotoModal(false)}>
          <div
            className="info-modal photo-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-bar"></div>
            <div className="photo-modal-content">
              <div className="photo-modal-head">
                <div>
                  <h2>Upload profile photo</h2>
                  <p>Please upload jpg or png files only.</p>
                </div>
                <button
                  type="button"
                  className="photo-modal-close"
                  onClick={() => setShowPhotoModal(false)}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <ProfilePhotoUpload
                name={`${firstName || "U"} ${lastName || ""}`.trim()}
                previewUrl={profilePhotoPreview}
                disabled={isSigningUp}
                error={profilePhotoError}
                onFileChange={handleProfilePhotoChange}
              />

              <div className="photo-modal-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    handleProfilePhotoChange(null);
                  }}
                  disabled={isSigningUp || (!profilePhoto && !profilePhotoPreview)}
                >
                  Remove
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => setShowPhotoModal(false)}
                  disabled={isSigningUp}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTerms && (
        <div className="modal-overlay" onClick={() => setShowTerms(false)}>
          <div className="info-modal terms-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-bar"></div>
      
            <div className="terms-content">
              <h2>Class Connect Terms and Conditions</h2>
              <p className="terms-updated">Last updated: May 2026</p>
      
              <p>
                Welcome to Class Connect, an educational classroom participation system
                designed for Gordon College - College of Computer Studies. By creating
                an account, you agree to use the system responsibly and only for academic
                purposes.
              </p>
      
              <h3>1. Purpose of the System</h3>
              <p>
                Class Connect supports fair classroom participation through class
                sessions, student selection, volunteer queues, participation records,
                point tracking, and teacher-managed activities.
              </p>
      
              <h3>2. Account Registration</h3>
              <p>
                Users must provide accurate information. Students must enter their
                correct student ID number and use their Gordon College email account.
                Each user should maintain only one account.
              </p>
      
              <h3>3. Proper Use</h3>
              <p>
                Users must not share accounts, impersonate another user, submit false
                information, bypass system restrictions, or interfere with class session
                records.
              </p>
      
              <h3>4. Participation and Points</h3>
              <p>
                Participation records, volunteer queues, and points are managed by the
                teacher. The system records and organizes participation data based on
                class activities and teacher input.
              </p>
      
              <h3>5. Data Collection</h3>
              <p>
                Class Connect may collect and store full name, institutional email,
                student ID number, user role, class membership, participation history,
                volunteer activity, session records, and points earned.
              </p>
      
              <h3>6. Data Privacy</h3>
              <p>
                Personal information is used only for educational participation tracking
                and system functionality. The system follows the principles of Republic
                Act No. 10173, also known as the Data Privacy Act of 2012.
                <a
                  href="https://privacy.gov.ph/data-privacy-act/"
                  target="_blank"
                  rel="noreferrer"
                >
                  {" "}Read the Data Privacy Act.
                </a>
              </p>
      
              <h3>7. User Responsibility</h3>
              <p>
                Users are responsible for keeping login credentials private and reporting
                incorrect records, unauthorized access, or suspicious activity.
              </p>
      
              <h3>8. System Limitations</h3>
              <p>
                Class Connect assists classroom participation management, but it may
                still depend on internet connection, device compatibility, teacher input,
                and correct student information.
              </p>
      
              <h3>9. Agreement</h3>
              <p>
                By selecting “Accept Terms,” you confirm that you have read, understood,
                and agreed to these Terms and Conditions.
              </p>
      
              <div className="terms-actions">
                <button className="secondary-btn" onClick={() => setShowTerms(false)}>
                  CANCEL
                </button>
                <button
                  className="primary-btn"
                  onClick={() => {
                    setAgree(true);
                    setShowTerms(false);
                  }}
                >
                  ACCEPT TERMS
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
