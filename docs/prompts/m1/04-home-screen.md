# Task: Home Screen - Trip List

## Context
สร้างหน้า Home แสดงรายการทริปพร้อม skeleton, empty, error states

## Tech Stack
- Preact + TypeScript
- TanStack Query (React Query)
- Tailwind CSS v4
- Supabase

## Requirements

### File Structure
```
src/features/home/
├── Home.tsx                # Main screen
├── components/
│   ├── TripList.tsx       # List container
│   ├── TripCard.tsx       # Trip card
│   └── EmptyState.tsx     # Empty state
└── hooks/
    └── useTrips.ts        # Data fetching hook
```

### Core Features
1. ✅ แสดงรายการทริป (owner + member)
2. ✅ เรียงตาม `updated_at` (ล่าสุดก่อน)
3. ✅ Skeleton loading (3 cards)
4. ✅ Empty state + CTA
5. ✅ Error state + retry
6. ✅ Navigate ไป Trip Detail
7. ✅ Analytics: `open_home`

## Step-by-Step Implementation

### Step 1: Create useTrips Hook

```tsx
// src/features/home/hooks/useTrips.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type Trip = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  updated_at: string;
  owner_id: string;
  activity_count?: number;
};

export function useTrips() {
  return useQuery({
    queryKey: ['trips'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select(`
          id,
          title,
          start_date,
          end_date,
          updated_at,
          owner_id,
          activities(count)
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      return data.map((trip) => ({
        ...trip,
        activity_count: trip.activities?.[0]?.count ?? 0,
      })) as Trip[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
```

### Step 2: Create TripCard Component

```tsx
// src/features/home/components/TripCard.tsx
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import type { Trip } from '../hooks/useTrips';

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
```

### Step 3: Create Skeleton Component

```tsx
// src/features/home/components/TripSkeleton.tsx
export function TripSkeleton() {
  return (
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 animate-pulse">
      <div class="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
      <div class="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
      <div class="h-3 bg-gray-200 rounded w-1/4"></div>
    </div>
  );
}
```

### Step 4: Create Empty State

```tsx
// src/features/home/components/EmptyState.tsx
type EmptyStateProps = {
  onCreateTrip: () => void;
};

export function EmptyState({ onCreateTrip }: EmptyStateProps) {
  return (
    <div class="text-center py-12">
      <div class="text-6xl mb-4">✈️</div>
      <h2 class="text-xl font-semibold text-gray-900 mb-2">
        ยังไม่มีทริป
      </h2>
      <p class="text-gray-600 mb-6">
        เริ่มต้นวางแผนการเดินทางของคุณ
      </p>
      <button
        onClick={onCreateTrip}
        class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
      >
        สร้างทริปใหม่
      </button>
    </div>
  );
}
```

### Step 5: Create TripList Component

```tsx
// src/features/home/components/TripList.tsx
import { useNavigate } from 'react-router-dom';
import { TripCard } from './TripCard';
import { TripSkeleton } from './TripSkeleton';
import { EmptyState } from './EmptyState';
import { useTrips } from '../hooks/useTrips';

export function TripList() {
  const navigate = useNavigate();
  const { data: trips, isLoading, error, refetch } = useTrips();

  // Loading state
  if (isLoading) {
    return (
      <div class="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <TripSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div class="text-center py-12">
        <div class="text-4xl mb-4">⚠️</div>
        <h2 class="text-xl font-semibold text-gray-900 mb-2">
          เกิดข้อผิดพลาด
        </h2>
        <p class="text-gray-600 mb-6">
          {error instanceof Error ? error.message : 'ไม่สามารถโหลดข้อมูลได้'}
        </p>
        <button
          onClick={() => refetch()}
          class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          ลองใหม่
        </button>
      </div>
    );
  }

  // Empty state
  if (!trips || trips.length === 0) {
    return <EmptyState onCreateTrip={() => navigate('/trips/new')} />;
  }

  // Success state
  return (
    <div class="space-y-4">
      {trips.map((trip) => (
        <TripCard
          key={trip.id}
          trip={trip}
          onClick={() => navigate(`/trips/${trip.id}`)}
        />
      ))}
    </div>
  );
}
```

### Step 6: Create Home Screen

```tsx
// src/features/home/Home.tsx
import { useEffect } from 'preact/hooks';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { TripList } from './components/TripList';
import { trackEvent } from '@/lib/analytics';

export default function Home() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  useEffect(() => {
    // Track page view
    trackEvent('open_home');
  }, []);

  return (
    <div class="min-h-screen bg-gray-50">
      {/* Header */}
      <header class="bg-white border-b border-gray-200">
        <div class="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 class="text-xl font-bold text-gray-900">ทริปของฉัน</h1>
          <div class="flex items-center gap-4">
            <button
              onClick={() => navigate('/trips/new')}
              class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              + สร้างทริป
            </button>
            <button
              onClick={signOut}
              class="text-gray-600 hover:text-gray-900 text-sm"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main class="max-w-4xl mx-auto px-4 py-6">
        <TripList />
      </main>
    </div>
  );
}
```

### Step 7: Setup Analytics (Simple)

```tsx
// src/lib/analytics.ts
export function trackEvent(eventName: string, properties?: Record<string, any>) {
  // Console log for now (replace with real analytics later)
  console.log('[Analytics]', eventName, properties);

  // TODO: Send to PostHog/Amplitude/etc
}
```

### Step 8: Install Dependencies

```bash
bun add @tanstack/react-query date-fns
```

### Step 9: Setup Query Client

```tsx
// src/app/index.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
    </QueryClientProvider>
  );
}
```

## Testing Checklist

- [ ] Loading: แสดง 3 skeleton cards
- [ ] Empty: ไม่มีทริป → แสดง empty state
- [ ] Success: มีทริป → แสดงรายการ
- [ ] Error: network ผิดพลาด → แสดง error + retry
- [ ] Click card → navigate ไป trip detail
- [ ] Click "สร้างทริป" → navigate ไป new trip
- [ ] Analytics `open_home` ถูกส่ง
- [ ] Responsive บนมือถือ

## Best Practices Applied

✅ **KISS:** ไม่แยก component เล็กเกินไป
✅ **Type Safety:** TypeScript types ครบ
✅ **Loading UX:** Skeleton แทน spinner
✅ **Error Handling:** User-friendly error message + retry
✅ **Performance:** React Query cache, staleTime
✅ **Accessibility:** Semantic HTML, button for clickable

## Database Schema (Reference)

```sql
-- trips table
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX trips_owner_idx ON trips(owner_id);
CREATE INDEX trips_updated_at_idx ON trips(updated_at DESC);
```

## Next Steps

1. ทดสอบ UI states ทั้งหมด
2. เพิ่ม pull-to-refresh (optional)
3. เพิ่ม infinite scroll (future)
4. เพิ่ม search/filter (future)
