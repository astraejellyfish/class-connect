import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

export default function ResetPassword() {
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const passwordRules = {
    length: password.length >= 6,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };

  const isValid =
    passwordRules.length &&
    passwordRules.uppercase &&
    passwordRules.lowercase &&
    passwordRules.number;

  const handleReset = async () => {
    setErrorMsg("");

    if (!isValid) {
      setErrorMsg("Password does not meet requirements.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setSuccess(true);

    setTimeout(() => {
      navigate("/login");
    }, 2000);
  };

  return (
    <main className="auth-page">
      <div className="auth-window">
        <div className="auth-content">

          {/* LEFT */}
          <div className="auth-left">
            <div className="institution-block">
              <img src="/gordon-logo.png" className="institution-logo" />
              <div className="institution-text">
                <h2>Gordon College</h2>
                <p>College of Computer Studies</p>
              </div>
            </div>

            <div className="auth-brand" onClick={() => navigate("/")}>
              <img src="/leaf-logo.png" />
              <h1>Class Connect</h1>
            </div>

            <span className="auth-tag">LEVEL UP YOUR CLASS</span>
          </div>

          {/* RIGHT */}
          <div className="auth-right">
            <div className="auth-card">
              <div className="solid-card-bar"></div>

              {!success ? (
                <>
                  <h2>Reset Password</h2>
                  <p>Enter your new password</p>

                  <label>New Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />

                  {/* PASSWORD RULES */}
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
                      One number
                    </div>
                  </div>

                  {errorMsg && <div className="error-box">{errorMsg}</div>}

                  <button
                    className="primary-btn"
                    onClick={handleReset}
                    disabled={loading}
                  >
                    {loading ? "Updating..." : "UPDATE PASSWORD"}
                  </button>
                </>
              ) : (
                <div className="success-screen">
                  <h2>✓ Password Updated</h2>
                  <p>Redirecting to login...</p>
                </div>
              )}

              <div className="auth-switch">
                Back to{" "}
                <button onClick={() => navigate("/login")}>
                  Login
                </button>
              </div>

            </div>
          </div>

        </div>
      </div>
    </main>
  );
}