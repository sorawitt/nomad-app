# Trip Planner Learning Path

## Priority Topics (ต้องเรียนก่อน)

### 1. Supabase Auth Setup
**ทำอะไร:**
- เปิด Email OTP (Magic Link) ใน Supabase Dashboard
- ตั้งค่า Google OAuth (Client ID/Secret)
- กำหนด redirect URL: dev + production
- Config `.env.local`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

**ทดสอบ:**
- ส่ง Magic Link → ตรวจอีเมล → ล็อกอินสำเร็จ
- Google OAuth → กลับมาหน้าแอปพร้อม session

**Resources:** [Supabase Auth docs](https://supabase.com/docs/guides/auth), Google OAuth redirect URI setup

---

### 2. Preact Component Composition
**ทำอะไร:**
- ทำความเข้าใจ JSX + functional components
- แบ่งส่วน UI: `AuthLayout`, `LoginCard`, `AuthForm`
- สร้าง reusable components: `TripCard`, `Button`, `Card`

**Patterns:**
- Container/Presentation pattern
- Props composition
- `children` prop สำหรับ flexibility

**Resources:** Preact docs (Components), React composition patterns

---

### 3. Tailwind Responsive Utilities
**ทำอะไร:**
- เข้าใจ mobile-first approach
- ใช้ breakpoints: `sm:`, `md:`, `lg:`, `xl:`
- สร้าง skeleton, grid, flex layouts

**ตัวอย่าง:**
```html
<div class="max-w-md mx-auto p-4 md:p-6">
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <!-- cards here -->
  </div>
</div>
```

**Resources:** Tailwind docs (Responsive Design), [Tailwind Play](https://play.tailwindcss.com)

---

### 4. React Context + TypeScript
**ทำอะไร:**
- สร้าง `AuthContext` พร้อม type
- Provider component ที่จัดการ session
- Hook `useAuth()` เพื่อเข้าถึง context

**ตัวอย่าง:**
```ts
type AuthContextValue = {
  user: User | null;
  session: Session | null;
  signInWithEmail(email: string): Promise<void>;
  signOut(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
```

**Resources:** React Context docs, TypeScript generics basics

---

### 5. React Router Guards
**ทำอะไร:**
- สร้าง `ProtectedRoute` wrapper
- ตรวจ session → redirect ถ้าไม่ login
- `GuestRoute` สำหรับหน้า auth

**ตัวอย่าง:**
```tsx
const ProtectedRoute = ({ children }) => {
  const { session } = useAuth();
  if (!session) return <Navigate to="/auth" replace />;
  return children;
};
```

**Resources:** React Router docs (Route protection patterns)

---

## Data Fetching & State

### TanStack Query (React Query)
- Query keys, `useQuery`, `useMutation`
- Cache invalidation
- Optimistic updates

### SWR Alternative
- เปรียบเทียบกับ React Query
- เลือกตามความเหมาะสม

**Resources:** TanStack Query docs, SWR docs

---

## Forms & Validation

### Form Handling
- react-hook-form / controlled components
- Validation patterns ใน Preact

### Schema Validation
- Zod สำหรับ type-safe validation
- ใช้กับฟอร์ม + API payload

**Resources:** Zod docs, react-hook-form docs

---

## Supabase & Database

### SQL View & RPC
- สร้าง view: `trips_view`, `get_today_activities`
- Postgres stored procedures

### Row Level Security (RLS)
- Policy patterns: owner/editor/read-only
- ทดสอบ RLS ผ่าน dashboard

### Storage & Signed URLs
- Upload flow ด้วย signed URL
- Bucket policies (private)

### Triggers
- Auto-update `updated_at` timestamp
- การใช้ triggers เพื่อ sync

**Resources:** Supabase docs (Database, Storage, RLS), Postgres trigger examples

---

## Offline & Sync

### IndexedDB via localForage
- API basics: `setItem`, `getItem`
- Cache trips/days/activities

### Sync Strategies
- `Navigator.onLine` event
- `visibilitychange` สำหรับ background sync
- Conflict detection (Last-write-wins)

**Resources:** localForage docs, offline-first patterns

---

## UI/UX References

### UI States
- Skeleton loading states
- Empty states + CTA
- Error states + retry button

### Web Share API
- ใช้บนมือถือสำหรับแชร์ลิงก์
- Fallback: copy to clipboard

### Attachment Gallery
- แนวนอน scroll / list layout
- Badge สำหรับ status

**Resources:** Material Design (State patterns), iOS HIG

---

## Testing

### Vitest + Testing Library
- Unit tests สำหรับ components
- Mock Supabase ด้วย MSW
- Snapshot testing สำหรับ UI states

### Playwright (E2E)
- Mobile viewport testing
- Cross-browser testing

**Resources:** Vitest docs, Testing Library Preact, Playwright docs

---

## Analytics

### Event Taxonomy
- กำหนด schema: `create_trip`, `add_activity`, etc.
- Payload structure

### Consent Management
- เคารพ analytics toggle
- ไม่เก็บข้อมูลส่วนบุคคล

**Resources:** PostHog docs, Analytics best practices

---

## DevOps

### Bun Scripts
- `bun run lint/test/build`
- Custom scripts ใน `package.json`

### Supabase CLI
- Migration workflow: `supabase migration new`
- Local development

### Living Documentation
- อัปเดต README, PRD, Changelog
- Markdown best practices

**Resources:** Bun docs, Supabase CLI docs

---

## Optional Deep Dives

### Supabase Edge Functions
- Serverless functions สำหรับ signed URL
- Deploy + testing

### TypeScript Utility Types
- `Pick`, `Partial`, `Omit`, `ReturnType`
- ใช้ใน service/hook

### Offline-First Case Studies
- PouchDB patterns
- Firebase offline behavior

**Resources:** Edge Functions docs, TypeScript handbook, Offline-first articles
