import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentAccount } from "../../features/authRole";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const navigate = useNavigate();

  const [emailName, setEmailName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  
  const handleLogin = async () => {
    if (isLoggingIn || isSendingReset) return;

    setErrorMsg("");
    setSuccessMsg("");
  
    if (!emailName || !password) {
      setErrorMsg("Please fill in all fields.");
      return;
    }
  
    const fullEmail = emailName + "@gordoncollege.edu.ph";

    setIsLoggingIn(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: fullEmail,
        password: password,
      });
    
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          setErrorMsg("Account not found or incorrect password.");
        } else {
          setErrorMsg(error.message);
        }
      } else {
        const account = await getCurrentAccount();
        const user = data.user;
        const role = account.role || user?.user_metadata?.role;

        if (role === "student") {
          navigate("/student/classes");
          return;
        }

        if (role === "teacher") {
          navigate("/teacher/dashboard");
          return;
        }

        const { data: studentProfile } = await supabase
          .from("students")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();

        navigate(studentProfile ? "/student/classes" : "/teacher/dashboard");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleForgotPassword = async () => {
    if (isLoggingIn || isSendingReset) return;

    setErrorMsg("");
    setSuccessMsg("");

    if (!emailName) {
      setErrorMsg("Enter your email first.");
      return;
    }
  
    const fullEmail = `${emailName}@gordoncollege.edu.ph`;

    setIsSendingReset(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(fullEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    
      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg("Password reset email sent.");
      }
    } finally {
      setIsSendingReset(false);
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

              <h2>Login</h2>

              <label>Email</label>
              <div className="email-input">
                <input
                  type="text"
                  value={emailName}
                  onChange={(e) => setEmailName(e.target.value)}
                  placeholder="Email"
                  disabled={isLoggingIn || isSendingReset}
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
                  disabled={isLoggingIn || isSendingReset}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={isLoggingIn || isSendingReset}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <div className="auth-forgot">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={isLoggingIn || isSendingReset}
                >
                  {isSendingReset ? "Sending reset..." : "Forgot password?"}
                </button>
              </div>

              {errorMsg && <div className="error-box">{errorMsg}</div>}
              {successMsg && <div className="success-box">{successMsg}</div>}
 
              <button
                className="primary-btn"
                onClick={handleLogin}
                disabled={isLoggingIn || isSendingReset}
              >
                {isLoggingIn ? "CHECKING..." : "LOGIN"}
              </button>

              <p className="auth-switch">
                Don’t have an account?{" "}
                <button onClick={() => navigate("/signup")}>
                  Sign up
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
