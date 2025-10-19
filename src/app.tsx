import { Switch, Route } from 'wouter';
import Home from './features/home/home';
import NewTrip from './features/trips/NewTrip';

export function App() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/trips/new" component={NewTrip} />
      <Route>/* 404 fallback if needed */</Route>
    </Switch>
  );
}
