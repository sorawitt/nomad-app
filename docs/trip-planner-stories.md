# Trip Planner Mini-App — User Stories & Tasks

## Milestone 1 (สัปดาห์ 0-2): Auth, Home, New Trip, Analytics เบื้องต้น

### Story [M1-S1] ผู้ใช้ล็อกอินด้วย Magic Link หรือ Google
- **Persona:** Trip Lead / Co-traveler
- **เหตุผล:** เริ่มจากการมี Auth ที่เชื่อถือได้เพื่อปกป้องข้อมูลส่วนตัวและเป็นฐานสำหรับทุก flow อื่น; ได้เรียนรู้การผสาน Supabase Auth กับ Preact + TypeScript ในบริบท mobile-first
- **Acceptance Criteria**
  1. ผู้ใช้กรอกอีเมลและได้รับ Magic Link จาก Supabase สำเร็จ
  2. ผู้ใช้สามารถใช้ Google OAuth และกลับมาที่แอปในสถานะล็อกอิน
  3. Session ถูกเก็บไว้และโหลดอัตโนมัติเมื่อเปิดแอปใหม่
  4. UI แสดง error กรณีลิงก์หมดอายุหรือ credential ไม่ถูกต้อง
- **Tasks**
  - FE: ออกแบบและประกาศหน้า Auth (mobile-first) พร้อมฟอร์ม email — *เหตุผล:* ฝึกออกแบบ responsive layout กับ Tailwind และสร้างประสบการณ์ login ที่ตรง UX หลัก *(Ref: Preact component composition, Tailwind responsive utilities)*  
    - สร้าง `AuthScreen.tsx` ใน `src/features/auth` และจัด layout ให้รองรับหน้าจอมือถือ  
    - ใช้ฟอร์มที่ตรวจ email format, แสดงสถานะ loading/disabled บนปุ่ม Magic Link และ Google  
    - เชื่อม Supabase `auth.signInWithOtp` + `auth.signInWithOAuth`, แสดง toast สำเร็จ/ล้มเหลว, redirect ผู้ใช้ที่ล็อกอินแล้วไป Home
  - FE: จัดการ session ผ่าน Supabase Auth context และ route guard — *เหตุผล:* เรียนรู้การใช้ React Context ใน Preact และการจัดการ state แบบ type-safe เพื่อควบคุม routing *(Ref: React Context API, TypeScript generics, React Router guards)*  
    - เพิ่ม `AuthProvider` ใน `provider.tsx` โหลด session จาก `supabase.auth.getSession()` และ subscribe `onAuthStateChange`  
    - สร้าง hook `useAuth()` คืนค่า `{ user, session, signIn, signOut }`  
    - ปรับ router ให้ป้องกันหน้าหลักสำหรับผู้ที่ไม่ล็อกอิน และส่งไป `/auth`
  - BE: ตั้งค่า Supabase Auth provider และ environment — *เหตุผล:* ทำความเข้าใจการตั้งค่า Supabase Dashboard และการจัดการ environment สำหรับ local dev *(Ref: Supabase Auth configuration, OAuth redirect URI)*  
    - เปิดใช้งาน Email (Magic Link) กับ Google OAuth ใน Supabase dashboard และกำหนด redirect URL ให้ตรงกับ dev/prod  
    - ปรับแต่ง template อีเมล Magic Link, ตั้งค่า `.env.local` ให้มี `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY`  
    - ทดสอบจาก dashboard ด้วย Magic Link และ OAuth เพื่อตรวจ flow ครบ
  - QA: ทดสอบ end-to-end flow และ error case — *เหตุผล:* สร้างนิสัยทดสอบกรณีสำคัญตั้งแต่ต้นและเข้าใจ UX เมื่อผิดพลาด *(Ref: Exploratory testing, Supabase Auth error handling)*  
    - ทดสอบ login ด้วยอีเมลและ Google บน desktop/mobile และตรวจว่า session persist หลัง refresh  
    - ตรวจ error copy เมื่อใส่อีเมลผิด, ลิงก์หมดอายุ, หรือยกเลิก OAuth  
    - ยืนยันว่า logout เคลียร์ session และ redirect ไปหน้าล็อกอิน

### Story [M1-S2] ผู้ใช้เห็นหน้า Home พร้อมรายการทริปล่าสุด
- **เหตุผล:** Home เป็นจุดเริ่มประสบการณ์ ช่วยฝึกการดึงข้อมูลด้วย hooks และจัดการสถานะต่างๆ (loading/empty/error) อย่างเรียบง่ายซึ่งจำเป็นต่อ mobile-first UX
- **Acceptance Criteria**
  1. หลังล็อกอินผู้ใช้เห็น Trip list ตามสิทธิ์ (owner/member) เรียงตาม `updated_at`
  2. Empty state แสดง CTA “สร้างทริปใหม่” เมื่อไม่มีรายการ
  3. Loading state แสดง skeleton 3 ใบ
  4. Analytics ส่ง event `open_home`
- **Tasks**
  - FE: สร้าง `TripList` component รองรับ skeleton/empty/error — *เหตุผล:* ฝึก component-driven development และการออกแบบสถานะให้ UI ตอบโจทย์ทุกกรณี *(Ref: Preact component patterns, Tailwind skeleton UI)*  
    - ออกแบบ card ให้สั้น กระชับ ใช้ Tailwind class ที่มีอยู่  
    - เพิ่ม state แสดง skeleton ระหว่างโหลด และ empty state พร้อม CTA  
    - รองรับการแตะที่รายการเพื่อเปิด Trip Detail
  - FE: สร้าง hook `useTrips` สำหรับโหลดและ cache ข้อมูล — *เหตุผล:* ฝึกใช้ React Query/SWR กับ TypeScript เพื่อดึงข้อมูล Supabase อย่างปลอดภัย *(Ref: TanStack Query, TypeScript inference)*  
    - เรียก service `listTrips` ผ่าน SWR/React Query พร้อม `staleTime` เหมาะสม  
    - จัดการ error ด้วย toast และ retry button ในหน้า  
    - ส่ง event `open_home` เมื่อข้อมูลโหลดสำเร็จครั้งแรก
  - BE: สร้าง view `trips_view` สำหรับ owner + member — *เหตุผล:* รู้จักการเตรียม data layer ฝั่งฐานข้อมูลให้เรียบง่ายสำหรับ client และฝึกเขียน SQL View *(Ref: Supabase SQL view, Postgres RLS)*  
    - เขียน SQL view รวม trips ที่ owner และที่เป็น member จาก `trip_members`  
    - เพิ่ม index `updated_at` เพื่อเรียงข้อมูลไว  
    - ตรวจ RLS ให้ view เคารพสิทธิ์
  - QA: ทดสอบ owner/member, empty state, network error — *เหตุผล:* ให้ความสำคัญกับการครอบคลุมสถานะ UI เพื่อมั่นใจในคุณภาพเมื่อ scale *(Ref: UX state testing, offline-first mindset)*  
    - สร้างบัญชี owner/member เพื่อทดสอบแยกสิทธิ์  
    - จำลองกรณีไม่มีทริปและเช็คข้อความ empty state  
    - ปิดอินเทอร์เน็ตชั่วคราวเพื่อตรวจ error banner และ retry

### Story [M1-S3] ผู้ใช้สร้างทริปใหม่
- **เหตุผล:** ฟีเจอร์สร้างทริปเป็นแกนกลางของแอป ฝึกการทำฟอร์มที่มี validation และการทำงานร่วมกับ Supabase transaction
- **Acceptance Criteria**
  1. ผู้ใช้กรอกชื่อทริป วันที่เริ่ม/จบ และบันทึกได้
  2. ระบบสร้าง `trip_days` ตามช่วงวันที่อัตโนมัติ
  3. หลังบันทึก redirect ไป Trip Detail
  4. ส่ง analytics `create_trip` พร้อม `trip_id`, `day_count`
- **Tasks**
  - FE: ฟอร์ม `NewTrip` + validation — *เหตุผล:* ฝึกออกแบบ form ที่รองรับ TypeScript types และ validation ที่เรียบง่าย *(Ref: Form handling, Zod validation)*  
    - ใช้คอมโพเนนต์ฟอร์ม reuse ได้ กรอกชื่อทริป, วันที่เริ่ม/จบ, currency  
    - ตรวจสอบว่าชื่อไม่ว่าง, วันที่เริ่ม ≤ วันที่จบ, currency default จาก settings  
    - หลังบันทึกแสดง toast สำเร็จและเคลียร์ฟอร์ม
  - FE: Mutation `createTrip` พร้อม redirect — *เหตุผล:* สอนการใช้ mutation กับ optimistic workflow และการจัดการ navigation *(Ref: TanStack Query mutation, React Router navigation)*  
    - ใช้ React Query `useMutation` เรียก service `createTrip`  
    - หลังสำเร็จให้ invalidates `['trips']` และนำผู้ใช้ไป Trip Detail  
    - ส่ง analytics `create_trip` พร้อม payload ที่กำหนด
  - BE: RPC/Edge function สร้าง trip + days ใน transaction — *เหตุผล:* เรียนรู้ Postgres function/transaction และแนวคิด atomic insert *(Ref: Postgres stored procedure, Supabase RPC)*  
    - เขียนฟังก์ชันสร้าง `trips` row และ loop สร้าง `trip_days` จาก range วันที่  
    - เพิ่ม trigger อัปเดต `updated_at` อัตโนมัติและ index ที่ใช้บ่อย  
    - ทดสอบผ่าน Supabase SQL editor ด้วย sample payload
  - QA: ทดสอบกรณี edge case — *เหตุผล:* สร้าง mindset ตรวจสอบความสมบูรณ์ของฟีเจอร์หลักและ analytics *(Ref: Boundary testing, analytics validation)*  
    - กรอกวันที่ผิดลำดับควรเห็นข้อความแจ้งเตือน  
    - สร้างทริปที่มีหลายวันและตรวจว่า day index ต่อเนื่องถูกต้องใน DB  
    - สร้างทริปซ้ำชื่อเดิมควรบันทึกได้ (ไม่บังคับ unique) และ analytics ส่งครั้งเดียว

### Story [M1-S4] ผู้ใช้เห็น Trip Detail (Day list) เบื้องต้น
- **เหตุผล:** ให้ผู้ใช้เห็นภาพรวม itinerary ทันที และเป็นพื้นฐานสำหรับฟีเจอร์วัน/กิจกรรมขั้นถัดไป ฝึกทำงานกับ relational data
- **Acceptance Criteria**
  1. Trip Detail แสดงวันทั้งหมดตามลำดับ
  2. แต่ละวันโชว์นับจำนวนกิจกรรม (0 เริ่มต้น)
  3. มีปุ่ม `+กิจกรรม` พร้อมเรียก modal (placeholder)
  4. Error state แสดง retry
- **Tasks**
  - FE: Layout Trip Detail + `DayCard` component — *เหตุผล:* ฝึกจัด layout หลายส่วนบน mobile และ component reusability *(Ref: Layout composition, Tailwind grid/flex)*  
    - สร้าง header แสดงชื่อทริป + ช่วงวันที่, เพิ่มปุ่ม `+กิจกรรม`  
    - ทำ `DayCard` ให้โชว์วันที่, จำนวนกิจกรรม, ปุ่มดูรายละเอียด  
    - รองรับ state ไม่มีวัน (แสดงข้อความให้กลับไปแก้วันที่เริ่ม/จบ)
  - FE: Hook `useTripDays` โหลด days + count — *เหตุผล:* ต่อยอดจาก hook เดิมเพื่อทำงานกับ relation และ count ใน Supabase *(Ref: Supabase select with relation, TanStack Query)*  
    - ใช้ React Query เรียก Supabase `trip_days` พร้อม relation count  
    - จัดการ loading ด้วย skeleton timeline, error ด้วย retry บนหน้า  
    - Cache ตาม `['trip-days', tripId]` และ refresh เมื่อเพิ่ม/ลบกิจกรรม
  - BE: Query + index สำหรับ count — *เหตุผล:* ทำความเข้าใจการเตรียมข้อมูลสรุป (aggregate) จากฐานข้อมูลอย่างมีประสิทธิภาพ *(Ref: Postgres aggregate, index strategy)*  
    - ตรวจสอบว่า `trip_days` มี index บน `trip_id, day_index`  
    - ใช้ Supabase `select('*, activities(count)')` หรือ view สรุป count  
    - ตรวจ RLS ให้ผู้ใช้ที่เป็น member เห็นข้อมูลได้
  - QA: ทดสอบหลายสถานการณ์ — *เหตุผล:* รับประกัน UX สำหรับทริปหลายรูปแบบ และฝึกทดสอบ error/network *(Ref: Scenario testing, network throttling)*  
    - ทริปที่มีวันเดียว/หลายวันและไม่มีวันเลย  
    - ปิดเน็ตเพื่อดู error state และทดสอบ refresh  
    - ตรวจว่าปุ่ม `+กิจกรรม` พาผู้ใช้ไปฟอร์มหรือ modal ถูกต้อง

## Milestone 2 (สัปดาห์ 3-4): Trip Detail, Today Mode, Budget, แนบไฟล์เดี่ยว

### Story [M2-S1] ผู้ใช้เพิ่มและแก้ไขกิจกรรมรายวัน
- **เหตุผล:** ฟีเจอร์กิจกรรมคือหัวใจของประสบการณ์ Trip Planner ช่วยฝึก CRUD เต็มรูปแบบและ state management ใน Preact
- **Acceptance Criteria**
  1. ผู้ใช้เพิ่มกิจกรรมระบุชื่อ เวลาต้น-จบ, note ได้
  2. รายการกิจกรรมเรียงตามเวลาในวันเดียวกัน
  3. สามารถแก้ไข/ทำเครื่องหมาย complete ได้
  4. เมื่อกิจกรรมถูกทำเครื่องหมาย complete ส่ง event `complete_activity`
- **Tasks**
  - FE: สร้าง `ActivityForm` modal และ `ActivityCard` — *เหตุผล:* ฝึกสร้าง component แบบ reusable พร้อม TypeScript props และจัดการ state ใน modal *(Ref: Controlled components, Preact portals)*  
    - ฟอร์มเก็บชื่อ, เวลาต้น-จบ, note, สถานที่แบบ optional  
    - แสดง status toggle ใน `ActivityCard` พร้อม animation สั้น ๆ  
    - เมื่อ complete ให้ update UI ทันทีและแสดง timestamp เล็ก ๆ
  - FE: Hook `useActivities(dayId)` + mutation — *เหตุผล:* ต่อยอดการใช้ React Query สำหรับ resource ที่มี dependency (dayId) และ optimistic updates *(Ref: Query Key patterns, optimistic UI)*  
    - โหลดกิจกรรมเรียงตามเวลา, ใช้ optimistic update เมื่อเพิ่ม/แก้/complete  
    - แยก mutation สำหรับ `addActivity` และ `updateActivityStatus`  
    - หลังสำเร็จ invalidate cache ของวันและทริปเพื่ออัปเดต count
  - BE: Migration และ policy สำหรับ `activities` — *เหตุผล:* เรียนรู้การออกแบบ schema ที่มี FK และ index เพื่อประสิทธิภาพ พร้อมตั้ง RLS *(Ref: Postgres foreign key, Supabase RLS)*  
    - สร้างตารางด้วย field ที่ระบุใน PRD และ index `trip_id`, `day_id`, `start_time`  
    - ตั้ง RLS ให้ owner/editor CRUD ได้, ผู้ถือ token อ่านอย่างเดียว  
    - สร้าง helper function สำหรับ mark complete (optional แต่เรียบง่าย)
  - QA: ตรวจ flow เพิ่ม/แก้/ลบ — *เหตุผล:* สร้างความเชื่อมั่นว่า CRUD พื้นฐานไม่มี regression และ analytics ถูกต้อง *(Ref: Regression testing, event tracking)*  
    - เพิ่มกิจกรรมหลายรายการและตรวจว่าเรียงตามเวลา  
    - ทำเครื่องหมาย complete แล้ว refresh หน้าจอควรสถานะคงเดิม  
    - ตรวจ event `add_activity` และ `complete_activity` ว่าส่ง payload ครบ

### Story [M2-S2] Today Mode แสดงกิจกรรมวันนี้
- **เหตุผล:** Today Mode ช่วยให้ผู้ใช้โฟกัสกับกิจกรรมปัจจุบันและเป็นจุดเริ่มต้นการเรียนรู้การทำ offline-first
- **Acceptance Criteria**
  1. Today Mode แสดงเฉพาะกิจกรรมที่ตรงกับวันที่ปัจจุบันของ trip
  2. กิจกรรม complete ถูกย้ายลง section “เสร็จแล้ว”
  3. Offline cache ยังแสดงรายการล่าสุด พร้อม banner “รอซิงก์” เมื่อ offline
  4. ส่ง analytics `open_today` พร้อม `activity_count`
- **Tasks**
  - FE: พัฒนา `TodayMode` view — *เหตุผล:* ฝึกการทำ conditional rendering และ UI state แยกส่วน active/completed *(Ref: Conditional rendering, mobile nav patterns)*  
    - ดึงกิจกรรมของวันปัจจุบัน (เทียบกับ timezone trip) และแยก Active/Completed  
    - เพิ่ม toggle หรือ segmented control เพื่อสลับมุมมอง  
    - แสดง banner เมื่อไม่มีรายการหรือเมื่ออยู่ในสถานะ offline
  - FE: Cache ข้อมูล Today ด้วย IndexedDB (read-only) — *เหตุผล:* เรียนรู้พื้นฐาน offline storage โดยไม่ซับซ้อน *(Ref: IndexedDB via localForage, offline-first)*  
    - ใช้ data layer เดิมเพิ่มการเก็บ `['today', tripId]` ลง IndexedDB  
    - ระบุแหล่งข้อมูล (online/offline) ให้ UI แสดง badge “ออฟไลน์”  
    - ซิงก์ข้อมูลใหม่เมื่อกลับออนไลน์ด้วยฟังก์ชันเดียวกับ refresh
  - BE: เพิ่ม filter convenience สำหรับ Today — *เหตุผล:* สร้าง endpoint/view ที่ลด logic บน client ทำให้โค้ดง่ายขึ้น *(Ref: Postgres date filtering, RPC convenience)*  
    - สร้าง view หรือ RPC `get_today_activities(trip_id, date)`  
    - ตรวจสอบ timezone ให้รับค่า `start_date` + offset เรียบง่าย  
    - เพิ่ม index `date` ใน `trip_days` หากยังไม่มี
  - QA: ทดสอบ timezone และ offline — *เหตุผล:* ช่วยให้มั่นใจว่าแอปทำงานได้ดีในสถานการณ์จริงที่ผู้ใช้เดินทางข้ามเวลา *(Ref: Timezone testing, offline QA)*  
    - ตั้งค่า trip ต่าง timezone และตรวจว่ากิจกรรมวันนี้ถูกต้อง  
    - ใช้ devtool offline เพื่อดู behavior, banner, data persist  
    - ตรวจ event `open_today` ว่าส่ง `trip_id` + `activity_count`

### Story [M2-S3] ผู้ใช้บันทึกค่าใช้จ่ายและดู Budget summary
- **เหตุผล:** การจัดการงบประมาณเป็น pain point ของทริป ช่วยฝึกการรวมข้อมูล (aggregation) และ UI ที่แสดงสรุปตัวเลขชัดเจน
- **Acceptance Criteria**
  1. ผู้ใช้เพิ่มค่าใช้จ่าย กำหนดหมวด, จำนวนเงิน, วัน, ผู้จ่าย
  2. Budget summary แสดงยอดรวมและยอดคงเหลือ
  3. Tab “ตามหมวด” สรุปยอดแต่ละ category
  4. Empty state แนะนำให้เพิ่มค่าใช้จ่ายแรก
- **Tasks**
  - FE: พัฒนา `BudgetView` พร้อม `ExpenseItem` — *เหตุผล:* ฝึกทำ UI สรุปตัวเลขบนจอเล็กและการใช้ Tailwind ในการจัด card/list *(Ref: Data visualization lite, Tailwind grid)*  
    - แสดงยอดรวม, ยอดคงเหลือ, และปุ่ม `+ค่าใช้จ่าย`  
    - ใช้ list card simple แสดงหมวด, จำนวน, วัน, ผู้จ่าย  
    - เพิ่ม tab “ตามหมวด” ที่ reuse component เดียวกัน
  - FE: Hook `useExpenses(tripId|dayId)` และ mutation — *เหตุผล:* ทำความเข้าใจการ reuse hook ที่รับพารามิเตอร์และจัดการ cache หลาย key *(Ref: Query key parametrization, TypeScript union types)*  
    - โหลดข้อมูลตาม trip หรือกรอง `day_id` ตามที่เลือก  
    - Mutation เพิ่ม/แก้ไข/ลบค่าใช้จ่ายพร้อม optimistic update เล็กน้อย  
    - หลัง mutate ให้รีเฟรช summary และส่ง event หากเพิ่มใหม่
  - BE: Migration และ policy สำหรับ `expenses` — *เหตุผล:* เรียนรู้การออกแบบ schema ที่เกี่ยวกับการเงิน พร้อม constraint สำหรับความถูกต้อง *(Ref: Numeric precision, Postgres check constraint)*  
    - สร้างตารางตาม schema พร้อม index `trip_id`, `day_id`, `category`  
    - ตั้ง RLS owner/editor CRUD และ token read-only  
    - เพิ่ม view `trip_expense_summary` สำหรับยอดรวม/หมวด (เรียบง่าย)
  - QA: ทดสอบความถูกต้องของข้อมูล — *เหตุผล:* ให้แน่ใจว่าตัวเลขไม่ผิดพลาดและ UX ฟอร์มใช้งานได้จริง *(Ref: Financial QA, form validation)*  
    - ป้อนจำนวนเงินหลายหมวด ตรวจว่ารวมถูกและไม่สูญค่า  
    - ตรวจ validation จำนวนเงินเป็นตัวเลขบวก  
    - ตรวจว่าการแก้ไขสะท้อนใน summary และ analytics

### Story [M2-S4] แนบไฟล์ใบเสร็จได้ 1 รายการต่อกิจกรรม
- **เหตุผล:** ใบเสร็จคือหลักฐานค่าใช้จ่าย การเริ่มจากไฟล์เดียวช่วยรักษาความเรียบง่ายแต่ได้เรียนรู้ Supabase Storage และการอัปโหลดไฟล์
- **Acceptance Criteria**
  1. ผู้ใช้เลือกไฟล์ภาพ/PDF ≤5MB และเห็น progress upload
  2. กิจกรรมที่มีไฟล์แนบแสดง thumbnail/ไอคอน
  3. สามารถลบไฟล์โดย owner/editor
  4. Event `upload_attachment` ถูกส่งหลังสำเร็จ
- **Tasks**
  - FE: เพิ่ม `AttachmentButton` และ preview modal — *เหตุผล:* ฝึก UI การแนบไฟล์บนจอมือถือ และการจัดการ preview หลายประเภทไฟล์ *(Ref: File input UX, modal design)*  
    - ปุ่มอยู่ใน `ActivityCard`, แสดง file name และ icon ถ้ามีไฟล์แล้ว  
    - modal แสดง preview สำหรับภาพ หรือ icon + ดาวน์โหลดสำหรับ PDF  
    - ลบไฟล์ได้ด้วยปุ่มเดียวและยืนยันแบบ dialog
  - FE: เชื่อม signed URL upload อย่างเรียบง่าย — *เหตุผล:* เรียนรู้การใช้งาน Supabase Storage และการอัปโหลดด้วย signed URL *(Ref: Supabase storage upload, pre-signed URL)*  
    - เรียก edge function เพื่อขอ URL, ใช้ `fetch`/`supabase.storage` อัปโหลดไฟล์เดียว  
    - ระหว่างอัปโหลดแสดง progress bar และจัดการ error ให้ลองใหม่  
    - หลังสำเร็จรีเฟรช `useActivities` เพื่อให้ metadata อัปเดต
  - BE: เตรียมตารางและ Storage policy — *เหตุผล:* ทำความเข้าใจการผสาน Postgres ตาราง metadata กับ Supabase Storage และ RLS *(Ref: Supabase storage policy, Postgres constraint)*  
    - Migration สร้าง `activity_attachments` และ constraint ที่จำกัด 1 ไฟล์/กิจกรรมใน R1  
    - สร้าง bucket `trip-attachments` แบบ private พร้อม RLS policy owner/editor  
    - Edge function บันทึก metadata เข้า table หลังอัปโหลด
  - QA: ตรวจการอัปโหลดและข้อจำกัด — *เหตุผล:* ตรวจสอบ UX เวลาอัปโหลดล้มเหลวและการจัดการขนาดไฟล์ *(Ref: Upload testing, file validation)*  
    - ทดสอบไฟล์ภาพ, PDF, และกรณีไฟล์เกิน 5MB ต้องแจ้ง error ชัดเจน  
    - ลบไฟล์แล้วตรวจว่า Storage/DB ไม่มีไฟล์ค้าง  
    - ทดสอบอัปโหลดเมื่อสัญญาณตก (pause network) ต้อง resume หรือแจ้งเตือน

## Milestone 3 (สัปดาห์ 5-6): Settings, Offline Cache, แชร์ลิงก์

### Story [M3-S1] ผู้ใช้ตั้งค่าพื้นฐานใน Settings
- **เหตุผล:** Settings ทำให้ผู้ใช้ควบคุมประสบการณ์และเป็นโอกาสเรียนรู้การทำ persistence แบบ 1:1 กับ user profile
- **Acceptance Criteria**
  1. Settings แสดงข้อมูลโปรไฟล์, default currency, analytics toggle
  2. ผู้ใช้เปิด/ปิด offline cache และ analytics consent ได้
  3. Logout เคลียร์ session และนำกลับสู่หน้า Auth
  4. ค่า preference ถูกบันทึกใน `user_settings`
- **Tasks**
  - FE: สร้าง Settings UI + จัดการ state — *เหตุผล:* ฝึกสร้างหน้ารวม preference อย่างเป็นระบบ ใช้ component ซ้ำได้ *(Ref: Settings UX, Tailwind list styling)*  
    - Layout แบบ list item พร้อม switch/toggle สำหรับแต่ละ preference  
    - ฟอร์มแก้ไขชื่อ, currency, analytics toggle, offline toggle  
    - ปุ่ม logout อยู่ท้ายหน้าและเรียก `signOut`
  - FE: Hook `useUserSettings` — *เหตุผล:* เรียนรู้การทำ hook ที่รวม default value กับ server state *(Ref: Custom hooks, fallback defaults)*  
    - โหลดค่าจาก `user_settings` (fallback default เมื่อยังไม่มี row)  
    - บันทึกการเปลี่ยนด้วย mutation ที่ merge ค่าใหม่  
    - sync ค่า default currency ให้หน้าฟอร์มอื่นผ่าน context
  - BE: Migration + policy — *เหตุผล:* ทำ schema 1:1 ที่เรียบง่ายและฝึก RLS ระดับผู้ใช้ *(Ref: Unique constraint, Supabase RLS)*  
    - สร้างตาราง `user_settings` แบบ 1:1 กับ `profiles` และตั้ง constraint UNIQUE  
    - RLS ให้ `auth.uid() = user_id`, default insert เมื่อผู้ใช้สร้างทริปครั้งแรก  
    - สร้าง trigger อัปเดต `updated_at`
  - QA: ตรวจ persistence — *เหตุผล:* ให้มั่นใจว่าการตั้งค่าของผู้ใช้ไม่สูญหายและ UX logout ทำงานถูกต้อง *(Ref: Settings regression testing)*  
    - เปลี่ยน toggle แล้ว refresh ควรค่าคงเดิม  
    - ทดสอบ logout → login ใหม่ยังเห็นค่าที่ตั้งไว้  
    - ตรวจ copy/UX ให้ง่ายต่อการเข้าใจบนหน้าจอมือถือ

### Story [M3-S2] Offline cache สำหรับ Trip/Day/Activity/Expense
- **เหตุผล:** ยกระดับประสบการณ์ให้ใช้งานได้แม้ออฟไลน์ พร้อมฝึกแนวคิด sync และ cache ที่จำเป็นต่อ mobile-first
- **Acceptance Criteria**
  1. เมื่อออนไลน์ app cache ข้อมูลล่าสุดลง IndexedDB
  2. เมื่อ offline ยังคงอ่านข้อมูล cached ได้ พร้อม badge “ออฟไลน์”
  3. กลับมาออนไลน์แล้ว sync และอัปเดต UI อัตโนมัติ
  4. Error sync แสดง toast พร้อมปุ่ม retry
- **Tasks**
  - FE: เพิ่ม caching layer ใน data hooks — *เหตุผล:* ฝึกใช้ IndexedDB/localForage ควบคู่กับ React Query เพื่อเก็บข้อมูล offline *(Ref: localForage integration, offline caching)*  
    - ใช้ IndexedDB (ผ่าน localForage) จัดเก็บ trips/days/activities/expenses/attachments metadata  
    - เมื่อ `session` เปลี่ยนให้เคลียร์ cache ของผู้ใช้ก่อนหน้า  
    - แสดง indicator เมื่อข้อมูลมาจาก cache (เช่น badge “จากออฟไลน์”)
  - FE: Implement background sync เรียบง่าย — *เหตุผล:* เรียนรู้การซิงก์ข้อมูลแบบกำหนดเวลาและเมื่อสถานะเครือข่ายเปลี่ยน *(Ref: Navigator.onLine, background sync pattern)*  
    - ใช้ `setInterval` หรือ visibility change เพื่อตรวจข้อมูลใหม่ทุก 5 นาที  
    - เมื่อกลับมาออนไลน์เรียก revalidate ของ query key ทั้งชุด  
    - หาก sync ล้มเหลวให้แสดง toast พร้อมปุ่ม retry
  - BE: สนับสนุน diff ด้วย timestamp — *เหตุผล:* ทำความเข้าใจว่าฐานข้อมูลต้องเตรียมข้อมูลเพิ่มเติมเพื่อ sync ที่มีประสิทธิภาพ *(Ref: updated_at trigger, incremental sync)*  
    - ยืนยันว่าทุกตารางมี trigger อัปเดต `updated_at` อัตโนมัติ  
    - เพิ่ม index `updated_at` สำหรับ query ที่จะใช้ incremental sync  
    - เตรียม endpoint/filter คืนรายการที่ `updated_at > lastSync`
  - QA: ทดสอบสถานการณ์ออฟไลน์ — *เหตุผล:* ฝึก QA ด้าน offline-first และ performance เมื่อข้อมูลเพิ่มขึ้น *(Ref: Offline QA checklist)*  
    - เปิด flight mode → ปิด → ตรวจว่าข้อมูลกลับมาถูกต้อง  
    - สร้างข้อมูลใหม่จากอีกเครื่องระหว่างที่ออฟไลน์ แล้วตรวจ sync  
    - ตรวจ performance เมื่อ cache ใหญ่ขึ้น (ทริป > 30 วัน)

### Story [M3-S3] แชร์ทริปผ่าน shared token
- **เหตุผล:** การแชร์ทำให้ทริปทำงานร่วมกับผู้อื่นได้ และเป็นจุดเรียนรู้เรื่อง token-based access + edge function
- **Acceptance Criteria**
  1. Owner สร้าง token กดแชร์และเปิด native share sheet
  2. ผู้รับลิงก์เห็น Trip read-only (วัน, กิจกรรม, ค่าใช้จ่าย, ไฟล์)
  3. Owner revoke token แล้วลิงก์เดิมใช้ไม่ได้
  4. Access log บันทึกเวลาและผู้ใช้ (อย่างน้อยใน Supabase logs)
- **Tasks**
  - FE: เพิ่ม share button และ flow generate/revoke — *เหตุผล:* ฝึกผสานฟังก์ชัน native share บนเว็บและการจัดการ state ที่เกี่ยวข้องกับ token *(Ref: Web Share API, state management)*  
    - ปุ่มอยู่ใน Trip Detail header → modal แสดงลิงก์ + ปุ่ม copy/share  
    - เรียก mutation สร้าง token (ถ้ายังไม่มี) และรีเฟรช UI  
    - ปุ่ม revoke ตั้งค่า `shared_token = null` และอัปเดต state ทันที
  - FE: Read-only view สำหรับ token — *เหตุผล:* เรียนรู้การสร้าง route แบบแยกสิทธิ์และใช้ query แยกตาม token *(Ref: React Router dynamic route, conditional rendering)*  
    - สร้าง route `/shared/:token` ใช้ layout เดียวแต่ disable edit  
    - ใช้ query แยก `useSharedTrip(token)` เพื่อดึงข้อมูล  
    - แสดง提示ว่าผู้ใช้กำลังดูแบบ read-only และเสนอให้สมัครบัญชี
  - BE: Edge function ตรวจ token — *เหตุผล:* ได้ประสบการณ์เขียน Supabase Edge Function เพื่อเช็คสิทธิ์ก่อนคืนข้อมูล *(Ref: Supabase Edge Functions, bearer token validation)*  
    - Endpoint รับ token ตรวจ `trips.shared_token` แล้วคืน trip + days + activities + attachments  
    - รองรับ revoke โดย owner ตั้งค่า `shared_token = null`  
    - log การเข้าถึงด้วย timestamp เพื่อง่ายต่อการ audit
  - QA: ทดสอบการแชร์ — *เหตุผล:* มั่นใจว่าการแชร์ทำงานบนอุปกรณ์จริงและ token ถูกจัดการปลอดภัย *(Ref: Cross-device testing, security QA)*  
    - กด copy/share บนมือถือและเปิดในเบราว์เซอร์อื่น → ต้องเห็นข้อมูล read-only  
    - Revoke แล้วรีเฟรชลิงก์เดิมควรเห็น error “ลิงก์หมดอายุ”  
    - ตรวจว่า token ใช้งานได้แม้ไม่ล็อกอิน แต่แก้ไขอะไรไม่ได้

## Milestone 4 (สัปดาห์ 7-8): Collaborator, Maps, Conflict Alert, Multi Attachment

### Story [M4-S1] Owner จัดการ collaborator editor
- **เหตุผล:** เพิ่มการทำงานร่วมกันและฝึกออกแบบระบบสิทธิ์ (RBAC) แบบง่าย ๆ ระหว่าง owner กับ editor
- **Acceptance Criteria**
  1. Owner เพิ่ม email เพื่อเชิญ editor (ถ้า user มีบัญชี)
  2. Editor สามารถเพิ่ม/แก้กิจกรรม ค่าใช้จ่าย, แนบไฟล์
  3. Owner ดูรายการสมาชิกและ role
  4. Analytics `add_member` บันทึกการเชิญ
- **Tasks**
  - FE: Member management UI ใน Settings — *เหตุผล:* ฝึกสร้าง UI จัดการรายชื่อและใช้ Tailwind สำหรับ list + badge *(Ref: List management UI, Tailwind badge)*  
    - เพิ่ม section แสดงรายชื่อสมาชิก, role, ปุ่มลบ  
    - ฟอร์มใส่อีเมลเพื่อเชิญ editor พร้อม validation ง่าย ๆ  
    - แสดง badge “pending” หากยังไม่มีการยืนยันบัญชี
  - FE: Mutation add/remove member — *เหตุผล:* เรียนรู้การจัดการ mutation ที่มีสถานะ pending และ optimistic removal *(Ref: Mutation status handling, optimistic UI)*  
    - สร้าง service `inviteMember`, `removeMember` ใช้ React Query mutation  
    - หลัง invite ล็อก UI ไม่ให้ส่งซ้ำจนกว่าจะสำเร็จ  
    - เมื่อ remove ให้ถามยืนยันและอัปเดตรายการทันที
  - BE: ตาราง `trip_members` และ invite flow — *เหตุผล:* เข้าใจการสร้าง pivot table สำหรับ many-to-many และการส่งคำเชิญด้วย edge function *(Ref: Join table design, Supabase RPC email)*  
    - Migration สร้างตาราง + UNIQUE `(trip_id, user_id)` + index `user_id`  
    - Edge function ส่งอีเมลแจ้งเตือน (หรือแค่สร้าง record แล้วให้ผู้ใช้เห็น)  
    - Policy: owner จัดการ, editor อ่านได้
  - QA: ตรวจสิทธิ์และ flow — *เหตุผล:* ยืนยันว่า RBAC ถูกต้องและไม่มีสิทธิ์เกินจำเป็น *(Ref: Role-based testing)*  
    - Owner เพิ่ม/ลบสมาชิกได้, editor ควรแก้ไม่ได้  
    - สมาชิกที่ถูกเชิญสามารถเพิ่มกิจกรรม/ค่าใช้จ่าย/ไฟล์  
    - คนนอกที่เปิดลิงก์ควรโดนปฏิเสธ (401/403)

### Story [M4-S2] แนบไฟล์หลายรายการต่อกิจกรรม + Conflict Alert
- **เหตุผล:** ขยายความสามารถแนบไฟล์ให้ใกล้เคียงการใช้งานจริง พร้อมฝึกจัดการ offline queue และ conflict ที่ซับซ้อนขึ้น
- **Acceptance Criteria**
  1. ผู้ใช้เพิ่มไฟล์หลายรายการต่อกิจกรรมได้, จำกัดรวม ≤ 20MB
  2. UI แสดงรายการไฟล์พร้อมขนาดและปุ่มลบ
  3. หากเกิด conflict (ไฟล์ถูกแก้ไขระหว่าง offline) แสดง toast แจ้งและ mark รายการ
  4. Offline upload queue retry อัตโนมัติเมื่อกลับออนไลน์
- **Tasks**
  - FE: ปรับ UI รองรับไฟล์หลายรายการ — *เหตุผล:* ฝึกจัด layout สำหรับรายการไฟล์ย่อยๆ และสื่อสารสถานะ conflict ให้เข้าใจง่าย *(Ref: Attachment gallery UX)*  
    - ใช้ gallery แบบแนวนอนหรือรายการสั้น ๆ ใน `ActivityCard`  
    - เพิ่ม badge/ไอคอนเมื่อไฟล์มี conflict หรืออัปโหลดไม่สำเร็จ  
    - ให้ผู้ใช้ reorder ไม่จำเป็น ตัดออกเพื่อความเรียบง่าย
  - FE: จัดการ offline upload queue — *เหตุผล:* เรียนรู้การต่อยอด offline-first ด้วย queue manager ที่เรียบง่าย *(Ref: Retry queue pattern, IndexedDB queue)*  
    - เก็บไฟล์ที่รออัปโหลดใน IndexedDB พร้อมสถานะ `pending`, `failed`, `synced`  
    - เมื่อกลับออนไลน์ให้ลองอัปโหลดใหม่แบบต่อเนื่อง  
    - แสดง toast หากไฟล์บางรายการอัปโหลดไม่สำเร็จหลัง retry
  - BE: ขยาย edge function สำหรับ multi attachment — *เหตุผล:* ฝึกจัดการ quota และ versioning เพื่อรองรับ conflict detection *(Ref: File versioning, Supabase Edge Function)*  
    - อนุญาตหลายไฟล์/กิจกรรมโดยไม่จำกัดจำนวน (แต่เช็ค quota รวม ≤ 20MB)  
    - เพิ่ม field `version` หรือ `updated_at` เพื่อให้ client ตรวจ conflict  
    - ลบไฟล์ใน Storage เมื่อ metadata ถูกลบเพื่อไม่ให้ orphan
  - QA: ทดสอบหลายสถานการณ์ — *เหตุผล:* ให้แน่ใจว่า queue ทำงานและ conflict แจ้งเตือนชัดเจน *(Ref: Offline queue QA)*  
    - อัปโหลดหลายไฟล์พร้อมกัน, ลบทีละไฟล์, ตรวจ quota  
    - จำลอง offline หลังอัปโหลดครึ่งทาง → กลับออนไลน์ต้องต่อคิว  
    - ตรวจ conflict โดยให้อีกผู้ใช้ลบไฟล์ตอนที่ออฟไลน์ แล้วซิงก์กลับ

### Story [M4-S3] เปิด Google Maps จากกิจกรรม
- **เหตุผล:** เพิ่มความสะดวกให้ผู้ใช้ลงสนามจริง และได้ฝึกการสร้าง deeplink รวมถึงจัดการ fallback บนเว็บ
- **Acceptance Criteria**
  1. กิจกรรมที่มี location_lat/lng มีปุ่ม “เปิดแผนที่”
  2. กดแล้วเปิด Google Maps app/เว็บด้วยพิกัดถูกต้อง
  3. Analytics `open_map` บันทึก `activity_id`
  4. กรณีไม่มี location ซ่อนปุ่ม
- **Tasks**
  - FE: เพิ่มปุ่ม Google Maps deeplink — *เหตุผล:* ฝึกสร้าง deeplink ที่ง่ายและเชื่อถือได้บนเว็บ *(Ref: URL encoding, mobile web patterns)*  
    - ปุ่มอยู่ใน `ActivityCard` เมื่อมี lat/lng ครบ  
    - กดแล้วเรียก `window.open` ด้วย URL `https://www.google.com/maps/search/?api=1&query=lat,lng`  
    - ถ้า location ไม่ครบ ให้ซ่อนปุ่มเพื่อเลี่ยงความสับสน
  - FE: เก็บ analytics และ fallback — *เหตุผล:* ตอกย้ำสำคัญของ telemetry และ UX เมื่อ deeplink เปิดไม่ได้ *(Ref: Analytics instrumentation, graceful fallback)*  
    - ส่ง event `open_map` พร้อม `activity_id` และ `source = 'card'`  
    - หาก `window.open` ถูกบล็อกให้แสดง snackbar แจ้งให้เปิดเอง  
    - ไม่มี permission พิเศษ จำเป็นเพียงเช็คว่ามี lat/lng
  - BE: ตรวจ schema location fields — *เหตุผล:* ตรวจสอบ data integrity ว่ารองรับ lat/lng ที่ถูกต้อง *(Ref: Geo coordinate schema)*  
    - ยืนยันว่า field `location_lat`, `location_lng` เป็น double precision และอนุญาต null  
    - ไม่ต้องมี API เพิ่มเติม เพียงส่งค่าปัจจุบันให้ครบ  
    - อัปเดต seed data ให้มีตัวอย่างกิจกรรมพร้อม location
  - QA: ทดสอบบน iOS/Android และ desktop — *เหตุผล:* มั่นใจว่าประสบการณ์บนอุปกรณ์จริงทำงานและ fallback มองเห็น *(Ref: Cross-platform QA)*  
    - บนมือถือควรเปิดแอป Google Maps ถ้ามี, ถ้าไม่มีให้ fallback web  
    - ตรวจว่ากิจกรรมไม่มี location ไม่มีปุ่มแสดง  
    - ตรวจว่า analytics ถูกเรียกโดยดักจับผ่าน network log

### Story [M4-S4] แจ้งเตือน conflict เมื่อข้อมูลถูกแก้ระหว่าง offline
- **เหตุผล:** สุดท้ายเพิ่มความเสถียรสำหรับ multi-user offline → online และฝึกแนวคิด conflict resolution ที่เรียบง่าย
- **Acceptance Criteria**
  1. เมื่อ sync แล้วพบ `updated_at` ใหม่กว่า client แสดง toast และไอคอนแจ้งเตือนในรายการนั้น
  2. ผู้ใช้เปิดรายละเอียดเพื่อเลือกนำเข้าข้อมูลล่าสุดหรือเขียนทับ (ขั้นแรก server-wins)
  3. Log conflict เพื่อวัดความถี่
  4. Event `sync_conflict` ถูกส่งพร้อม resource id
- **Tasks**
  - FE: ตรวจจับ conflict ใน data layer — *เหตุผล:* เรียนรู้การเปรียบเทียบ metadata (`updated_at`) และแจ้งผู้ใช้โดยไม่เขียนระบบ diff ยุ่งยาก *(Ref: Conflict detection, server-wins strategy)*  
    - เมื่อ sync แล้วพบ `updated_at` จากเซิร์ฟเวอร์ใหม่กว่า local ให้ mark record  
    - แสดง toast แจ้ง “ข้อมูลอัปเดตบนอุปกรณ์อื่น” พร้อมปุ่มดูรายละเอียด  
    - ใส่ badge ในการ์ดที่มี conflict และปุ่ม “รับข้อมูลล่าสุด” (server wins)
  - BE: ส่งข้อมูลประกอบ conflict — *เหตุผล:* ให้ client มีข้อมูลพอสำหรับตัดสินใจโดยไม่เพิ่ม payload มาก *(Ref: Metadata fields, updated_by tracking)*  
    - ให้ทุก endpoint คืน `updated_at` และ `updated_by` (user id) เพื่อใช้ใน UI  
    - ไม่ต้องเพิ่ม API แยก เพียง ensure field อยู่ใน select  
    - Log conflict ใน edge function sync (optionally) เพื่อวิเคราะห์ทีหลัง
  - QA: จำลอง conflict end-to-end — *เหตุผล:* เข้าใจวิธีสร้างเหตุการณ์ขัดแย้งและตรวจว่า app ตอบสนองถูกต้อง *(Ref: Multi-device QA, conflict scenario)*  
    - ผู้ใช้ A ออฟไลน์แก้ข้อมูล, ผู้ใช้ B ออนไลน์แก้ record เดียวกัน, จากนั้น A sync  
    - ตรวจว่าระบบแสดงเตือนและไม่ทับข้อมูลของ B  
    - ตรวจ event `sync_conflict` ว่าส่ง id ถูกต้อง

---

## Cross-cutting Tasks
- **เหตุผล:** งานคร่อมทีมช่วยให้โปรเจกต์ side project นี้เดินหน้าอย่างมีระบบ และให้คุณได้ฝึกกระบวนการพัฒนาที่ครบวงจร
- Design: เตรียม Figma mobile-first, component spec, และ state (loading/empty/error) ให้ dev อ้างอิงง่าย — *เหตุผล:* ฝึกถ่ายทอด UX → UI อย่างมืออาชีพ *(Ref: Design tokens, mobile-first design)*
- DevOps: จัดการ Supabase migrations, edge functions, storage policy, และตั้ง CI (Bun lint/test) — *เหตุผล:* เรียนรู้การตั้ง pipeline ขั้นพื้นฐานเพื่อป้องกัน regression *(Ref: Database migration workflow, Bun scripts)*
- QA: วาง test plan manual + automation (Playwright viewport mobile) และระบุ smoke test ราย milestone — *เหตุผล:* ฝึกจัดการคุณภาพตั้งแต่ต้น ไม่รอปลายทาง *(Ref: Test plan template, Playwright mobile emulation)*
- Documentation: อัปเดต README, PRD, Changelog เมื่อเริ่มและปิดแต่ละ story — *เหตุผล:* ฝึกนิสัยเขียนเอกสารให้ทีม/อนาคตตัวเองเข้าใจง่าย *(Ref: Living documentation)*
- Analytics: เก็บ schema event ใน `src/lib/analytics.ts`, ตรวจการเคารพ analytics consent จาก Settings — *เหตุผล:* เข้าใจการตั้ง Analytics pipeline แบบ data privacy conscious *(Ref: Event taxonomy, consent management)*
