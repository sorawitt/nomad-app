# Trip Planner User Stories & Tasks

## Milestone 1: Auth, Home, New Trip, Analytics

### [M1-S1] ล็อกอินด้วย Magic Link หรือ Google

**Personas:** Trip Lead, Co-traveler

**Acceptance Criteria:**
1. กรอกอีเมลและได้รับ Magic Link
2. Login ด้วย Google OAuth สำเร็จ
3. Session persist หลัง refresh
4. แสดง error เมื่อลิงก์หมดอายุ

**Tasks:**
- **FE: Auth Screen (mobile-first)**
  - Component: `AuthScreen.tsx` ใน `src/features/auth`
  - ฟอร์ม email + validation
  - ปุ่ม Magic Link และ Google OAuth
  - เชื่อม `auth.signInWithOtp` + `auth.signInWithOAuth`
  - แสดง toast + redirect หลังสำเร็จ

- **FE: Session management + route guard**
  - `AuthProvider` ใน `provider.tsx`
  - Hook `useAuth()` คืนค่า `{ user, session, signIn, signOut }`
  - Router guard ป้องกันหน้าหลักสำหรับผู้ที่ไม่ login

- **BE: Supabase Auth setup**
  - เปิด Email (Magic Link) + Google OAuth ใน dashboard
  - ตั้ง redirect URL ให้ตรงกับ dev/prod
  - Config `.env.local`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

- **QA: End-to-end testing**
  - ทดสอบ login ด้วยอีเมล + Google บน desktop/mobile
  - ตรวจ session persist หลัง refresh
  - ทดสอบ error cases

---

### [M1-S2] หน้า Home แสดงรายการทริป

**Acceptance Criteria:**
1. แสดง Trip list เรียงตาม `updated_at`
2. Empty state + CTA "สร้างทริปใหม่"
3. Loading state: skeleton 3 cards
4. Analytics: `open_home`

**Tasks:**
- **FE: TripList component**
  - Component: `TripList` พร้อม skeleton/empty/error states
  - Card แสดงชื่อทริป, วันที่, จำนวนกิจกรรม
  - แตะการ์ดเพื่อเปิด Trip Detail

- **FE: Hook `useTrips`**
  - ใช้ React Query/SWR เรียก `listTrips`
  - จัดการ error ด้วย toast + retry
  - ส่ง event `open_home` เมื่อโหลดสำเร็จ

- **BE: View `trips_view`**
  - SQL view รวม trips ที่ owner + member
  - Index: `updated_at`
  - RLS ตามสิทธิ์

- **QA: Testing**
  - ทดสอบ owner/member, empty state
  - จำลอง network error

---

### [M1-S3] สร้างทริปใหม่

**Acceptance Criteria:**
1. กรอกชื่อ, วันที่เริ่ม/จบ, บันทึกสำเร็จ
2. สร้าง `trip_days` อัตโนมัติ
3. Redirect ไป Trip Detail
4. Analytics: `create_trip` พร้อม `trip_id`, `day_count`

**Tasks:**
- **FE: ฟอร์ม NewTrip + validation**
  - ฟอร์มกรอก: ชื่อ, วันที่, currency
  - Validation: ชื่อไม่ว่าง, วันเริ่ม ≤ วันจบ
  - Toast สำเร็จ + clear form

- **FE: Mutation `createTrip`**
  - React Query `useMutation` เรียก `createTrip`
  - Invalidate `['trips']` + redirect
  - ส่ง analytics `create_trip`

- **BE: RPC/Edge function**
  - ฟังก์ชันสร้าง `trips` + loop สร้าง `trip_days`
  - Trigger: อัปเดต `updated_at` อัตโนมัติ
  - ทดสอบผ่าน SQL editor

- **QA: Edge cases**
  - วันที่ผิดลำดับ → error message
  - ตรวจ `trip_days` สร้างถูกต้อง
  - Analytics ส่งครั้งเดียว

---

### [M1-S4] Trip Detail แสดง Day list

**Acceptance Criteria:**
1. แสดงวันทั้งหมดตามลำดับ
2. วันละการ์ดแสดงจำนวนกิจกรรม
3. ปุ่ม `+กิจกรรม` (placeholder)
4. Error state + retry

**Tasks:**
- **FE: Layout Trip Detail + DayCard**
  - Header: ชื่อทริป + ช่วงวันที่
  - `DayCard`: วันที่, จำนวนกิจกรรม, ปุ่มดูรายละเอียด
  - Empty state

- **FE: Hook `useTripDays`**
  - React Query เรียก `trip_days` พร้อม count
  - Skeleton timeline, error + retry
  - Cache: `['trip-days', tripId]`

- **BE: Query + index**
  - Index: `trip_id, day_index`
  - Select: `*, activities(count)`
  - RLS: member อ่านได้

- **QA: Scenarios**
  - ทริปวันเดียว/หลายวัน/ไม่มีวัน
  - ปิดเน็ต → error state
  - ปุ่ม `+กิจกรรม` ทำงาน

---

## Milestone 2: Activities, Today Mode, Budget, Attachments

### [M2-S1] เพิ่มและแก้ไขกิจกรรม

**Acceptance Criteria:**
1. เพิ่มกิจกรรม: ชื่อ, เวลา, note
2. เรียงตามเวลา
3. แก้ไข/complete ได้
4. Event: `complete_activity`

**Tasks:**
- **FE: ActivityForm modal + ActivityCard**
  - Form: ชื่อ, เวลาต้น-จบ, note, location (optional)
  - Toggle status + animation
  - แสดง timestamp เมื่อ complete

- **FE: Hook `useActivities(dayId)` + mutation**
  - โหลดกิจกรรมเรียงตามเวลา
  - Optimistic update
  - Mutation: `addActivity`, `updateActivityStatus`

- **BE: Migration + policy**
  - Table: `activities` พร้อม FK + index
  - RLS: owner/editor CRUD, token read-only
  - Helper function: mark complete (optional)

- **QA: CRUD testing**
  - เพิ่มหลายกิจกรรม → เรียงตามเวลา
  - Complete → refresh → สถานะคงเดิม
  - Event tracking

---

### [M2-S2] Today Mode

**Acceptance Criteria:**
1. แสดงกิจกรรมวันนี้
2. แยก Active/Completed
3. Offline cache + banner "รอซิงก์"
4. Analytics: `open_today`

**Tasks:**
- **FE: TodayMode view**
  - ดึงกิจกรรมวันปัจจุบัน (timezone-aware)
  - แยก section: Active/Completed
  - Banner offline

- **FE: IndexedDB cache (read-only)**
  - เก็บ `['today', tripId]` ใน IndexedDB
  - แสดง badge "ออฟไลน์"
  - Sync เมื่อกลับออนไลน์

- **BE: Filter convenience**
  - View/RPC: `get_today_activities(trip_id, date)`
  - Timezone support
  - Index: `date`

- **QA: Timezone + offline**
  - ทริปต่าง timezone
  - Offline behavior
  - Event tracking

---

### [M2-S3] Budget summary

**Acceptance Criteria:**
1. เพิ่มค่าใช้จ่าย: หมวด, จำนวน, วัน, ผู้จ่าย
2. แสดงยอดรวม + คงเหลือ
3. Tab: ทั้งหมด, ตามหมวด
4. Empty state

**Tasks:**
- **FE: BudgetView + ExpenseItem**
  - Summary: ยอดรวม, คงเหลือ
  - List: หมวด, จำนวน, วัน, ผู้จ่าย
  - Tab: ทั้งหมด, ตามหมวด

- **FE: Hook `useExpenses` + mutation**
  - โหลดตาม trip/day
  - Optimistic update
  - Refresh summary

- **BE: Migration + policy**
  - Table: `expenses` พร้อม numeric precision
  - RLS: owner/editor CRUD, token read-only
  - View: `trip_expense_summary`

- **QA: Data accuracy**
  - ยอดรวมถูกต้อง
  - Validation: จำนวนเงินบวก
  - Analytics

---

### [M2-S4] แนบไฟล์ (1 ไฟล์/กิจกรรม)

**Acceptance Criteria:**
1. อัปโหลดภาพ/PDF ≤5MB พร้อม progress
2. แสดง thumbnail/icon
3. ลบไฟล์ได้ (owner/editor)
4. Event: `upload_attachment`

**Tasks:**
- **FE: AttachmentButton + preview modal**
  - ปุ่มใน ActivityCard
  - Modal: preview ภาพ / icon + ดาวน์โหลด PDF
  - ลบ + confirm dialog

- **FE: Signed URL upload**
  - เรียก edge function ขอ URL
  - Progress bar
  - Error handling

- **BE: Table + Storage policy**
  - Migration: `activity_attachments` (constraint: 1 ไฟล์/กิจกรรม)
  - Bucket: `trip-attachments` (private)
  - Edge function: บันทึก metadata

- **QA: Upload testing**
  - ภาพ, PDF, ไฟล์ >5MB
  - ลบไฟล์ → ไม่มีค้างใน Storage/DB
  - Network pause → resume/แจ้งเตือน

---

## Milestone 3: Settings, Offline Cache, Share

### [M3-S1] Settings

**Acceptance Criteria:**
1. แสดงโปรไฟล์, currency, analytics toggle
2. เปิด/ปิด offline cache, analytics
3. Logout เคลียร์ session
4. บันทึกลง `user_settings`

**Tasks:**
- **FE: Settings UI**
  - List layout: switch/toggle แต่ละ preference
  - ฟอร์มแก้ไข: ชื่อ, currency, toggles
  - ปุ่ม logout

- **FE: Hook `useUserSettings`**
  - โหลด fallback default
  - Mutation: merge ค่าใหม่
  - Sync default currency ผ่าน context

- **BE: Migration + policy**
  - Table: `user_settings` (1:1 profiles)
  - RLS: `auth.uid() = user_id`
  - Trigger: `updated_at`

- **QA: Persistence**
  - Toggle → refresh → ค่าคงเดิม
  - Logout → login → ค่ายังอยู่

---

### [M3-S2] Offline cache

**Acceptance Criteria:**
1. Cache ข้อมูลล่าสุดลง IndexedDB
2. Offline อ่าน cached data + badge
3. Online sync อัตโนมัติ
4. Error sync → toast + retry

**Tasks:**
- **FE: Caching layer**
  - IndexedDB: trips/days/activities/expenses/attachments
  - เคลียร์ cache เมื่อ session เปลี่ยน
  - Indicator: ข้อมูลจาก cache

- **FE: Background sync**
  - `setInterval` หรือ visibility change (5 นาที)
  - Revalidate เมื่อกลับออนไลน์
  - Toast + retry เมื่อล้มเหลว

- **BE: Timestamp support**
  - ทุกตาราง: trigger `updated_at`
  - Index: `updated_at`
  - Filter: `updated_at > lastSync`

- **QA: Offline scenarios**
  - Flight mode → กลับมา → data sync
  - ข้อมูลจากเครื่องอื่น → sync
  - Performance: cache ใหญ่ (>30 วัน)

---

### [M3-S3] แชร์ทริปผ่าน token

**Acceptance Criteria:**
1. Owner สร้าง token + native share
2. ผู้รับเห็น read-only
3. Revoke token ได้
4. Access log

**Tasks:**
- **FE: Share button + flow**
  - ปุ่มใน Trip Detail → modal
  - Mutation: สร้าง/revoke token
  - Copy/share ลิงก์

- **FE: Read-only view**
  - Route: `/shared/:token`
  - Query: `useSharedTrip(token)`
  - แสดงข้อความ read-only

- **BE: Edge function token check**
  - Endpoint ตรวจ `trips.shared_token`
  - คืน trip + days + activities + attachments
  - Revoke: `shared_token = null`
  - Log การเข้าถึง

- **QA: Cross-device testing**
  - Copy/share → เปิดเบราว์เซอร์อื่น
  - Revoke → ลิงก์หมดอายุ
  - Token ใช้ได้โดยไม่ login

---

## Milestone 4: Collaborators, Maps, Conflict, Multi-attachments

### [M4-S1] Collaborator editor

**Acceptance Criteria:**
1. Owner เชิญ editor ผ่านอีเมล
2. Editor เพิ่ม/แก้ กิจกรรม, ค่าใช้จ่าย, ไฟล์
3. Owner ดูรายการสมาชิก + role
4. Analytics: `add_member`

**Tasks:**
- **FE: Member management UI**
  - Section: รายชื่อ, role, ปุ่มลบ
  - ฟอร์มเชิญ email + validation
  - Badge "pending"

- **FE: Mutation add/remove member**
  - Service: `inviteMember`, `removeMember`
  - ล็อก UI ไม่ให้ส่งซ้ำ
  - Confirm + optimistic removal

- **BE: Table `trip_members` + invite flow**
  - Migration: UNIQUE `(trip_id, user_id)` + index
  - Edge function ส่งอีเมลแจ้งเตือน
  - Policy: owner จัดการ, editor อ่าน

- **QA: Role testing**
  - Owner เพิ่ม/ลบ, editor ไม่สามารถแก้
  - Editor เพิ่มกิจกรรม/ค่าใช้จ่าย/ไฟล์
  - คนนอก → 401/403

---

### [M4-S2] Multi-attachments + Conflict alert

**Acceptance Criteria:**
1. หลายไฟล์/กิจกรรม, รวม ≤20MB
2. แสดงรายการ + ขนาด + ลบ
3. Conflict → toast + mark รายการ
4. Offline queue retry อัตโนมัติ

**Tasks:**
- **FE: UI รองรับหลายไฟล์**
  - Gallery แนวนอน/list
  - Badge conflict/อัปโหลดไม่สำเร็จ

- **FE: Offline upload queue**
  - IndexedDB queue: `pending`, `failed`, `synced`
  - Retry เมื่อกลับออนไลน์
  - Toast เมื่อล้มเหลว

- **BE: Multi-attachment + versioning**
  - อนุญาตหลายไฟล์ (quota ≤20MB)
  - Field `version`/`updated_at` สำหรับ conflict
  - ลบ orphan files

- **QA: Queue + conflict**
  - อัปโหลดหลายไฟล์, ลบทีละไฟล์
  - Offline → กลับออนไลน์ → ต่อคิว
  - Conflict detection

---

### [M4-S3] Google Maps deeplink

**Acceptance Criteria:**
1. กิจกรรมที่มี lat/lng → ปุ่ม "เปิดแผนที่"
2. เปิด Google Maps app/web
3. Analytics: `open_map`
4. ไม่มี location → ซ่อนปุ่ม

**Tasks:**
- **FE: Maps deeplink button**
  - ปุ่มใน ActivityCard (มี lat/lng)
  - `window.open` URL: `https://www.google.com/maps/search/?api=1&query=lat,lng`

- **FE: Analytics + fallback**
  - Event `open_map` พร้อม `activity_id`
  - Snackbar หากเปิดไม่ได้

- **BE: Schema location fields**
  - Field: `location_lat`, `location_lng` (double precision, nullable)
  - Seed data ตัวอย่าง

- **QA: Cross-platform**
  - มือถือ → เปิดแอป Maps (ถ้ามี)
  - ไม่มี location → ไม่มีปุ่ม
  - Analytics tracking

---

### [M4-S4] Conflict alert

**Acceptance Criteria:**
1. Sync พบ `updated_at` ใหม่กว่า → toast + ไอคอน
2. เลือกนำเข้าหรือเขียนทับ (server-wins)
3. Log conflict
4. Event: `sync_conflict`

**Tasks:**
- **FE: Conflict detection**
  - เปรียบเทียบ `updated_at` local vs server
  - Toast แจ้ง + ปุ่มดูรายละเอียด
  - Badge + ปุ่ม "รับข้อมูลล่าสุด"

- **BE: Conflict metadata**
  - คืน `updated_at` + `updated_by` ทุก endpoint
  - Log conflict (optional)

- **QA: Multi-device conflict**
  - A offline แก้, B online แก้ record เดียวกัน → A sync
  - ตรวจ toast + ไม่ทับข้อมูล B
  - Event tracking

---

## Cross-Cutting Tasks

### Design
- Figma mobile-first specs
- Component library
- State designs: loading/empty/error

### DevOps
- Supabase migrations
- Edge functions
- Storage policies
- CI: Bun lint/test

### QA
- Test plan: manual + Playwright
- Smoke tests ต่อ milestone
- Mobile viewport testing

### Documentation
- อัปเดต README, PRD, Changelog
- Living documentation

### Analytics
- Event schema ใน `src/lib/analytics.ts`
- ตรวจ consent toggle
