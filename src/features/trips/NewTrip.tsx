import NavBar from '../../components/compounds/NavBar';

export default function NewTrip() {
    return (
        <div class="min-h-screen bg-gray-50">
            <NavBar
                title="New Trip"
                leftAction={
                    <button
                        class="text-zinc-500 hover:text-zinc-600 text-xl transition-colors duration-150"
                        onClick={() => history.back()}
                        aria-label="Back"
                        type="button"
                    >
                        ←
                    </button>
                }
            />
            <main class="px-4 py-6">
                <h1>New Trip</h1>
                <input
                    type="text"
                    placeholder="Thailand Explorer"
                    class="w-full bg-white rounded-md border border-gray-200 px-4 py-3 
         text-gray-900 text-sm placeholder-gray-400 
         focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />

                <div class="mt-6 flex justify-end">
                    <button class="btn-primary" type="button">
                        Save Trip
                    </button>
                </div>
            </main>
        </div>
    );
}
