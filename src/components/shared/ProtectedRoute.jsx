import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getCurrentAccount } from "../../features/authRole";
import AppLoadingScreen from "./AppLoadingScreen";

function getRoleRedirect(role) {
  return role === "teacher" ? "/teacher/dashboard" : "/student/classes";
}

function ProtectedRoute({ children, role }) {
  const location = useLocation();
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadAccount() {
      const nextAccount = await getCurrentAccount();
      if (cancelled) return;
      setAccount(nextAccount);
      setLoading(false);
    }

    loadAccount();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <AppLoadingScreen title="Checking your session" />;
  }

  if (!account?.user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (role && account.role !== role) {
    return <Navigate to={getRoleRedirect(account.role)} replace />;
  }

  return children;
}

export default ProtectedRoute;
