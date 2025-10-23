import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { useTripDetail } from "./hooks/useTripDetail";
import { useTripDays, type TripDay } from "./hooks/useTripDays";

export default function TripDetail(props: { id: string }) {
  const { data: trip, isLoading: tripLoading } = useTripDetail(props.id);
  const { data: tripDays, isLoading: tripDaysLoading } = useTripDays(props.id, 3);

  if (tripLoading || tripDaysLoading) {
    return (
      <div class="min-h-screen bg-[#F8F7F4] text-[#37352F]">
        <header class="border-b border-[#E9E7E2] bg-white/80 backdrop-blur">
          <div class="mx-auto max-w-3xl px-5">
            <div class="relative flex items-center justify-center py-4">
              <div class="absolute left-0 h-3 w-16 rounded bg-[#E4E2DC] animate-pulse" />
              <div class="h-3 w-24 rounded bg-[#E9E7E2] animate-pulse" />
            </div>
          </div>
        </header>
        <main class="mx-auto max-w-3xl px-5 py-8">
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
    <div class="min-h-screen bg-gray-50 text-zinc-900">
      <header class="sticky top-0 z-10 border-b border-[#E9E7E2] bg-white/85 backdrop-blur">
        <div class="mx-auto max-w-3xl px-5">
          <div class="relative flex items-center justify-center py-4">
            <button
              class="absolute left-0 flex items-center gap-2 text-sm text-[#86837E] transition hover:text-[#37352F]"
              onClick={() => history.back()}
              type="button"
              aria-label="Back"
            >
              <span class="text-lg leading-none">←</span>
              <span>Back</span>
            </button>
            <span class="text-sm font-medium text-[#86837E]">Trip Detail</span>
          </div>
        </div>
      </header>
      <main class="mx-auto max-w-3xl px-5 py-8">
        <div class="flex flex-col divide-y divide-[#E9E7E2]">
          <TripDetailHeader
            title={trip.title}
            startDate={timeStr}
            endDate={timeEnd}
            badges={["taiwan", "trip"]}
          />
          <TripItinerary tripDays={tripDays ?? []} tripId={trip.id} />
          <TripBudgetOverview spent={100000} budget={500000} />
        </div>
      </main>
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
    <section class="py-8 first:pt-0">
      <span class="text-[11px] uppercase tracking-[0.18em] text-[#86837E]">
        Overview
      </span>
      <div class="mt-5 space-y-2">
        <h1 class="text-[28px] font-medium leading-tight text-[#37352F]">
          {title}
        </h1>
        <p class="text-sm text-[#8F8C86]">
          {startDate} {'-'} {endDate}
        </p>
      </div>
      {badges && badges.length > 0 && (
        <div class="mt-5 flex flex-wrap gap-2">
          {badges.map((badge) => (
            <Badge text={badge} key={badge} />
          ))}
        </div>
      )}
    </section>
  );
}

function Badge({ text }: { text: string }) {
  return (
    <span class="inline-flex items-center gap-2 rounded-full border border-[#E3E0D9] px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-[#86837E]">
      {text}
    </span>
  );
}

function DaysSkeleton() {
  return (
    <div class="flex flex-col divide-y divide-[#E9E7E2]">
      {Array.from({ length: 3 }).map((_, i) => (
        <div class="py-8 first:pt-0" key={i}>
          <div class="h-3 w-24 rounded bg-[#E4E2DC] animate-pulse" />
          <div class="mt-4 h-3 w-40 rounded bg-[#E9E7E2] animate-pulse" />
          <div class="mt-5 h-14 rounded bg-[#F2F1EC] animate-pulse" />
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
    <section class="py-8">
      <header class="flex items-center justify-between">
        <span class="text-[11px] uppercase tracking-[0.18em] text-[#86837E]">
          Itinerary
        </span>
        <a
          href={`/trip/itinerary/${tripId}`}
          class="text-xs text-[#86837E] transition hover:text-[#5E5B55]"
        >
          View full itinerary
        </a>
      </header>

      {tripDays.length === 0 ? (
        <p class="mt-5 text-sm text-[#AAA79F]">
          No itinerary yet. Start planning to see your days appear here.
        </p>
      ) : (
        <ol class="mt-5 space-y-2 border-l border-[#E3E0D9] pl-4">
          {tripDays.map((day) => (
            <li key={day.id}>
              <p class="text-sm font-medium text-[#37352F]">
                Day {day.day_index + 1}
              </p>
              <p class="text-sm text-[#8F8C86] capitalize">{day.title}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

interface TripBudgetOverviewProps {
  budget: number;
  spent: number;
}
function TripBudgetOverview({ budget, spent }: TripBudgetOverviewProps) {
  const total = budget > 0 ? budget : 0;
  const progress = total > 0 ? Math.min(100, Math.round((spent / total) * 100)) : 0;

  return (
    <section class="py-8">
      <header class="flex flex-wrap items-center gap-4">
        <span class="text-[11px] uppercase tracking-[0.18em] text-[#86837E]">
          Budget
        </span>
        <div class="h-px flex-1 bg-[#E9E7E2]" />
        <span class="text-xs text-[#86837E]">{progress}%</span>
      </header>
      <div class="mt-4 flex items-center gap-3">
        <div class="relative h-1 flex-1 overflow-hidden rounded-full bg-[#E9E7E2]">
          <div
            class="absolute inset-0 rounded-full bg-[#37352F] transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span class="text-xs text-[#86837E]">
          THB {spent.toLocaleString()} / {budget.toLocaleString()}
        </span>
      </div>
    </section>
  );
}
