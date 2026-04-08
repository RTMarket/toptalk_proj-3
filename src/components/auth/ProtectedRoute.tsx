import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isLoggedIn = localStorage.getItem('toptalk_session_token');
  if (!isLoggedIn || !isLoggedIn.trim()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
