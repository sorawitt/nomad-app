import { useTripDetail } from "./hooks/useTripDetail";
import { enUS } from "date-fns/locale";
import { format } from "date-fns";
import { useTripDays, type TripDay } from "./hooks/useTripDays";

export default function TripDetail(props: { id: string }) {
  const { data: trip, isLoading: tripLoading } = useTripDetail(props.id);
  const { data: tripDays, isLoading: tripDaysLoading } = useTripDays(props.id);

  if (tripLoading || tripDaysLoading) {
    return (
      <div class="min-h-screen bg-gray-50">
        <header class="bg-white border-b border-gray-200">
          <div class="max-w-4xl mx-auto px-4 py-4 animate-pulse">
            <div class="h-6 bg-gray-200 rounded w-48 mb-2"></div>
            <div class="h-4 bg-gray-200 rounded w-32"></div>
          </div>
        </header>
        <main class="max-w-4xl mx-auto px-4 py-6">
          <DaysSkeleton />
        </main>
      </div>
    );
  }

  if (!trip) {
    return <div>Trip not found</div>;
  }

  const timeStr = trip.start_date
    ? format(new Date(trip.start_date), "d MMMM yyyy", { locale: enUS })
    : "-";

  const timeEnd = trip.end_date
    ? format(new Date(trip.end_date), "d MMMM yyyy", { locale: enUS })
    : "-";

  return (
    <div class="min-h-screen bg-gray-50">
      <header class="sticky top-0 z-10 bg-white/90 backdrop-blur supports-[backdrop-filter]:border-b border-gray-200/60">
        <div class="relative flex items-center justify-center py-4">
          <button
            class="absolute left-4 text-blue-600 text-xl hover:text-blue-500"
            onClick={() => history.back()}
            type="button"
            aria-label="Back"
          >
            ←
          </button>
          <h1 class="text-base font-semibold text-gray-900">Trip Detail</h1>
        </div>
      </header>
      <TripDetailHeader
        title={trip.title}
        startDate={timeStr}
        endDate={timeEnd}
        badges={["taiwan", "trip"]}
      />
      <TripItinerary tripDays={tripDays ?? []} tripId={trip.id} />
    </div>
  );
}

interface TripDetailHeaderProps {
  title: string;
  startDate: string;
  endDate: string;
  badges?: string[];
}
function TripDetailHeader({
  title,
  startDate,
  endDate,
  badges,
}: TripDetailHeaderProps) {
  return (
    <div class="p-4 border-b-1 border-zinc-200 space-y-2">
      <h1 class="text-4xl font-bold">{title}</h1>
      <h2 class="text-sm text-gray-600">
        {startDate} - {endDate}
      </h2>
      <div class="mt-2">
        {badges && badges.map((badge) => <Badge text={badge} key={badge} />)}
      </div>
    </div>
  );
}

function Badge({ text }: { text: string }) {
  return (
    <span class="inline-block bg-zinc-100 text-zinc-600 text-xs px-2 py-1 rounded-full mr-2">
      {text}
    </span>
  );
}

function DaysSkeleton() {
  return (
    <div class="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 animate-pulse"
        >
          <div class="flex items-start justify-between mb-3">
            <div class="flex-1">
              <div class="h-4 bg-gray-200 rounded w-16 mb-2"></div>
              <div class="h-4 bg-gray-200 rounded w-32"></div>
            </div>
            <div class="text-right">
              <div class="h-8 w-8 bg-gray-200 rounded ml-auto mb-1"></div>
              <div class="h-3 bg-gray-200 rounded w-12"></div>
            </div>
          </div>
          <div class="h-10 bg-gray-200 rounded"></div>
        </div>
      ))}
    </div>
  );
}

interface TripItineraryProps {
  tripId: string;
  tripDays: TripDay[];
}
function TripItinerary({ tripId, tripDays }: TripItineraryProps) {
  return (
    <div class="flex flex-col gap-1 p-4">
      <h1>Itinerary</h1>
      {tripDays.map((day) => (
        <div class="flex items-center gap-2" key={day.id}>
          <div class="w-1 h-1 bg-slate-900 rounded-full"></div>
          <span class="text-xs font-medium text-slate-900 capitalize">
            Day {day.day_index + 1} | {day.title}
          </span>
        </div>
      ))}

      <a
        href={`/trip/itinerary/${tripId}`}
        class="mt-4 inline-block text-blue-600 hover:underline text-xs"
      >
        View Full Itinerary
      </a>
    </div>
  );
}
