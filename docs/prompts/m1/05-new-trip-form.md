# Task: New Trip Form

## Context
สร้างฟอร์มสำหรับสร้างทริปใหม่ พร้อม validation และ auto-generate trip days

## Tech Stack
- Preact + TypeScript
- TanStack Query (mutations)
- Tailwind CSS v4
- Supabase (RPC)

## Requirements

### File Structure
```
src/features/trips/
├── NewTrip.tsx             # Form screen
└── hooks/
    └── useCreateTrip.ts    # Mutation hook
```

### Core Features
1. ✅ ฟอร์มกรอก: ชื่อ, วันเริ่ม, วันจบ, currency
2. ✅ Validation: ชื่อไม่ว่าง, วันเริ่ม ≤ วันจบ
3. ✅ Auto-calculate จำนวนวัน
4. ✅ สร้าง `trip_days` อัตโนมัติ
5. ✅ Redirect ไป Trip Detail หลังสำเร็จ
6. ✅ Analytics: `create_trip`

## Step-by-Step Implementation

### Step 1: Create Mutation Hook

```tsx
// src/features/trips/hooks/useCreateTrip.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { trackEvent } from '@/lib/analytics';

type CreateTripInput = {
  title: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  currency_code?: string;
};

export function useCreateTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTripInput) => {
      // Call Supabase RPC to create trip + days
      const { data, error } = await supabase.rpc('create_trip_with_days', {
        p_title: input.title,
        p_start_date: input.start_date,
        p_end_date: input.end_date,
        p_currency_code: input.currency_code || 'THB',
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Invalidate trips list
      queryClient.invalidateQueries({ queryKey: ['trips'] });

      // Calculate day count
      const startDate = new Date(data.start_date);
      const endDate = new Date(data.end_date);
      const dayCount = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      // Track analytics
      trackEvent('create_trip', {
        trip_id: data.id,
        day_count: dayCount,
      });
    },
  });
}
```

### Step 2: Create Form Component

```tsx
// src/features/trips/NewTrip.tsx
import { useState } from 'preact/hooks';
import { useNavigate } from 'react-router-dom';
import { useCreateTrip } from './hooks/useCreateTrip';

export default function NewTrip() {
  const navigate = useNavigate();
  const createTrip = useCreateTrip();

  const [formData, setFormData] = useState({
    title: '',
    start_date: '',
    end_date: '',
    currency_code: 'THB',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Calculate day count
  const dayCount =
    formData.start_date && formData.end_date
      ? Math.ceil(
          (new Date(formData.end_date).getTime() - new Date(formData.start_date).getTime()) /
            (1000 * 60 * 60 * 24)
        ) + 1
      : 0;

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'กรุณากรอกชื่อทริป';
    }

    if (!formData.start_date) {
      newErrors.start_date = 'กรุณาเลือกวันเริ่ม';
    }

    if (!formData.end_date) {
      newErrors.end_date = 'กรุณาเลือกวันจบ';
    }

    if (formData.start_date && formData.end_date) {
      if (new Date(formData.start_date) > new Date(formData.end_date)) {
        newErrors.end_date = 'วันจบต้องไม่น้อยกว่าวันเริ่ม';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      const trip = await createTrip.mutateAsync(formData);
      navigate(`/trips/${trip.id}`, { replace: true });
    } catch (error) {
      console.error('Failed to create trip:', error);
    }
  };

  return (
    <div class="min-h-screen bg-gray-50">
      {/* Header */}
      <header class="bg-white border-b border-gray-200">
        <div class="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            class="text-gray-600 hover:text-gray-900"
          >
            ← กลับ
          </button>
          <h1 class="text-xl font-bold text-gray-900">สร้างทริปใหม่</h1>
        </div>
      </header>

      {/* Form */}
      <main class="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
          {/* Title */}
          <div>
            <label for="title" class="block text-sm font-medium text-gray-700 mb-2">
              ชื่อทริป *
            </label>
            <input
              id="title"
              type="text"
              value={formData.title}
              onInput={(e) =>
                setFormData({ ...formData, title: (e.target as HTMLInputElement).value })
              }
              placeholder="เช่น ทริปเที่ยวเกาหลี"
              class={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.title ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.title && <p class="text-sm text-red-600 mt-1">{errors.title}</p>}
          </div>

          {/* Date Range */}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="start_date" class="block text-sm font-medium text-gray-700 mb-2">
                วันเริ่ม *
              </label>
              <input
                id="start_date"
                type="date"
                value={formData.start_date}
                onInput={(e) =>
                  setFormData({ ...formData, start_date: (e.target as HTMLInputElement).value })
                }
                class={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.start_date ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.start_date && <p class="text-sm text-red-600 mt-1">{errors.start_date}</p>}
            </div>

            <div>
              <label for="end_date" class="block text-sm font-medium text-gray-700 mb-2">
                วันจบ *
              </label>
              <input
                id="end_date"
                type="date"
                value={formData.end_date}
                onInput={(e) =>
                  setFormData({ ...formData, end_date: (e.target as HTMLInputElement).value })
                }
                class={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.end_date ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.end_date && <p class="text-sm text-red-600 mt-1">{errors.end_date}</p>}
            </div>
          </div>

          {/* Currency */}
          <div>
            <label for="currency" class="block text-sm font-medium text-gray-700 mb-2">
              สกุลเงิน
            </label>
            <select
              id="currency"
              value={formData.currency_code}
              onChange={(e) =>
                setFormData({ ...formData, currency_code: (e.target as HTMLSelectElement).value })
              }
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="THB">บาท (THB)</option>
              <option value="USD">ดอลลาร์ (USD)</option>
              <option value="EUR">ยูโร (EUR)</option>
              <option value="JPY">เยน (JPY)</option>
            </select>
          </div>

          {/* Summary */}
          {dayCount > 0 && (
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p class="text-sm text-blue-900">
                ทริปนี้มี <span class="font-semibold">{dayCount} วัน</span>
              </p>
            </div>
          )}

          {/* Error Message */}
          {createTrip.error && (
            <div class="bg-red-50 border border-red-200 rounded-lg p-4">
              <p class="text-sm text-red-900">
                {createTrip.error instanceof Error ? createTrip.error.message : 'เกิดข้อผิดพลาด'}
              </p>
            </div>
          )}

          {/* Submit */}
          <div class="flex gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              class="flex-1 bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={createTrip.isPending}
              class="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {createTrip.isPending ? 'กำลังสร้าง...' : 'สร้างทริป'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
```

### Step 3: Create Supabase RPC Function

```sql
-- Create RPC function in Supabase SQL Editor
CREATE OR REPLACE FUNCTION create_trip_with_days(
  p_title TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_currency_code TEXT DEFAULT 'THB'
)
RETURNS trips
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trip trips;
  v_current_date DATE;
  v_day_index INT;
BEGIN
  -- Insert trip
  INSERT INTO trips (owner_id, title, start_date, end_date, currency_code)
  VALUES (auth.uid(), p_title, p_start_date, p_end_date, p_currency_code)
  RETURNING * INTO v_trip;

  -- Create trip_days
  v_current_date := p_start_date;
  v_day_index := 1;

  WHILE v_current_date <= p_end_date LOOP
    INSERT INTO trip_days (trip_id, day_index, date)
    VALUES (v_trip.id, v_day_index, v_current_date);

    v_current_date := v_current_date + INTERVAL '1 day';
    v_day_index := v_day_index + 1;
  END LOOP;

  RETURN v_trip;
END;
$$;
```

### Step 4: Add Route

```tsx
// src/app/router.tsx
import NewTrip from '@/features/trips/NewTrip';

<Route
  path="/trips/new"
  element={
    <ProtectedRoute>
      <NewTrip />
    </ProtectedRoute>
  }
/>
```

## Testing Checklist

- [ ] กรอกข้อมูลครบ → สร้างทริปสำเร็จ
- [ ] ชื่อว่าง → error message
- [ ] วันจบ < วันเริ่ม → error message
- [ ] Day count แสดงถูกต้อง
- [ ] สร้างสำเร็จ → redirect ไป trip detail
- [ ] `trip_days` ถูกสร้างครบตามวัน
- [ ] Analytics `create_trip` ส่งพร้อม day_count
- [ ] Loading state ระหว่างสร้าง

## Best Practices Applied

✅ **KISS:** ไม่ใช้ form library (controlled inputs เพียงพอ)
✅ **Validation:** Client-side validation ก่อน submit
✅ **UX:** แสดง summary จำนวนวันทันที
✅ **Type Safety:** TypeScript strict mode
✅ **Performance:** React Query mutation + cache invalidation
✅ **Accessibility:** Labels, error messages

## Common Issues

**Q: วันที่ไม่ถูกต้อง?**
A: ใช้ format `YYYY-MM-DD` สำหรับ `<input type="date">`

**Q: RPC ไม่ทำงาน?**
A: ตรวจ `SECURITY DEFINER` และ `auth.uid()` ใน function

**Q: trip_days ไม่ครบ?**
A: ตรวจ WHILE loop ใน RPC function

## Next Steps

1. ทดสอบ edge cases (leap year, timezone)
2. เพิ่ม draft save (optional)
3. เพิ่ม template selection (future)
4. เพิ่ม invite members (M4)
