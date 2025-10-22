# Task: Settings Screen - หน้าตั้งค่า

## Context
สร้างหน้า Settings ให้ผู้ใช้จัดการโปรไฟล์ การตั้งค่าแอป (currency, offline cache, analytics) และ logout ข้อมูลจะถูกบันทึกลง `user_settings` table และ `profiles` table

## Tech Stack
- **Preact + TypeScript**: Component และ Type Safety
- **TanStack Query**: Data fetching, mutations, cache
- **Supabase**: Database, Auth
- **Tailwind CSS v4**: Styling (mobile-first)

## Requirements

### Functional Requirements
- แสดงข้อมูลโปรไฟล์: อีเมล, ชื่อแสดง
- แก้ไขโปรไฟล์: ชื่อแสดง
- ตั้งค่า default currency (THB, USD, EUR, JPY)
- Toggle: เปิด/ปิด offline cache
- Toggle: เปิด/ปิด analytics tracking
- Logout button (confirm dialog)
- บันทึกอัตโนมัติ (debounce)
- Loading states และ success feedback

## Step-by-Step Implementation

### Step 1: Database Migration

สร้างตาราง `user_settings` และแก้ไข `profiles`

**File: `supabase/migrations/005_user_settings.sql`**

```sql
-- ตาราง user_settings
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  default_currency TEXT DEFAULT 'THB' CHECK (default_currency IN ('THB', 'USD', 'EUR', 'JPY')),
  offline_cache_enabled BOOLEAN DEFAULT true,
  analytics_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX idx_user_settings_user ON user_settings(user_id);

-- RLS Enable
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Policy: ผู้ใช้อ่านได้เฉพาะของตัวเอง
CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: ผู้ใช้เพิ่มได้เฉพาะของตัวเอง
CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: ผู้ใช้แก้ไขได้เฉพาะของตัวเอง
CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger: อัปเดต updated_at
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- แก้ไข profiles table ให้มี display_name
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Update existing profiles RLS
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
```

**Run migration:**
```bash
supabase db push
```

---

### Step 2: Type Definitions

**File: `src/types/settings.ts`**

```typescript
export const CURRENCIES = ['THB', 'USD', 'EUR', 'JPY'] as const;
export type Currency = typeof CURRENCIES[number];

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  THB: '฿',
  USD: '$',
  EUR: '€',
  JPY: '¥'
};

export const CURRENCY_NAMES: Record<Currency, string> = {
  THB: 'บาทไทย (THB)',
  USD: 'ดอลลาร์สหรัฐ (USD)',
  EUR: 'ยูโร (EUR)',
  JPY: 'เยนญี่ปุ่น (JPY)'
};

export interface UserSettings {
  id: string;
  user_id: string;
  default_currency: Currency;
  offline_cache_enabled: boolean;
  analytics_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface UpdateProfileInput {
  display_name: string;
}

export interface UpdateSettingsInput {
  default_currency?: Currency;
  offline_cache_enabled?: boolean;
  analytics_enabled?: boolean;
}
```

---

### Step 3: Hooks - useUserSettings

**File: `src/hooks/useUserSettings.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { UserSettings } from '@/types/settings';

export function useUserSettings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-settings', user?.id],
    queryFn: async (): Promise<UserSettings> => {
      if (!user) throw new Error('Not authenticated');

      // ดึง settings ของผู้ใช้
      let { data: settings, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      // ถ้ายังไม่มี settings สร้างใหม่พร้อม default values
      if (!settings && !error) {
        const { data: newSettings, error: insertError } = await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            default_currency: 'THB',
            offline_cache_enabled: true,
            analytics_enabled: true
          })
          .select()
          .single();

        if (insertError) throw insertError;
        settings = newSettings;
      }

      if (error) throw error;
      return settings!;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
```

---

### Step 4: Hooks - useUpdateSettings

**File: `src/hooks/useUpdateSettings.ts`**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { UpdateSettingsInput, UserSettings } from '@/types/settings';

export function useUpdateSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateSettingsInput): Promise<UserSettings> => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('user_settings')
        .update(input)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async (input) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['user-settings', user?.id] });

      const previousSettings = queryClient.getQueryData<UserSettings>(['user-settings', user?.id]);

      if (previousSettings) {
        queryClient.setQueryData<UserSettings>(
          ['user-settings', user?.id],
          { ...previousSettings, ...input }
        );
      }

      return { previousSettings };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previousSettings) {
        queryClient.setQueryData(['user-settings', user?.id], context.previousSettings);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-settings', user?.id] });
    }
  });
}
```

---

### Step 5: Hooks - useUserProfile

**File: `src/hooks/useUserProfile.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { UserProfile } from '@/types/settings';

export function useUserProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async (): Promise<UserProfile> => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, display_name, avatar_url')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
```

---

### Step 6: Hooks - useUpdateProfile

**File: `src/hooks/useUpdateProfile.ts`**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { UpdateProfileInput, UserProfile } from '@/types/settings';

export function useUpdateProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateProfileInput): Promise<UserProfile> => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('profiles')
        .update(input)
        .eq('id', user.id)
        .select('id, email, display_name, avatar_url')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile', user?.id] });
    }
  });
}
```

---

### Step 7: Component - SettingsScreen

**File: `src/pages/SettingsScreen.tsx`**

```typescript
import { useState } from 'preact/hooks';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useUpdateProfile } from '@/hooks/useUpdateProfile';
import { useUpdateSettings } from '@/hooks/useUpdateSettings';
import { ProfileSection } from '@/components/settings/ProfileSection';
import { CurrencySection } from '@/components/settings/CurrencySection';
import { PreferencesSection } from '@/components/settings/PreferencesSection';
import { LogoutButton } from '@/components/settings/LogoutButton';

export function SettingsScreen() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { data: profile, isLoading: profileLoading } = useUserProfile();
  const { data: settings, isLoading: settingsLoading } = useUserSettings();

  const handleLogout = async () => {
    if (!confirm('ต้องการออกจากระบบ?')) return;

    try {
      await signOut();
      navigate('/auth');
    } catch (error) {
      alert('ไม่สามารถออกจากระบบได้');
    }
  };

  if (profileLoading || settingsLoading) {
    return (
      <div class="min-h-screen bg-gray-50 p-4">
        <div class="max-w-2xl mx-auto space-y-4">
          <div class="h-8 bg-gray-200 rounded animate-pulse w-32" />
          <div class="h-32 bg-white rounded-lg animate-pulse" />
          <div class="h-48 bg-white rounded-lg animate-pulse" />
          <div class="h-32 bg-white rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div class="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div class="bg-white border-b border-gray-200 px-4 py-4">
        <div class="max-w-2xl mx-auto">
          <h1 class="text-xl font-bold text-gray-900">ตั้งค่า</h1>
        </div>
      </div>

      {/* Content */}
      <div class="max-w-2xl mx-auto p-4 space-y-4">
        {/* Profile Section */}
        {profile && <ProfileSection profile={profile} />}

        {/* Currency Section */}
        {settings && <CurrencySection settings={settings} />}

        {/* Preferences Section */}
        {settings && <PreferencesSection settings={settings} />}

        {/* Logout Button */}
        <LogoutButton onLogout={handleLogout} />
      </div>
    </div>
  );
}
```

---

### Step 8: Component - ProfileSection

**File: `src/components/settings/ProfileSection.tsx`**

```typescript
import { useState, useEffect } from 'preact/hooks';
import { useUpdateProfile } from '@/hooks/useUpdateProfile';
import type { UserProfile } from '@/types/settings';

interface Props {
  profile: UserProfile;
}

export function ProfileSection({ profile }: Props) {
  const [displayName, setDisplayName] = useState(profile.display_name || '');
  const [isDirty, setIsDirty] = useState(false);
  const updateMutation = useUpdateProfile();

  useEffect(() => {
    setDisplayName(profile.display_name || '');
  }, [profile.display_name]);

  useEffect(() => {
    setIsDirty(displayName !== (profile.display_name || ''));
  }, [displayName, profile.display_name]);

  const handleSave = async () => {
    if (!isDirty || !displayName.trim()) return;

    try {
      await updateMutation.mutateAsync({ display_name: displayName.trim() });
      setIsDirty(false);
    } catch (error) {
      alert('ไม่สามารถบันทึกข้อมูลได้');
    }
  };

  return (
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">โปรไฟล์</h2>

      <div class="space-y-4">
        {/* Email (Read-only) */}
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            อีเมล
          </label>
          <div class="px-4 py-2 bg-gray-50 rounded-lg text-gray-600 text-sm">
            {profile.email}
          </div>
        </div>

        {/* Display Name (Editable) */}
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            ชื่อแสดง
          </label>
          <input
            type="text"
            value={displayName}
            onInput={(e) => setDisplayName((e.target as HTMLInputElement).value)}
            placeholder="กรอกชื่อแสดง"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Save Button */}
        {isDirty && (
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending || !displayName.trim()}
            class="w-full bg-blue-500 text-white py-2 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {updateMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        )}
      </div>
    </div>
  );
}
```

---

### Step 9: Component - CurrencySection

**File: `src/components/settings/CurrencySection.tsx`**

```typescript
import { useState } from 'preact/hooks';
import { useUpdateSettings } from '@/hooks/useUpdateSettings';
import type { UserSettings, Currency } from '@/types/settings';
import { CURRENCIES, CURRENCY_NAMES, CURRENCY_SYMBOLS } from '@/types/settings';

interface Props {
  settings: UserSettings;
}

export function CurrencySection({ settings }: Props) {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(settings.default_currency);
  const updateMutation = useUpdateSettings();

  const handleChange = async (currency: Currency) => {
    setSelectedCurrency(currency);

    try {
      await updateMutation.mutateAsync({ default_currency: currency });
    } catch (error) {
      alert('ไม่สามารถบันทึกการตั้งค่าได้');
      setSelectedCurrency(settings.default_currency);
    }
  };

  return (
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">สกุลเงิน</h2>

      <div class="space-y-2">
        {CURRENCIES.map(currency => (
          <button
            key={currency}
            onClick={() => handleChange(currency)}
            disabled={updateMutation.isPending}
            class={`
              w-full px-4 py-3 rounded-lg border-2 text-left transition-all
              ${selectedCurrency === currency
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
              }
              ${updateMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <div class="flex items-center justify-between">
              <div>
                <div class="font-medium text-gray-900">
                  {CURRENCY_SYMBOLS[currency]} {CURRENCY_NAMES[currency]}
                </div>
              </div>
              {selectedCurrency === currency && (
                <svg class="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

---

### Step 10: Component - PreferencesSection

**File: `src/components/settings/PreferencesSection.tsx`**

```typescript
import { useState, useEffect } from 'preact/hooks';
import { useUpdateSettings } from '@/hooks/useUpdateSettings';
import type { UserSettings } from '@/types/settings';

interface Props {
  settings: UserSettings;
}

export function PreferencesSection({ settings }: Props) {
  const [offlineCache, setOfflineCache] = useState(settings.offline_cache_enabled);
  const [analytics, setAnalytics] = useState(settings.analytics_enabled);
  const updateMutation = useUpdateSettings();

  useEffect(() => {
    setOfflineCache(settings.offline_cache_enabled);
    setAnalytics(settings.analytics_enabled);
  }, [settings]);

  const handleToggleOfflineCache = async (enabled: boolean) => {
    setOfflineCache(enabled);

    try {
      await updateMutation.mutateAsync({ offline_cache_enabled: enabled });
    } catch (error) {
      alert('ไม่สามารถบันทึกการตั้งค่าได้');
      setOfflineCache(settings.offline_cache_enabled);
    }
  };

  const handleToggleAnalytics = async (enabled: boolean) => {
    setAnalytics(enabled);

    try {
      await updateMutation.mutateAsync({ analytics_enabled: enabled });
    } catch (error) {
      alert('ไม่สามารถบันทึกการตั้งค่าได้');
      setAnalytics(settings.analytics_enabled);
    }
  };

  return (
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">การตั้งค่า</h2>

      <div class="space-y-4">
        {/* Offline Cache Toggle */}
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <div class="font-medium text-gray-900">แคชข้อมูลออฟไลน์</div>
            <div class="text-sm text-gray-500 mt-1">
              เก็บข้อมูลไว้ใช้งานแบบออฟไลน์
            </div>
          </div>
          <button
            onClick={() => handleToggleOfflineCache(!offlineCache)}
            disabled={updateMutation.isPending}
            class={`
              relative inline-flex h-6 w-11 items-center rounded-full transition-colors
              ${offlineCache ? 'bg-blue-500' : 'bg-gray-200'}
              ${updateMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <span
              class={`
                inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                ${offlineCache ? 'translate-x-6' : 'translate-x-1'}
              `}
            />
          </button>
        </div>

        {/* Analytics Toggle */}
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <div class="font-medium text-gray-900">Analytics</div>
            <div class="text-sm text-gray-500 mt-1">
              ช่วยเราปรับปรุงแอปให้ดีขึ้น
            </div>
          </div>
          <button
            onClick={() => handleToggleAnalytics(!analytics)}
            disabled={updateMutation.isPending}
            class={`
              relative inline-flex h-6 w-11 items-center rounded-full transition-colors
              ${analytics ? 'bg-blue-500' : 'bg-gray-200'}
              ${updateMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <span
              class={`
                inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                ${analytics ? 'translate-x-6' : 'translate-x-1'}
              `}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

### Step 11: Component - LogoutButton

**File: `src/components/settings/LogoutButton.tsx`**

```typescript
interface Props {
  onLogout: () => void;
}

export function LogoutButton({ onLogout }: Props) {
  return (
    <button
      onClick={onLogout}
      class="w-full bg-red-500 text-white py-3 rounded-lg font-medium hover:bg-red-600 transition-colors"
    >
      ออกจากระบบ
    </button>
  );
}
```

---

## Testing Checklist

- [ ] แสดงอีเมล (read-only) ถูกต้อง
- [ ] แก้ไขชื่อแสดง → บันทึกสำเร็จ → refresh → ค่าคงเดิม
- [ ] เปลี่ยน currency → อัปเดตทันที (optimistic)
- [ ] Toggle offline cache → บันทึกสำเร็จ
- [ ] Toggle analytics → บันทึกสำเร็จ
- [ ] Logout → confirm dialog → redirect ไป /auth
- [ ] Logout → session cleared → ไม่สามารถเข้าหน้าอื่นได้
- [ ] User ใหม่ → สร้าง user_settings default อัตโนมัติ
- [ ] Optimistic update → error → rollback ค่าเดิม
- [ ] RLS: ผู้ใช้อ่าน/แก้ไขได้เฉพาะของตัวเอง

---

## Best Practices

### 1. Optimistic Updates
```typescript
// ✅ Optimistic update with rollback
onMutate: async (input) => {
  const previous = queryClient.getQueryData(['user-settings', userId]);
  queryClient.setQueryData(['user-settings', userId],
    { ...previous, ...input }
  );
  return { previous };
},
onError: (err, vars, context) => {
  queryClient.setQueryData(['user-settings', userId], context.previous);
}
```

### 2. Auto-create Settings
```typescript
// ✅ Create default settings if not exists
if (!settings && !error) {
  const { data: newSettings } = await supabase
    .from('user_settings')
    .insert({ user_id, ...defaults })
    .select()
    .single();
  settings = newSettings;
}
```

### 3. Toggle Component
```typescript
// ✅ Accessible toggle button
<button
  onClick={() => handleToggle(!enabled)}
  class={`relative inline-flex h-6 w-11 rounded-full ${enabled ? 'bg-blue-500' : 'bg-gray-200'}`}
>
  <span class={`h-4 w-4 rounded-full bg-white ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
</button>
```

### 4. Form Dirty State
```typescript
// ✅ Track dirty state before saving
const [isDirty, setIsDirty] = useState(false);

useEffect(() => {
  setIsDirty(displayName !== (profile.display_name || ''));
}, [displayName, profile.display_name]);

// Show save button only when dirty
{isDirty && <button onClick={handleSave}>บันทึก</button>}
```

### 5. Logout Confirmation
```typescript
// ✅ Confirm before logout
const handleLogout = async () => {
  if (!confirm('ต้องการออกจากระบบ?')) return;
  await signOut();
  navigate('/auth');
};
```

---

## Common Issues

### Issue: Settings ไม่โหลด
```typescript
// ❌ ลืม create default settings
const { data } = await supabase.from('user_settings')
  .select('*').eq('user_id', userId).maybeSingle();
// data = null สำหรับ user ใหม่

// ✅ Auto-create if not exists
if (!data && !error) {
  const { data: created } = await supabase
    .from('user_settings')
    .insert({ user_id: userId, ...defaults })
    .select().single();
  data = created;
}
```

### Issue: Toggle ไม่อัปเดต UI
```typescript
// ❌ ไม่ sync state กับ server
const [enabled, setEnabled] = useState(true);

// ✅ Sync with server data
useEffect(() => {
  setEnabled(settings.analytics_enabled);
}, [settings]);
```

### Issue: Optimistic update ไม่ rollback
```typescript
// ❌ ไม่เก็บ previous state
onMutate: async (input) => {
  queryClient.setQueryData(['settings'], { ...old, ...input });
}

// ✅ เก็บ previous และ rollback on error
onMutate: async (input) => {
  const previous = queryClient.getQueryData(['settings']);
  queryClient.setQueryData(['settings'], { ...previous, ...input });
  return { previous };
},
onError: (err, vars, context) => {
  queryClient.setQueryData(['settings'], context.previous);
}
```

---

## Notes

- **Default Settings**: สร้างอัตโนมัติเมื่อ user login ครั้งแรก
- **Optimistic Updates**: ใช้ทุก toggle/select เพื่อ UX ที่ดีขึ้น
- **Debounce**: ไม่จำเป็นสำหรับ toggle, แต่ควรใช้กับ text input
- **Currency Context**: พิจารณาสร้าง context สำหรับ share currency ทั่วแอป
- **Logout**: ต้อง clear session + redirect + clear cache (ถ้ามี)
