# Task: Today Mode - กิจกรรมวันนี้

## Context
สร้างหน้า Today Mode แสดงกิจกรรมของวันปัจจุบัน แยก Active/Completed พร้อม offline cache

## Tech Stack
- Preact + TypeScript
- TanStack Query
- localForage (IndexedDB)
- Tailwind CSS v4
- Supabase

## Requirements

### File Structure
```
src/features/today/
├── TodayView.tsx               # Main screen
├── components/
│   ├── TodayActivityCard.tsx  # Activity card (simplified)
│   ├── OfflineBanner.tsx      # Offline indicator
│   └── EmptyToday.tsx         # Empty state
└── hooks/
    ├── useTodayActivities.ts   # Fetch today's activities
    └── useOfflineCache.ts      # Offline cache management
```

### Core Features
1. ✅ แสดงเฉพาะกิจกรรมวันนี้ (timezone-aware)
2. ✅ แยก section: Active (pending), Completed
3. ✅ Offline cache (read-only จาก IndexedDB)
4. ✅ Badge/banner "ออฟไลน์" เมื่อไม่มี network
5. ✅ Auto-sync เมื่อกลับออนไลน์
6. ✅ Analytics: `open_today` พร้อม `activity_count`

---

## Step-by-Step Implementation

### Step 1: Install Dependencies

```bash
bun add localforage date-fns
```

---

### Step 2: Create useTodayActivities Hook

```tsx
// src/features/today/hooks/useTodayActivities.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { startOfDay, endOfDay } from 'date-fns';
import type { Activity } from '@/types/activity';

export function useTodayActivities(tripId: string) {
  return useQuery({
    queryKey: ['today-activities', tripId],
    queryFn: async () => {
      // Get today's date range
      const today = new Date();
      const startDate = startOfDay(today).toISOString();
      const endDate = endOfDay(today).toISOString();

      // Query activities for today
      const { data, error } = await supabase
        .from('activities')
        .select(`
          *,
          trip_days!inner(date)
        `)
        .eq('trip_id', tripId)
        .gte('trip_days.date', startDate.split('T')[0])
        .lte('trip_days.date', endDate.split('T')[0])
        .order('start_time', { ascending: true });

      if (error) throw error;

      const activities = data as Activity[];

      // Separate active and completed
      const active = activities.filter(a => a.status === 'pending');
      const completed = activities.filter(a => a.status === 'completed');

      return { active, completed, all: activities };
    },
    enabled: !!tripId,
    staleTime: 1000 * 60 * 2, // 2 minutes (more frequent than regular queries)
  });
}
```

---

### Step 3: Create Offline Cache Hook

```tsx
// src/features/today/hooks/useOfflineCache.ts
import { useEffect, useState } from 'preact/hooks';
import localforage from 'localforage';
import type { Activity } from '@/types/activity';

type CachedData = {
  active: Activity[];
  completed: Activity[];
  timestamp: number;
};

export function useOfflineCache(tripId: string) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cachedData, setCachedData] = useState<CachedData | null>(null);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load cached data
  useEffect(() => {
    if (!isOnline) {
      localforage.getItem<CachedData>(`today-${tripId}`).then((data) => {
        if (data) setCachedData(data);
      });
    }
  }, [isOnline, tripId]);

  // Save to cache
  const saveToCache = async (active: Activity[], completed: Activity[]) => {
    const data: CachedData = {
      active,
      completed,
      timestamp: Date.now(),
    };
    await localforage.setItem(`today-${tripId}`, data);
  };

  return {
    isOnline,
    cachedData,
    saveToCache,
  };
}
```

---

### Step 4: Create TodayActivityCard Component

```tsx
// src/features/today/components/TodayActivityCard.tsx
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import type { Activity } from '@/types/activity';
import { useToggleComplete } from '@/features/activities/hooks/useToggleComplete';

type TodayActivityCardProps = {
  activity: Activity;
};

export function TodayActivityCard({ activity }: TodayActivityCardProps) {
  const toggleComplete = useToggleComplete();

  const timeStr = activity.start_time
    ? format(new Date(activity.start_time), 'HH:mm', { locale: th })
    : null;

  return (
    <div class="bg-white rounded-lg border border-gray-200 p-4">
      <div class="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={() => toggleComplete.mutate(activity)}
          disabled={toggleComplete.isPending}
          class={`mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
            activity.status === 'completed'
              ? 'bg-green-500 border-green-500'
              : 'border-gray-300 hover:border-green-500'
          }`}
        >
          {activity.status === 'completed' && (
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Content */}
        <div class="flex-1 min-w-0">
          <div class="flex items-baseline justify-between gap-2">
            <h3 class={`font-medium text-gray-900 ${activity.status === 'completed' ? 'line-through' : ''}`}>
              {activity.title}
            </h3>
            {timeStr && (
              <span class="text-sm font-medium text-blue-600 whitespace-nowrap">{timeStr}</span>
            )}
          </div>

          {activity.description && (
            <p class="text-sm text-gray-600 mt-1 line-clamp-2">{activity.description}</p>
          )}

          {activity.location_name && (
            <p class="text-sm text-gray-500 mt-1 flex items-center gap-1">
              📍 {activity.location_name}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

### Step 5: Create OfflineBanner Component

```tsx
// src/features/today/components/OfflineBanner.tsx
type OfflineBannerProps = {
  lastUpdate?: number;
};

export function OfflineBanner({ lastUpdate }: OfflineBannerProps) {
  const lastUpdateStr = lastUpdate
    ? new Date(lastUpdate).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4">
      <div class="flex items-start gap-3">
        <div class="text-2xl">📴</div>
        <div class="flex-1">
          <p class="text-sm font-medium text-yellow-800">โหมดออฟไลน์</p>
          <p class="text-sm text-yellow-700 mt-1">
            แสดงข้อมูลล่าสุด{lastUpdateStr && ` (อัปเดตเมื่อ ${lastUpdateStr})`}
          </p>
        </div>
      </div>
    </div>
  );
}
```

---

### Step 6: Create EmptyToday Component

```tsx
// src/features/today/components/EmptyToday.tsx
import { useNavigate } from 'react-router-dom';

type EmptyTodayProps = {
  tripId: string;
};

export function EmptyToday({ tripId }: EmptyTodayProps) {
  const navigate = useNavigate();

  return (
    <div class="text-center py-12">
      <div class="text-6xl mb-4">☀️</div>
      <h2 class="text-xl font-semibold text-gray-900 mb-2">ยังไม่มีกิจกรรมวันนี้</h2>
      <p class="text-gray-600 mb-6">เพิ่มกิจกรรมเพื่อเริ่มวันใหม่</p>
      <button
        onClick={() => navigate(`/trips/${tripId}`)}
        class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
      >
        เพิ่มกิจกรรม
      </button>
    </div>
  );
}
```

---

### Step 7: Create TodayView Screen

```tsx
// src/features/today/TodayView.tsx
import { useEffect } from 'preact/hooks';
import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { useTrip } from '@/features/trips/hooks/useTrip';
import { useTodayActivities } from './hooks/useTodayActivities';
import { useOfflineCache } from './hooks/useOfflineCache';
import { TodayActivityCard } from './components/TodayActivityCard';
import { OfflineBanner } from './components/OfflineBanner';
import { EmptyToday } from './components/EmptyToday';
import { trackEvent } from '@/lib/analytics';

export default function TodayView() {
  const { id: tripId } = useParams<{ id: string }>();
  const { data: trip } = useTrip(tripId!);
  const { data, isLoading } = useTodayActivities(tripId!);
  const { isOnline, cachedData, saveToCache } = useOfflineCache(tripId!);

  // Save to cache when online
  useEffect(() => {
    if (data && isOnline) {
      saveToCache(data.active, data.completed);
    }
  }, [data, isOnline, saveToCache]);

  // Track analytics
  useEffect(() => {
    if (data) {
      trackEvent('open_today', {
        trip_id: tripId,
        activity_count: data.all.length,
      });
    }
  }, [data, tripId]);

  // Use cached data when offline
  const activities = isOnline ? data : cachedData;

  if (isLoading && isOnline) {
    return (
      <div class="min-h-screen bg-gray-50">
        <header class="bg-white border-b border-gray-200">
          <div class="max-w-4xl mx-auto px-4 py-4 animate-pulse">
            <div class="h-6 bg-gray-200 rounded w-32 mb-2"></div>
            <div class="h-4 bg-gray-200 rounded w-48"></div>
          </div>
        </header>
        <main class="max-w-4xl mx-auto px-4 py-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} class="bg-white rounded-lg border p-4 animate-pulse">
              <div class="h-5 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </main>
      </div>
    );
  }

  const todayStr = format(new Date(), 'EEEE d MMMM yyyy', { locale: th });

  return (
    <div class="min-h-screen bg-gray-50">
      {/* Header */}
      <header class="bg-white border-b border-gray-200">
        <div class="max-w-4xl mx-auto px-4 py-4">
          <h1 class="text-2xl font-bold text-gray-900">{trip?.title}</h1>
          <p class="text-sm text-gray-600 mt-1">วันนี้ • {todayStr}</p>
        </div>
      </header>

      {/* Offline Banner */}
      {!isOnline && <OfflineBanner lastUpdate={cachedData?.timestamp} />}

      {/* Content */}
      <main class="max-w-4xl mx-auto px-4 py-6">
        {!activities || (activities.active.length === 0 && activities.completed.length === 0) ? (
          <EmptyToday tripId={tripId!} />
        ) : (
          <div class="space-y-8">
            {/* Active Activities */}
            {activities.active.length > 0 && (
              <section>
                <h2 class="text-lg font-semibold text-gray-900 mb-4">
                  กำลังทำ ({activities.active.length})
                </h2>
                <div class="space-y-3">
                  {activities.active.map((activity) => (
                    <TodayActivityCard key={activity.id} activity={activity} />
                  ))}
                </div>
              </section>
            )}

            {/* Completed Activities */}
            {activities.completed.length > 0 && (
              <section>
                <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  เสร็จแล้ว ({activities.completed.length})
                  <span class="text-green-600">✓</span>
                </h2>
                <div class="space-y-3 opacity-75">
                  {activities.completed.map((activity) => (
                    <TodayActivityCard key={activity.id} activity={activity} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
```

---

### Step 8: Add Route

```tsx
// src/app/router.tsx
import TodayView from '@/features/today/TodayView';

<Route
  path="/trips/:id/today"
  element={
    <ProtectedRoute>
      <TodayView />
    </ProtectedRoute>
  }
/>
```

---

### Step 9: Add Navigation Button (Optional)

```tsx
// In TripDetail.tsx header
<button
  onClick={() => navigate(`/trips/${id}/today`)}
  class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
>
  วันนี้
</button>
```

---

## Testing Checklist

### Core Functionality
- [ ] แสดงเฉพาะกิจกรรมวันนี้
- [ ] แยก Active/Completed ถูกต้อง
- [ ] Toggle complete → ย้าย section
- [ ] ไม่มีกิจกรรม → empty state

### Offline Behavior
- [ ] Online → cache ข้อมูล
- [ ] Offline → แสดง cached data
- [ ] Offline banner แสดงเมื่อไม่มี network
- [ ] กลับออนไลน์ → sync ข้อมูลใหม่
- [ ] Timestamp แสดงเวลา cache ถูกต้อง

### Edge Cases
- [ ] ไม่มี cache + offline → แสดง empty/error
- [ ] เปลี่ยนวัน → อัปเดตกิจกรรม
- [ ] Timezone ต่างประเทศ → แสดงถูกต้อง
- [ ] Refresh page → data persist

### Analytics
- [ ] `open_today` ส่งพร้อม `activity_count`
- [ ] ส่งเฉพาะเมื่อ online

---

## Best Practices Applied

✅ **KISS:** ไม่มี complex sync logic, cache read-only
✅ **Offline-First:** Cache อัตโนมัติ, แสดง indicator ชัดเจน
✅ **Type Safety:** TypeScript strict types
✅ **Performance:** Cache staleTime 2 นาที (frequent update)
✅ **UX:** Banner แจ้งเตือน offline, timestamp แสดงเวลา cache
✅ **Mobile-First:** Large touch targets, clear sections
✅ **Accessibility:** Semantic HTML, clear labels

---

## Performance Tips

⚡ **Smaller staleTime:** 2 นาที (vs 5 นาที ปกติ) เพราะต้องการข้อมูลทันสมัย
⚡ **IndexedDB:** เร็วกว่า localStorage, support ข้อมูลใหญ่
⚡ **localForage:** Auto-fallback localStorage ถ้า IndexedDB ไม่ support

---

## Common Issues

**Q: ข้อมูล cache ไม่ update?**
A: ตรวจว่า `saveToCache` ถูกเรียกเมื่อ `isOnline && data` มีค่า

**Q: กิจกรรมไม่ตรงวันนี้?**
A: ตรวจ timezone, ใช้ `startOfDay` + `endOfDay` จาก date-fns

**Q: Offline banner ไม่หาย?**
A: ตรวจ event listener `online`/`offline` cleanup

**Q: Toggle complete ไม่ทำงาน offline?**
A: ปกติ - offline mode เป็น read-only, ไม่รองรับ mutation

---

## Future Enhancements

1. **Offline mutations:** Queue mutations ทำเมื่อกลับออนไลน์ (M3)
2. **Push notifications:** แจ้งเตือนกิจกรรมใกล้เวลา
3. **Voice input:** เพิ่มกิจกรรมด้วยเสียง
4. **Widgets:** iOS/Android home screen widget

---

## Next Steps

1. ทดสอบ online/offline switching
2. ทดสอบบนอุปกรณ์จริง (mobile)
3. เพิ่ม Today Mode ใน bottom navigation
4. เพิ่ม analytics dashboard
