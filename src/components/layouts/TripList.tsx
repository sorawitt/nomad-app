import type { Trip } from "../../types/models"
import TripCard from "../compounds/TripCard"

interface TripListProps {
    title: string
    trips: Trip[]
}
export default function TripList({ title, trips }: TripListProps) {
    return (
        <div class='p-4'>
            <h1 class='text-xs font-semibold text-gray-400 mb-2'>{title}</h1>
            <div class='space-y-2'>
                {
                    trips.map((trip) => (
                        <TripCard key={trip.id} trip={trip} />
                    ))
                }
            </div>
        </div>
    )
}