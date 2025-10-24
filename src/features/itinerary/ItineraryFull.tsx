import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { ArrowUpLeft, List, Wallet } from "lucide-preact";
import NavBar from "../../components/compounds/NavBar";
import { useTripDetail } from "../trips/detail/hooks/useTripDetail";
import { useTripDays, type TripDay } from "../trips/detail/hooks/useTripDays";

type ItineraryFullProps = {
  id: string;
};

export default function ItineraryFull({ id }: ItineraryFullProps) {
  const { data: trip, isLoading: tripLoading } = useTripDetail(id);
  const { data: tripDays, isLoading: daysLoading } = useTripDays(id, 90);

  if (tripLoading || daysLoading) {
    return (
      <div class="min-h-screen bg-[#F5F6F8] text-slate-900">
        <NavBar title="Itinerary" leftAction={<BackButton />} />
        <main class="mx-auto max-w-3xl px-5 py-8">
          <ItinerarySkeleton />
        </main>
      </div>
    );
  }

  if (!trip) {
    return <div class="p-6 text-center text-sm text-slate-500">Trip not found</div>;
  }

  const days = tripDays ?? [];
  const totalActivities = days.reduce((sum, day) => sum + (day.activity_count ?? 0), 0);
  const totalSpend = days.reduce((sum, day) => sum + (day.expense_total ?? 0), 0);

  return (
    <div class="min-h-screen bg-[#F5F6F8] text-slate-900">
      <NavBar title={trip.title} leftAction={<BackButton />} />
      <main class="mx-auto max-w-3xl px-5 py-8">
        <div class="flex flex-col gap-5">
          <ItinerarySummary
            totalDays={days.length}
            totalActivities={totalActivities}
            totalSpend={totalSpend}
            currencyCode={trip.currency_code}
            startDate={trip.start_date}
            endDate={trip.end_date}
          />
          <ItineraryList
            days={days}
            currencyCode={trip.currency_code}
            tripId={trip.id}
          />
        </div>
      </main>
    </div>
  );
}

function ItinerarySummary(props: {
  totalDays: number;
  totalActivities: number;
  totalSpend: number;
  currencyCode?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}) {
  const { totalDays, totalActivities, totalSpend, currencyCode, startDate, endDate } = props;
  const formattedStart = startDate ? format(new Date(startDate), "d MMM yyyy", { locale: enUS }) : "-";
  const formattedEnd = endDate ? format(new Date(endDate), "d MMM yyyy", { locale: enUS }) : "-";

  return (
    <section class="soft-card">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-[11px] font-medium uppercase tracking-[0.34em] text-slate-400">
            Full itinerary
          </p>
          <h1 class="mt-2 text-[24px] font-semibold text-slate-900">
            {formattedStart} – {formattedEnd}
          </h1>
        </div>
        <span class="soft-chip text-xs uppercase tracking-[0.2em] text-slate-600">
          {totalDays} {totalDays === 1 ? "day" : "days"}
        </span>
      </header>

      <div class="mt-5 grid gap-4 sm:grid-cols-3">
        <SummaryMetric
          label="Activities"
          value={`${totalActivities} ${totalActivities === 1 ? "item" : "items"}`}
        />
        <SummaryMetric
          label="Planned spend"
          value={totalSpend > 0 ? formatCurrency(totalSpend, currencyCode) : "No expenses yet"}
        />
        <SummaryMetric
          label="Average per day"
          value={
            totalSpend > 0 && totalDays > 0
              ? formatCurrency(totalSpend / totalDays, currencyCode)
              : "-"
          }
        />
      </div>
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div class="rounded-2xl border border-white/40 bg-white/50 p-4 text-sm text-slate-600 backdrop-blur">
      <p class="text-[11px] uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p class="mt-2 text-base font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function ItineraryList({
  days,
  currencyCode,
}: {
  days: TripDay[];
  currencyCode?: string | null;
}) {
  if (!days || days.length === 0) {
    return (
      <section class="soft-card">
        <p class="soft-empty">
          No itinerary days yet. Add activities from the trip detail screen to get started.
        </p>
      </section>
    );
  }

  return (
    <section class="soft-card">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-[15px] font-semibold text-slate-800">Day by day</h2>
          <p class="text-xs text-slate-500">
            Overview of your itinerary. Open a day in the trip detail screen to add details.
          </p>
        </div>
      </div>

      <ol class="soft-list mt-5">
        {days.map((day) => {
          const formattedDate = formatTripDayDate(day.date);
          return (
            <li key={day.id} class="soft-list-item flex flex-col gap-3">
              <header class="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                <span class="soft-chip px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-600">
                  Day {day.day_index + 1}
                </span>
                {formattedDate && <span>{formattedDate}</span>}
              </header>

              <div>
                <p class="text-base font-semibold capitalize text-slate-800">
                  {day.title || `Untitled day ${day.day_index + 1}`}
                </p>
              </div>

              <div class="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <span class="inline-flex items-center gap-1">
                  <List class="h-3.5 w-3.5" />
                  {day.activity_count === 0
                    ? "No activities added"
                    : `${day.activity_count} ${day.activity_count === 1 ? "activity" : "activities"}`}
                </span>
                <span class="inline-flex items-center gap-1">
                  <Wallet class="h-3.5 w-3.5" />
                  {day.expense_total > 0
                    ? formatCurrency(day.expense_total, currencyCode)
                    : "No expenses recorded"}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function formatTripDayDate(date?: string | null) {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, "EEE, d MMM", { locale: enUS });
}

function formatCurrency(amount: number, currencyCode?: string | null) {
  const code = currencyCode || "THB";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${code} ${Math.round(amount).toLocaleString()}`;
  }
}

function ItinerarySkeleton() {
  return (
    <div class="flex flex-col gap-4">
      <div class="soft-card space-y-4">
        <div class="h-3 w-24 animate-pulse rounded-full bg-slate-100" />
        <div class="h-4 w-48 animate-pulse rounded-full bg-slate-100/80" />
        <div class="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} class="h-16 animate-pulse rounded-2xl bg-slate-100/50" />
          ))}
        </div>
      </div>

      <div class="soft-card space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} class="soft-list-item space-y-3">
            <div class="h-3 w-32 animate-pulse rounded-full bg-slate-100" />
            <div class="h-4 w-48 animate-pulse rounded bg-slate-100/80" />
            <div class="h-3 w-40 animate-pulse rounded-full bg-slate-100/70" />
          </div>
        ))}
      </div>
    </div>
  );
}

function BackButton() {
  return (
    <button
      class="soft-icon-btn"
      onClick={() => history.back()}
      type="button"
      aria-label="Back"
    >
      <ArrowUpLeft class="h-4 w-4" />
    </button>
  );
}
