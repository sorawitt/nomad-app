import { Router, Route } from 'preact-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './provider';
import { ProtectedRoute, GuestRoute } from './guards';
import AuthScreen from '../features/auth/AuthScreen';
import AuthCallback from '../features/auth/AuthCallback';
import Home from '../features/home/home';
import NewTrip from '../features/trips/NewTrip';

const queryClient = new QueryClient();

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
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Route path="/auth" component={GuestAuth} />
          <Route path="/" component={ProtectedHome} />
          <Route path="/trips/new" component={NewTrip} />
          <Route default component={NotFound} />
          <Route path="/auth/callback" component={AuthCallback} />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}
