# Trip Planner Mini-App PRD

## Overview

**Vision:** Mobile-first trip planner ช่วยทีมท่องเที่ยววางแผน ร่วมมือ ติดตามสถานะ และแนบหลักฐานค่าใช้จ่าย

**Goals (6 เดือน):**
- Home → Create Trip conversion ≥ 60%
- Retention วันถัดไป ≥ 40%
- Today Mode usage ≥ 70% ในทริปที่ active
- กิจกรรมที่ complete เฉลี่ย ≥ 3 รายการ/ทริป

**Key Metrics:**
- DAU/WAU ratio
- Funnel: Home → create_trip → add_activity
- Budget coverage %
- API error rate < 1%
- NPS หลังใช้งานครั้งที่ 3

**Out of Scope:**
- จองตั๋ว/ที่พัก
- AI itinerary generator
- Chat/voice
- ไฟล์แนบ >10MB
- แปลงอัตราแลกเปลี่ยนอัตโนมัติ

## Personas & Jobs-to-be-Done

### Trip Lead (25-34 ปี, mobile-first)
**Pain Points:** สเปรดชีตกระจัด งบไม่รวมศูนย์ แชร์ยาก

**JTBD:** "รวมกิจกรรม งบ และไฟล์ไว้ที่เดียว ให้ทีมช่วยอัปเดตได้ทันที"

### Co-traveler (23-32 ปี)
**Pain Points:** ไม่รู้กิจกรรมวันนี้ ไม่แน่ใจค่าใช้จ่าย

**JTBD:** "ดูกิจกรรมวันนี้ แนบใบเสร็จ และติ๊กกิจกรรมเสร็จได้รวดเร็ว"

### Financial Keeper
**Pain Points:** สรุปค่าใช้จ่ายยาก ไฟล์หลักฐานกระจัด

**JTBD:** "สรุปและดาวน์โหลดหลักฐานหลังจบทริป"

## Scope & Release Plan

### Must-Have (R1)
- Supabase Auth (Magic Link + Google OAuth)
- CRUD: trip, day, activity
- Today Mode
- Budget tracker
- Attachment: อัปโหลด/ดู/ลบ ≤5MB (1 ไฟล์/กิจกรรม)
- Share link (read-only)
- UI states: skeleton, empty, error
- Analytics: `create_trip`, `add_activity`, `open_today`, `complete_activity`

### Nice-to-Have (R2)
- Collaborator editor
- เชิญผ่านอีเมล
- Activity template
- Google Maps deeplink
- Settings: currency, analytics consent
- Dark mode
- Multi-attachments พร้อมสิทธิ์
- Offline queue + conflict alert
- Budget ตามหมวด

### Release Timeline
**R1 (สัปดาห์ 0-4):** Auth → Home → Create Trip → Trip Detail → Today Mode → Budget → Attachment (single)

**R2 (สัปดาห์ 5-8):** Settings → Collaborators → Multi-attachments → Maps → Offline sync → Conflict resolution

## UX & Information Architecture

### Navigation
`Home → Trip Detail → (Today | Days | Budget | Settings)`

Bottom tab/segmented control สำหรับ mobile

### Screen Specs

**Home**
- รายการทริปล่าสุด + จำนวนกิจกรรมวันนี้
- CTA "สร้างทริปใหม่"
- States: skeleton (3 cards), empty state

**New Trip**
- Fields: name, date range, currency
- Auto summary จำนวนวัน
- Inline validation

**Trip Detail (Day List)**
- Timeline cards ต่อวัน
- Badge: จำนวนกิจกรรม + ค่าใช้จ่าย
- ปุ่ม `+กิจกรรม`
- Thumbnail ไฟล์แนบ

**Today Mode**
- Sticky header ข้อมูลทริป
- List กิจกรรมวันนี้ + checkbox
- Quick action: แนบไฟล์/ดูไฟล์
- Offline banner เมื่อ sync ค้าง

**Budget**
- Tab: ทั้งหมด | ตามหมวด
- Summary + donut chart
- รายการค่าใช้จ่าย + ยอดสะสม
- Preview ใบเสร็จ

**Settings**
- โปรไฟล์
- Default currency
- Toggle: analytics consent, offline cache
- Logout

### Key User Flows

1. **Create Trip:** Home → New Trip → Save → Auto-create days → Trip Detail
2. **Track Activity:** Trip Detail → Add Activity → Attach file → Complete
3. **Share Trip:** Trip Detail → Share → Generate token → Recipient views (read-only)

### UI States
- **Empty:** ข้อความ + CTA
- **Loading:** Skeleton list/timeline
- **Error:** Toast + retry button
- **Offline:** Banner "รอซิงก์" + refresh button

## Data Model

### Entity Relationships
- `profiles` 1:N `trips`
- `trips` 1:N `trip_days`, `activities`, `expenses`, `activity_attachments`
- `trip_members` (join table) → owner/editor สำหรับ collaboration
- `user_settings` 1:1 `profiles`

### Schema Notes
- ทุกตารางมี: `id` (uuid), `created_at`, `updated_at`
- Foreign keys: `user_id`, `owner_id`, `trip_id`, `day_id`
```sql
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  display_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES profiles(id),
  title text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  currency_code text DEFAULT 'THB',
  shared_token text UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX trips_owner_idx ON trips(owner_id);

CREATE TABLE trip_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role text CHECK (role IN ('owner','editor')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (trip_id, user_id)
);
CREATE INDEX trip_members_user_idx ON trip_members(user_id);

CREATE TABLE trip_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  day_index integer NOT NULL,
  date date NOT NULL,
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (trip_id, day_index)
);
CREATE INDEX trip_days_trip_idx ON trip_days(trip_id);

CREATE TABLE activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  day_id uuid REFERENCES trip_days(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  start_time timestamptz,
  end_time timestamptz,
  location_name text,
  location_lat double precision,
  location_lng double precision,
  status text DEFAULT 'pending',
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX activities_day_idx ON activities(day_id);
CREATE INDEX activities_trip_idx ON activities(trip_id);

CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  day_id uuid REFERENCES trip_days(id) ON DELETE SET NULL,
  category text,
  amount numeric(12,2) NOT NULL,
  currency_code text,
  paid_by uuid REFERENCES profiles(id),
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX expenses_trip_idx ON expenses(trip_id);
CREATE INDEX expenses_day_idx ON expenses(day_id);

CREATE TABLE activity_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES activities(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES profiles(id),
  file_name text NOT NULL,
  file_size integer NOT NULL CHECK (file_size <= 10 * 1024 * 1024),
  file_type text NOT NULL,
  storage_path text NOT NULL,
  thumbnail_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX activity_attachments_activity_idx ON activity_attachments(activity_id);
CREATE INDEX activity_attachments_trip_idx ON activity_attachments(trip_id);

CREATE TABLE user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  default_currency text DEFAULT 'THB',
  notifications_enabled boolean DEFAULT true,
  offline_cache_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX user_settings_user_idx ON user_settings(user_id);
```
### RLS Examples

**trips**
```sql
-- Owner สามารถ insert
CREATE POLICY "trip_owner_insert" ON trips FOR INSERT
WITH CHECK (auth.uid() = owner_id);

-- Owner + members อ่านได้
CREATE POLICY "trip_member_select" ON trips FOR SELECT
USING (auth.uid() = owner_id OR auth.uid() IN (
  SELECT user_id FROM trip_members WHERE trip_id = trips.id
));
```

**activities**
```sql
-- Owner + editors ทำ CRUD ได้
CREATE POLICY "activities_member_rw" ON activities FOR ALL
USING (
  auth.uid() = (SELECT owner_id FROM trips WHERE id = activities.trip_id)
  OR auth.uid() IN (
    SELECT user_id FROM trip_members WHERE trip_id = activities.trip_id
  )
);
```

## Auth & Security

### Authentication
- **Methods:** Email Magic Link + Google OAuth
- **Session:** Supabase client + router guard
- **Implementation:** `AuthProvider` ใน `provider.tsx`

### Row Level Security (RLS)

| Table | Policy |
|-------|--------|
| `profiles`, `user_settings` | `auth.uid() = user_id` |
| `trips` | Owner: CRUD / Members: Read / Editor: Update (R2) |
| `activities`, `expenses` | Owner + Editor: CRUD / Shared token: Read (via edge function) |
| `trip_members` | Owner-only manage |

### Storage Security
- Bucket: `trip-attachments` (private)
- Signed URL: อายุ ≤ 60 วินาที
- Upload/delete: ผ่าน Edge Function ตรวจสิทธิ์

## Offline & Sync Strategy

### Caching
- **Storage:** IndexedDB (via localForage)
- **Data:** trips, days, activities, expenses, attachments metadata
- **Session:** localStorage fallback

### Sync Behavior
- **Prefetch:** ทริป + วันที่ login; Today Mode เมื่อเข้า Trip Detail
- **Schedule:** ทุก 5 นาที หรือเมื่อกลับออนไลน์
- **Delta:** ใช้ `updated_at` เช็คความเปลี่ยนแปลง

### Conflict Resolution
- **Policy:** Last-write-wins (ตาม `updated_at`)
- **UI:** Toast "มีการอัปเดตใหม่" + ไอคอน diff (R2)

### Attachment Offline
1. เก็บ blob ชั่วคราวใน IndexedDB + metadata
2. เมื่อออนไลน์ → อัปโหลดผ่าน signed URL
3. อัปเดตสถานะ → ลบไฟล์ชั่วคราว

## Integrations

### Google Maps
- ปุ่ม "เปิดแผนที่" บน Activity card
- Deeplink: `https://www.google.com/maps/search/?api=1&query={lat},{lng}`
- R2: ปุ่ม "นำทาง" เปิด Google Maps App

### Trip Sharing
- สร้าง `shared_token` ใน trips table
- Endpoint: `/trip/:token` (read-only)
- Web Share API สำหรับ mobile
- Revoke token ผ่าน Settings

## Analytics & Telemetry

### Tools
- Supabase Edge Function logging / PostHog self-host
- Config: environment variables

### Core Events

| Event | Payload |
|-------|---------|
| `create_trip` | `trip_id`, `day_count` |
| `add_activity` | `trip_id`, `day_id`, `has_attachment` |
| `open_today` | `trip_id`, `activity_count` |
| `complete_activity` | `activity_id`, `duration_seconds` |
| `upload_attachment` | `activity_id`, `file_type`, `file_size` |
| `view_attachment` | `attachment_id`, `source` |

### System Telemetry
- API error rate
- Offline duration
- Sync retry count

## Development Setup

### Tech Stack
- **Frontend:** Preact + TypeScript + Vite + Tailwind CSS v4
- **Backend:** Supabase (Auth, DB, Storage, Edge Functions)
- **Runtime:** Bun

### Project Structure
```
src/
├── app/          # router, provider, layout
├── features/     # Home, Trips, Today, Budget, Settings
├── components/   # primitives, compounds, layouts
├── hooks/        # custom hooks
├── lib/          # supabase client, analytics
├── types/        # TypeScript types
└── styles/       # global styles
```

### Data Hooks
- `useTrips`, `useTripDays`, `useActivities`, `useExpenses`, `useAttachments`
- Library: SWR / React Query
- Pattern: Optimistic updates

### Environment Variables
```bash
VITE_SUPABASE_URL=<url>
VITE_SUPABASE_ANON_KEY=<key>
VITE_APP_VERSION=<version>
VITE_POSTHOG_KEY=<key>  # optional
```

### Testing
- **Unit:** Vitest + Testing Library Preact
- **Mocks:** MSW สำหรับ Supabase
- **Snapshot:** Skeleton/error states

### Build & Deploy
- **Scripts:** `bun run lint/test/build`
- **Hosting:** Netlify/Vercel (static)
- **Functions:** Supabase Edge Functions

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **Offline conflict → data loss** | Warning toast + `updated_at` tracking; R2: diff view |
| **Performance บนมือถือ (large trips)** | List virtualization, lazy load, thumbnail ≤ 200KB |
| **Shared token รั่วไหล** | Regenerate/revoke token, access logging |
| **Storage quota** | จำกัดไฟล์/กิจกรรม, quota warning, cron ลบ orphan files |
| **Analytics privacy** | Consent toggle, ไม่เก็บข้อมูลส่วนบุคคล |

## Milestones & Acceptance Criteria

### M1 (สัปดาห์ 2): Auth + Home + Create Trip
**AC:** ผู้ใช้ใหม่ login → สร้างทริปแรกได้บนมือถือภายใน 2 นาที

### M2 (สัปดาห์ 4): Trip Detail + Today + Budget + Attachment
**AC:** เพิ่มกิจกรรม/ค่าใช้จ่ายได้, แนบใบเสร็จ, Today Mode แสดงกิจกรรมวันนี้

### M3 (สัปดาห์ 6): Settings + Offline + Share
**AC:** Offline mode อ่านข้อมูลได้, share token ใช้งานได้ + revoke ได้

### M4 (สัปดาห์ 8): Collaborators + Maps + Conflict + Multi-attachments
**AC:** Editor เพิ่มกิจกรรม/ไฟล์ได้, Maps deeplink ทำงาน, conflict alert แสดงถูกต้อง

---

## Open Questions
1. รองรับหลายภาษาใน R1 หรือเริ่มที่ TH/EN?
2. ขนาดไฟล์แนบสูงสุด? รองรับ PDF/HEIC?
3. Editor แก้ไข/ลบค่าใช้จ่ายและไฟล์แนบได้หรือไม่?
4. ต้องการ export (CSV/PDF) สำหรับสรุปค่าใช้จ่าย?
5. ต้องการ push/email notification?
