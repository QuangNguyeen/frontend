import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { authService } from '@/features/auth/services/authService';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';

export function RequireAdmin() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setUser = useAuthStore((s) => s.setUser);
  const [hasCheckedAdmin, setHasCheckedAdmin] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);

  useEffect(() => {
    let active = true;

    if (!isAuthenticated) return;

    authService
      .getMe()
      .then((nextUser) => {
        if (active) setUser(nextUser);
      })
      .catch(() => {
        if (active) setCheckFailed(true);
      })
      .finally(() => {
        if (active) setHasCheckedAdmin(true);
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated, setUser]);

  if (isAuthenticated && !hasCheckedAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (checkFailed || !user?.is_admin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
