import { BrowserRouter, Routes, Route } from "react-router-dom";

import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/auth/LoginPage";
import SignUpPage from "./pages/auth/SignUpPage";
import ResetPassword from "./pages/auth/ResetPassword";
import DashboardTeacher from "./pages/teacher/DashboardTeacher";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="/teacher/dashboard" element={<DashboardTeacher />} />
      </Routes>
    </BrowserRouter>
  );
}