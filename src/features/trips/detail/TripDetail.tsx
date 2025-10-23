import NavBar from "../../../components/compounds/NavBar";
import { ChevronLeft, Share2 } from "lucide-preact";
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
      <div class="min-h-screen bg-[#F8F7F4] text-[#37352F]">
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
    <div class="min-h-screen bg-gray-50 text-zinc-900">
      <NavBar
        title={trip.title}
        leftAction={<BackButton />}
        rightAction={<ShareButton tripId={trip.id} tripTitle={trip.title} />}
      />
      <main class="mx-auto max-w-3xl px-5 py-8 bg-white">
        <div class="flex flex-col gap-8">
          <TripDetailHeader
            title={trip.title}
            startDate={startDate}
            endDate={endDate}
            destination={trip.title}
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
  destination?: string | null;
}
function TripDetailHeader({
  title,
  startDate,
  endDate,
  destination,
}: TripDetailHeaderProps) {
  const metaParts = [
    destination?.trim(),
    startDate !== "-" && endDate !== "-" ? `${startDate} – ${endDate}` : undefined,
  ].filter(Boolean);

  return (
    <section class="first:pt-0">
      <p class="text-[11px] uppercase tracking-[0.2em] text-[#A5A19B]">Overview</p>
      <div class="mt-3 space-y-2">
        <h1 class="text-[26px] font-medium leading-snug text-[#2F2B25]">{title}</h1>
        {metaParts.length > 0 && (
          <p class="text-sm text-[#6F6B64]">{metaParts.join(" · ")}</p>
        )}
      </div>
    </section>
  );
}

function DaysSkeleton() {
  return (
    <div class="flex flex-col gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div class="space-y-3 border border-[#ECEAE4] bg-white p-4" key={i}>
          <div class="h-3 w-28 bg-[#E4E2DC] animate-pulse" />
          <div class="h-3 w-40 bg-[#E9E7E2] animate-pulse" />
          <div class="h-24 bg-[#F4F2ED] animate-pulse" />
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
    <section>
      <header class="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-[#A5A19B]">
        <span>Itinerary</span>
        <a
          href={`/trip/itinerary/${tripId}`}
          class="text-[10px] font-medium tracking-[0.18em] text-[#86837E] transition hover:text-[#5E5B55]"
        >
          View all
        </a>
      </header>

      {tripDays.length === 0 ? (
        <p class="mt-4 rounded-none border border-[#ECEAE4] bg-white p-4 text-sm text-[#AAA79F]">
          No itinerary yet. Start planning to see your days appear here.
        </p>
      ) : (
        <ol class="mt-4 space-y-1 border-l border-[#E3E0D9] pl-4">
          {tripDays.map((day) => (
            <li key={day.id} class="flex flex-col gap-0.5 text-sm text-[#37352F]">
              <span class="font-medium">
                Day {day.day_index + 1}
              </span>
              <span class="text-[#6F6B64] capitalize">{day.title}</span>
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
    <section>
      <header class="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-[#A5A19B]">
        <span>Budget</span>
        <span class="text-[10px] text-[#86837E]">{progress}%</span>
      </header>
      <div class="mt-4 space-y-2">
        <div class="relative h-1 bg-[#ECEAE4] rounded-full">
          <div
            class="absolute inset-y-0 left-0 bg-emerald-500 transition-[width] duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p class="text-sm text-[#37352F]">
          THB {spent.toLocaleString()} <span class="text-[#86837E]">/ {budget.toLocaleString()}</span>
        </p>
      </div>
    </section>
  );
}

function BackButton() {
  return (
    <button
      class="flex h-8 w-8 items-center justify-center text-[#6F6B64] transition hover:text-[#37352F]"
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
      class="flex h-8 w-8 items-center justify-center text-[#6F6B64] transition hover:text-[#37352F]"
      type="button"
      onClick={handleShare}
      aria-label="Share trip"
      title={isCopied ? "Link copied" : "Share trip"}
    >
      <Share2 class="h-4 w-4" />
    </button>
  );
}
