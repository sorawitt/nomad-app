# Task: Activity CRUD - เพิ่ม/แก้/ลบกิจกรรม

## Context
สร้างระบบจัดการกิจกรรมรายวัน พร้อม modal form, optimistic updates, และ mark complete

## Tech Stack
- Preact + TypeScript
- TanStack Query (mutations)
- Tailwind CSS v4
- Supabase

## Requirements

### File Structure
```
src/features/activities/
├── ActivityModal.tsx           # Modal form
├── ActivityCard.tsx            # Activity card
├── ActivityList.tsx            # List container
└── hooks/
    ├── useActivities.ts        # Fetch activities
    ├── useAddActivity.ts       # Add mutation
    ├── useUpdateActivity.ts    # Update mutation
    └── useDeleteActivity.ts    # Delete mutation
```

### Core Features
1. ✅ เพิ่มกิจกรรม: ชื่อ, เวลาต้น-จบ, note, location (optional)
2. ✅ แก้ไขกิจกรรม
3. ✅ ลบกิจกรรม (confirm dialog)
4. ✅ Mark complete/incomplete
5. ✅ เรียงตามเวลา
6. ✅ Optimistic updates
7. ✅ Analytics: `add_activity`, `complete_activity`

---

## Step-by-Step Implementation

### Step 1: Database Migration

```sql
-- Create activities table
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_id UUID NOT NULL REFERENCES trip_days(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  location_name TEXT,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX activities_trip_idx ON activities(trip_id);
CREATE INDEX activities_day_idx ON activities(day_id);
CREATE INDEX activities_start_time_idx ON activities(start_time);

-- RLS Policies
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Owner + Editor can CRUD
CREATE POLICY "activities_member_crud" ON activities
FOR ALL USING (
  auth.uid() = (SELECT owner_id FROM trips WHERE id = activities.trip_id)
  OR auth.uid() IN (
    SELECT user_id FROM trip_members
    WHERE trip_id = activities.trip_id AND role = 'editor'
  )
);

-- Shared token can read
CREATE POLICY "activities_shared_read" ON activities
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM trips
    WHERE id = activities.trip_id
    AND shared_token IS NOT NULL
  )
);

-- Trigger: auto update updated_at
CREATE TRIGGER activities_updated_at
  BEFORE UPDATE ON activities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

---

### Step 2: Define Types

```tsx
// src/types/activity.ts
export type ActivityStatus = 'pending' | 'completed';

export type Activity = {
  id: string;
  trip_id: string;
  day_id: string;
  title: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  location_name?: string;
  location_lat?: number;
  location_lng?: number;
  status: ActivityStatus;
  created_by?: string;
  created_at: string;
  updated_at: string;
};

export type ActivityFormData = {
  title: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  location_name?: string;
  location_lat?: number;
  location_lng?: number;
};
```

---

### Step 3: Create useActivities Hook

```tsx
// src/features/activities/hooks/useActivities.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Activity } from '@/types/activity';

export function useActivities(dayId: string) {
  return useQuery({
    queryKey: ['activities', dayId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('day_id', dayId)
        .order('start_time', { ascending: true });

      if (error) throw error;
      return data as Activity[];
    },
    enabled: !!dayId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
```

---

### Step 4: Create Add/Update/Delete Mutations

```tsx
// src/features/activities/hooks/useAddActivity.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { trackEvent } from '@/lib/analytics';
import type { ActivityFormData } from '@/types/activity';

type AddActivityInput = ActivityFormData & {
  trip_id: string;
  day_id: string;
};

export function useAddActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddActivityInput) => {
      const { data, error } = await supabase
        .from('activities')
        .insert({
          ...input,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Invalidate activities list
      queryClient.invalidateQueries({ queryKey: ['activities', data.day_id] });

      // Invalidate trip days to update activity count
      queryClient.invalidateQueries({ queryKey: ['trip-days', data.trip_id] });

      // Track analytics
      trackEvent('add_activity', {
        trip_id: data.trip_id,
        day_id: data.day_id,
        has_location: !!data.location_lat,
      });
    },
  });
}
```

```tsx
// src/features/activities/hooks/useUpdateActivity.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Activity, ActivityFormData } from '@/types/activity';

type UpdateActivityInput = {
  id: string;
  data: Partial<ActivityFormData>;
};

export function useUpdateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: UpdateActivityInput) => {
      const { data: updated, error } = await supabase
        .from('activities')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updated as Activity;
    },
    onMutate: async ({ id, data }) => {
      // Optimistic update
      const previousActivities = queryClient.getQueriesData({
        queryKey: ['activities']
      });

      queryClient.setQueriesData(
        { queryKey: ['activities'] },
        (old: Activity[] | undefined) => {
          if (!old) return old;
          return old.map((activity) =>
            activity.id === id ? { ...activity, ...data } : activity
          );
        }
      );

      return { previousActivities };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousActivities) {
        context.previousActivities.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['activities', data.day_id] });
    },
  });
}
```

```tsx
// src/features/activities/hooks/useDeleteActivity.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Activity } from '@/types/activity';

export function useDeleteActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (activityId: string) => {
      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', activityId);

      if (error) throw error;
      return activityId;
    },
    onMutate: async (activityId) => {
      // Optimistic delete
      const previousActivities = queryClient.getQueriesData({
        queryKey: ['activities']
      });

      queryClient.setQueriesData(
        { queryKey: ['activities'] },
        (old: Activity[] | undefined) => {
          if (!old) return old;
          return old.filter((activity) => activity.id !== activityId);
        }
      );

      return { previousActivities };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousActivities) {
        context.previousActivities.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['trip-days'] });
    },
  });
}
```

```tsx
// src/features/activities/hooks/useToggleComplete.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { trackEvent } from '@/lib/analytics';
import type { Activity } from '@/types/activity';

export function useToggleComplete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (activity: Activity) => {
      const newStatus = activity.status === 'completed' ? 'pending' : 'completed';

      const { data, error } = await supabase
        .from('activities')
        .update({ status: newStatus })
        .eq('id', activity.id)
        .select()
        .single();

      if (error) throw error;
      return data as Activity;
    },
    onMutate: async (activity) => {
      // Optimistic update
      const newStatus = activity.status === 'completed' ? 'pending' : 'completed';

      queryClient.setQueriesData(
        { queryKey: ['activities', activity.day_id] },
        (old: Activity[] | undefined) => {
          if (!old) return old;
          return old.map((a) =>
            a.id === activity.id ? { ...a, status: newStatus } : a
          );
        }
      );
    },
    onSuccess: (data) => {
      if (data.status === 'completed') {
        trackEvent('complete_activity', {
          activity_id: data.id,
          trip_id: data.trip_id,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['activities', data.day_id] });
    },
  });
}
```

---

### Step 5: Create ActivityCard Component

```tsx
// src/features/activities/ActivityCard.tsx
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import type { Activity } from '@/types/activity';
import { useToggleComplete } from './hooks/useToggleComplete';

type ActivityCardProps = {
  activity: Activity;
  onEdit: () => void;
  onDelete: () => void;
};

export function ActivityCard({ activity, onEdit, onDelete }: ActivityCardProps) {
  const toggleComplete = useToggleComplete();

  const timeStr = activity.start_time
    ? format(new Date(activity.start_time), 'HH:mm', { locale: th })
    : null;

  return (
    <div class={`bg-white rounded-lg border p-4 ${activity.status === 'completed' ? 'opacity-60' : ''}`}>
      <div class="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={() => toggleComplete.mutate(activity)}
          disabled={toggleComplete.isPending}
          class={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            activity.status === 'completed'
              ? 'bg-green-500 border-green-500'
              : 'border-gray-300 hover:border-green-500'
          }`}
        >
          {activity.status === 'completed' && (
            <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Content */}
        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1">
              <h3 class={`font-medium text-gray-900 ${activity.status === 'completed' ? 'line-through' : ''}`}>
                {activity.title}
              </h3>
              {activity.description && (
                <p class="text-sm text-gray-600 mt-1">{activity.description}</p>
              )}
              {activity.location_name && (
                <p class="text-sm text-gray-500 mt-1 flex items-center gap-1">
                  📍 {activity.location_name}
                </p>
              )}
            </div>
            {timeStr && (
              <span class="text-sm font-medium text-blue-600 whitespace-nowrap">{timeStr}</span>
            )}
          </div>

          {/* Actions */}
          <div class="flex items-center gap-2 mt-3">
            <button
              onClick={onEdit}
              class="text-sm text-blue-600 hover:text-blue-700"
            >
              แก้ไข
            </button>
            <span class="text-gray-300">|</span>
            <button
              onClick={onDelete}
              class="text-sm text-red-600 hover:text-red-700"
            >
              ลบ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### Step 6: Create ActivityModal Component

```tsx
// src/features/activities/ActivityModal.tsx
import { useState, useEffect } from 'preact/hooks';
import type { Activity, ActivityFormData } from '@/types/activity';

type ActivityModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ActivityFormData) => Promise<void>;
  activity?: Activity;
  dayDate: string; // YYYY-MM-DD for default time
};

export function ActivityModal({ isOpen, onClose, onSubmit, activity, dayDate }: ActivityModalProps) {
  const [formData, setFormData] = useState<ActivityFormData>({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    location_name: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activity) {
      setFormData({
        title: activity.title,
        description: activity.description || '',
        start_time: activity.start_time || '',
        end_time: activity.end_time || '',
        location_name: activity.location_name || '',
      });
    } else {
      // Reset form
      setFormData({
        title: '',
        description: '',
        start_time: '',
        end_time: '',
        location_name: '',
      });
    }
    setError(null);
  }, [activity, isOpen]);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!formData.title.trim()) {
        throw new Error('กรุณากรอกชื่อกิจกรรม');
      }

      await onSubmit(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div class="p-6 space-y-4">
          {/* Header */}
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-bold text-gray-900">
              {activity ? 'แก้ไขกิจกรรม' : 'เพิ่มกิจกรรม'}
            </h2>
            <button onClick={onClose} class="text-gray-400 hover:text-gray-600">
              ✕
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} class="space-y-4">
            {/* Title */}
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                ชื่อกิจกรรม *
              </label>
              <input
                type="text"
                value={formData.title}
                onInput={(e) => setFormData({ ...formData, title: (e.target as HTMLInputElement).value })}
                placeholder="เช่น เที่ยว N Seoul Tower"
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Description */}
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                รายละเอียด
              </label>
              <textarea
                value={formData.description}
                onInput={(e) => setFormData({ ...formData, description: (e.target as HTMLTextAreaElement).value })}
                placeholder="บันทึกเพิ่มเติม..."
                rows={3}
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Time Range */}
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  เวลาเริ่ม
                </label>
                <input
                  type="time"
                  value={formData.start_time ? new Date(formData.start_time).toTimeString().slice(0, 5) : ''}
                  onInput={(e) => {
                    const time = (e.target as HTMLInputElement).value;
                    setFormData({
                      ...formData,
                      start_time: time ? `${dayDate}T${time}:00` : ''
                    });
                  }}
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  เวลาจบ
                </label>
                <input
                  type="time"
                  value={formData.end_time ? new Date(formData.end_time).toTimeString().slice(0, 5) : ''}
                  onInput={(e) => {
                    const time = (e.target as HTMLInputElement).value;
                    setFormData({
                      ...formData,
                      end_time: time ? `${dayDate}T${time}:00` : ''
                    });
                  }}
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Location */}
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                สถานที่
              </label>
              <input
                type="text"
                value={formData.location_name}
                onInput={(e) => setFormData({ ...formData, location_name: (e.target as HTMLInputElement).value })}
                placeholder="เช่น N Seoul Tower"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Error */}
            {error && (
              <div class="bg-red-50 border border-red-200 rounded-lg p-3">
                <p class="text-sm text-red-900">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div class="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                class="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={loading}
                class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
              >
                {loading ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
```

---

### Step 7: Create ActivityList Component

```tsx
// src/features/activities/ActivityList.tsx
import { useState } from 'preact/hooks';
import { useActivities } from './hooks/useActivities';
import { useAddActivity } from './hooks/useAddActivity';
import { useUpdateActivity } from './hooks/useUpdateActivity';
import { useDeleteActivity } from './hooks/useDeleteActivity';
import { ActivityCard } from './ActivityCard';
import { ActivityModal } from './ActivityModal';
import type { Activity, ActivityFormData } from '@/types/activity';

type ActivityListProps = {
  tripId: string;
  dayId: string;
  dayDate: string; // YYYY-MM-DD
};

export function ActivityList({ tripId, dayId, dayDate }: ActivityListProps) {
  const { data: activities, isLoading } = useActivities(dayId);
  const addActivity = useAddActivity();
  const updateActivity = useUpdateActivity();
  const deleteActivity = useDeleteActivity();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | undefined>();

  const handleAdd = async (data: ActivityFormData) => {
    await addActivity.mutateAsync({
      ...data,
      trip_id: tripId,
      day_id: dayId,
    });
  };

  const handleUpdate = async (data: ActivityFormData) => {
    if (!editingActivity) return;
    await updateActivity.mutateAsync({
      id: editingActivity.id,
      data,
    });
  };

  const handleDelete = async (activity: Activity) => {
    if (!confirm(`ลบกิจกรรม "${activity.title}"?`)) return;
    await deleteActivity.mutateAsync(activity.id);
  };

  if (isLoading) {
    return (
      <div class="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} class="bg-white rounded-lg border p-4 animate-pulse">
            <div class="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div class="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div class="space-y-3">
      {/* Activities */}
      {activities && activities.length > 0 ? (
        activities.map((activity) => (
          <ActivityCard
            key={activity.id}
            activity={activity}
            onEdit={() => {
              setEditingActivity(activity);
              setIsModalOpen(true);
            }}
            onDelete={() => handleDelete(activity)}
          />
        ))
      ) : (
        <div class="text-center py-8 text-gray-500">
          ยังไม่มีกิจกรรม
        </div>
      )}

      {/* Add Button */}
      <button
        onClick={() => {
          setEditingActivity(undefined);
          setIsModalOpen(true);
        }}
        class="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
      >
        + เพิ่มกิจกรรม
      </button>

      {/* Modal */}
      <ActivityModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingActivity(undefined);
        }}
        onSubmit={editingActivity ? handleUpdate : handleAdd}
        activity={editingActivity}
        dayDate={dayDate}
      />
    </div>
  );
}
```

---

## Testing Checklist

### CRUD Operations
- [ ] เพิ่มกิจกรรม → แสดงในรายการ
- [ ] แก้ไขกิจกรรม → อัปเดตข้อมูล
- [ ] ลบกิจกรรม → confirm dialog → หายจากรายการ
- [ ] Optimistic update ทำงาน (UI update ทันที)

### Mark Complete
- [ ] คลิก checkbox → toggle status
- [ ] Completed → มี checkmark + opacity
- [ ] Analytics `complete_activity` ถูกส่ง

### Time & Sorting
- [ ] กิจกรรมเรียงตามเวลา (เร็ว → ช้า)
- [ ] ไม่มีเวลา → แสดงท้ายสุด
- [ ] แก้ไขเวลา → re-sort อัตโนมัติ

### UI/UX
- [ ] Modal เปิด/ปิดถูกต้อง
- [ ] Validation: ชื่อไม่ว่าง
- [ ] Error message แสดงชัดเจน
- [ ] Loading state ระหว่าง submit
- [ ] Mobile responsive

### Edge Cases
- [ ] Network error → rollback optimistic update
- [ ] Delete ขณะ loading → handle correctly
- [ ] Refresh ระหว่างแก้ไข → data ไม่หาย

---

## Best Practices Applied

✅ **KISS:** ไม่ใช้ form library (controlled inputs พอ)
✅ **Optimistic Updates:** UI responsive ทันที
✅ **Type Safety:** TypeScript strict types
✅ **Error Handling:** Rollback on error
✅ **Analytics:** Track key events
✅ **Mobile-First:** Touch-friendly, responsive
✅ **Accessibility:** Checkbox semantics, labels

---

## Common Issues

**Q: Optimistic update ไม่ rollback?**
A: ตรวจ `onError` callback ใน mutation

**Q: เรียงเวลาผิด?**
A: ตรวจ `.order('start_time')` ใน query

**Q: Modal ไม่ปิด?**
A: ตรวจ `onClose()` ถูกเรียกหลัง submit success

---

## Next Steps

1. เพิ่ม image attachment (M2-S4)
2. เพิ่ม location picker (map integration)
3. เพิ่ม activity templates
4. เพิ่ม recurring activities
