import { Router, Route } from 'preact-router';
import { AuthProvider } from './provider';
import { ProtectedRoute, GuestRoute } from './guards';
import AuthScreen from '../features/auth/AuthScreen';
import { useAuth } from '../hooks/useAuth';
import AuthCallback from '../features/auth/AuthCallback';

// Pages
function Home() {
  const { user, signOut } = useAuth();
  return (
    <div class="min-h-screen bg-gray-50 p-8">
      <div class="max-w-4xl mx-auto">
        <div class="bg-white rounded-lg shadow p-6">
          <h1 class="text-2xl font-bold mb-4">Welcome!</h1>
          <p class="text-gray-600 mb-4">Logged in as: {user?.email}</p>
          <button
            onClick={signOut}
            class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

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