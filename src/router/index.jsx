import { createBrowserRouter } from "react-router-dom";

import LandingPage from "../pages/LandingPage";
import LoginPage from "../pages/auth/LoginPage";
import SignUpPage from "../pages/auth/SignUpPage";
import ResetPassword from "../pages/auth/ResetPassword";
import DashboardTeacher from "../pages/teacher/DashboardTeacher";
import MyClassesTeacher from "../pages/teacher/MyClassesTeacher";
import ClassPage from "../pages/teacher/ClassPage";
import SettingsPage from "../pages/teacher/SettingsPage";
import MyClassesStudent from "../pages/student/MyClasses";
import ClassPageStudent from "../pages/student/ClassPageStudent";
import JoinInviteRedirect from "../pages/student/JoinInviteRedirect";
import SettingsPageStudent from "../pages/student/SettingsPage";
import ProtectedRoute from "../components/shared/ProtectedRoute";

function protect(element, role) {
  return <ProtectedRoute role={role}>{element}</ProtectedRoute>;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/signup",
    element: <SignUpPage />,
  },
  {
    path: "/reset-password",
    element: <ResetPassword />,
  },
  {
    path: "/teacher/dashboard",
    element: protect(<DashboardTeacher />, "teacher"),
  },
  {
    path: "/teacher/classes",
    element: protect(<MyClassesTeacher />, "teacher"),
  },
  {
    path: "/teacher/class/:classId",
    element: protect(<ClassPage />, "teacher"),
  },
  {
    path: "/student/classes",
    element: protect(<MyClassesStudent />, "student"),
  },
  {
    path: "/student/join/:classCode",
    element: protect(<JoinInviteRedirect />, "student"),
  },
  {
    path: "/student/class/:classId",
    element: protect(<ClassPageStudent />, "student"),
  },
  {
    path: "/student/settings",
    element: protect(<SettingsPageStudent />, "student"),
  },
  {
    path: "/settings",
    element: protect(<SettingsPage />, "teacher"),
  },
  {
    path: "/settings/account",
    element: protect(<SettingsPage />, "teacher"),
  }
]);

export default router;
