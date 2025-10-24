import { Router, Route, route } from 'preact-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './provider';
import { ProtectedRoute, GuestRoute } from './guards';
import AuthScreen from '../features/auth/AuthScreen';
import AuthCallback from '../features/auth/AuthCallback';
import Home from '../features/home/home';
import NewTrip from '../features/trips/NewTrip';
import TripDetail from '../features/trips/detail/TripDetail';
import ItineraryFull from '../features/itinerary/ItineraryFull';

// Configure QueryClient with global error handling
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry on 401/403 errors
        if (error?.status === 401 || error?.status === 403) {
          return false;
        }
        return failureCount < 3;
      }
    },
    mutations: {
      onError: (error: any) => {
        // Redirect to login on unauthorized errors
        if (error?.status === 401 || error?.code === 'PGRST301') {
          route('/auth', true);
        }
      },
    },
  },
});

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

const ProtectedTripDetail = ({ id }: { id: string }) => (
  <ProtectedRoute>
    <TripDetail id={id} />
  </ProtectedRoute>
);

const ProtectedItineraryFull = ({ id }: { id: string }) => (
  <ProtectedRoute>
    <ItineraryFull id={id} />
  </ProtectedRoute>
);

const ProtectedNewTrip = () => (
  <ProtectedRoute>
    <NewTrip />
  </ProtectedRoute>
);

export function AppRouter() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Route path="/auth" component={GuestAuth} />
          <Route path="/" component={ProtectedHome} />
          <Route path="/trips/new" component={ProtectedNewTrip} />
          <Route default component={NotFound} />
          <Route path="/trip/:id" component={ProtectedTripDetail} />
          <Route path="/trip/itinerary/:id" component={ProtectedItineraryFull} />
          <Route path="/auth/callback" component={AuthCallback} />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}
