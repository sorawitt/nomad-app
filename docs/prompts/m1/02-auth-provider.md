# Task: Auth Provider & Route Guard

## Context
สร้าง Auth context provider และ route protection สำหรับจัดการ session ทั้งแอป

## Tech Stack
- Preact + TypeScript
- React Context API
- React Router
- Supabase Auth

## Requirements

### File Structure
```
src/app/
├── provider.tsx         # AuthProvider
└── router.tsx           # Router with guards

src/hooks/
└── useAuth.ts          # Auth hook
```

### Core Features
1. ✅ AuthContext สำหรับ share session
2. ✅ `useAuth()` hook
3. ✅ Auto session refresh
4. ✅ Route guards (Protected + Guest)
5. ✅ Type-safe context

## Step-by-Step Implementation

### Step 1: Define Types

```tsx
// src/types/auth.ts
import type { User, Session } from '@supabase/supabase-js';

export type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};
```

### Step 2: Create AuthProvider

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
      signIn: async (email: string) => {
        const { error } = await supabase.auth.signInWithOtp({ email });
        if (error) throw error;
      },
      signInWithGoogle: async () => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin },
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

### Step 3: Create useAuth Hook

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

### Step 4: Create Route Guards

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

### Step 5: Setup Router

```tsx
// src/app/router.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './provider';
import { ProtectedRoute, GuestRoute } from './guards';

// Pages
import AuthScreen from '@/features/auth/AuthScreen';
import Home from '@/features/home/Home';
import TripDetail from '@/features/trips/TripDetail';

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
          <Route
            path="/trips/:id"
            element={
              <ProtectedRoute>
                <TripDetail />
              </ProtectedRoute>
            }
          />

          {/* 404 */}
          <Route path="*" element={<div>Not Found</div>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

### Step 6: App Entry Point

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

## Usage Examples

### In Components

```tsx
import { useAuth } from '@/hooks/useAuth';

function UserProfile() {
  const { user, signOut } = useAuth();

  return (
    <div>
      <p>Welcome, {user?.email}</p>
      <button onClick={signOut}>Logout</button>
    </div>
  );
}
```

### In AuthScreen

```tsx
import { useAuth } from '@/hooks/useAuth';

function AuthScreen() {
  const { signIn, signInWithGoogle } = useAuth();

  const handleSubmit = async (email: string) => {
    try {
      await signIn(email);
      alert('Check your email!');
    } catch (error) {
      console.error(error);
    }
  };

  // ... rest of component
}
```

## Testing Checklist

- [ ] Provider ห่อ app ถูกต้อง
- [ ] `useAuth()` คืนค่า user, session
- [ ] `useAuth()` นอก Provider → throw error
- [ ] Protected route: ไม่ login → redirect `/auth`
- [ ] Guest route: login แล้ว → redirect `/`
- [ ] Loading state แสดงระหว่างตรวจ session
- [ ] Session persist หลัง refresh page
- [ ] signOut → session cleared

## Best Practices Applied

✅ **Type Safety:** TypeScript generics สำหรับ context
✅ **KISS:** ใช้ context ง่ายๆ ไม่ซับซ้อน
✅ **Error Handling:** throw error เมื่อใช้ hook ผิด scope
✅ **Performance:** useMemo สำหรับ context value
✅ **Cleanup:** unsubscribe listener ใน useEffect
✅ **Loading UX:** แสดง spinner ระหว่างตรวจ session

## Security Notes

🔒 Session refresh ทำงานอัตโนมัติผ่าน Supabase client
🔒 Route guards ป้องกันการเข้าถึงหน้าที่ไม่มีสิทธิ์
🔒 Context ไม่เก็บ sensitive data (เฉพาะ user metadata)

## Common Issues

**Q: Loading state ไม่หาย?**
A: ตรวจสอบว่า `setLoading(false)` ถูกเรียกใน auth state change

**Q: Redirect loop?**
A: ใช้ `replace: true` ใน Navigate เพื่อไม่ให้เข้า history

**Q: Context undefined?**
A: ตรวจว่า component อยู่ใน `<AuthProvider>` หรือไม่

## Next Steps

1. ทดสอบ login → logout flow
2. เพิ่ม error boundary (optional)
3. เพิ่ม analytics tracking
4. ทดสอบ session expiry behavior
