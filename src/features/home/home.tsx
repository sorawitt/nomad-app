import Header from '../../components/compounds/Header'
import NavBar from '../../components/compounds/NavBar'
import TripList from '../../components/layouts/TripList'
import { useAuth } from '../../hooks/useAuth';
import { route } from 'preact-router';
import { useTrips } from './hooks/useTrips';

export default function Home() {
    const { data: trips } = useTrips();
    const { user, signOut } = useAuth();
    const handleCreateTrip = () => {
        route('/trips/new');
    };

    return (
        <div class="min-h-screen bg-gray-50">
            <NavBar
                title={`My Trips - ${user?.user_metadata.name}`}
                leftAction={
                    <button
                        class="w-8 h-8 flex items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition"
                        aria-label="Open menu"
                         onClick={signOut}
                    >
                        ☰
                    </button>
                }
                rightAction={
                    <button
                        class="w-8 h-8 flex items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition"
                        aria-label="Add new trip"
                        onClick={handleCreateTrip}
                    >
                        +
                    </button>
                }
            />

            <main class="p-4">
                <Header title='My Trips' subtitle='Plan your fun journey'></Header>
                <TripList title="UPCOMING TRIPS" trips={trips} />
            </main>
        </div>
    )
}
