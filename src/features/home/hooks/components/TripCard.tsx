import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import type { Trip } from '../../hooks/useTrips';

type TripCardProps = {
  trip: Trip;
  onClick: () => void;
};

export function TripCard({ trip, onClick }: TripCardProps) {
  const dateRange = `${format(new Date(trip.start_date), 'd MMM', { locale: th })} - ${format(new Date(trip.end_date), 'd MMM yyyy', { locale: th })}`;

  return (
    <button
      onClick={onClick}
      class="w-full bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow text-left"
    >
      <h3 class="font-semibold text-gray-900 text-lg mb-1">{trip.title}</h3>
      <p class="text-sm text-gray-600 mb-2">{dateRange}</p>
      <div class="flex items-center gap-4 text-xs text-gray-500">
        <span>{trip.activity_count ?? 0} กิจกรรม</span>
      </div>
    </button>
  );
}