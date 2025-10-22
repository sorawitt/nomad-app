# Task: Trip Detail Screen - Day List

## Context
สร้างหน้า Trip Detail แสดงรายการวันพร้อมจำนวนกิจกรรม

## Tech Stack
- Preact + TypeScript
- TanStack Query
- Tailwind CSS v4
- Supabase

## Requirements

### File Structure
```
src/features/trips/
├── TripDetail.tsx          # Main screen
└── components/
    ├── DayCard.tsx        # Day card
    └── DaysSkeleton.tsx   # Loading skeleton
```

### Core Features
1. ✅ แสดงรายการวันตามลำดับ
2. ✅ วันละการ์ด: วันที่, จำนวนกิจกรรม
3. ✅ ปุ่ม `+กิจกรรม` (placeholder)
4. ✅ Skeleton loading
5. ✅ Error state + retry
6. ✅ Empty state (ไม่มีวัน)

## Step-by-Step Implementation

### Step 1: Create useTripDays Hook

```tsx
// src/features/trips/hooks/useTripDays.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type TripDay = {
  id: string;
  trip_id: string;
  day_index: number;
  date: string;
  activity_count: number;
};

export function useTripDays(tripId: string) {
  return useQuery({
    queryKey: ['trip-days', tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trip_days')
        .select(`
          id,
          trip_id,
          day_index,
          date,
          activities(count)
        `)
        .eq('trip_id', tripId)
        .order('day_index', { ascending: true });

      if (error) throw error;

      return data.map((day) => ({
        ...day,
        activity_count: day.activities?.[0]?.count ?? 0,
      })) as TripDay[];
    },
    enabled: !!tripId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
```

### Step 2: Create useTrip Hook (Trip Header)

```tsx
// src/features/trips/hooks/useTrip.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type Trip = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  currency_code: string;
};

export function useTrip(tripId: string) {
  return useQuery({
    queryKey: ['trip', tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select('id, title, start_date, end_date, currency_code')
        .eq('id', tripId)
        .single();

      if (error) throw error;
      return data as Trip;
    },
    enabled: !!tripId,
  });
}
```

### Step 3: Create DayCard Component

```tsx
// src/features/trips/components/DayCard.tsx
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import type { TripDay } from '../hooks/useTripDays';

type DayCardProps = {
  day: TripDay;
  onViewActivities: () => void;
};

export function DayCard({ day, onViewActivities }: DayCardProps) {
  const dateStr = format(new Date(day.date), 'EEEE d MMMM yyyy', { locale: th });

  return (
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div class="flex items-start justify-between mb-3">
        <div>
          <div class="text-sm font-medium text-blue-600 mb-1">วันที่ {day.day_index}</div>
          <div class="text-sm text-gray-600">{dateStr}</div>
        </div>
        <div class="text-right">
          <div class="text-2xl font-bold text-gray-900">{day.activity_count}</div>
          <div class="text-xs text-gray-500">กิจกรรม</div>
        </div>
      </div>

      <button
        onClick={onViewActivities}
        class="w-full bg-blue-50 text-blue-700 py-2 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
      >
        {day.activity_count === 0 ? '+ เพิ่มกิจกรรม' : 'ดูรายละเอียด'}
      </button>
    </div>
  );
}
```

### Step 4: Create Skeleton Component

```tsx
// src/features/trips/components/DaysSkeleton.tsx
export function DaysSkeleton() {
  return (
    <div class="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 animate-pulse">
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
```

### Step 5: Create TripDetail Screen

```tsx
// src/features/trips/TripDetail.tsx
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { useTrip } from './hooks/useTrip';
import { useTripDays } from './hooks/useTripDays';
import { DayCard } from './components/DayCard';
import { DaysSkeleton } from './components/DaysSkeleton';

export default function TripDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const { data: trip, isLoading: tripLoading } = useTrip(id!);
  const { data: days, isLoading: daysLoading, error, refetch } = useTripDays(id!);

  if (tripLoading || daysLoading) {
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

  if (error || !trip) {
    return (
      <div class="min-h-screen bg-gray-50 flex items-center justify-center">
        <div class="text-center">
          <div class="text-4xl mb-4">⚠️</div>
          <h2 class="text-xl font-semibold text-gray-900 mb-2">เกิดข้อผิดพลาด</h2>
          <p class="text-gray-600 mb-6">ไม่สามารถโหลดข้อมูลทริปได้</p>
          <button
            onClick={() => refetch()}
            class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            ลองใหม่
          </button>
        </div>
      </div>
    );
  }

  const dateRange = `${format(new Date(trip.start_date), 'd MMM', { locale: th })} - ${format(new Date(trip.end_date), 'd MMM yyyy', { locale: th })}`;

  return (
    <div class="min-h-screen bg-gray-50">
      {/* Header */}
      <header class="bg-white border-b border-gray-200">
        <div class="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => navigate('/')}
            class="text-gray-600 hover:text-gray-900 mb-3 inline-flex items-center text-sm"
          >
            ← กลับ
          </button>
          <h1 class="text-2xl font-bold text-gray-900 mb-1">{trip.title}</h1>
          <p class="text-sm text-gray-600">{dateRange}</p>
        </div>
      </header>

      {/* Tabs (Future) */}
      <div class="bg-white border-b border-gray-200">
        <div class="max-w-4xl mx-auto px-4">
          <div class="flex gap-8 text-sm">
            <button class="pb-3 border-b-2 border-blue-600 text-blue-600 font-medium">
              กิจกรรม
            </button>
            <button class="pb-3 text-gray-600 hover:text-gray-900">
              งบประมาณ
            </button>
            <button class="pb-3 text-gray-600 hover:text-gray-900">
              ตั้งค่า
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main class="max-w-4xl mx-auto px-4 py-6">
        {!days || days.length === 0 ? (
          <div class="text-center py-12">
            <div class="text-4xl mb-4">📅</div>
            <h2 class="text-xl font-semibold text-gray-900 mb-2">ยังไม่มีวัน</h2>
            <p class="text-gray-600">กลับไปแก้ไขวันที่ของทริป</p>
          </div>
        ) : (
          <div class="space-y-4">
            {days.map((day) => (
              <DayCard
                key={day.id}
                day={day}
                onViewActivities={() => navigate(`/trips/${id}/days/${day.id}`)}
              />
            ))}
          </div>
        )}

        {/* FAB: Add Activity */}
        <button
          onClick={() => alert('Add activity - Coming soon')}
          class="fixed bottom-6 right-6 bg-blue-600 text-white w-14 h-14 rounded-full shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center text-2xl"
        >
          +
        </button>
      </main>
    </div>
  );
}
```

### Step 6: Add Route

```tsx
// src/app/router.tsx
<Route
  path="/trips/:id"
  element={
    <ProtectedRoute>
      <TripDetail />
    </ProtectedRoute>
  }
/>
```

## Testing Checklist

- [ ] แสดงชื่อทริป + วันที่ถูกต้อง
- [ ] แสดงรายการวันตาม day_index
- [ ] จำนวนกิจกรรมแสดงถูกต้อง (0 ถ้าไม่มี)
- [ ] Click "ดูรายละเอียด" → navigate ไป day detail
- [ ] Loading: แสดง skeleton
- [ ] Error: แสดง error + retry button
- [ ] Empty: ไม่มีวัน → แสดง empty state
- [ ] FAB "+ Add" อยู่มุมล่างขวา

## Best Practices Applied

✅ **KISS:** Component structure เรียบง่าย
✅ **Type Safety:** TypeScript types ชัดเจน
✅ **Loading UX:** Skeleton แทน spinner
✅ **Error Handling:** Retry mechanism
✅ **Performance:** Query cache, staleTime
✅ **Mobile-First:** FAB สำหรับ quick action

## Database Schema (Reference)

```sql
CREATE TABLE trip_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  day_index INTEGER NOT NULL,
  date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (trip_id, day_index)
);

CREATE INDEX trip_days_trip_idx ON trip_days(trip_id, day_index);
```

## Next Steps

1. เพิ่ม tab navigation (Today, Days, Budget)
2. เพิ่ม activity modal (M2)
3. เพิ่ม share button (M3)
4. เพิ่ม edit trip info
