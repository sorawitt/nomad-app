# Trip Planner Mini-App PRD

## 1. 🧭 Overview
- **วิสัยทัศน์:** Trip Planner แบบ mobile-first ที่ช่วยทีมท่องเที่ยววางแผน ร่วมมือ และติดตามสถานะได้ครบวงจร รวมถึงแนบหลักฐานการใช้จ่ายเพื่อสรุปทริปได้ง่าย
- **เป้าหมาย:** ภายใน 6 เดือน Home→Create Trip conversion ≥ 60%, retention วันถัดไป ≥ 40%, อัตราใช้ Today Mode ในทริปที่ active ≥ 70%, ค่าเฉลี่ยกิจกรรมที่ถูกทำเครื่องหมาย complete ≥ 3 รายการ/ทริป
- **Non-goals:** ระบบจองตั๋วหรือที่พัก, AI itinerary generator, ระบบ chat/voice, การจัดการไฟล์แนบขนาด >10MB, การแปลงอัตราแลกเปลี่ยนอัตโนมัติ
- **ตัวชี้วัดความสำเร็จ:** DAU/WAU Trip Planner, funnel Home→create_trip→add_activity, budget coverage %, error rate API < 1%, NPS หลังใช้งานครั้งที่ 3

## 2. 👤 Personas & JTBD
- **Trip Lead (25-34 ปี, ทำงานในเมืองใหญ่, ใช้มือถือเป็นหลัก):** เจ็บปวดจากการใช้สเปรดชีตหลายไฟล์ งบไม่รวมศูนย์ แชร์ itinerary ยาก  
  - **JTBD:** “เมื่อเตรียมทริปกลุ่ม ฉันต้องการรวมกิจกรรม งบ และไฟล์ที่เกี่ยวข้องไว้ที่เดียว เพื่อให้ทีมช่วยอัปเดตได้ทันที”
- **Co-traveler (23-32 ปี, เป็นผู้ร่วมเดินทาง):** ต้องการเห็นกิจกรรมวันนี้ ควบคุมค่าใช้จ่าย โปร่งใส  
  - **JTBD:** “เมื่ออยู่ระหว่างทริป ฉันต้องการดูสิ่งที่ต้องทำวันนี้ แนบหรือดูใบเสร็จ และติ๊กกิจกรรมเสร็จได้รวดเร็ว”
- **Financial Keeper (บทบาทเสริม):** ผู้รับผิดชอบจัดการค่าใช้จ่าย ต้องการสรุปและดาวน์โหลดไฟล์หลักฐานหลังจบทริป

## 3. 🎯 Scope & Release Plan
- **Must-have:** Supabase Auth, CRUD trip/day/activity, Today Mode, Budget tracker, แนบไฟล์กิจกรรม (อัปโหลด/ดู/ลบ ≤5MB), แชร์ลิงก์อ่านอย่างเดียว, skeleton/empty/error states, analytics events พื้นฐาน
- **Nice-to-have:** Collaborator editor role, เชิญเพื่อนผ่านอีเมล, Activity quick template, Google Maps deeplink พร้อมทิศทาง, Settings สำหรับ currency & analytics consent, Dark mode
- **Out-of-scope:** หลายสกุลเงินพร้อมแปลง FX, Export PDF itinerary, ปฏิทินออฟไลน์เต็มรูปแบบ, ระบบแจ้งเตือน push, การแนบไฟล์ขนาดใหญ่หรือหลายประเภทนอก image/PDF
- **Release R1 (สัปดาห์ 0-4):** Auth, Home, New Trip, Trip Detail (Day list), Today Mode พื้นฐาน, Budget summary, Attachment upload + preview จำกัด 1 ไฟล์/กิจกรรม, analytics `create_trip`, `add_activity`, `open_today`, `complete_activity`
- **Release R2 (สัปดาห์ 5-8):** Settings, Collaborator editor, Many attachments/กิจกรรม พร้อมสิทธิ์, Google Maps deeplink, แชร์ token read-only, Offline queue + conflict toast, Budget รายงานตามหมวด, analytics `upload_attachment`, `view_attachment`

## 4. 📱 UX & IA
- **IA หลัก:** `Home → Trip Detail → (Today | Days | Budget | Settings)` ด้วย bottom tab/segmented control; Attachment modal เข้าผ่าน Activity card และ Budget detail
- **Home:** รายการทริปล่าสุด, แสดงจำนวนกิจกรรมวันนี้, CTA “สร้างทริปใหม่”, empty state พร้อม illustration, skeleton cards 3 ใบ
- **New Trip:** ฟอร์ม name/date/currency, summary จำนวนวัน auto, error inline ต่อ field, future slot สำหรับ invite email (R2)
- **Trip Detail (Day list):** Timeline card ต่อวัน, badge จำนวนกิจกรรม + ค่าใช้จ่าย, ปุ่ม `+กิจกรรม`, thumbnail สำหรับกิจกรรมที่มีไฟล์แนบ, empty state “เพิ่มวันแรกของคุณ”
- **Today Mode:** Sticky header ข้อมูลทริป, list กิจกรรมวันนี้พร้อม checkbox และ quick action “แนบไฟล์/ดูไฟล์”, skeleton เป็น list bar, offline banner เมื่อ sync ค้าง
- **Budget:** Tab “ทั้งหมด” “ตามหมวด”, donut summary, รายการค่าใช้จ่ายพร้อมยอดสะสม, ปุ่ม `+ค่าใช้จ่าย`, preview ใบเสร็จ, empty state ชวนเพิ่มค่าใช้จ่ายแรก
- **Settings:** โปรไฟล์, default currency, toggle analytics consent, toggle offline cache, ปุ่ม logout
- **User Flows:**  
  - `Home → New Trip → Save → Auto-create days → Trip Detail → Add Activity → Attach file → Trip Detail`  
  - `Home → Trip Detail → Today Mode → Complete Activity → Add Expense → Upload receipt → Budget`  
  - `Home → Trip Detail → Share → Generate token → Share sheet → Recipient opens read-only view`
- **States:** Empty (ข้อความ+CTA), Loading (skeleton list/timeline), Error (toast + retry, offline banner “รอซิงก์” พร้อมปุ่ม refresh)

## 5. 🗃 Data Model (Supabase/Postgres)
- **ERD เชิงข้อความ:**  
  - `profiles` (ผู้ใช้) 1:N `trips` (ทริป)  
  - `trips` 1:N `trip_days`, `activities`, `expenses`, `activity_attachments`  
  - `trip_members` เชื่อม user กับ trip สำหรับ owner/editor  
  - `user_settings` 1:1 กับ `profiles` เพื่อเก็บ preference  
- **ตารางหลักและคอลัมน์สำคัญ:**  
  - ทุกตารางมี `id`, `created_at`, `updated_at`, และ FK เช่น `user_id/owner_id`, `trip_id`, `day_index`
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
- **RLS ตัวอย่าง:**  
```sql
CREATE POLICY "trip_owner_insert"
ON trips FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "trip_member_select"
ON trips FOR SELECT
USING (auth.uid() = owner_id OR auth.uid() IN (
  SELECT user_id FROM trip_members WHERE trip_id = trips.id
));

CREATE POLICY "activities_member_rw"
ON activities FOR ALL
USING (
  auth.uid() = (SELECT owner_id FROM trips WHERE id = activities.trip_id)
  OR auth.uid() IN (
    SELECT user_id FROM trip_members WHERE trip_id = activities.trip_id
  )
);

CREATE POLICY "attachments_member_rw"
ON activity_attachments FOR ALL
USING (
  auth.uid() = owner_id
  OR auth.uid() = (SELECT owner_id FROM trips WHERE id = activity_attachments.trip_id)
  OR auth.uid() IN (
    SELECT user_id FROM trip_members WHERE trip_id = activity_attachments.trip_id
  )
)
WITH CHECK (
  auth.uid() = owner_id
);
```

## 6. 🔐 Auth & Security
- **วิธี login:** Supabase Email Magic Link + OAuth Google, ใช้ Supabase Auth helper ใน `provider.tsx` ตรวจ session และรีเฟรช token background
- **Session:** เก็บไว้ใน Supabase client; ปกป้อง route ผ่าน router guard ตรวจ `auth.session()`; ใช้ `@supabase/supabase-js` กับ context hook
- **RLS ต่อโต๊ะ:**  
  - `profiles`, `user_settings`: `auth.uid() = id/user_id`  
  - `trips`: owner insert/update/delete, members read, editor update ใน R2  
  - `trip_days`, `activities`, `expenses`, `activity_attachments`: owner/editor CRUD; read-only สำหรับผู้ถือ shared token ผ่าน edge function  
  - `trip_members`: owner-only manage roles  
- **Supabase Storage:** bucket `trip-attachments` private; signed URL อายุ ≤ 60 วินาที; การลบ/อัปโหลดผ่าน Edge Function ตรวจสิทธิ์; ปิด public read

## 7. 🔁 Sync/Offline
- **Caching:** ใช้ IndexedDB ผ่าน localForage สำหรับ trips/days/activities/expenses/attachments metadata; fallback localStorage สำหรับสถานะ session
- **Prefetch:** ดึงรายการทริป+วันเมื่อ login; cache Today Mode เมื่อเข้า Trip Detail
- **Sync schedule:** background sync ทุก 5 นาทีหรือเมื่อกลับมาออนไลน์; ใช้ `updated_at` เพื่อเช็ค delta
- **Conflict policy:** Last-write-wins บน `updated_at`; หากมี diff ระหว่าง offline และ server ให้แจ้ง toast “มีการอัปเดตใหม่ ให้ตรวจสอบ” และแสดงไอคอน diff ในกิจกรรม/ไฟล์แนบ (R2 UI)
- **Attachment offline:** เก็บ blob ชั่วคราวใน IndexedDB พร้อม metadata; เมื่อออนไลน์อัปโหลดผ่าน signed URL แล้วอัปเดตสถานะ; ลบไฟล์ชั่วคราวหลังสำเร็จ

## 8. 🔌 Integrations
- **Google Maps:** ปุ่ม “เปิดแผนที่” บน Activity card สร้าง deeplink `https://www.google.com/maps/search/?api=1&query={lat},{lng}`; R2 เพิ่มปุ่ม “นำทาง” เปิด Google Maps App
- **แชร์ลิงก์ทริป:** สร้าง `shared_token` ใน trips; endpoint `/trip/:token` ให้สิทธิ์ read-only; ใช้ Web Share API บนมือถือ; token สามารถ revoke ผ่าน Settings

## 9. 🧪 Analytics & Telemetry
- **เครื่องมือ:** Supabase Edge Function logging หรือ PostHog self-host; config ผ่าน env
- **Events หลัก:**  
  - `create_trip` (payload: `trip_id`, `day_count`)  
  - `add_activity` (`trip_id`, `day_id`, `has_attachment`)  
  - `open_today` (`trip_id`, `activity_count`)  
  - `complete_activity` (`activity_id`, `duration_seconds`)  
  - `upload_attachment` (`activity_id`, `file_type`, `file_size`)  
  - `view_attachment` (`attachment_id`, `source`)  
- **Telemetry เสริม:** error rate Supabase, network offline duration, sync retry count

## 10. 🛠 Dev Notes
- **Stack:** Preact + TypeScript + Bun runtime (script runner) + Vite + Tailwind CSS v4 + Supabase client
- **Folder layout:**  
  - `src/app` (router, provider, layout)  
  - `src/features` (โดเมน Home, Trips, Today, Budget, Settings)  
  - `src/components` (primitives/compounds/layouts)  
  - `src/hooks`, `src/lib` (supabase client, analytics), `src/types`, `src/styles`, `src/mocks`
- **API client:** Wrapper `src/lib/supabase.ts`; hooks `useTrips`, `useTripDays`, `useActivities`, `useExpenses`, `useAttachments` ใช้ SWR/React Query พร้อม optimistic update
- **Environment:** `.env.local` ต้องกำหนด `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_VERSION`, `VITE_POSTHOG_KEY (optional)`
- **Testing:** Vitest + Testing Library Preact; mock Supabase ผ่าน MSW; snapshot UI สำหรับ skeleton/error state
- **Build/Deploy:** Bun scripts `bun run lint/test/build`; deploy frontend ผ่าน Static hosting (Netlify/Vercel) + Supabase functions สำหรับ signed URL

## 11. ⚠️ Risks & Mitigations
- **Offline conflict ทำให้ข้อมูลหาย:** แสดง warning + เก็บ `updated_at`/revision; R2 เพิ่ม diff view ก่อน merge
- **Performance บนมือถือเมื่อมีทริปใหญ่:** ใช้ list virtualization, lazy load วัน, จำกัดภาพ thumbnail ≤ 200KB
- **Shared token รั่วไหล:** Owner regenerate token และ revoke; logging การเข้าถึง token
- **Storage โตเร็ว:** จำกัดจำนวนไฟล์/กิจกรรม, แจ้ง quota ใน Settings, เพิ่ม cron ลบไฟล์ orphan
- **Analytics privacy:** เคารพ toggle consent, ไม่เก็บข้อมูลส่วนบุคคลใน payload

## 12. 📅 Milestones & Acceptance Criteria
- **Milestone 1 (สัปดาห์ 2):** Auth + Home + New Trip + analytics `create_trip`  
  - **AC:** ผู้ใช้ใหม่ login สร้างทริปแรกได้บนมือถือภายใน 2 นาที
- **Milestone 2 (สัปดาห์ 4):** Trip Detail + Today Mode + Budget summary + single attachment  
  - **AC:** เพิ่มกิจกรรม/ค่าใช้จ่ายได้, แนบใบเสร็จและดูภาพได้, Today Mode แสดงเฉพาะกิจกรรมวันนี้
- **Milestone 3 (สัปดาห์ 6):** Settings + Offline cache + แชร์ลิงก์อ่านอย่างเดียว  
  - **AC:** เปิดโหมด offline แล้วอ่านข้อมูลล่าสุดได้, token แชร์ใช้ได้และ revoke ได้
- **Milestone 4 (สัปดาห์ 8):** Collaborator editor + Maps deeplink + conflict alert + multi-attachment  
  - **AC:** Editor เพิ่มกิจกรรม/แนบไฟล์ได้, deeplink เปิดแผนที่, มีการแจ้งเตือนเมื่อเกิด conflict จากการ sync

## Open Questions
- ต้องการรองรับหลายภาษาใน UI ตั้งแต่ R1 หรือเริ่มเฉพาะไทย/อังกฤษ?
- ขนาดไฟล์แนบสูงสุดควรเป็นเท่าไร และจำเป็นต้องรองรับ PDF/HEIC เพิ่มเติมหรือไม่?
- สิทธิ์ editor ควรแก้ไข/ลบค่าใช้จ่ายและไฟล์แนบได้หรือจำกัดเฉพาะ owner?
- ต้องมีรายงาน export (CSV/PDF) สำหรับสรุปค่าใช้จ่ายและไฟล์แนบหรือไม่?
- จำเป็นต้องมีระบบแจ้งเตือน push/email สำหรับกิจกรรมล่วงหน้าหรือเตือนค่าใช้จ่ายหรือไม่?
