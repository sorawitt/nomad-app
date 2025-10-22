# Task: Offline Cache - แคชข้อมูลออฟไลน์

## Context
สร้างระบบ offline cache ด้วย IndexedDB เพื่อให้ผู้ใช้สามารถดูข้อมูลทริปได้แม้ไม่มีอินเทอร์เน็ต พร้อม background sync ทุก 5 นาที และ conflict detection แบบ last-write-wins

## Tech Stack
- **Preact + TypeScript**: Component และ Type Safety
- **TanStack Query**: Data fetching, cache management
- **localForage**: IndexedDB wrapper (easier than raw IndexedDB API)
- **Supabase**: Database backend

## Requirements

### Functional Requirements
- Cache ข้อมูล: trips, trip_days, activities, expenses, attachments (metadata only)
- Background sync ทุก 5 นาที เมื่ออยู่ในแอป
- Sync เมื่อกลับมา online (visibility change)
- แสดง badge "ออฟไลน์" เมื่อใช้ข้อมูล cache
- Conflict detection: เปรียบเทียบ `updated_at`
- Last-write-wins strategy
- เคลียร์ cache เมื่อ logout
- ตรวจสอบ user setting `offline_cache_enabled`

## Step-by-Step Implementation

### Step 1: Install Dependencies

```bash
bun add localforage
```

---

### Step 2: Type Definitions

**File: `src/types/cache.ts`**

```typescript
export interface CacheMetadata {
  last_sync: string; // ISO timestamp
  trip_ids: string[];
}

export interface CachedTrip {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  budget: number;
  currency: string;
  updated_at: string;
}

export interface CachedDay {
  id: string;
  trip_id: string;
  day_number: number;
  date: string;
  title: string;
  updated_at: string;
}

export interface CachedActivity {
  id: string;
  trip_id: string;
  day_id: string;
  title: string;
  description: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  updated_at: string;
}

export interface CachedExpense {
  id: string;
  trip_id: string;
  category: string;
  amount: number;
  paid_by: string;
  note: string | null;
  updated_at: string;
}

export interface SyncResult {
  success: boolean;
  synced_at: string;
  conflicts: ConflictItem[];
}

export interface ConflictItem {
  entity_type: 'trip' | 'day' | 'activity' | 'expense';
  entity_id: string;
  local_updated_at: string;
  server_updated_at: string;
}
```

---

### Step 3: Cache Service

**File: `src/lib/cache.ts`**

```typescript
import localForage from 'localforage';
import type {
  CacheMetadata,
  CachedTrip,
  CachedDay,
  CachedActivity,
  CachedExpense
} from '@/types/cache';

// สร้าง IndexedDB instances แยกตาม collection
const metadataStore = localForage.createInstance({ name: 'nomad', storeName: 'metadata' });
const tripsStore = localForage.createInstance({ name: 'nomad', storeName: 'trips' });
const daysStore = localForage.createInstance({ name: 'nomad', storeName: 'days' });
const activitiesStore = localForage.createInstance({ name: 'nomad', storeName: 'activities' });
const expensesStore = localForage.createInstance({ name: 'nomad', storeName: 'expenses' });

export const cacheService = {
  // ===== Metadata =====
  async getMetadata(): Promise<CacheMetadata | null> {
    return metadataStore.getItem<CacheMetadata>('metadata');
  },

  async setMetadata(metadata: CacheMetadata): Promise<void> {
    await metadataStore.setItem('metadata', metadata);
  },

  // ===== Trips =====
  async getCachedTrips(): Promise<CachedTrip[]> {
    const trips: CachedTrip[] = [];
    await tripsStore.iterate<CachedTrip, void>((value) => {
      trips.push(value);
    });
    return trips.sort((a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  },

  async getCachedTrip(tripId: string): Promise<CachedTrip | null> {
    return tripsStore.getItem<CachedTrip>(tripId);
  },

  async setCachedTrip(trip: CachedTrip): Promise<void> {
    await tripsStore.setItem(trip.id, trip);
  },

  async setCachedTrips(trips: CachedTrip[]): Promise<void> {
    await Promise.all(trips.map(trip => tripsStore.setItem(trip.id, trip)));
  },

  // ===== Days =====
  async getCachedDays(tripId: string): Promise<CachedDay[]> {
    const days: CachedDay[] = [];
    await daysStore.iterate<CachedDay, void>((value) => {
      if (value.trip_id === tripId) {
        days.push(value);
      }
    });
    return days.sort((a, b) => a.day_number - b.day_number);
  },

  async setCachedDays(days: CachedDay[]): Promise<void> {
    await Promise.all(days.map(day => daysStore.setItem(day.id, day)));
  },

  // ===== Activities =====
  async getCachedActivities(dayId: string): Promise<CachedActivity[]> {
    const activities: CachedActivity[] = [];
    await activitiesStore.iterate<CachedActivity, void>((value) => {
      if (value.day_id === dayId) {
        activities.push(value);
      }
    });
    return activities.sort((a, b) => {
      if (!a.start_time) return 1;
      if (!b.start_time) return -1;
      return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
    });
  },

  async setCachedActivities(activities: CachedActivity[]): Promise<void> {
    await Promise.all(activities.map(act => activitiesStore.setItem(act.id, act)));
  },

  // ===== Expenses =====
  async getCachedExpenses(tripId: string): Promise<CachedExpense[]> {
    const expenses: CachedExpense[] = [];
    await expensesStore.iterate<CachedExpense, void>((value) => {
      if (value.trip_id === tripId) {
        expenses.push(value);
      }
    });
    return expenses.sort((a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  },

  async setCachedExpenses(expenses: CachedExpense[]): Promise<void> {
    await Promise.all(expenses.map(exp => expensesStore.setItem(exp.id, exp)));
  },

  // ===== Clear =====
  async clearAll(): Promise<void> {
    await Promise.all([
      metadataStore.clear(),
      tripsStore.clear(),
      daysStore.clear(),
      activitiesStore.clear(),
      expensesStore.clear()
    ]);
  },

  async clearTrip(tripId: string): Promise<void> {
    // ลบ trip
    await tripsStore.removeItem(tripId);

    // ลบ days
    const dayIds: string[] = [];
    await daysStore.iterate<CachedDay, void>((value, key) => {
      if (value.trip_id === tripId) {
        dayIds.push(key);
      }
    });
    await Promise.all(dayIds.map(id => daysStore.removeItem(id)));

    // ลบ activities
    const activityIds: string[] = [];
    await activitiesStore.iterate<CachedActivity, void>((value, key) => {
      if (value.trip_id === tripId) {
        activityIds.push(key);
      }
    });
    await Promise.all(activityIds.map(id => activitiesStore.removeItem(id)));

    // ลบ expenses
    const expenseIds: string[] = [];
    await expensesStore.iterate<CachedExpense, void>((value, key) => {
      if (value.trip_id === tripId) {
        expenseIds.push(key);
      }
    });
    await Promise.all(expenseIds.map(id => expensesStore.removeItem(id)));
  }
};
```

---

### Step 4: Sync Service

**File: `src/lib/sync.ts`**

```typescript
import { supabase } from '@/lib/supabase';
import { cacheService } from '@/lib/cache';
import type { SyncResult, ConflictItem } from '@/types/cache';

export const syncService = {
  async syncAllData(userId: string): Promise<SyncResult> {
    const conflicts: ConflictItem[] = [];
    const syncedAt = new Date().toISOString();

    try {
      // 1. ดึงข้อมูลจาก Supabase
      const [tripsResult, daysResult, activitiesResult, expensesResult] = await Promise.all([
        supabase.from('trips').select('*').order('updated_at', { ascending: false }),
        supabase.from('trip_days').select('*').order('day_number'),
        supabase.from('activities').select('*').order('start_time'),
        supabase.from('expenses').select('*').order('created_at', { ascending: false })
      ]);

      if (tripsResult.error) throw tripsResult.error;
      if (daysResult.error) throw daysResult.error;
      if (activitiesResult.error) throw activitiesResult.error;
      if (expensesResult.error) throw expensesResult.error;

      // 2. Detect conflicts (optional: เปรียบเทียบกับ cache)
      const cachedTrips = await cacheService.getCachedTrips();
      for (const serverTrip of tripsResult.data) {
        const cachedTrip = cachedTrips.find(t => t.id === serverTrip.id);
        if (cachedTrip && new Date(cachedTrip.updated_at) > new Date(serverTrip.updated_at)) {
          conflicts.push({
            entity_type: 'trip',
            entity_id: serverTrip.id,
            local_updated_at: cachedTrip.updated_at,
            server_updated_at: serverTrip.updated_at
          });
        }
      }

      // 3. บันทึกลง cache (last-write-wins: server wins)
      await Promise.all([
        cacheService.setCachedTrips(tripsResult.data),
        cacheService.setCachedDays(daysResult.data),
        cacheService.setCachedActivities(activitiesResult.data),
        cacheService.setCachedExpenses(expensesResult.data)
      ]);

      // 4. อัปเดต metadata
      await cacheService.setMetadata({
        last_sync: syncedAt,
        trip_ids: tripsResult.data.map(t => t.id)
      });

      return {
        success: true,
        synced_at: syncedAt,
        conflicts
      };
    } catch (error) {
      console.error('Sync failed:', error);
      return {
        success: false,
        synced_at: syncedAt,
        conflicts
      };
    }
  },

  async syncTrip(tripId: string): Promise<SyncResult> {
    const conflicts: ConflictItem[] = [];
    const syncedAt = new Date().toISOString();

    try {
      const [tripResult, daysResult, activitiesResult, expensesResult] = await Promise.all([
        supabase.from('trips').select('*').eq('id', tripId).single(),
        supabase.from('trip_days').select('*').eq('trip_id', tripId),
        supabase.from('activities').select('*').eq('trip_id', tripId),
        supabase.from('expenses').select('*').eq('trip_id', tripId)
      ]);

      if (tripResult.error) throw tripResult.error;
      if (daysResult.error) throw daysResult.error;
      if (activitiesResult.error) throw activitiesResult.error;
      if (expensesResult.error) throw expensesResult.error;

      await Promise.all([
        cacheService.setCachedTrip(tripResult.data),
        cacheService.setCachedDays(daysResult.data),
        cacheService.setCachedActivities(activitiesResult.data),
        cacheService.setCachedExpenses(expensesResult.data)
      ]);

      return {
        success: true,
        synced_at: syncedAt,
        conflicts
      };
    } catch (error) {
      console.error('Sync trip failed:', error);
      return {
        success: false,
        synced_at: syncedAt,
        conflicts
      };
    }
  }
};
```

---

### Step 5: Hook - useSyncManager

**File: `src/hooks/useSyncManager.ts`**

```typescript
import { useEffect, useRef } from 'preact/hooks';
import { useAuth } from '@/hooks/useAuth';
import { useUserSettings } from '@/hooks/useUserSettings';
import { syncService } from '@/lib/sync';
import { cacheService } from '@/lib/cache';

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useSyncManager() {
  const { user } = useAuth();
  const { data: settings } = useUserSettings();
  const intervalRef = useRef<number>();

  // Background sync ทุก 5 นาที
  useEffect(() => {
    if (!user || !settings?.offline_cache_enabled) return;

    const performSync = async () => {
      const result = await syncService.syncAllData(user.id);
      if (!result.success) {
        console.error('Background sync failed');
      }
    };

    // Sync ทันทีเมื่อ mount
    performSync();

    // ตั้ง interval
    intervalRef.current = window.setInterval(performSync, SYNC_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [user, settings?.offline_cache_enabled]);

  // Sync เมื่อกลับมา online
  useEffect(() => {
    if (!user || !settings?.offline_cache_enabled) return;

    const handleOnline = async () => {
      console.log('Back online, syncing...');
      const result = await syncService.syncAllData(user.id);
      if (result.success) {
        // แสดง toast หรือ notification
        console.log('Sync successful');
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [user, settings?.offline_cache_enabled]);

  // Sync เมื่อ page กลับมา visible
  useEffect(() => {
    if (!user || !settings?.offline_cache_enabled) return;

    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        console.log('App visible, syncing...');
        await syncService.syncAllData(user.id);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, settings?.offline_cache_enabled]);

  // Clear cache on logout
  useEffect(() => {
    if (!user) {
      cacheService.clearAll();
    }
  }, [user]);
}
```

---

### Step 6: Hook - useOfflineTrips

**File: `src/hooks/useOfflineTrips.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { cacheService } from '@/lib/cache';
import { useUserSettings } from '@/hooks/useUserSettings';
import type { CachedTrip } from '@/types/cache';

export function useOfflineTrips() {
  const { data: settings } = useUserSettings();
  const cacheEnabled = settings?.offline_cache_enabled ?? false;

  return useQuery({
    queryKey: ['trips', 'offline'],
    queryFn: async (): Promise<{ trips: CachedTrip[]; fromCache: boolean }> => {
      try {
        // พยายามดึงจาก server ก่อน
        const { data, error } = await supabase
          .from('trips')
          .select('*')
          .order('updated_at', { ascending: false });

        if (!error && data) {
          // สำเร็จ → บันทึกลง cache
          if (cacheEnabled) {
            await cacheService.setCachedTrips(data);
          }
          return { trips: data, fromCache: false };
        }

        // ล้มเหลว → ใช้ cache
        if (cacheEnabled) {
          const cached = await cacheService.getCachedTrips();
          return { trips: cached, fromCache: true };
        }

        throw error || new Error('No data');
      } catch (error) {
        // Offline → ใช้ cache
        if (cacheEnabled) {
          const cached = await cacheService.getCachedTrips();
          return { trips: cached, fromCache: true };
        }
        throw error;
      }
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
```

---

### Step 7: Component - OfflineBanner

**File: `src/components/common/OfflineBanner.tsx`**

```typescript
import { useState, useEffect } from 'preact/hooks';
import { cacheService } from '@/lib/cache';

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSync, setLastSync] = useState<string | null>(null);

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

  useEffect(() => {
    const loadMetadata = async () => {
      const metadata = await cacheService.getMetadata();
      if (metadata) {
        setLastSync(metadata.last_sync);
      }
    };
    loadMetadata();
  }, []);

  if (isOnline && !lastSync) return null;

  return (
    <div class={`px-4 py-2 text-sm ${isOnline ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'}`}>
      <div class="max-w-2xl mx-auto flex items-center gap-2">
        {isOnline ? (
          <>
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>ออนไลน์</span>
          </>
        ) : (
          <>
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>ออฟไลน์</span>
          </>
        )}
        {lastSync && (
          <span class="text-xs opacity-75">
            (ซิงก์ล่าสุด: {new Date(lastSync).toLocaleTimeString('th-TH')})
          </span>
        )}
      </div>
    </div>
  );
}
```

---

### Step 8: Integration - Add Sync Manager to App

**File: `src/App.tsx`** (ส่วนที่เพิ่ม)

```typescript
import { useSyncManager } from '@/hooks/useSyncManager';
import { OfflineBanner } from '@/components/common/OfflineBanner';

export function App() {
  // Enable background sync
  useSyncManager();

  return (
    <div>
      <OfflineBanner />
      {/* ... rest of app */}
    </div>
  );
}
```

---

## Testing Checklist

- [ ] Cache ถูกสร้างเมื่อ login ครั้งแรก
- [ ] Background sync ทำงานทุก 5 นาที
- [ ] Offline → ดูข้อมูลจาก cache ได้
- [ ] Offline → banner "ออฟไลน์" แสดง
- [ ] Online → banner "ออนไลน์" แสดง
- [ ] กลับมา online → sync อัตโนมัติ
- [ ] Page visibility change → sync
- [ ] Logout → cache ถูกลบทั้งหมด
- [ ] ปิด offline cache ใน settings → ไม่มี cache/sync
- [ ] Conflict detection → แสดง conflicts (optional: แสดง UI)
- [ ] Last sync timestamp แสดงถูกต้อง

---

## Best Practices

### 1. localForage Setup
```typescript
// ✅ สร้าง instance แยกตาม collection
const tripsStore = localForage.createInstance({
  name: 'nomad',
  storeName: 'trips'
});

const activitiesStore = localForage.createInstance({
  name: 'nomad',
  storeName: 'activities'
});
```

### 2. Sync Strategy
```typescript
// ✅ Try server first, fallback to cache
try {
  const { data } = await supabase.from('trips').select('*');
  await cacheService.setCachedTrips(data); // cache latest
  return { trips: data, fromCache: false };
} catch {
  const cached = await cacheService.getCachedTrips();
  return { trips: cached, fromCache: true };
}
```

### 3. Background Sync
```typescript
// ✅ Sync on multiple triggers
useEffect(() => {
  // 1. Interval (5 min)
  const interval = setInterval(sync, 5 * 60 * 1000);

  // 2. Online event
  window.addEventListener('online', sync);

  // 3. Visibility change
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) sync();
  });

  return () => {
    clearInterval(interval);
    window.removeEventListener('online', sync);
    document.removeEventListener('visibilitychange', sync);
  };
}, []);
```

### 4. Clear Cache on Logout
```typescript
// ✅ Auto-clear when user is null
useEffect(() => {
  if (!user) {
    cacheService.clearAll();
  }
}, [user]);
```

### 5. Conflict Detection
```typescript
// ✅ Compare timestamps
const conflicts: ConflictItem[] = [];
for (const serverItem of serverData) {
  const cachedItem = cache.find(c => c.id === serverItem.id);
  if (cachedItem && new Date(cachedItem.updated_at) > new Date(serverItem.updated_at)) {
    conflicts.push({
      entity_type: 'trip',
      entity_id: serverItem.id,
      local_updated_at: cachedItem.updated_at,
      server_updated_at: serverItem.updated_at
    });
  }
}

// Last-write-wins: server wins (overwrite cache)
await cacheService.setCachedTrips(serverData);
```

---

## Common Issues

### Issue: Cache ไม่อัปเดต
```typescript
// ❌ ลืม save หลัง fetch
const { data } = await supabase.from('trips').select('*');
return data;

// ✅ Save to cache หลัง fetch สำเร็จ
const { data } = await supabase.from('trips').select('*');
await cacheService.setCachedTrips(data);
return data;
```

### Issue: Sync ทำงานตอน offline
```typescript
// ❌ ไม่ตรวจสอบ online status
setInterval(sync, 5000);

// ✅ Check online before sync
setInterval(() => {
  if (navigator.onLine) sync();
}, 5000);
```

### Issue: Memory leak จาก interval
```typescript
// ❌ ไม่ clear interval
useEffect(() => {
  setInterval(sync, 5000);
}, []);

// ✅ Clear interval on unmount
useEffect(() => {
  const id = setInterval(sync, 5000);
  return () => clearInterval(id);
}, []);
```

### Issue: Iterate ช้าเมื่อมีข้อมูลเยอะ
```typescript
// ⚠️ iterate ทุกครั้งอาจช้า
async getCachedActivities(dayId: string) {
  const result: Activity[] = [];
  await activitiesStore.iterate((value) => {
    if (value.day_id === dayId) result.push(value);
  });
  return result;
}

// ✅ พิจารณาใช้ index key หรือ filter ที่ฝั่ง UI
// หรือ cache metadata เพิ่มเติมสำหรับ filtering
```

---

## Advanced: Incremental Sync (Optional)

หากต้องการ sync เฉพาะข้อมูลที่เปลี่ยนแปลง:

```typescript
async incrementalSync(userId: string, lastSync: string): Promise<SyncResult> {
  // ดึงเฉพาะข้อมูลที่ updated_at > lastSync
  const { data: trips } = await supabase
    .from('trips')
    .select('*')
    .gt('updated_at', lastSync);

  const { data: activities } = await supabase
    .from('activities')
    .select('*')
    .gt('updated_at', lastSync);

  // Merge กับ cache
  const cachedTrips = await cacheService.getCachedTrips();
  const mergedTrips = mergeWithCache(cachedTrips, trips);
  await cacheService.setCachedTrips(mergedTrips);

  // ... ทำเหมือนกันกับ days, activities, expenses

  return { success: true, synced_at: new Date().toISOString(), conflicts: [] };
}

function mergeWithCache<T extends { id: string }>(cached: T[], fresh: T[]): T[] {
  const map = new Map(cached.map(item => [item.id, item]));
  fresh.forEach(item => map.set(item.id, item));
  return Array.from(map.values());
}
```

---

## Notes

- **IndexedDB**: localForage wrapper ใช้งานง่ายกว่า raw IndexedDB API
- **Sync Interval**: 5 นาที เหมาะสม, ถ้าน้อยเกินอาจกิน battery/bandwidth
- **Last-write-wins**: Strategy ที่ง่ายที่สุด, server เป็นแหล่งข้อมูลหลัก
- **Conflict UI**: แสดง toast เตือนเมื่อเจอ conflict (optional)
- **Clear on Logout**: ต้อง clear cache เพื่อป้องกัน leak ข้อมูล
- **Settings Toggle**: ต้องตรวจสอบ `offline_cache_enabled` ก่อนทุกครั้ง
- **Performance**: พิจารณา incremental sync เมื่อข้อมูลเยอะ (>100 trips)
