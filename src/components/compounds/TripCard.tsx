import type { Trip } from "../../types/models";

interface TripCardProps {
    trip: Trip;
}
export default function TripCard({ trip }: TripCardProps) {
    return (
        <div class='border rounded-lg border-gray-200 p-3 hover:bg-gray-50 cursor-pointer transition-colors'>
            <h1 class='text-sm font-semibold text-gray-800 mb-1'>{trip.title}</h1>
            <h2 class='text-xs font-normal text-gray-800 mb-1'>{trip.startDate} - {trip.endDate}</h2>
        </div>
    )
}