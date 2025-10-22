import { Router, Route } from 'preact-router';
import { AuthProvider } from './provider';
import { ProtectedRoute, GuestRoute } from './guards';
import AuthScreen from '../features/auth/AuthScreen';
import AuthCallback from '../features/auth/AuthCallback';
import Home from '../features/home/home';

function NotFound() {
  return <div class="p-8 text-center">Not Found</div>;
}

// Wrapped route components
const ProtectedHome = () => (
  <ProtectedRoute>
    <Home />
  </ProtectedRoute>
);

const GuestAuth = () => (
  <GuestRoute>
    <AuthScreen />
  </GuestRoute>
);

export function AppRouter() {
  return (
    <AuthProvider>
      <Router>
        <Route path="/auth" component={GuestAuth} />
        <Route path="/" component={ProtectedHome} />
        <Route default component={NotFound} />
        <Route path="/auth/callback" component={AuthCallback} />
      </Router>
    </AuthProvider>
  );
}