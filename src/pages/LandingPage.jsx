import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function LandingPage() {
  const navigate = useNavigate();
  const [activeModal, setActiveModal] = useState(null);

  return (
    <main className="landing-page-v2">
      <nav className="landing-nav">
        <div className="nav-brand">
          <img src="/leaf-logo.png" alt="Class Connect Logo" />
          <span>Class Connect</span>
        </div>

        <div className="nav-actions">
          <button onClick={() => setActiveModal("about")}>ABOUT US</button>
          <button onClick={() => setActiveModal("terms")}>TERMS & CONDITIONS</button>
          <button className="nav-primary" onClick={() => navigate("/signup")}>
            GET STARTED
          </button>
        </div>
      </nav>

      <section className="hero-section">
        <div className="hero-layout">
          <div className="hero-content">
            <div className="institution-block">
              <img src="/gordon-logo.png" className="institution-logo" alt="Gordon College Logo" />
            
              <div className="institution-text">
                <h2>Gordon College</h2>
                <p>College of Computer Studies</p>
              </div>
            </div>
            
            <div className="brand-row">
              <img
                src="/leaf-logo.png"
                className="leaf-logo"
                alt="Class Connect Logo"
              />
              <h1>Class Connect</h1>
            </div>

            <p className="tagline">LEVEL UP YOUR CLASS</p>

            <p className="hero-description">
              An equity-based classroom participation system that helps instructors
              manage recitations, track participation points, and encourage every
              student to take part in class.
            </p>

            <div className="hero-buttons">
              <button className="primary-btn" onClick={() => navigate("/login")}>
                LOGIN
              </button>
              <button
                className="secondary-btn"
                onClick={() => navigate("/signup")}
              >
                GET STARTED
              </button>
            </div>
          </div>

          <div className="hero-qr-card" aria-label="Class Connect QR code">
            <img
              src="/qr-code.png"
              className="hero-qr-code"
              alt="Class Connect QR code"
            />
          </div>
        </div>
      </section>

      <section className="features-section">
        <h2>System Features</h2>
      
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <img src="/icons/fair.png" alt="Fair Selection" />
            </div>
            <h3>Fair Selection</h3>
            <p>
              Uses a structured selection process to give students fair participation
              opportunities.
            </p>
          </div>
      
          <div className="feature-card">
            <div className="feature-icon">
              <img src="/icons/points.png" alt="Point Tracking" />
            </div>
            <h3>Point Tracking</h3>
            <p>
              Allows instructors to assign points for activities and record student
              participation.
            </p>
          </div>
      
          <div className="feature-card">
            <div className="feature-icon">
              <img src="/icons/volunteer.png" alt="Volunteer Queue" />
            </div>
            <h3>Volunteer Queue</h3>
            <p>
              Records student volunteers in order when another student is unable to
              answer.
            </p>
          </div>
      
          <div className="feature-card">
            <div className="feature-icon">
              <img src="/icons/session.png" alt="Session Control" />
            </div>
            <h3>Session Control</h3>
            <p>
              Supports class sessions, time limits, and participation tracking during
              live classroom activities.
            </p>
          </div>
        </div>
      </section>

      {activeModal === "about" && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="info-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-bar"></div>

            <div className="terms-content">
              <h2>About Class Connect</h2>

              <p>
                Class Connect is a classroom participation system designed to
                help instructors manage recitations in a fair, organized, and
                technology-assisted way.
              </p>

              <p>
                The system helps reduce manual selection bias by supporting fair
                student selection, participation point recording, volunteer
                queues, and session-based activity tracking.
              </p>

              <button className="modal-close" onClick={() => setActiveModal(null)}>
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === "terms" && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div
            className="info-modal terms-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-bar"></div>

            <div className="terms-content">
              <h2> ClassConnect Terms and Conditions</h2>
              <p className="terms-updated">Last updated: May 2026</p>

              <p>
                Welcome to Class Connect, an educational classroom participation
                system designed for Gordon College - College of Computer
                Studies. By creating an account, you agree to use the system
                responsibly and only for academic purposes.
              </p>

              <h3>1. Purpose of the System</h3>
              <p>
                Class Connect supports fair classroom participation through class
                sessions, student selection, volunteer queues, participation
                records, point tracking, and instructor-managed activities.
              </p>

              <h3>2. Account Registration</h3>
              <p>
                Users must provide accurate information. Students must enter
                their correct student ID number and use their Gordon College
                domain account. Each user should maintain only one account.
              </p>

              <h3>3. Proper Use</h3>
              <p>
                Users must not share accounts, impersonate another user, submit
                false information, bypass system restrictions, or interfere with
                class session records.
              </p>

              <h3>4. Participation and Points</h3>
              <p>
                Participation records, volunteer queues, and points are managed
                by the instructor. The system records and organizes participation
                data based on class activities and instructor input.
              </p>

              <h3>5. Data Collection</h3>
              <p>
                Class Connect may collect and store full name, institutional
                domain, student ID number, user role, class membership,
                participation history, volunteer activity, session records, and
                points earned.
              </p>

              <h3>6. Data Privacy</h3>
              <p>
                Personal information is used only for educational participation
                tracking and system functionality. The system follows the
                principles of Republic Act No. 10173, also known as the Data
                Privacy Act of 2012.
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
                Class Connect assists classroom participation management, but it
                may still depend on internet connection, device compatibility,
                instructor input, and correct student information.
              </p>

              <h3>9. Agreement</h3>
              <p>
                By using the system, you confirm that you have read, understood,
                and agreed to these Terms and Conditions.
              </p>

              <button className="modal-close" onClick={() => setActiveModal(null)}>
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

