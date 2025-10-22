# Task: Collaborator Editor - เชิญผู้ร่วมทริป

## Context
สร้างระบบเชิญ editor เข้าร่วมทริป โดย owner สามารถเชิญผ่านอีเมล และ editor มีสิทธิ์ CRUD กิจกรรม/ค่าใช้จ่าย/ไฟล์ (แต่ไม่สามารถจัดการสมาชิกได้) พร้อมแสดงรายการสมาชิกและ role

## Tech Stack
- **Preact + TypeScript**: Component และ Type Safety
- **TanStack Query**: Data fetching, mutations
- **Supabase**: Database, Edge Functions, Email
- **Tailwind CSS v4**: Styling (mobile-first)

## Requirements

### Functional Requirements
- Owner เชิญ editor ผ่านอีเมล
- ส่งอีเมลแจ้งเตือนผู้รับเชิญ (Supabase Email)
- Editor มีสิทธิ์: CRUD activities, expenses, attachments
- แสดงรายการสมาชิก + role (owner/editor)
- Owner ลบ editor ได้ (confirm dialog)
- Editor ไม่สามารถลบตัวเองหรือ owner ได้
- Analytics: `add_member`, `remove_member`

### Roles & Permissions
```typescript
type Role = 'owner' | 'editor';

// Permissions:
// owner: จัดการทุกอย่างรวมถึงสมาชิก
// editor: CRUD activities/expenses/attachments, ดูสมาชิก (แต่ไม่สามารถเพิ่ม/ลบได้)
```

## Step-by-Step Implementation

### Step 1: Database Migration

สร้างตาราง `trip_members` และแก้ไข RLS policies

**File: `supabase/migrations/007_trip_members.sql`**

```sql
-- ตาราง trip_members
CREATE TABLE trip_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor')),
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_trip_member UNIQUE (trip_id, user_id)
);

-- Index
CREATE INDEX idx_trip_members_trip ON trip_members(trip_id);
CREATE INDEX idx_trip_members_user ON trip_members(user_id);

-- RLS Enable
ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;

-- Policy: สมาชิกดูสมาชิกของทริปตัวเองได้
CREATE POLICY "Members can view trip members"
  ON trip_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trip_members tm
      WHERE tm.trip_id = trip_members.trip_id
        AND tm.user_id = auth.uid()
    )
  );

-- Policy: เฉพาะ owner เพิ่มสมาชิกได้
CREATE POLICY "Owner can insert members"
  ON trip_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip_members tm
      WHERE tm.trip_id = trip_members.trip_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'owner'
    )
  );

-- Policy: เฉพาะ owner ลบสมาชิกได้
CREATE POLICY "Owner can delete members"
  ON trip_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trip_members tm
      WHERE tm.trip_id = trip_members.trip_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'owner'
    )
  );

-- ฟังก์ชัน: สร้าง trip_member (owner) อัตโนมัติเมื่อสร้าง trip
CREATE OR REPLACE FUNCTION create_trip_owner_member()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO trip_members (trip_id, user_id, role, accepted_at)
  VALUES (NEW.id, NEW.owner_id, 'owner', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_trip_insert
  AFTER INSERT ON trips
  FOR EACH ROW
  EXECUTE FUNCTION create_trip_owner_member();

-- แก้ไข RLS policies ใน activities, expenses, attachments
-- (ให้ editor สามารถ CRUD ได้)

-- Example: activities table
DROP POLICY IF EXISTS "Owner/Editor can insert activities" ON activities;
CREATE POLICY "Owner/Editor can insert activities"
  ON activities FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip_members tm
      WHERE tm.trip_id = activities.trip_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'editor')
    )
  );

DROP POLICY IF EXISTS "Owner/Editor can update activities" ON activities;
CREATE POLICY "Owner/Editor can update activities"
  ON activities FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM trip_members tm
      WHERE tm.trip_id = activities.trip_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'editor')
    )
  );

DROP POLICY IF EXISTS "Owner/Editor can delete activities" ON activities;
CREATE POLICY "Owner/Editor can delete activities"
  ON activities FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trip_members tm
      WHERE tm.trip_id = activities.trip_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'editor')
    )
  );

-- ทำซ้ำกับ expenses และ activity_attachments (ถ้ามี)
```

**Run migration:**
```bash
supabase db push
```

---

### Step 2: Edge Function - Invite Member

สร้าง edge function สำหรับเชิญสมาชิก + ส่งอีเมล

**File: `supabase/functions/invite-member/index.ts`**

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { trip_id, email } = await req.json();

    if (!trip_id || !email) {
      return new Response(
        JSON.stringify({ error: 'trip_id and email are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // สร้าง Supabase client
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // ตรวจสอบว่า user คือ owner หรือไม่
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: member, error: memberError } = await supabase
      .from('trip_members')
      .select('role')
      .eq('trip_id', trip_id)
      .eq('user_id', user.id)
      .single();

    if (memberError || member?.role !== 'owner') {
      return new Response(
        JSON.stringify({ error: 'Only owner can invite members' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ดึงข้อมูล trip
    const { data: trip } = await supabase
      .from('trips')
      .select('id, title')
      .eq('id', trip_id)
      .single();

    // หาผู้ใช้ที่ต้องการเชิญ
    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: invitedUser } = await serviceSupabase.auth.admin.listUsers();
    const targetUser = invitedUser.users.find(u => u.email === email);

    if (!targetUser) {
      return new Response(
        JSON.stringify({ error: 'User not found. They need to sign up first.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ตรวจสอบว่าเป็นสมาชิกอยู่แล้วหรือไม่
    const { data: existingMember } = await supabase
      .from('trip_members')
      .select('id')
      .eq('trip_id', trip_id)
      .eq('user_id', targetUser.id)
      .maybeSingle();

    if (existingMember) {
      return new Response(
        JSON.stringify({ error: 'User is already a member' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // เพิ่มสมาชิก
    const { data: newMember, error: insertError } = await supabase
      .from('trip_members')
      .insert({
        trip_id,
        user_id: targetUser.id,
        role: 'editor',
        invited_by: user.id,
        accepted_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // ส่งอีเมลแจ้งเตือน (optional)
    // ใช้ Supabase Email หรือ SendGrid/Resend
    // Example: await sendInviteEmail(email, trip.title, user.email);

    return new Response(
      JSON.stringify({ success: true, member: newMember }),
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
supabase functions deploy invite-member
```

---

### Step 3: Type Definitions

**File: `src/types/member.ts`**

```typescript
export type MemberRole = 'owner' | 'editor';

export interface TripMember {
  id: string;
  trip_id: string;
  user_id: string;
  role: MemberRole;
  invited_by: string | null;
  invited_at: string;
  accepted_at: string | null;
  created_at: string;
  // Joined fields
  user_email?: string;
  user_display_name?: string;
}

export interface InviteMemberInput {
  trip_id: string;
  email: string;
}
```

---

### Step 4: Hooks - useTripMembers

**File: `src/hooks/useTripMembers.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { TripMember } from '@/types/member';

export function useTripMembers(tripId: string) {
  return useQuery({
    queryKey: ['trip-members', tripId],
    queryFn: async (): Promise<TripMember[]> => {
      const { data, error } = await supabase
        .from('trip_members')
        .select(`
          *,
          user:profiles!user_id(email, display_name)
        `)
        .eq('trip_id', tripId)
        .order('created_at');

      if (error) throw error;

      return data.map(member => ({
        ...member,
        user_email: member.user?.email,
        user_display_name: member.user?.display_name
      }));
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
```

---

### Step 5: Hooks - useInviteMember

**File: `src/hooks/useInviteMember.ts`**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { InviteMemberInput, TripMember } from '@/types/member';
import { trackEvent } from '@/lib/analytics';

export function useInviteMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: InviteMemberInput): Promise<TripMember> => {
      const { data, error } = await supabase.functions.invoke('invite-member', {
        body: input
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data.member;
    },
    onSuccess: (member) => {
      queryClient.invalidateQueries({ queryKey: ['trip-members', member.trip_id] });

      trackEvent('add_member', {
        trip_id: member.trip_id,
        role: member.role
      });
    }
  });
}
```

---

### Step 6: Hooks - useRemoveMember

**File: `src/hooks/useRemoveMember.ts`**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { TripMember } from '@/types/member';
import { trackEvent } from '@/lib/analytics';

export function useRemoveMember(tripId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memberId: string): Promise<void> => {
      const { error } = await supabase
        .from('trip_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
    },
    onMutate: async (memberId) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['trip-members', tripId] });

      const previousMembers = queryClient.getQueryData<TripMember[]>(['trip-members', tripId]);

      if (previousMembers) {
        queryClient.setQueryData<TripMember[]>(
          ['trip-members', tripId],
          previousMembers.filter(m => m.id !== memberId)
        );
      }

      return { previousMembers };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousMembers) {
        queryClient.setQueryData(['trip-members', tripId], context.previousMembers);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip-members', tripId] });

      trackEvent('remove_member', {
        trip_id: tripId
      });
    }
  });
}
```

---

### Step 7: Hook - useTripMember (Current User Role)

**File: `src/hooks/useTripMember.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { TripMember } from '@/types/member';

export function useTripMember(tripId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['trip-member', tripId, user?.id],
    queryFn: async (): Promise<TripMember | null> => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('trip_members')
        .select('*')
        .eq('trip_id', tripId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
```

---

### Step 8: Component - MembersSection

**File: `src/components/trip/MembersSection.tsx`**

```typescript
import { useState } from 'preact/hooks';
import { useTripMembers } from '@/hooks/useTripMembers';
import { useTripMember } from '@/hooks/useTripMember';
import { useRemoveMember } from '@/hooks/useRemoveMember';
import { InviteMemberModal } from './InviteMemberModal';
import type { TripMember } from '@/types/member';

interface Props {
  tripId: string;
}

export function MembersSection({ tripId }: Props) {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const { data: members, isLoading } = useTripMembers(tripId);
  const { data: currentMember } = useTripMember(tripId);
  const removeMutation = useRemoveMember(tripId);

  const isOwner = currentMember?.role === 'owner';

  const handleRemove = async (member: TripMember) => {
    if (member.role === 'owner') {
      alert('ไม่สามารถลบ owner ได้');
      return;
    }

    if (!confirm(`ต้องการลบ ${member.user_email || 'สมาชิก'} ?`)) return;

    try {
      await removeMutation.mutateAsync(member.id);
    } catch (error) {
      alert('ไม่สามารถลบสมาชิกได้');
    }
  };

  if (isLoading) {
    return (
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <div class="h-6 bg-gray-200 rounded animate-pulse w-24 mb-4" />
        <div class="space-y-3">
          <div class="h-12 bg-gray-200 rounded animate-pulse" />
          <div class="h-12 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-gray-900">สมาชิก ({members?.length || 0})</h2>
          {isOwner && (
            <button
              onClick={() => setShowInviteModal(true)}
              class="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              + เชิญสมาชิก
            </button>
          )}
        </div>

        <div class="space-y-3">
          {members?.map(member => (
            <div
              key={member.id}
              class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span class="text-sm font-medium text-blue-600">
                    {member.user_display_name?.[0]?.toUpperCase() || member.user_email?.[0]?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <div class="font-medium text-gray-900">
                    {member.user_display_name || member.user_email}
                  </div>
                  {member.user_display_name && (
                    <div class="text-xs text-gray-500">{member.user_email}</div>
                  )}
                </div>
              </div>

              <div class="flex items-center gap-3">
                <span
                  class={`
                    px-2 py-1 rounded text-xs font-medium
                    ${member.role === 'owner'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-green-100 text-green-700'
                    }
                  `}
                >
                  {member.role === 'owner' ? 'เจ้าของ' : 'แก้ไขได้'}
                </span>

                {isOwner && member.role !== 'owner' && (
                  <button
                    onClick={() => handleRemove(member)}
                    disabled={removeMutation.isPending}
                    class="text-red-500 hover:text-red-600 disabled:opacity-50"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showInviteModal && (
        <InviteMemberModal
          tripId={tripId}
          onClose={() => setShowInviteModal(false)}
        />
      )}
    </>
  );
}
```

---

### Step 9: Component - InviteMemberModal

**File: `src/components/trip/InviteMemberModal.tsx`**

```typescript
import { useState } from 'preact/hooks';
import { useInviteMember } from '@/hooks/useInviteMember';

interface Props {
  tripId: string;
  onClose: () => void;
}

export function InviteMemberModal({ tripId, onClose }: Props) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const inviteMutation = useInviteMember();

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('กรุณากรอกอีเมล');
      return;
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('รูปแบบอีเมลไม่ถูกต้อง');
      return;
    }

    try {
      await inviteMutation.mutateAsync({ trip_id: tripId, email: email.trim() });
      onClose();
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถเชิญสมาชิกได้');
    }
  };

  return (
    <div class="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
      <div class="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md">
        {/* Header */}
        <div class="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900">เชิญสมาชิก</h2>
          <button
            onClick={onClose}
            class="text-gray-400 hover:text-gray-600"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} class="p-6 space-y-5">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              อีเมล
            </label>
            <input
              type="email"
              value={email}
              onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
              placeholder="example@email.com"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <p class="text-xs text-gray-500 mt-2">
              ผู้รับเชิญต้องลงทะเบียนในระบบก่อน
            </p>
          </div>

          {error && (
            <div class="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={inviteMutation.isPending}
            class="w-full bg-blue-500 text-white py-3 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {inviteMutation.isPending ? 'กำลังเชิญ...' : 'เชิญ'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

---

## Testing Checklist

- [ ] Owner เชิญ editor ผ่านอีเมล → สำเร็จ
- [ ] Editor ปรากฏในรายการสมาชิก
- [ ] Editor มีสิทธิ์ CRUD activities/expenses/attachments
- [ ] Editor ไม่สามารถเชิญ/ลบสมาชิกได้
- [ ] Owner ลบ editor → หายจากรายการ
- [ ] เชิญซ้ำ → error "already a member"
- [ ] เชิญอีเมลที่ไม่มีในระบบ → error "user not found"
- [ ] RLS: editor อ่านรายการสมาชิกได้ แต่ไม่สามารถลบได้
- [ ] Analytics: `add_member`, `remove_member` tracked
- [ ] Optimistic update → ลบทันที, error → rollback

---

## Best Practices

### 1. Unique Constraint
```sql
-- ✅ Prevent duplicate members
CONSTRAINT unique_trip_member UNIQUE (trip_id, user_id)
```

### 2. Auto-create Owner Member
```sql
-- ✅ Trigger to auto-add owner when trip is created
CREATE TRIGGER after_trip_insert
  AFTER INSERT ON trips
  FOR EACH ROW
  EXECUTE FUNCTION create_trip_owner_member();
```

### 3. Role-based RLS
```sql
-- ✅ Editor can CRUD activities
CREATE POLICY "Owner/Editor can insert activities"
  ON activities FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_id = activities.trip_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'editor')
    )
  );
```

### 4. Edge Function Validation
```typescript
// ✅ Verify owner before inviting
const { data: member } = await supabase
  .from('trip_members')
  .select('role')
  .eq('trip_id', trip_id)
  .eq('user_id', user.id)
  .single();

if (member?.role !== 'owner') {
  throw new Error('Only owner can invite members');
}
```

### 5. Optimistic Remove
```typescript
// ✅ Optimistic update with rollback
onMutate: async (memberId) => {
  const previous = queryClient.getQueryData(['trip-members', tripId]);
  queryClient.setQueryData(['trip-members', tripId],
    previous.filter(m => m.id !== memberId)
  );
  return { previous };
},
onError: (err, vars, context) => {
  queryClient.setQueryData(['trip-members', tripId], context.previous);
}
```

---

## Common Issues

### Issue: เชิญอีเมลไม่มีในระบบ
```typescript
// Solution: ตรวจสอบ user ก่อน
const { data: users } = await supabase.auth.admin.listUsers();
const targetUser = users.users.find(u => u.email === email);

if (!targetUser) {
  throw new Error('User not found. They need to sign up first.');
}
```

### Issue: Editor ลบตัวเองได้
```sql
-- ✅ Policy: เฉพาะ owner ลบได้
CREATE POLICY "Owner can delete members"
  ON trip_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trip_members tm
      WHERE tm.trip_id = trip_members.trip_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'owner'
    )
  );
```

### Issue: Owner ลบตัวเองได้
```typescript
// ✅ Check role before remove
if (member.role === 'owner') {
  alert('ไม่สามารถลบ owner ได้');
  return;
}
```

---

## Advanced: Email Notification (Optional)

หากต้องการส่งอีเมลแจ้งเตือน ใช้ Resend/SendGrid:

```bash
bun add resend
```

**File: `supabase/functions/invite-member/index.ts`** (ส่วนเพิ่ม)

```typescript
import { Resend } from 'https://esm.sh/resend@2';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

async function sendInviteEmail(toEmail: string, tripTitle: string, inviterEmail: string) {
  await resend.emails.send({
    from: 'noreply@yourapp.com',
    to: toEmail,
    subject: `คุณได้รับเชิญเข้าร่วมทริป: ${tripTitle}`,
    html: `
      <p>${inviterEmail} เชิญคุณเข้าร่วมทริป "${tripTitle}"</p>
      <p><a href="${Deno.env.get('APP_URL')}/trips/${tripId}">เปิดทริป</a></p>
    `
  });
}

// เรียกหลังเพิ่มสมาชิกสำเร็จ
await sendInviteEmail(email, trip.title, user.email);
```

---

## Notes

- **trip_members table**: เก็บ mapping ระหว่าง user กับ trip + role
- **Auto-create owner**: ใช้ trigger สร้าง owner member อัตโนมัติเมื่อสร้าง trip
- **RLS**: editor มีสิทธิ์ CRUD activities/expenses/attachments แต่ไม่สามารถจัดการสมาชิกได้
- **Edge Function**: ใช้สำหรับ validate + ส่งอีเมล (ไม่สามารถทำที่ client ได้)
- **Email**: ต้องมีการส่งอีเมลแจ้งเตือน (optional) ด้วย Resend/SendGrid
- **Service Role**: ใช้ใน edge function เพื่อ list users (auth.admin.listUsers)
