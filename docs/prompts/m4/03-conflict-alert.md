# Task: Conflict Alert - แจ้งเตือนข้อมูลขัดแย้ง

## Context
สร้างระบบ detect และแจ้งเตือนเมื่อเกิด conflict จากการแก้ไขข้อมูลพร้อมกันหลายอุปกรณ์ ใช้ strategy "server-wins" (ข้อมูลจาก server เป็นหลัก) และแสดง toast แจ้งเตือนผู้ใช้

## Tech Stack
- **Preact + TypeScript**: Component และ Type Safety
- **TanStack Query**: Data fetching, cache management
- **Supabase Realtime**: Detect changes in real-time (optional)
- **Tailwind CSS v4**: Styling (toast notification)

## Requirements

### Functional Requirements
- Detect conflict: เปรียบเทียบ `updated_at` local vs server
- แสดง toast เมื่อพบ conflict
- Strategy: server-wins (ข้อมูลจาก server เป็นหลัก)
- ปุ่ม "รีเฟรช" ใน toast เพื่อดึงข้อมูลล่าสุด
- Badge conflict ที่หน้ารายการ (optional)
- Analytics: `sync_conflict` event
- Log conflict สำหรับ debugging

## Step-by-Step Implementation

### Step 1: Database Migration

เพิ่ม `version` field สำหรับ conflict detection (optional: alternative to `updated_at`)

**File: `supabase/migrations/009_conflict_tracking.sql`**

```sql
-- เพิ่ม version field (optional: ใช้แทน updated_at)
ALTER TABLE activities ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Trigger: เพิ่ม version เมื่ออัปเดต
CREATE OR REPLACE FUNCTION increment_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER increment_activities_version
  BEFORE UPDATE ON activities
  FOR EACH ROW
  EXECUTE FUNCTION increment_version();

CREATE TRIGGER increment_expenses_version
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION increment_version();

-- ตาราง conflict_logs (optional: สำหรับ debugging)
CREATE TABLE conflict_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  local_version INTEGER,
  server_version INTEGER,
  local_updated_at TIMESTAMPTZ,
  server_updated_at TIMESTAMPTZ,
  resolved_strategy TEXT, -- 'server-wins', 'manual', etc.
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX idx_conflict_logs_entity ON conflict_logs(entity_type, entity_id);
CREATE INDEX idx_conflict_logs_user ON conflict_logs(user_id);
```

**Run migration:**
```bash
supabase db push
```

---

### Step 2: Type Definitions

**File: `src/types/conflict.ts`**

```typescript
export interface ConflictInfo {
  entity_type: 'activity' | 'expense' | 'trip';
  entity_id: string;
  local_updated_at: string;
  server_updated_at: string;
  local_version?: number;
  server_version?: number;
}

export interface ConflictLog {
  id: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
  local_version: number | null;
  server_version: number | null;
  local_updated_at: string;
  server_updated_at: string;
  resolved_strategy: string;
  created_at: string;
}
```

---

### Step 3: Utility - Conflict Detection

**File: `src/lib/conflict.ts`**

```typescript
import type { ConflictInfo } from '@/types/conflict';

/**
 * ตรวจสอบ conflict โดยเปรียบเทียบ updated_at
 */
export function detectConflict(
  localUpdatedAt: string,
  serverUpdatedAt: string
): boolean {
  const localTime = new Date(localUpdatedAt).getTime();
  const serverTime = new Date(serverUpdatedAt).getTime();

  // ถ้า server ใหม่กว่า local → conflict
  return serverTime > localTime;
}

/**
 * ตรวจสอบ conflict โดยเปรียบเทียบ version
 */
export function detectConflictByVersion(
  localVersion: number,
  serverVersion: number
): boolean {
  return serverVersion > localVersion;
}

/**
 * Log conflict
 */
export async function logConflict(
  conflict: ConflictInfo,
  userId: string
): Promise<void> {
  try {
    const { supabase } = await import('@/lib/supabase');

    await supabase.from('conflict_logs').insert({
      entity_type: conflict.entity_type,
      entity_id: conflict.entity_id,
      user_id: userId,
      local_updated_at: conflict.local_updated_at,
      server_updated_at: conflict.server_updated_at,
      local_version: conflict.local_version,
      server_version: conflict.server_version,
      resolved_strategy: 'server-wins'
    });
  } catch (error) {
    console.error('Failed to log conflict:', error);
  }
}
```

---

### Step 4: Context - Toast Provider

สร้าง context สำหรับแสดง toast notifications

**File: `src/contexts/ToastContext.tsx`**

```typescript
import { createContext } from 'preact';
import { useContext, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, 'id'>) => void;
  hideToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ComponentChildren }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(7);
    const newToast = { ...toast, id };

    setToasts(prev => [...prev, newToast]);

    // Auto hide after duration
    if (toast.duration !== Infinity) {
      setTimeout(() => {
        hideToast(id);
      }, toast.duration || 5000);
    }
  };

  const hideToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toasts, showToast, hideToast }}>
      {children}
      <ToastContainer toasts={toasts} onClose={hideToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

interface ToastContainerProps {
  toasts: Toast[];
  onClose: (id: string) => void;
}

function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div class="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      {toasts.map(toast => (
        <div
          key={toast.id}
          class={`
            p-4 rounded-lg shadow-lg border flex items-start gap-3
            ${toast.type === 'error' ? 'bg-red-50 border-red-200' : ''}
            ${toast.type === 'warning' ? 'bg-yellow-50 border-yellow-200' : ''}
            ${toast.type === 'success' ? 'bg-green-50 border-green-200' : ''}
            ${toast.type === 'info' ? 'bg-blue-50 border-blue-200' : ''}
          `}
        >
          <div class="flex-1">
            <p class={`
              text-sm font-medium
              ${toast.type === 'error' ? 'text-red-800' : ''}
              ${toast.type === 'warning' ? 'text-yellow-800' : ''}
              ${toast.type === 'success' ? 'text-green-800' : ''}
              ${toast.type === 'info' ? 'text-blue-800' : ''}
            `}>
              {toast.message}
            </p>
            {toast.action && (
              <button
                onClick={() => {
                  toast.action!.onClick();
                  onClose(toast.id);
                }}
                class={`
                  text-sm font-medium mt-2 underline
                  ${toast.type === 'error' ? 'text-red-700 hover:text-red-800' : ''}
                  ${toast.type === 'warning' ? 'text-yellow-700 hover:text-yellow-800' : ''}
                  ${toast.type === 'success' ? 'text-green-700 hover:text-green-800' : ''}
                  ${toast.type === 'info' ? 'text-blue-700 hover:text-blue-800' : ''}
                `}
              >
                {toast.action.label}
              </button>
            )}
          </div>
          <button
            onClick={() => onClose(toast.id)}
            class="text-gray-400 hover:text-gray-600"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

### Step 5: Hook - useConflictDetection

**File: `src/hooks/useConflictDetection.ts`**

```typescript
import { useEffect } from 'preact/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/contexts/ToastContext';
import { detectConflict, logConflict } from '@/lib/conflict';
import { trackEvent } from '@/lib/analytics';
import type { Activity } from '@/types/activity';
import type { Expense } from '@/types/expense';

/**
 * Hook สำหรับ detect conflict เมื่อ query data มีการอัปเดต
 */
export function useConflictDetection() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Listen to query updates
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated') return;
      if (!event.query.state.data) return;

      const queryKey = event.query.queryKey;

      // ตรวจสอบ activities
      if (queryKey[0] === 'activities' && Array.isArray(event.query.state.data)) {
        const activities = event.query.state.data as Activity[];
        checkActivitiesConflict(activities);
      }

      // ตรวจสอบ expenses
      if (queryKey[0] === 'expenses' && Array.isArray(event.query.state.data)) {
        const expenses = event.query.state.data as Expense[];
        checkExpensesConflict(expenses);
      }
    });

    return () => unsubscribe();
  }, [queryClient, user]);

  const checkActivitiesConflict = (serverActivities: Activity[]) => {
    const cachedActivities = queryClient.getQueryData<Activity[]>(['activities']);
    if (!cachedActivities) return;

    serverActivities.forEach(serverActivity => {
      const cachedActivity = cachedActivities.find(a => a.id === serverActivity.id);
      if (!cachedActivity) return;

      if (detectConflict(cachedActivity.updated_at, serverActivity.updated_at)) {
        showConflictToast('activity', serverActivity.id, serverActivity.title);

        // Log conflict
        if (user) {
          logConflict({
            entity_type: 'activity',
            entity_id: serverActivity.id,
            local_updated_at: cachedActivity.updated_at,
            server_updated_at: serverActivity.updated_at
          }, user.id);
        }

        // Track analytics
        trackEvent('sync_conflict', {
          entity_type: 'activity',
          entity_id: serverActivity.id
        });
      }
    });
  };

  const checkExpensesConflict = (serverExpenses: Expense[]) => {
    const cachedExpenses = queryClient.getQueryData<Expense[]>(['expenses']);
    if (!cachedExpenses) return;

    serverExpenses.forEach(serverExpense => {
      const cachedExpense = cachedExpenses.find(e => e.id === serverExpense.id);
      if (!cachedExpense) return;

      if (detectConflict(cachedExpense.updated_at, serverExpense.updated_at)) {
        showConflictToast('expense', serverExpense.id, `ค่าใช้จ่าย ${serverExpense.category}`);

        if (user) {
          logConflict({
            entity_type: 'expense',
            entity_id: serverExpense.id,
            local_updated_at: cachedExpense.updated_at,
            server_updated_at: serverExpense.updated_at
          }, user.id);
        }

        trackEvent('sync_conflict', {
          entity_type: 'expense',
          entity_id: serverExpense.id
        });
      }
    });
  };

  const showConflictToast = (entityType: string, entityId: string, entityName: string) => {
    showToast({
      type: 'warning',
      message: `"${entityName}" ถูกแก้ไขจากอุปกรณ์อื่น`,
      action: {
        label: 'รีเฟรช',
        onClick: () => {
          // Invalidate queries to refetch
          if (entityType === 'activity') {
            queryClient.invalidateQueries({ queryKey: ['activities'] });
          } else if (entityType === 'expense') {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
          }
        }
      },
      duration: 10000 // 10 seconds
    });
  };
}
```

---

### Step 6: Integration - Add to App

เพิ่ม ToastProvider และ conflict detection ใน App

**File: `src/App.tsx`** (ส่วนที่เพิ่ม)

```typescript
import { ToastProvider } from '@/contexts/ToastContext';
import { useConflictDetection } from '@/hooks/useConflictDetection';

function AppContent() {
  // Enable conflict detection
  useConflictDetection();

  return (
    <div>
      {/* ... app content ... */}
    </div>
  );
}

export function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
```

---

### Step 7: Optimistic Update with Conflict Check

แก้ไข mutation hooks ให้ตรวจสอบ conflict ก่อน commit

**File: `src/hooks/useUpdateActivity.ts`** (ตัวอย่าง)

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { detectConflict } from '@/lib/conflict';
import { useToast } from '@/contexts/ToastContext';
import type { Activity, UpdateActivityInput } from '@/types/activity';

export function useUpdateActivity(activityId: string, tripId: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async (input: UpdateActivityInput): Promise<Activity> => {
      // ดึงข้อมูลล่าสุดจาก server ก่อน
      const { data: serverActivity, error: fetchError } = await supabase
        .from('activities')
        .select('*')
        .eq('id', activityId)
        .single();

      if (fetchError) throw fetchError;

      // ดึงข้อมูลจาก cache
      const cachedActivities = queryClient.getQueryData<Activity[]>(['activities', tripId]);
      const cachedActivity = cachedActivities?.find(a => a.id === activityId);

      // ตรวจสอบ conflict
      if (cachedActivity && detectConflict(cachedActivity.updated_at, serverActivity.updated_at)) {
        // มี conflict → แจ้งเตือนและยกเลิก mutation
        showToast({
          type: 'error',
          message: 'ข้อมูลถูกแก้ไขจากอุปกรณ์อื่น กรุณารีเฟรชและลองใหม่',
          action: {
            label: 'รีเฟรช',
            onClick: () => {
              queryClient.invalidateQueries({ queryKey: ['activities', tripId] });
            }
          },
          duration: 10000
        });

        throw new Error('Conflict detected');
      }

      // ไม่มี conflict → ทำการอัปเดต
      const { data, error } = await supabase
        .from('activities')
        .update(input)
        .eq('id', activityId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', tripId] });
    }
  });
}
```

---

## Testing Checklist

- [ ] แก้ไขจาก 2 อุปกรณ์พร้อมกัน → toast แจ้ง conflict
- [ ] Toast แสดงชื่อ entity ที่ conflict
- [ ] คลิก "รีเฟรช" ใน toast → ดึงข้อมูลล่าสุด
- [ ] Server-wins: ข้อมูลจาก server เป็นหลัก
- [ ] Conflict log บันทึกใน database
- [ ] Analytics: `sync_conflict` event tracked
- [ ] Toast ปิดอัตโนมัติหลัง 10 วินาที
- [ ] หลาย conflicts พร้อมกัน → แสดงหลาย toasts
- [ ] Optimistic update + conflict → cancel และแจ้งเตือน

---

## Best Practices

### 1. Timestamp Comparison
```typescript
// ✅ Compare as timestamps
const localTime = new Date(localUpdatedAt).getTime();
const serverTime = new Date(serverUpdatedAt).getTime();
return serverTime > localTime;

// ❌ String comparison (unreliable)
return serverUpdatedAt > localUpdatedAt;
```

### 2. Server-Wins Strategy
```typescript
// ✅ Always use server data
if (detectConflict(cached.updated_at, server.updated_at)) {
  showToast('ข้อมูลถูกแก้ไขจากอุปกรณ์อื่น');
  queryClient.setQueryData(['activities'], serverData); // Use server data
}
```

### 3. Pre-mutation Conflict Check
```typescript
// ✅ Check before mutating
mutationFn: async (input) => {
  const { data: serverData } = await supabase.from('activities').select('*').eq('id', id).single();
  const cached = queryClient.getQueryData(['activity', id]);

  if (detectConflict(cached.updated_at, serverData.updated_at)) {
    throw new Error('Conflict detected');
  }

  // Proceed with mutation
  return await supabase.from('activities').update(input).eq('id', id);
}
```

### 4. Toast with Action
```typescript
// ✅ Provide refresh action
showToast({
  type: 'warning',
  message: 'ข้อมูลถูกแก้ไข',
  action: {
    label: 'รีเฟรช',
    onClick: () => queryClient.invalidateQueries(['activities'])
  }
});
```

### 5. Log Conflicts
```typescript
// ✅ Log for debugging
await supabase.from('conflict_logs').insert({
  entity_type: 'activity',
  entity_id: id,
  local_updated_at: cached.updated_at,
  server_updated_at: server.updated_at,
  resolved_strategy: 'server-wins'
});
```

---

## Common Issues

### Issue: False positive conflicts
```typescript
// ⚠️ Small time difference may cause false positives
// Solution: Add tolerance threshold
const TOLERANCE_MS = 1000; // 1 second

export function detectConflict(local: string, server: string): boolean {
  const diff = new Date(server).getTime() - new Date(local).getTime();
  return diff > TOLERANCE_MS;
}
```

### Issue: Toast spam
```typescript
// ❌ หลาย conflicts → หลาย toasts
conflicts.forEach(c => showToast(...));

// ✅ รวมเป็น toast เดียว
if (conflicts.length > 0) {
  showToast({
    message: `${conflicts.length} รายการถูกแก้ไขจากอุปกรณ์อื่น`,
    action: { label: 'รีเฟรชทั้งหมด', onClick: refreshAll }
  });
}
```

### Issue: Conflict ขณะ optimistic update
```typescript
// ✅ Cancel optimistic update on conflict
onMutate: async (input) => {
  // Fetch latest from server
  const server = await fetchLatest();
  const cached = getCached();

  if (detectConflict(cached, server)) {
    showToast('Conflict detected');
    throw new Error('Conflict'); // Cancel mutation
  }

  // Proceed with optimistic update
}
```

---

## Alternative: Version-based Conflict Detection

ใช้ `version` field แทน `updated_at`:

```typescript
export function detectConflictByVersion(localVersion: number, serverVersion: number): boolean {
  return serverVersion > localVersion;
}

// In mutation
mutationFn: async (input) => {
  const server = await fetchLatest();
  const cached = getCached();

  if (detectConflictByVersion(cached.version, server.version)) {
    throw new Error('Conflict detected');
  }

  // Increment version on update
  return await supabase.from('activities')
    .update({ ...input, version: server.version + 1 })
    .eq('id', id)
    .eq('version', server.version); // Optimistic concurrency control
}
```

---

## Notes

- **Server-Wins**: ข้อมูลจาก server เป็นหลัก (simple strategy)
- **Timestamp**: ใช้ `updated_at` เป็น baseline สำหรับ conflict detection
- **Version Field**: Alternative ที่ accurate กว่า timestamp
- **Toast**: แสดงแจ้งเตือนพร้อมปุ่ม "รีเฟรช"
- **Conflict Logs**: เก็บ log สำหรับ debugging และ analytics
- **Pre-mutation Check**: ตรวจสอบก่อน mutate เพื่อป้องกัน overwrite
- **Analytics**: Track `sync_conflict` event เพื่อวิเคราะห์
