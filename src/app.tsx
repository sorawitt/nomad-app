import { Router, Route } from 'preact-router';
import Home from './features/home/home';
import NewTrip from './features/trips/NewTrip';

export function App() {
  return (
    <Router>
      <Route path="/" component={Home} />
      <Route path="/trips/new" component={NewTrip} />
      <Route default component={Home} />
    </Router>
  );
}
