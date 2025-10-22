import { route } from 'preact-router';
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { useAuth } from '../hooks/useAuth';

type GuardProps = {
  children: ComponentChildren;
  requireAuth: boolean;
  redirectTo: string;
};

function RouteGuard({ children, requireAuth, redirectTo }: GuardProps) {
  const { session, loading } = useAuth();
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (loading) return;

    const hasSession = !!session;
    const shouldRedirect = requireAuth ? !hasSession : hasSession;

    if (shouldRedirect) {
      route(redirectTo, true);
      setShouldRender(false);
    } else {
      setShouldRender(true);
    }
  }, [session, loading, requireAuth, redirectTo]);

  if (loading) {
    return (
      <div class="min-h-screen flex items-center justify-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return shouldRender ? <>{children}</> : null;
}

export const ProtectedRoute = ({ children }: { children: ComponentChildren }) => (
  <RouteGuard requireAuth={true} redirectTo="/auth">
    {children}
  </RouteGuard>
);

export const GuestRoute = ({ children }: { children: ComponentChildren }) => (
  <RouteGuard requireAuth={false} redirectTo="/">
    {children}
  </RouteGuard>
);