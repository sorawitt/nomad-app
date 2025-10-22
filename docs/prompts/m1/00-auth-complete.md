# Task: Auth System Complete (Screen + Provider + Guards)

## Context
สร้างระบบ Authentication แบบครบชุดสำหรับ Trip Planner:
1. หน้า Auth Screen (Magic Link + Google OAuth)
2. Auth Context Provider สำหรับจัดการ session
3. Route Guards (Protected + Guest)

## Tech Stack
- Preact + TypeScript
- Tailwind CSS v4 (mobile-first)
- Supabase Auth
- React Router
- React Context API

## Requirements

### File Structure
```
src/
├── app/
│   ├── provider.tsx        # AuthProvider
│   ├── guards.tsx          # Route guards
│   ├── router.tsx          # Router config
│   └── index.tsx           # App entry
├── features/auth/
│   └── AuthScreen.tsx      # Login screen
├── hooks/
│   └── useAuth.ts          # Auth hook
├── types/
│   └── auth.ts             # Auth types
└── lib/
    └── supabase.ts         # Supabase client
```

### Core Features
1. ✅ Email Magic Link authentication
2. ✅ Google OAuth authentication
3. ✅ Auth Context Provider
4. ✅ Protected routes (require login)
5. ✅ Guest routes (redirect if logged in)
6. ✅ Auto session refresh
7. ✅ Loading states
8. ✅ Error handling

---

## Step-by-Step Implementation

### Step 1: Define Auth Types

```tsx
// src/types/auth.ts
import type { User, Session } from '@supabase/supabase-js';

export type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithEmail: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};
```

---

### Step 2: Initialize Supabase Client

```tsx
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
```

---

### Step 3: Create AuthProvider

```tsx
// src/app/provider.tsx
import { createContext } from 'preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { AuthContextValue } from '@/types/auth';

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthProviderProps = {
  children: ComponentChildren;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading,
      signInWithEmail: async (email: string) => {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
      },
      signInWithGoogle: async () => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    }),
    [user, session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
```

---

### Step 4: Create useAuth Hook

```tsx
// src/hooks/useAuth.ts
import { useContext } from 'preact/hooks';
import { AuthContext } from '@/app/provider';

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
```

---

### Step 5: Create Route Guards

```tsx
// src/app/guards.tsx
import { Navigate } from 'react-router-dom';
import type { ComponentChildren } from 'preact';
import { useAuth } from '@/hooks/useAuth';

type GuardProps = {
  children: ComponentChildren;
};

// Protected Route: ต้อง login
export function ProtectedRoute({ children }: GuardProps) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div class="min-h-screen flex items-center justify-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

// Guest Route: login แล้วห้ามเข้า
export function GuestRoute({ children }: GuardProps) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div class="min-h-screen flex items-center justify-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (session) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
```

---

### Step 6: Create Auth Screen

```tsx
// src/features/auth/AuthScreen.tsx
import { useState } from 'preact/hooks';
import { useAuth } from '@/hooks/useAuth';

export default function AuthScreen() {
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleMagicLink = async (e: Event) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('กรุณากรอกอีเมลที่ถูกต้อง');
      }

      await signInWithEmail(email);
      setSuccess(true);
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);

    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถเข้าสู่ระบบด้วย Google');
      setLoading(false);
    }
  };

  return (
    <div class="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <div class="max-w-md w-full">
        <div class="bg-white rounded-xl shadow-lg p-6 md:p-8 space-y-6">
          {/* Header */}
          <div class="text-center">
            <h1 class="text-2xl font-bold text-gray-900">Trip Planner</h1>
            <p class="text-sm text-gray-600 mt-2">เข้าสู่ระบบเพื่อจัดการทริปของคุณ</p>
          </div>

          {/* Success Message */}
          {success && (
            <div class="bg-green-50 border border-green-200 rounded-lg p-4">
              <p class="text-sm text-green-900">
                ✓ ส่งลิงก์ไปที่อีเมลแล้ว กรุณาตรวจสอบกล่องจดหมาย
              </p>
            </div>
          )}

          {/* Email Form */}
          <form onSubmit={handleMagicLink} class="space-y-4">
            <div>
              <label for="email" class="block text-sm font-medium text-gray-700 mb-2">
                อีเมล
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
                placeholder="your@email.com"
                required
                disabled={loading}
                class={`
                  w-full px-4 py-2 border rounded-lg
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  disabled:bg-gray-100 disabled:cursor-not-allowed
                  ${error ? 'border-red-500' : 'border-gray-300'}
                `}
              />
              {error && <p class="text-sm text-red-600 mt-1">{error}</p>}
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              class="w-full bg-blue-600 text-white font-medium py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {loading ? 'กำลังส่ง...' : 'ส่ง Magic Link'}
            </button>
          </form>

          {/* Divider */}
          <div class="relative">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-gray-300"></div>
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-2 bg-white text-gray-500">หรือ</span>
            </div>
          </div>

          {/* Google Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            class="w-full bg-white border border-gray-300 text-gray-700 font-medium py-3 rounded-lg hover:bg-gray-50 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            🔐 เข้าสู่ระบบด้วย Google
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

### Step 7: Setup Router

```tsx
// src/app/router.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './provider';
import { ProtectedRoute, GuestRoute } from './guards';

// Pages (placeholders)
import AuthScreen from '@/features/auth/AuthScreen';

// Temporary Home component
function Home() {
  const { user, signOut } = useAuth();
  return (
    <div class="min-h-screen bg-gray-50 p-8">
      <div class="max-w-4xl mx-auto">
        <div class="bg-white rounded-lg shadow p-6">
          <h1 class="text-2xl font-bold mb-4">Welcome!</h1>
          <p class="text-gray-600 mb-4">Logged in as: {user?.email}</p>
          <button
            onClick={signOut}
            class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

export function Router() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Guest Routes */}
          <Route
            path="/auth"
            element={
              <GuestRoute>
                <AuthScreen />
              </GuestRoute>
            }
          />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />

          {/* 404 */}
          <Route path="*" element={<div class="p-8 text-center">Not Found</div>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

---

### Step 8: App Entry Point

```tsx
// src/app/index.tsx
import { render } from 'preact';
import { Router } from './router';
import '@/styles/globals.css';

function App() {
  return <Router />;
}

render(<App />, document.getElementById('app')!);
```

---

### Step 9: Environment Setup

```bash
# .env.local
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
```

```gitignore
# .gitignore
.env*.local
.env.production
```

---

## Testing Checklist

### Auth Screen
- [ ] กรอกอีเมลถูกต้อง → ได้รับ Magic Link
- [ ] กรอกอีเมลผิด → error message
- [ ] คลิก Google → popup OAuth
- [ ] Success message แสดงหลังส่ง Magic Link
- [ ] Loading state ระหว่าง submit

### Auth Provider
- [ ] Provider ห่อ app ถูกต้อง
- [ ] `useAuth()` คืนค่า user, session, loading
- [ ] `useAuth()` นอก Provider → throw error
- [ ] Session persist หลัง refresh page
- [ ] Auth state change trigger re-render

### Route Guards
- [ ] Protected route: ไม่ login → redirect `/auth`
- [ ] Guest route: login แล้ว → redirect `/`
- [ ] Loading spinner แสดงระหว่างตรวจ session
- [ ] ไม่มี redirect loop

### Integration
- [ ] Login สำเร็จ → auto redirect ไป `/`
- [ ] Logout → redirect ไป `/auth`
- [ ] Refresh page → session ยังอยู่
- [ ] Multiple tabs → session sync
- [ ] Network error → แสดง error message

---

## Best Practices Applied

✅ **KISS:** ใช้ Context API เรียบง่าย ไม่ซับซ้อน
✅ **Type Safety:** TypeScript strict types ทุก component
✅ **Error Handling:** try-catch + user-friendly messages
✅ **Performance:** useMemo สำหรับ context value
✅ **Cleanup:** unsubscribe listener ใน useEffect
✅ **Loading UX:** Spinner ระหว่างตรวจ session
✅ **Security:** ไม่เก็บ sensitive data ใน context
✅ **Accessibility:** Labels, semantic HTML, ARIA attributes
✅ **Mobile-First:** Responsive design, touch-friendly
✅ **No Over-Engineering:** ไม่ใช้ Redux/Zustand (Context พอ)

---

## Dependencies

```json
{
  "dependencies": {
    "preact": "^10.19.0",
    "react-router-dom": "^6.20.0",
    "@supabase/supabase-js": "^2.38.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```

Install:
```bash
bun add preact react-router-dom @supabase/supabase-js
bun add -d @types/node typescript vite
```

---

## Common Issues & Solutions

### Q: Loading state ไม่หาย?
**A:** ตรวจสอบว่า `setLoading(false)` ถูกเรียกใน `onAuthStateChange`

### Q: Redirect loop?
**A:** ใช้ `replace: true` ใน `<Navigate>` เพื่อไม่ให้เข้า history

### Q: Context undefined?
**A:** ตรวจว่า component อยู่ใน `<AuthProvider>` wrapper หรือไม่

### Q: Magic Link ไม่ได้รับ?
**A:**
- ตรวจ spam folder
- ตรวจ Supabase email template settings
- ตรวจ Supabase logs: Authentication → Logs

### Q: Google OAuth error `redirect_uri_mismatch`?
**A:** ตรวจ redirect URI ใน Google Console ต้องตรงกับ Supabase:
```
https://<project-ref>.supabase.co/auth/v1/callback
```

### Q: Session ไม่ persist?
**A:** ตรวจ `persistSession: true` ใน Supabase client config

### Q: TypeScript errors?
**A:** ตรวจว่าติดตั้ง `@types/node` และ config `tsconfig.json` ถูกต้อง

---

## Security Notes

🔒 **ไม่ commit `.env.local`** → เพิ่มใน `.gitignore`
🔒 **ใช้ anon key** (ไม่ใช่ service role key) บน client
🔒 **Rotate secrets** เมื่อมี security incident
🔒 **Enable RLS** บน Supabase tables
🔒 **Validate ทุก input** ก่อนส่ง API
🔒 **ไม่เก็บ password** ใน state/localStorage

---

## Performance Tips

⚡ **useMemo:** ใช้สำหรับ context value เพื่อป้องกัน re-render
⚡ **Code splitting:** Lazy load pages ด้วย `React.lazy` (future)
⚡ **Bundle size:** Preact เล็กกว่า React (~3KB)
⚡ **Auth check:** ทำแค่ครั้งเดียวตอน mount

---

## Next Steps

1. **ทดสอบ complete auth flow**
   - Login → Logout → Re-login
   - Session persistence
   - Error cases

2. **ตั้งค่า Supabase Dashboard**
   - ดู `03-supabase-auth-setup.md` สำหรับ detailed guide
   - Enable Magic Link + Google OAuth
   - Set redirect URLs

3. **เพิ่ม features**
   - Toast notifications (react-hot-toast)
   - Password reset flow
   - Email verification

4. **สร้างหน้าถัดไป**
   - Home screen (trip list)
   - New trip form
   - Trip detail

5. **เพิ่ม analytics**
   - Track auth events
   - Monitor errors
   - User behavior

---

## Related Files

- `03-supabase-auth-setup.md` - Supabase configuration guide
- `04-home-screen.md` - Home screen implementation
- `trip-planner-mini-app-prd.md` - Full PRD document
