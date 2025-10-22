# Task: Share Trip - แชร์ทริปผ่าน Token

## Context
สร้างระบบแชร์ทริปแบบ read-only ผ่าน unique token โดย owner สามารถสร้าง/ยกเลิก token ได้ และผู้รับสามารถดูทริปโดยไม่ต้อง login พร้อม Web Share API สำหรับ native sharing

## Tech Stack
- **Preact + TypeScript**: Component และ Type Safety
- **TanStack Query**: Data fetching, mutations
- **Supabase**: Database, Edge Functions
- **Web Share API**: Native sharing on mobile

## Requirements

### Functional Requirements
- Owner สร้าง share token (UUID v4)
- คัดลอกลิงก์แชร์ หรือใช้ Web Share API
- Read-only view: แสดงทริป + วัน + กิจกรรม (ไม่มีปุ่มแก้ไข/ลบ)
- Owner revoke token ได้
- Access log (optional: track การเข้าถึง)
- Error handling: token หมดอายุ/ไม่มีอยู่

## Step-by-Step Implementation

### Step 1: Database Migration

เพิ่ม `shared_token` และ `shared_access_logs` table

**File: `supabase/migrations/006_share_trip.sql`**

```sql
-- เพิ่ม shared_token column ใน trips
ALTER TABLE trips ADD COLUMN IF NOT EXISTS shared_token TEXT UNIQUE;

-- Index สำหรับ token lookup
CREATE INDEX IF NOT EXISTS idx_trips_shared_token ON trips(shared_token) WHERE shared_token IS NOT NULL;

-- ตาราง access logs (optional)
CREATE TABLE shared_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  shared_token TEXT NOT NULL,
  accessed_at TIMESTAMPTZ DEFAULT now(),
  user_agent TEXT,
  ip_address TEXT
);

-- Index
CREATE INDEX idx_access_logs_trip ON shared_access_logs(trip_id);
CREATE INDEX idx_access_logs_token ON shared_access_logs(shared_token);

-- RLS: ไม่ต้องการ policy สำหรับ access logs (internal only)
ALTER TABLE shared_access_logs ENABLE ROW LEVEL SECURITY;
```

**Run migration:**
```bash
supabase db push
```

---

### Step 2: Edge Function - Get Shared Trip

สร้าง edge function สำหรับดึงข้อมูลทริปผ่าน token (ไม่ต้อง auth)

**File: `supabase/functions/shared-trip/index.ts`**

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client (service role for bypassing RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ดึงข้อมูล trip ด้วย token
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('id, title, start_date, end_date, budget, currency')
      .eq('shared_token', token)
      .maybeSingle();

    if (tripError || !trip) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ดึง days, activities, expenses
    const [daysResult, activitiesResult, expensesResult] = await Promise.all([
      supabase.from('trip_days').select('*').eq('trip_id', trip.id).order('day_number'),
      supabase.from('activities').select('*').eq('trip_id', trip.id).order('start_time'),
      supabase.from('expenses').select('*').eq('trip_id', trip.id).order('created_at')
    ]);

    // Log access (optional)
    const userAgent = req.headers.get('user-agent') || '';
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';

    await supabase.from('shared_access_logs').insert({
      trip_id: trip.id,
      shared_token: token,
      user_agent: userAgent,
      ip_address: ipAddress
    });

    return new Response(
      JSON.stringify({
        trip,
        days: daysResult.data || [],
        activities: activitiesResult.data || [],
        expenses: expensesResult.data || []
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

**Deploy function:**
```bash
supabase functions deploy shared-trip
```

---

### Step 3: Type Definitions

**File: `src/types/share.ts`**

```typescript
export interface SharedTripData {
  trip: {
    id: string;
    title: string;
    start_date: string;
    end_date: string;
    budget: number;
    currency: string;
  };
  days: Array<{
    id: string;
    trip_id: string;
    day_number: number;
    date: string;
    title: string;
  }>;
  activities: Array<{
    id: string;
    trip_id: string;
    day_id: string;
    title: string;
    description: string | null;
    start_time: string | null;
    end_time: string | null;
    status: string;
  }>;
  expenses: Array<{
    id: string;
    trip_id: string;
    category: string;
    amount: number;
    note: string | null;
  }>;
}
```

---

### Step 4: Hooks - useGenerateShareToken

**File: `src/hooks/useGenerateShareToken.ts`**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { trackEvent } from '@/lib/analytics';

export function useGenerateShareToken(tripId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<string> => {
      const token = uuidv4();

      const { error } = await supabase
        .from('trips')
        .update({ shared_token: token })
        .eq('id', tripId);

      if (error) throw error;

      return token;
    },
    onSuccess: (token) => {
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });

      trackEvent('generate_share_token', {
        trip_id: tripId,
        token_length: token.length
      });
    }
  });
}
```

---

### Step 5: Hooks - useRevokeShareToken

**File: `src/hooks/useRevokeShareToken.ts`**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { trackEvent } from '@/lib/analytics';

export function useRevokeShareToken(tripId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { error } = await supabase
        .from('trips')
        .update({ shared_token: null })
        .eq('id', tripId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });

      trackEvent('revoke_share_token', {
        trip_id: tripId
      });
    }
  });
}
```

---

### Step 6: Hooks - useSharedTrip

**File: `src/hooks/useSharedTrip.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { SharedTripData } from '@/types/share';

export function useSharedTrip(token: string) {
  return useQuery({
    queryKey: ['shared-trip', token],
    queryFn: async (): Promise<SharedTripData> => {
      const { data, error } = await supabase.functions.invoke('shared-trip', {
        body: { token }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    enabled: !!token,
    retry: false, // ไม่ retry เพราะ token อาจไม่ถูกต้อง
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
```

---

### Step 7: Component - ShareTripModal

**File: `src/components/trip/ShareTripModal.tsx`**

```typescript
import { useState } from 'preact/hooks';
import { useTrip } from '@/hooks/useTrip';
import { useGenerateShareToken } from '@/hooks/useGenerateShareToken';
import { useRevokeShareToken } from '@/hooks/useRevokeShareToken';

interface Props {
  tripId: string;
  onClose: () => void;
}

export function ShareTripModal({ tripId, onClose }: Props) {
  const { data: trip } = useTrip(tripId);
  const generateMutation = useGenerateShareToken(tripId);
  const revokeMutation = useRevokeShareToken(tripId);
  const [copied, setCopied] = useState(false);

  const shareUrl = trip?.shared_token
    ? `${window.location.origin}/shared/${trip.shared_token}`
    : null;

  const handleGenerate = async () => {
    try {
      await generateMutation.mutateAsync();
    } catch (error) {
      alert('ไม่สามารถสร้างลิงก์แชร์ได้');
    }
  };

  const handleRevoke = async () => {
    if (!confirm('ต้องการยกเลิกลิงก์แชร์? ผู้ที่มีลิงก์เก่าจะเข้าถึงไม่ได้อีก')) return;

    try {
      await revokeMutation.mutateAsync();
    } catch (error) {
      alert('ไม่สามารถยกเลิกลิงก์ได้');
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      alert('ไม่สามารถคัดลอกลิงก์ได้');
    }
  };

  const handleNativeShare = async () => {
    if (!shareUrl || !navigator.share) return;

    try {
      await navigator.share({
        title: `แชร์ทริป: ${trip?.title}`,
        text: `มาดูแผนทริป "${trip?.title}" กัน!`,
        url: shareUrl
      });
    } catch (error) {
      // User cancelled or error
      console.log('Share cancelled:', error);
    }
  };

  return (
    <div class="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
      <div class="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md">
        {/* Header */}
        <div class="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900">แชร์ทริป</h2>
          <button
            onClick={onClose}
            class="text-gray-400 hover:text-gray-600"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div class="p-6 space-y-5">
          {!shareUrl ? (
            <>
              <p class="text-gray-600">
                สร้างลิงก์แชร์เพื่อให้คนอื่นดูทริปของคุณแบบ read-only (ไม่สามารถแก้ไขได้)
              </p>
              <button
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
                class="w-full bg-blue-500 text-white py-3 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {generateMutation.isPending ? 'กำลังสร้าง...' : 'สร้างลิงก์แชร์'}
              </button>
            </>
          ) : (
            <>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  ลิงก์แชร์
                </label>
                <div class="flex gap-2">
                  <input
                    type="text"
                    value={shareUrl}
                    readonly
                    class="flex-1 px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-600"
                  />
                  <button
                    onClick={handleCopy}
                    class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    {copied ? (
                      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Native Share (if supported) */}
              {navigator.share && (
                <button
                  onClick={handleNativeShare}
                  class="w-full bg-green-500 text-white py-3 rounded-lg font-medium hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  แชร์
                </button>
              )}

              {/* Revoke Button */}
              <button
                onClick={handleRevoke}
                disabled={revokeMutation.isPending}
                class="w-full bg-red-500 text-white py-3 rounded-lg font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {revokeMutation.isPending ? 'กำลังยกเลิก...' : 'ยกเลิกลิงก์'}
              </button>

              <p class="text-xs text-gray-500 text-center">
                หากยกเลิกลิงก์ ผู้ที่มีลิงก์เก่าจะเข้าถึงไม่ได้อีก
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

### Step 8: Page - SharedTripView

**File: `src/pages/SharedTripView.tsx`**

```typescript
import { useParams } from 'react-router-dom';
import { useSharedTrip } from '@/hooks/useSharedTrip';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

export function SharedTripView() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, error } = useSharedTrip(token!);

  if (isLoading) {
    return (
      <div class="min-h-screen bg-gray-50 p-4">
        <div class="max-w-2xl mx-auto space-y-4">
          <div class="h-32 bg-gray-200 rounded-lg animate-pulse" />
          <div class="h-64 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-lg p-8 max-w-md text-center">
          <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 class="text-xl font-semibold text-gray-900 mb-2">ไม่พบทริป</h2>
          <p class="text-gray-600">ลิงก์นี้อาจหมดอายุหรือถูกยกเลิกแล้ว</p>
        </div>
      </div>
    );
  }

  const { trip, days, activities } = data;

  return (
    <div class="min-h-screen bg-gray-50 pb-8">
      {/* Read-only Banner */}
      <div class="bg-blue-50 border-b border-blue-200 px-4 py-3">
        <div class="max-w-2xl mx-auto flex items-center gap-2 text-blue-800 text-sm">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <span>โหมดดูอย่างเดียว - คุณไม่สามารถแก้ไขข้อมูลได้</span>
        </div>
      </div>

      {/* Trip Header */}
      <div class="bg-white border-b border-gray-200 px-4 py-6">
        <div class="max-w-2xl mx-auto">
          <h1 class="text-2xl font-bold text-gray-900 mb-2">{trip.title}</h1>
          <div class="text-gray-600">
            {format(new Date(trip.start_date), 'd MMM', { locale: th })} -{' '}
            {format(new Date(trip.end_date), 'd MMM yyyy', { locale: th })}
          </div>
          <div class="text-sm text-gray-500 mt-2">
            งบประมาณ: {trip.budget.toLocaleString()} {trip.currency}
          </div>
        </div>
      </div>

      {/* Days & Activities */}
      <div class="max-w-2xl mx-auto p-4 space-y-4">
        {days.map(day => {
          const dayActivities = activities.filter(act => act.day_id === day.id);

          return (
            <div key={day.id} class="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <div class="flex items-center gap-3 mb-4">
                <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <span class="text-lg font-semibold text-blue-600">{day.day_number}</span>
                </div>
                <div>
                  <div class="font-semibold text-gray-900">{day.title}</div>
                  <div class="text-sm text-gray-500">
                    {format(new Date(day.date), 'd MMMM yyyy', { locale: th })}
                  </div>
                </div>
              </div>

              {dayActivities.length === 0 ? (
                <p class="text-gray-500 text-sm">ยังไม่มีกิจกรรม</p>
              ) : (
                <div class="space-y-3">
                  {dayActivities.map(activity => (
                    <div key={activity.id} class="border-l-4 border-blue-500 pl-4 py-2">
                      <div class="font-medium text-gray-900">{activity.title}</div>
                      {activity.description && (
                        <p class="text-sm text-gray-600 mt-1">{activity.description}</p>
                      )}
                      {activity.start_time && (
                        <div class="text-xs text-gray-500 mt-2">
                          {format(new Date(activity.start_time), 'HH:mm', { locale: th })}
                          {activity.end_time && ` - ${format(new Date(activity.end_time), 'HH:mm', { locale: th })}`}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

### Step 9: Add Route

**File: `src/App.tsx`** (ส่วนที่เพิ่ม)

```typescript
import { SharedTripView } from '@/pages/SharedTripView';

// Add route
<Route path="/shared/:token" element={<SharedTripView />} />
```

---

## Testing Checklist

- [ ] Owner สร้าง share token → ได้ลิงก์
- [ ] คัดลอกลิงก์ → แสดง "คัดลอกแล้ว"
- [ ] Web Share API → เปิด native share sheet (บนมือถือ)
- [ ] เปิดลิงก์แชร์ → แสดงทริป read-only
- [ ] Read-only view → ไม่มีปุ่มแก้ไข/ลบ
- [ ] Banner "โหมดดูอย่างเดียว" แสดง
- [ ] Revoke token → ลิงก์เก่าใช้ไม่ได้
- [ ] Token ไม่ถูกต้อง → แสดง error page
- [ ] Access log บันทึก (optional: ตรวจใน database)
- [ ] Analytics: `generate_share_token`, `revoke_share_token` tracked

---

## Best Practices

### 1. UUID v4 for Tokens
```typescript
// ✅ Use UUID v4 for unpredictable tokens
import { v4 as uuidv4 } from 'uuid';
const token = uuidv4();

// ❌ Don't use sequential or guessable tokens
const token = `${tripId}-${Date.now()}`;
```

### 2. Service Role for Edge Function
```typescript
// ✅ Use service role key to bypass RLS
const supabase = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') // Service role
);

// Query can access all data regardless of RLS
```

### 3. Web Share API Fallback
```typescript
// ✅ Check support and provide fallback
{navigator.share && (
  <button onClick={handleNativeShare}>แชร์</button>
)}

// Always provide copy button as fallback
<button onClick={handleCopy}>คัดลอกลิงก์</button>
```

### 4. Access Logging
```typescript
// ✅ Log access for analytics
await supabase.from('shared_access_logs').insert({
  trip_id,
  shared_token: token,
  user_agent: req.headers.get('user-agent'),
  ip_address: req.headers.get('x-forwarded-for')
});
```

### 5. Revoke Confirmation
```typescript
// ✅ Confirm before revoke
const handleRevoke = async () => {
  if (!confirm('ต้องการยกเลิกลิงก์? ผู้ที่มีลิงก์เก่าจะเข้าถึงไม่ได้อีก')) return;
  await revokeMutation.mutateAsync();
};
```

---

## Common Issues

### Issue: Token ซ้ำกัน
```sql
-- ✅ Add UNIQUE constraint
ALTER TABLE trips ADD COLUMN shared_token TEXT UNIQUE;

-- UUID v4 มีโอกาสซ้ำต่ำมาก แต่ database constraint ป้องกันแน่นอน
```

### Issue: Web Share API ไม่ทำงาน
```typescript
// ⚠️ Web Share API requires HTTPS (except localhost)
// ✅ Check support before using
if (navigator.share) {
  await navigator.share({ title, text, url });
} else {
  // Fallback to copy
  await navigator.clipboard.writeText(url);
}
```

### Issue: Edge Function CORS error
```typescript
// ✅ Add CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Handle OPTIONS preflight
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders });
}

// Include in response
return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
```

### Issue: RLS blocking edge function
```typescript
// ❌ Using anon key (RLS applied)
const supabase = createClient(url, anonKey);

// ✅ Using service role key (bypass RLS)
const supabase = createClient(url, serviceRoleKey);
```

---

## Advanced: QR Code (Optional)

หากต้องการสร้าง QR code สำหรับแชร์:

```bash
bun add qrcode
```

```typescript
import QRCode from 'qrcode';

export function ShareTripModal({ tripId, onClose }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (shareUrl) {
      QRCode.toDataURL(shareUrl, { width: 200 }).then(setQrDataUrl);
    }
  }, [shareUrl]);

  return (
    <div>
      {/* ... existing code ... */}
      {qrDataUrl && (
        <div class="flex flex-col items-center">
          <img src={qrDataUrl} alt="QR Code" class="w-48 h-48" />
          <p class="text-sm text-gray-500 mt-2">สแกนเพื่อเปิดทริป</p>
        </div>
      )}
    </div>
  );
}
```

---

## Notes

- **Token Security**: UUID v4 มีความยาว 36 ตัวอักษร แทบเดาไม่ได้
- **Service Role Key**: ใช้ใน edge function เท่านั้น ห้ามใช้ที่ client
- **Web Share API**: ทำงานบน HTTPS เท่านั้น (except localhost)
- **Access Logs**: เก็บ user_agent และ ip_address เพื่อ analytics (optional)
- **Revoke**: set `shared_token = null` ทำให้ลิงก์เก่าใช้ไม่ได้ทันที
- **Read-only**: ไม่มี mutation hooks ใน SharedTripView, แสดงเฉพาะข้อมูล
- **Performance**: พิจารณา cache shared trip data ที่ฝั่ง edge function (CDN)
