import NavBar from "../../../components/compounds/NavBar";
import { ArrowUpRight, Calendar, ChevronLeft, List, MapPin, Share2, Wallet } from "lucide-preact";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { useState } from "preact/hooks";
import { useTripDetail } from "./hooks/useTripDetail";
import { useTripDays, type TripDay } from "./hooks/useTripDays";

export default function TripDetail(props: { id: string }) {
  const { data: trip, isLoading: tripLoading } = useTripDetail(props.id);
  const { data: tripDays, isLoading: tripDaysLoading } = useTripDays(props.id, 3);

  if (tripLoading || tripDaysLoading) {
    return (
      <div class="min-h-screen bg-[#F5F6F8] text-slate-900">
        <NavBar title="Trip Detail" leftAction={<BackButton />} />
        <main class="mx-auto max-w-3xl px-5 py-8">
          <DaysSkeleton />
        </main>
      </div>
    );
  }

  if (!trip) {
    return <div>Trip not found</div>;
  }

  const startDate = trip.start_date
    ? format(new Date(trip.start_date), "d MMM yyyy", { locale: enUS })
    : "-";

  const endDate = trip.end_date
    ? format(new Date(trip.end_date), "d MMM yyyy", { locale: enUS })
    : "-";

  return (
    <div class="min-h-screen bg-[#F5F6F8] text-slate-900">
      <NavBar
        title={trip.title}
        leftAction={<BackButton />}
        rightAction={<ShareButton tripId={trip.id} tripTitle={trip.title} />}
      />
      <main class="mx-auto max-w-3xl px-5 py-8">
        <div class="flex flex-col gap-5">
          <TripDetailHeader
            title={trip.title}
            startDate={startDate}
            endDate={endDate}
            destination={trip.destination}
          />
          <TripItinerary
            tripDays={tripDays ?? []}
            tripId={trip.id}
            currencyCode={trip.currency_code}
          />
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
  destination?: string | null;
}
function TripDetailHeader({
  title,
  startDate,
  endDate,
  destination,
}: TripDetailHeaderProps) {
  const hasDestination = Boolean(destination?.trim());
  const hasDates = startDate !== "-" && endDate !== "-";

  return (
    <section>
      <div class="soft-card">
        <p class="text-[11px] font-medium uppercase tracking-[0.34em] text-slate-400">
          Trip overview
        </p>
        <h1 class="mt-3 text-[26px] font-semibold leading-tight text-slate-900">
          {title}
        </h1>

        {(hasDestination || hasDates) && (
          <div class="mt-4 flex flex-wrap gap-2 text-[13px] text-slate-500">
            {hasDestination && destination && (
              <span class="soft-chip">
                <MapPin class="h-3.5 w-3.5" />
                {destination}
              </span>
            )}
            {hasDates && (
              <span class="soft-chip bg-zinc-200">
                <Calendar class="h-3.5 w-3.5" />
                {startDate} – {endDate}
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function DaysSkeleton() {
  return (
    <div class="flex flex-col gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div class="soft-card space-y-4" key={i}>
          <div class="h-3 w-36 animate-pulse rounded-full bg-slate-100" />
          <div class="h-3 w-28 animate-pulse rounded-full bg-slate-100/80" />
          <div class="h-20 animate-pulse rounded-2xl bg-slate-100/60" />
        </div>
      ))}
    </div>
  );
}

interface TripItineraryProps {
  tripId: string;
  tripDays: TripDay[];
  currencyCode?: string | null;
}

function formatTripDayDate(date?: string | null) {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, "EEE, d MMM");
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

function TripItinerary({ tripId, tripDays, currencyCode }: TripItineraryProps) {
  return (
    <section>
      <div class="soft-card">
        <header class="flex items-center justify-between">
          <div>
            <p class="text-[11px] font-medium uppercase tracking-[0.34em] text-slate-400">
              Itinerary
            </p>
            <p class="mt-1 text-[15px] font-semibold text-slate-800">
              Snapshot of your upcoming days
            </p>
          </div>
          <a
            href={`/trip/itinerary/${tripId}`}
            class="soft-cta"
          >
            View all
            <ArrowUpRight class="h-3.5 w-3.5" />
          </a>
        </header>

        {tripDays.length === 0 ? (
          <p class="soft-empty mt-5">
            No itinerary yet. Start planning to see your days appear here.
          </p>
        ) : (
          <ol class="soft-list mt-5">
            {tripDays.map((day) => {
              const dayDate = formatTripDayDate(day.date);
              return (
                <li
                  key={day.id}
                  class="soft-list-item flex flex-col gap-2"
                >
                  <div class="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    <span class="soft-chip px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-600">
                      Day {day.day_index + 1}
                    </span>
                    {dayDate && <span>{dayDate}</span>}
                  </div>
                  <p class="text-sm font-medium text-slate-700 capitalize">
                    {day.title}
                  </p>
                  <div class="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span class="inline-flex items-center gap-1">
                      <List class="h-3.5 w-3.5" />
                      {day.activity_count === 0
                        ? "No plans yet"
                        : `${day.activity_count} ${
                            day.activity_count === 1 ? "activity" : "activities"
                          }`}
                    </span>
                    <span class="inline-flex items-center gap-1">
                      <Wallet class="h-3.5 w-3.5" />
                      {day.expense_total > 0
                        ? formatCurrency(day.expense_total, currencyCode)
                        : "No expenses"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
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
    <section>
      <div class="soft-card">
        <header class="flex items-center justify-between">
          <div>
            <p class="text-[11px] font-medium uppercase tracking-[0.34em] text-slate-400">
              Budget
            </p>
            <p class="mt-1 text-[15px] font-semibold text-slate-800">
              Spending snapshot
            </p>
          </div>
          <span class="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-100/60 px-3 py-1 text-xs font-semibold text-emerald-700">
            {progress}% used
          </span>
        </header>
        <div class="mt-5 space-y-3">
          <div class="soft-progress">
            <div
              class="soft-progress-bar"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div class="flex flex-wrap items-center gap-2 text-sm text-slate-700">
            <span class="font-semibold text-slate-900">
              THB {spent.toLocaleString()}
            </span>
            <span class="text-slate-400">of</span>
            <span>THB {budget.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </section>
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
      <ChevronLeft class="h-4 w-4" />
    </button>
  );
}

interface ShareButtonProps {
  tripId: string;
  tripTitle: string;
}
function ShareButton({ tripId, tripTitle }: ShareButtonProps) {
  const [isCopied, setIsCopied] = useState(false);

  const handleShare = async () => {
    if (typeof window === "undefined") return;

    const shareUrl = `${window.location.origin}/trip/${tripId}`;
    const shareNavigator = navigator as Navigator & {
      share?: (data: ShareData) => Promise<void>;
    };

    if (shareNavigator.share) {
      try {
        await shareNavigator.share({
          title: tripTitle,
          url: shareUrl,
        });
        return;
      } catch (error) {
        console.warn("Share failed, copying link instead", error);
      }
    }

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setIsCopied(true);
        window.setTimeout(() => setIsCopied(false), 2000);
      } catch (error) {
        console.error("Failed to copy share link", error);
      }
    }
  };

  return (
    <button
      class="soft-icon-btn"
      type="button"
      onClick={handleShare}
      aria-label="Share trip"
      title={isCopied ? "Link copied" : "Share trip"}
    >
      <Share2 class="h-4 w-4" />
    </button>
  );
}
