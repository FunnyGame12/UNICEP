import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function ProtectedRoute({ roles = [], permissions = [], children }) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles.length > 0 && !roles.includes(user?.rol)) {
    return <Navigate to="/" replace />;
  }

  if (permissions.length > 0) {
    const userPermissions = new Set(user?.permisos || []);
    const hasPermission = permissions.some((permission) => userPermissions.has(permission));
    if (!hasPermission) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
}
