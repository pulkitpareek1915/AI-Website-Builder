// ProtectedRoute — only lets a logged-in user see the page; otherwise sends
// them to /login. Shows a spinner while the session is being restored so a
// refresh doesn't bounce a logged-in user to the login page.
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { protectedRouteStyles as s } from "../assets/dummyStyles";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className={s.loadingContainer}>
        <div className={s.loadingSpinner} />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}