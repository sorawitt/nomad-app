# Trip Planner Mini-App

Side project ที่ทดลองต่อยอด Preact + Supabase สำหรับจัดการทริปกลุ่มแบบ mobile-first  
เป้าหมายคือมี Auth ครบ, หน้าหลักที่ดึงข้อมูลจริง, และ flow การเรียนรู้ทีละ milestone

---

## Features
- Supabase Auth (Magic Link + Google OAuth) พร้อม context/provider และ route guard
- โครงสร้าง router ที่แยก Protected/Guest + OAuth callback screen
- Home screen ที่ใช้ React Query ดึงรายการทริปและแสดงผ่าน `TripCard`
- Tailwind CSS v4 + component primitives สำหรับ UI mobile-first
- เอกสาร prompts ไล่ตาม milestone 1–4 สำหรับคนอยากเรียนโค้ดทีละเรื่อง

## Tech Stack
- **Frontend:** Preact 10, TypeScript, Vite, Tailwind CSS v4
- **State/Data:** @tanstack/react-query, Supabase JS v2
- **Routing:** preact-router (main), wouter (hook ช่วย navigate)
- **Tooling:** Bun (package manager + lockfile), Vitest (พร้อมใช้ถ้าอยากเขียนเทสต์)

---

## Getting Started

### ติดตั้งของที่ต้องมี
- Node 18+ หรือ Bun 1.1+
- โปรเจ็กต์ Supabase (ใช้ URL + anon key)
- Tailwind CLI ไม่ต้องลงเพิ่ม เพราะ Vite ไล่ผ่าน plugin อยู่แล้ว

### Clone + Install
```bash
git clone https://github.com/<your-name>/trip-planner-mini-app.git
cd trip-planner-mini-app
bun install
```

### Env Variables
```bash
cp .env.example .env.local
# แก้ไฟล์ .env.local ให้มีค่า:
# VITE_SUPABASE_URL=https://xxx.supabase.co
# VITE_SUPABASE_ANON_KEY=xxxx
```

### Run
```bash
bun run dev      # เปิด Vite dev server ที่ http://localhost:5173
```

### Scripts อื่น
- `bun run build` – build โปรดักชัน (tsc + vite)
- `bun run preview` – เสิร์ฟไฟล์ build แบบ local

---

## Project Structure (ส่วนที่น่ารู้)
```
src/
├─ app/          # Auth provider, guards, router
├─ features/
│  ├─ auth/      # Auth screen + OAuth callback
│  └─ home/      # Home UI, hooks, TripCard
├─ hooks/        # useAuth
├─ lib/          # Supabase client
└─ styles/       # Tailwind entry
```

---

## Learning Roadmap
- Milestone 1: Auth flows, Home list, New Trip form
- Milestone 2: Activity CRUD, Today Mode, Budget summary, Single attachment
- Milestone 3: Settings, Offline cache, Shared read-only token
- Milestone 4: Collaborator editor, Maps deeplink, Conflict alerts

เอกสารแต่ละเรื่องอยู่ใน `docs/prompts/<milestone>` เปิดอ่านตามลำดับได้

---

## Deploy Notes
- Build แล้วโยนขึ้น Netlify/Vercel ได้เลย (static hosting)
- อย่าลืมตั้งค่า environment variables ให้ตรงกับ Supabase
- การเก็บไฟล์แนบ / offline queue ยังอยู่ใน roadmap (Milestone 2–4)

---

## License
เผยแพร่ภายใต้สัญญาอนุญาต [MIT](./LICENSE) คุณสามารถนำไปใช้ ปรับแก้ หรือแจกจ่ายต่อได้ตามเงื่อนไขที่กำหนด
