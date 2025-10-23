import { format } from "date-fns/format";
import type { Trip } from "../../types/models";
import { enUS } from "date-fns/locale";

type TripCardProps = {
  trip: Trip;
  onClick: () => void;
};
export default function TripCard({ trip, onClick }: TripCardProps) {
  const dateRange = `${format(new Date(trip.start_date), "d MMM", {
    locale: enUS,
  })} - ${format(new Date(trip.end_date), "d MMM yyyy", { locale: enUS })}`;

  return (
    <button
      class="w-full text-left border rounded-lg border-gray-200 p-3 hover:bg-gray-50 transition-colors bg-white"
      onClick={onClick}
    >
      <h1 class="text-sm font-semibold text-gray-800 mb-1">{trip.title}</h1>
      <h2 class="text-xs font-normal text-gray-800 mb-1">{dateRange}</h2>
    </button>
  );
}
