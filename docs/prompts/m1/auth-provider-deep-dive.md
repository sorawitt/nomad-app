# Auth Provider & Route Guard - Deep Dive Guide

## 📚 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Context API Deep Dive](#context-api-deep-dive)
3. [Authentication Flow](#authentication-flow)
4. [Performance Optimization](#performance-optimization)
5. [Route Guards Strategy](#route-guards-strategy)
6. [TypeScript Patterns](#typescript-patterns)
7. [Error Handling](#error-handling)
8. [Security Considerations](#security-considerations)
9. [Testing Strategies](#testing-strategies)
10. [Common Pitfalls](#common-pitfalls)
11. [Advanced Patterns](#advanced-patterns)

---

## Architecture Overview

### System Design

```
┌─────────────────────────────────────────────────┐
│                   Application                    │
├─────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────┐     │
│  │         BrowserRouter                  │     │
│  │  ┌─────────────────────────────────┐  │     │
│  │  │      AuthProvider               │  │     │
│  │  │  ┌───────────────────────────┐  │  │     │
│  │  │  │       Routes              │  │  │     │
│  │  │  │  ┌─────────────────────┐  │  │  │     │
│  │  │  │  │  Guards             │  │  │  │     │
│  │  │  │  │  ├─ ProtectedRoute  │  │  │  │     │
│  │  │  │  │  └─ GuestRoute      │  │  │  │     │
│  │  │  │  └─────────────────────┘  │  │  │     │
│  │  │  │       Components           │  │  │     │
│  │  │  └───────────────────────────┘  │  │     │
│  │  └─────────────────────────────────┘  │     │
│  └───────────────────────────────────────┘     │
└─────────────────────────────────────────────────┘
         ↕                          ↕
    Supabase Auth              Local State
```

### Data Flow

```
User Action → Component → useAuth Hook → AuthContext
                                             ↓
                                    AuthProvider State
                                             ↓
                                    Supabase Client
                                             ↓
                                    Backend/Database
```

---

## Context API Deep Dive

### Why Context Over Redux/Zustand?

#### Comparison Table

| Feature | Context API | Redux | Zustand |
|---------|-------------|-------|---------|
| **Bundle Size** | 0 KB (built-in) | ~3 KB | ~1 KB |
| **Learning Curve** | Low | High | Medium |
| **Boilerplate** | Minimal | Heavy | Minimal |
| **DevTools** | React DevTools | Redux DevTools | Custom |
| **Use Case** | Global state ที่ไม่ซับซ้อน | Complex state logic | Medium complexity |

**เลือก Context API เพราะ:**
- Auth state ไม่ซับซ้อน (user, session, loading)
- ไม่ต้องการ time-travel debugging
- ลด dependencies
- Performance เพียงพอสำหรับ auth state

### Context Implementation Breakdown

```tsx
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
```

#### ทำไม `undefined` แทน `null`?

**Design Decision:**

```tsx
// ❌ แบบผิด
const AuthContext = createContext<AuthContextValue | null>(null);

function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === null) {
    throw new Error('...');
  }
  
  // TypeScript ยัง complain ว่า context อาจเป็น null
  return context; // Type: AuthContextValue | null ⚠️
}

// ✅ แบบถูก
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('...');
  }
  
  // TypeScript รู้ว่าหลัง check แล้ว context ไม่ใช่ undefined
  return context; // Type: AuthContextValue ✅
}
```

**เหตุผล:**
1. **Type Narrowing:** TypeScript narrowing ทำงานดีกับ `undefined`
2. **Semantic Meaning:** 
   - `undefined` = "ไม่เคยตั้งค่า" (ไม่ได้อยู่ใน Provider)
   - `null` = "ตั้งค่าเป็น null จงใจ" (อาจสับสนกับ user: null)
3. **Convention:** React Context default เป็น `undefined`

### Provider Implementation Deep Dive

```tsx
export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
```

#### ทำไมแยก `session` และ `user`?

**Redundancy มีเหตุผล:**

```tsx
// session object structure
{
  access_token: "eyJ...",
  refresh_token: "...",
  expires_at: 1234567890,
  user: { id: "...", email: "..." }  // ⬅️ user อยู่ใน session
}
```

**ถ้าไม่แยก:**
```tsx
// ❌ ทุกครั้งที่ต้องการ user
const { session } = useAuth();
const userName = session?.user?.email; // deep nesting

// ต้อง check ทีละ layer
if (session && session.user && session.user.email) { ... }
```

**แยก state:**
```tsx
// ✅ สะดวกกว่า
const { user } = useAuth();
const userName = user?.email; // shallow

// check ง่าย
if (user?.email) { ... }
```

**Trade-off:**
- ✅ **Pros:** Developer Experience ดีขึ้น, less nesting
- ❌ **Cons:** Redundant state (แต่ไม่เป็นปัญหาเพราะ sync อัตโนมัติ)

---

## Authentication Flow

### Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    App Initialization                    │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  useEffect(() => {                                       │
│    1. getSession() ← Check localStorage/cookies         │
│    2. Set initial state                                  │
│    3. setLoading(false)                                  │
│  }, [])                                                  │
└─────────────────────────────────────────────────────────┘
                           ↓
           ┌───────────────┴───────────────┐
           │                               │
     Loading: false                  Loading: false
     Session: null                   Session: {...}
           │                               │
           ↓                               ↓
    Redirect to /auth              Show protected content
           │                               │
           ↓                               ↓
   User logs in ──────────────────→ onAuthStateChange
                                            ↓
                                    Update state
                                            ↓
                                    Redirect to /
```

### Session Initialization Logic

```tsx
useEffect(() => {
  // Phase 1: Get initial session
  supabase.auth.getSession().then(({ data: { session } }) => {
    setSession(session);
    setUser(session?.user ?? null);
    setLoading(false);
  });

  // Phase 2: Listen for changes
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }
  );

  return () => subscription.unsubscribe();
}, []);
```

#### ทำไมต้องมีทั้ง `getSession()` และ `onAuthStateChange()`?

**เหตุผล:**

1. **`getSession()` - Initial State**
   ```tsx
   // เช็ค session ที่เก็บไว้ใน localStorage/cookies
   const { data: { session } } = await supabase.auth.getSession();
   ```
   - ทำงาน **1 ครั้ง** ตอน mount
   - **Synchronous read** จาก storage
   - ได้ผลลัพธ์ทันที (ไม่รอ network)

2. **`onAuthStateChange()` - Reactive Updates**
   ```tsx
   // ฟังการเปลี่ยนแปลง
   supabase.auth.onAuthStateChange((event, session) => {
     console.log(event); // 'SIGNED_IN', 'SIGNED_OUT', 'TOKEN_REFRESHED'
   });
   ```
   - ทำงาน **ทุกครั้ง** ที่ auth state เปลี่ยน
   - Handles: login, logout, token refresh, session expired
   - **Event-driven:** รับ notification จาก Supabase

**Scenario ที่เห็นความสำคัญ:**

```
User Action Timeline:
┌────────────────────────────────────────────────┐
│ 1. App starts                                  │
│    → getSession() อ่าน existing session       │
│    → แสดง UI ตาม session ที่มี                 │
├────────────────────────────────────────────────┤
│ 2. User clicks "Logout" (ใน tab อื่น)         │
│    → onAuthStateChange() ได้ event            │
│    → Update state ใน tab นี้ทันที              │
│    → Auto redirect to /auth                    │
├────────────────────────────────────────────────┤
│ 3. Token expiry (หลัง 1 ชั่วโมง)              │
│    → Supabase auto refresh token               │
│    → onAuthStateChange('TOKEN_REFRESHED')      │
│    → Update state with new token               │
└────────────────────────────────────────────────┘
```

**ถ้าใช้แค่ `getSession()`:**
- ❌ ไม่รู้เมื่อ user logout ใน tab อื่น
- ❌ ไม่รู้เมื่อ token refresh
- ❌ State ไม่ sync ระหว่าง tabs

**ถ้าใช้แค่ `onAuthStateChange()`:**
- ❌ ต้องรอ event แรก → loading นาน
- ❌ Flickering (แสดง guest content แล้วเปลี่ยนเป็น user content)

### Auth State Events

```tsx
supabase.auth.onAuthStateChange((event, session) => {
  console.log(event);
});
```

**Event Types:**

| Event | เกิดเมื่อ | Session State |
|-------|----------|---------------|
| `SIGNED_IN` | User login สำเร็จ | มี session ใหม่ |
| `SIGNED_OUT` | User logout | session = null |
| `TOKEN_REFRESHED` | Auto refresh token | session อัปเดต (token ใหม่) |
| `USER_UPDATED` | Update profile | session อัปเดต (user data) |
| `PASSWORD_RECOVERY` | Reset password | session ใหม่ (ถ้าสำเร็จ) |
| `INITIAL_SESSION` | เรียก getSession() | session ที่มีอยู่ |

**Advanced Handling:**

```tsx
supabase.auth.onAuthStateChange((event, session) => {
  // Track analytics
  if (event === 'SIGNED_IN') {
    analytics.track('user_logged_in', { userId: session?.user.id });
  }
  
  // Clear cache on logout
  if (event === 'SIGNED_OUT') {
    queryClient.clear();
    localStorage.removeItem('app_cache');
  }
  
  // Handle token refresh
  if (event === 'TOKEN_REFRESHED') {
    console.log('Token refreshed silently');
  }
});
```

---

## Performance Optimization

### useMemo Deep Dive

```tsx
const value = useMemo<AuthContextValue>(
  () => ({
    user,
    session,
    loading,
    signIn: async (email: string) => { ... },
    signInWithGoogle: async () => { ... },
    signOut: async () => { ... },
  }),
  [user, session, loading] // ⬅️ dependencies
);
```

#### Object Identity Problem

**JavaScript Behavior:**

```tsx
// Object ใหม่ทุกครั้ง
const obj1 = { name: 'John' };
const obj2 = { name: 'John' };

obj1 === obj2; // false ⚠️ (different references)

// Function ใหม่ทุกครั้ง
const fn1 = () => {};
const fn2 = () => {};

fn1 === fn2; // false ⚠️
```

**Impact on React:**

```tsx
// ❌ ไม่ใช้ useMemo
function AuthProvider({ children }) {
  const value = {
    user,
    signOut: () => supabase.auth.signOut()
  };
  
  // ทุกครั้งที่ AuthProvider re-render
  // value เป็น object ใหม่ → reference เปลี่ยน
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Component ที่ใช้ context
function UserMenu() {
  const auth = useAuth(); // ได้ object reference ใหม่ทุกครั้ง
  
  useEffect(() => {
    console.log('Auth changed!');
  }, [auth]); // 🔥 Fire ทุกครั้งที่ AuthProvider re-render
  
  return <button onClick={auth.signOut}>Logout</button>;
}
```

**Cascade Re-renders:**

```
AuthProvider re-render (เพราะ state เปลี่ยนที่อื่น)
    ↓
value object สร้างใหม่ (reference เปลี่ยน)
    ↓
Context consumers ทั้งหมด re-render
    ↓
Child components re-render
    ↓
Performance degradation 📉
```

#### useMemo Solution

```tsx
// ✅ ใช้ useMemo
const value = useMemo(
  () => ({
    user,
    session,
    loading,
    signOut: async () => { ... }
  }),
  [user, session, loading] // re-create เฉพาะเมื่อ deps เปลี่ยน
);
```

**Optimization Result:**

```
AuthProvider re-render (unrelated state change)
    ↓
useMemo checks dependencies
    ↓
Dependencies ไม่เปลี่ยน → คืน cached object
    ↓
Context consumers ไม่ re-render ✅
    ↓
Performance maintained 📈
```

### When Does useMemo Help?

**Measurement Example:**

```tsx
function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unrelatedState, setUnrelatedState] = useState(0); // state อื่น
  
  // ❌ ไม่ใช้ useMemo
  const value = { user, session, loading };
  
  // Scenario: เปลี่ยน unrelatedState
  setUnrelatedState(prev => prev + 1);
  // → AuthProvider re-render
  // → value object ใหม่
  // → consumers ทั้งหมด re-render 🔴
  
  // ✅ ใช้ useMemo
  const value = useMemo(
    () => ({ user, session, loading }),
    [user, session, loading]
  );
  
  // Scenario: เปลี่ยน unrelatedState
  setUnrelatedState(prev => prev + 1);
  // → AuthProvider re-render
  // → useMemo คืน cached value
  // → consumers ไม่ re-render ✅
}
```

**ใช้เมื่อไหร่:**
- ✅ Context value ที่มี consumers เยอะ
- ✅ Provider อยู่ high in component tree
- ✅ Dependencies มี่มีการเปลี่ยนแปลง
- ❌ Premature optimization (ถ้า app เล็ก ไม่จำเป็น)

### useCallback for Functions

**ทำไมไม่ใช้ useCallback สำหรับ functions?**

```tsx
// ❓ คำถาม: ควรใช้แบบนี้ไหม?
const signOut = useCallback(async () => {
  await supabase.auth.signOut();
}, []);

const value = useMemo(
  () => ({ user, session, loading, signOut }),
  [user, session, loading, signOut]
);
```

**คำตอบ: ไม่จำเป็น**

เหตุผล:
1. **useMemo ครอบแล้ว:** functions อยู่ใน useMemo ก็มี stable reference แล้ว
2. **Dependency Hell:** เพิ่ม complexity โดยไม่จำเป็น
3. **Trade-off:** Code ซับซ้อนขึ้น vs performance gain น้อยมาก

**เมื่อไหร่ถึงควรใช้ useCallback:**

```tsx
// ✅ ใช้เมื่อ function ถูกส่งเป็น prop โดยตรง
function Parent() {
  const handleClick = useCallback(() => {
    console.log('clicked');
  }, []);
  
  // ChildComponent.memo() จะ skip re-render ถ้า props ไม่เปลี่ยน
  return <ChildComponent onClick={handleClick} />;
}
```

---

## Route Guards Strategy

### ProtectedRoute Implementation

```tsx
export function ProtectedRoute({ children }: GuardProps) {
  const { session, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
```

#### Loading State State Machine

```
┌─────────────────────────────────────────┐
│         Initial State                    │
│  loading: true, session: null           │
└───────────────┬─────────────────────────┘
                ↓
        ┌───────────────┐
        │  Checking...  │
        │  (show spinner)│
        └───────┬───────┘
                ↓
     ┌──────────┴──────────┐
     ↓                     ↓
┌─────────────┐    ┌─────────────┐
│ Has Session │    │ No Session  │
│ loading:false│    │loading:false│
└──────┬──────┘    └──────┬──────┘
       ↓                  ↓
   Show Content      Redirect /auth
```

**ทำไม Loading State สำคัญ:**

```tsx
// ❌ ไม่มี loading state
function ProtectedRoute({ children }) {
  const { session } = useAuth();
  
  if (!session) {
    return <Navigate to="/auth" />;
  }
  
  return <>{children}</>;
}

// User Timeline:
// 1. App start → session = null (ยังไม่ได้เช็ค)
// 2. Render → redirect ไป /auth ทันที 🔴
// 3. getSession() complete → มี session
// 4. Redirect กลับมา / 🔴
// Result: เห็นหน้า /auth วูบแล้วกลับมา (bad UX)
```

```tsx
// ✅ มี loading state
function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();
  
  if (loading) {
    return <Spinner />; // รอจนกว่าจะรู้แน่ชัด
  }
  
  if (!session) {
    return <Navigate to="/auth" />;
  }
  
  return <>{children}</>;
}

// User Timeline:
// 1. App start → loading = true
// 2. Render → show spinner ✅
// 3. getSession() complete → loading = false, มี session
// 4. Show content ทันที ✅
// Result: ไม่มี flicker, UX ดี
```

### GuestRoute vs ProtectedRoute

```tsx
// GuestRoute: login แล้วห้ามเข้า
export function GuestRoute({ children }: GuardProps) {
  const { session, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  
  if (session) {
    return <Navigate to="/" replace />; // ⬅️ ตรงข้าม ProtectedRoute
  }

  return <>{children}</>;
}
```

**Use Cases:**

| Route Type | Use Case | Redirect Logic |
|------------|----------|----------------|
| **ProtectedRoute** | Dashboard, Profile, Settings | No session → /auth |
| **GuestRoute** | Login, Register, Reset Password | Has session → / |
| **PublicRoute** | Landing, About, Contact | No redirect |

**เหตุผลของ GuestRoute:**

```tsx
// Scenario: User กำลัง login อยู่แล้ว
// แล้วพิมพ์ URL /auth เข้าไป

// ❌ ถ้าไม่มี GuestRoute
// → แสดงหน้า login (แปลกเพราะ login อยู่แล้ว)
// → User confused

// ✅ มี GuestRoute
// → Auto redirect ไป dashboard
// → UX ดีขึ้น
```

### Advanced: Role-Based Guards

```tsx
type UserRole = 'admin' | 'user' | 'guest';

interface RoleGuardProps {
  children: ComponentChildren;
  allowedRoles: UserRole[];
  fallbackPath?: string;
}

export function RoleGuard({ 
  children, 
  allowedRoles,
  fallbackPath = '/'
}: RoleGuardProps) {
  const { user, loading } = useAuth();
  
  if (loading) return <LoadingSpinner />;
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  const userRole = user.user_metadata?.role as UserRole || 'user';
  
  if (!allowedRoles.includes(userRole)) {
    return <Navigate to={fallbackPath} replace />;
  }
  
  return <>{children}</>;
}

// Usage
<Route 
  path="/admin" 
  element={
    <RoleGuard allowedRoles={['admin']}>
      <AdminDashboard />
    </RoleGuard>
  } 
/>
```

### Navigate `replace` Deep Dive

```tsx
<Navigate to="/auth" replace />
```

**Browser History API:**

```tsx
// ไม่ใช้ replace (default)
history.push('/auth');

// Browser history stack:
['/trips', '/auth']  // เพิ่ม entry ใหม่
         ↑
    current

// User clicks back
['/trips', '/auth']
    ↑
  current (กลับไป /trips)

// ✅ ใช้ replace
history.replace('/auth');

// Browser history stack:
['/auth']  // แทนที่ current entry
    ↑
  current

// User clicks back
// → ออกจากแอปเลย (ไม่มี history ก่อนหน้า)
```

**Redirect Loop Prevention:**

```tsx
// Scenario: User เข้า /admin โดยที่ไม่ได้ login

// ❌ ไม่ใช้ replace
1. Navigate('/admin')        → history: ['/admin']
2. Guard redirect('/auth')   → history: ['/admin', '/auth']
3. User login
4. Navigate('/')             → history: ['/admin', '/auth', '/']
5. User clicks back          → history: ['/admin', '/auth', '/'] ← back to /auth
6. Has session → redirect /  → history: ['/admin', '/auth', '/', '/']
7. Infinite loop! 🔴

// ✅ ใช้ replace
1. Navigate('/admin')        → history: ['/admin']
2. Guard redirect('/auth')   → history: ['/auth']  (replace /admin)
3. User login
4. Navigate('/')             → history: ['/auth', '/']
5. User clicks back          → history: ['/auth', '/'] ← back to /auth
6. Has session → redirect /  → history: ['/']  (replace /auth)
7. No loop! ✅
```

---

## TypeScript Patterns

### Type Inference and Narrowing

```tsx
export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  
  // TypeScript รู้ว่าหลัง check แล้ว context ไม่ใช่ undefined
  return context; // Type: AuthContextValue (ไม่ใช่ AuthContextValue | undefined)
}
```

**Type Guard Pattern:**

```tsx
// Manual type guard
function isAuthenticated(
  auth: AuthContextValue
): auth is AuthContextValue & { user: User; session: Session } {
  return auth.user !== null && auth.session !== null;
}

// Usage
const auth = useAuth();

if (isAuthenticated(auth)) {
  // TypeScript รู้ว่า auth.user และ auth.session ไม่เป็น null
  console.log(auth.user.email); // ไม่ต้อง optional chaining
  console.log(auth.session.access_token);
}
```

### Generic Context Pattern

```tsx
// Reusable context factory
function createStrictContext<T>() {
  const Context = createContext<T | undefined>(undefined);
  
  function useStrictContext() {
    const context = useContext(Context);
    
    if (context === undefined) {
      throw new Error('useContext must be used within Provider');
    }
    
    return context;
  }
  
  return [Context, useStrictContext] as const;
}

// Usage
const [AuthContext, useAuth] = createStrictContext<AuthContextValue>();
```

### Discriminated Unions for Auth State

```tsx
// แทนที่ loading boolean
type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: User; session: Session }
  | { status: 'unauthenticated' };

// Usage
const auth = useAuth();

// TypeScript จะ narrow type ตาม status
switch (auth.status) {
  case 'loading':
    return <Spinner />;
    
  case 'authenticated':
    // TypeScript รู้ว่า user และ session มีแน่นอน
    console.log(auth.user.email);
    console.log(auth.session.access_token);
    break;
    
  case 'unauthenticated':
    return <Navigate to="/auth" />;
}
```

---

## Error Handling

### Comprehensive Error Strategy

```tsx
export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null); // เพิ่ม error state

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false; // ⬅️ Cleanup flag
      subscription.unsubscribe();
    };
  }, []);

  // ... rest of provider
}
```

### Why `mounted` Flag?

**Problem: Memory Leak & Warning**

```tsx
// ❌ ไม่มี mounted flag
useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    setSession(session); // ⚠️ อาจเกิด warning ถ้า component unmount แล้ว
  });
}, []);

// Warning: Can't perform a React state update on an unmounted component
```

**Scenario:**

```
1. Component mount → start async operation
2. User navigate away → Component unmount
3. Async operation complete → setState() ถูกเรียก
4. React warning: "state update on unmounted component"
```

**Solution:**

```tsx
// ✅ มี mounted flag
useEffect(() => {
  let mounted = true;
  
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (mounted) {  // ⬅️ check ก่อน setState
      setSession(session);
    }
  });
  
  return () => {
    mounted = false; // ⬅️ cleanup
  };
}, []);
```

### Error Boundary Integration

```tsx
// Error Boundary for auth errors
class AuthErrorBoundary extends Component<
  { children: ComponentChildren },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Auth error:', error, errorInfo);
    // Log to error tracking service
  }

  render() {
    if (this.state.hasError) {
      return (
        <div class="error-screen">
          <h1>Authentication Error</h1>
          <p>{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()}>
            Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrap AuthProvider
<AuthErrorBoundary>
  <AuthProvider>
    <App />
  </AuthProvider>
</AuthErrorBoundary>
```

---

## Security Considerations

### Token Security

**Supabase Token Storage:**

```
┌─────────────────────────────────────────┐
│         Browser Storage                  │
├─────────────────────────────────────────┤
│  localStorage:                           │
│  ├─ supabase.auth.token                 │
│  │   ├─ access_token (JWT)              │
│  │   ├─ refresh_token                   │
│  │   └─ expires_at                      │
│  └─ Auto-managed by Supabase client     │
└─────────────────────────────────────────┘
```

**Security Best Practices:**

1. **HTTPS Only**
   ```tsx
   // ⚠️ ห้ามใช้ HTTP in production
   // Tokens ถูกส่งผ่าน network → ต้อง encrypt
   
   // ✅ Force HTTPS
   if (window.location.protocol !== 'https:' && import.meta.env.PROD) {
     window.location.href = window.location.href.replace('http:', 'https:');
   }
   ```

2. **XSS Protection**
   ```tsx
   // ⚠️ อย่า inject user input โดยตรง
   const UserComment = ({ comment }: { comment: string }) => {
     // ❌ XSS vulnerability
     return <div dangerouslySetInnerHTML={{ __html: comment }} />;
     
     // ✅ React auto-escapes
     return <div>{comment}</div>;
   };
   ```

3. **CSRF Protection**
   ```tsx
   // Supabase handles CSRF automatically ผ่าน:
   // - Same-origin policy
   // - Token-based auth (ไม่ใช้ cookies)
   ```

### Row Level Security (RLS)

```sql
-- Database level security
-- ไม่ควรพึ่ง client-side auth เพียงอย่างเดียว

-- Example: Users can only see their own data
CREATE POLICY "Users can view own data"
ON users
FOR SELECT
USING (auth.uid() = id);

-- Example: Only authenticated users can insert
CREATE POLICY "Authenticated users can insert"
ON trips
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');
```

**Why RLS Matters:**

```tsx
// ❌ Client-side check อย่างเดียว (ไม่ปลอดภัย)
function fetchUserData() {
  const { user } = useAuth();
  
  if (!user) return; // ⚠️ แต่ใครก็เรียก API ได้ถ้า bypass UI
  
  // ถ้าไม่มี RLS: hacker สามารถเรียก API โดยตรงได้
  return supabase.from('users').select('*');
}

// ✅ RLS + Client-side check
// - Client-side: UX (hide UI)
// - RLS: Security (enforce at database level)
```

### Token Refresh Mechanism

```tsx
// Supabase handles this automatically
// But you can customize behavior:

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    console.log('Token refreshed', session?.access_token);
    
    // Update external services
    apiClient.setAuthToken(session?.access_token);
  }
});
```

**How Token Refresh Works:**

```
Initial Login:
├─ access_token (expires in 1 hour)
└─ refresh_token (expires in 30 days)

After 55 minutes:
├─ Supabase client checks expiry
├─ Calls refresh endpoint with refresh_token
├─ Gets new access_token
├─ Fires TOKEN_REFRESHED event
└─ Updates localStorage automatically
```

---

## Testing Strategies

### Unit Testing Provider

```tsx
// test/AuthProvider.test.tsx
import { render, waitFor } from '@testing-library/preact';
import { AuthProvider } from '@/app/provider';
import { useAuth } from '@/hooks/useAuth';

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } }
      })),
      signOut: jest.fn()
    }
  }
}));

describe('AuthProvider', () => {
  it('provides auth context to children', async () => {
    const mockSession = {
      user: { id: '123', email: 'test@example.com' }
    };
    
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: mockSession }
    });
    
    let authValue;
    function TestComponent() {
      authValue = useAuth();
      return null;
    }
    
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    await waitFor(() => {
      expect(authValue.loading).toBe(false);
      expect(authValue.user).toEqual(mockSession.user);
    });
  });
  
  it('throws error when used outside provider', () => {
    function TestComponent() {
      useAuth(); // Should throw
      return null;
    }
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useAuth must be used within AuthProvider');
  });
});
```

### Integration Testing Guards

```tsx
// test/guards.test.tsx
import { render, screen } from '@testing-library/preact';
import { BrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from '@/app/guards';
import { AuthProvider } from '@/app/provider';

describe('ProtectedRoute', () => {
  it('shows loading spinner while checking auth', () => {
    (supabase.auth.getSession as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );
    
    render(
      <BrowserRouter>
        <AuthProvider>
          <ProtectedRoute>
            <div>Protected Content</div>
          </ProtectedRoute>
        </AuthProvider>
      </BrowserRouter>
    );
    
    expect(screen.getByRole('status')).toBeInTheDocument(); // spinner
  });
  
  it('redirects to auth when not logged in', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null }
    });
    
    const { container } = render(
      <BrowserRouter>
        <AuthProvider>
          <ProtectedRoute>
            <div>Protected Content</div>
          </ProtectedRoute>
        </AuthProvider>
      </BrowserRouter>
    );
    
    await waitFor(() => {
      expect(window.location.pathname).toBe('/auth');
    });
  });
  
  it('shows content when logged in', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { user: { id: '123' } } }
    });
    
    render(
      <BrowserRouter>
        <AuthProvider>
          <ProtectedRoute>
            <div>Protected Content</div>
          </ProtectedRoute>
        </AuthProvider>
      </BrowserRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });
});
```

### E2E Testing

```tsx
// cypress/e2e/auth.cy.ts
describe('Authentication Flow', () => {
  it('protects routes when not logged in', () => {
    cy.visit('/dashboard');
    cy.url().should('include', '/auth');
  });
  
  it('allows access after login', () => {
    cy.visit('/auth');
    cy.get('[data-testid="email-input"]').type('test@example.com');
    cy.get('[data-testid="submit-button"]').click();
    
    // Mock OTP verification
    cy.window().then((win) => {
      win.localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock-token',
        user: { id: '123', email: 'test@example.com' }
      }));
    });
    
    cy.visit('/dashboard');
    cy.url().should('include', '/dashboard');
    cy.contains('Welcome').should('be.visible');
  });
  
  it('persists session across page reloads', () => {
    cy.login(); // Custom command
    cy.visit('/dashboard');
    cy.reload();
    cy.url().should('include', '/dashboard');
  });
  
  it('logs out successfully', () => {
    cy.login();
    cy.visit('/dashboard');
    cy.get('[data-testid="logout-button"]').click();
    cy.url().should('include', '/auth');
  });
});
```

---

## Common Pitfalls

### 1. Forgetting Loading State

```tsx
// ❌ Common mistake
function ProtectedRoute({ children }) {
  const { session } = useAuth();
  
  // Bug: ตอนแรก session = null (ยังไม่ได้เช็ค)
  // → redirect ทันที → flickering
  if (!session) {
    return <Navigate to="/auth" />;
  }
  
  return <>{children}</>;
}

// ✅ ถูกต้อง
function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();
  
  if (loading) return <LoadingSpinner />;
  if (!session) return <Navigate to="/auth" />;
  
  return <>{children}</>;
}
```

### 2. Not Cleaning Up Subscriptions

```tsx
// ❌ Memory leak
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(...);
  
  // Missing cleanup!
}, []);

// ✅ ถูกต้อง
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(...);
  
  return () => subscription.unsubscribe();
}, []);
```

### 3. Not Using `replace` in Navigate

```tsx
// ❌ Redirect loop
<Navigate to="/auth" /> // push to history

// ✅ ถูกต้อง
<Navigate to="/auth" replace /> // replace current entry
```

### 4. Checking Auth in Every Component

```tsx
// ❌ Anti-pattern
function UserProfile() {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/auth" />; // ทุก component ต้องเขียนเอง
  }
  
  return <div>Profile</div>;
}

// ✅ ใช้ Route Guard
<Route 
  path="/profile" 
  element={
    <ProtectedRoute>
      <UserProfile /> {/* ไม่ต้อง check auth */}
    </ProtectedRoute>
  } 
/>
```

### 5. Over-Fetching Auth State

```tsx
// ❌ Unnecessary re-fetching
function Navbar() {
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    // Re-fetch ทุกครั้งที่ component mount
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);
  
  return <div>{user?.email}</div>;
}

// ✅ ใช้ Context (single source of truth)
function Navbar() {
  const { user } = useAuth(); // อ่านจาก context
  return <div>{user?.email}</div>;
}
```

### 6. Not Handling Token Expiry

```tsx
// ❌ ไม่ handle expired token
async function fetchData() {
  const token = localStorage.getItem('token');
  
  // Token อาจ expire แล้ว
  const response = await fetch('/api/data', {
    headers: { Authorization: `Bearer ${token}` }
  });
}

// ✅ Let Supabase handle
async function fetchData() {
  // Supabase auto refresh token ถ้าจำเป็น
  const { data, error } = await supabase
    .from('table')
    .select('*');
}
```

### 7. Mixing Auth State Sources

```tsx
// ❌ Inconsistent state
function Component() {
  const { user: contextUser } = useAuth();
  const [localUser, setLocalUser] = useState(null);
  
  useEffect(() => {
    // ตอนนี้มี 2 sources → อาจไม่ sync
    supabase.auth.getUser().then(({ data }) => setLocalUser(data.user));
  }, []);
  
  // ใช้ user ไหน? 🤔
}

// ✅ Single source of truth
function Component() {
  const { user } = useAuth(); // เดียวเท่านั้น
}
```

---

## Advanced Patterns

### 1. Optimistic Updates

```tsx
function useOptimisticAuth() {
  const { signOut: originalSignOut, ...auth } = useAuth();
  
  const signOut = async () => {
    // 1. Update UI immediately (optimistic)
    setUser(null);
    setSession(null);
    
    // 2. Call actual API
    try {
      await originalSignOut();
    } catch (error) {
      // 3. Rollback on error
      setUser(auth.user);
      setSession(auth.session);
      throw error;
    }
  };
  
  return { ...auth, signOut };
}
```

### 2. Multi-Tab Sync

```tsx
// Sync auth state across browser tabs
useEffect(() => {
  const channel = new BroadcastChannel('auth');
  
  channel.onmessage = (event) => {
    if (event.data.type === 'SIGN_OUT') {
      setSession(null);
      setUser(null);
    }
  };
  
  return () => channel.close();
}, []);

// Broadcast logout
const signOut = async () => {
  await supabase.auth.signOut();
  
  const channel = new BroadcastChannel('auth');
  channel.postMessage({ type: 'SIGN_OUT' });
  channel.close();
};
```

### 3. Session Expiry Warning

```tsx
function useSessionExpiryWarning() {
  const { session } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  
  useEffect(() => {
    if (!session?.expires_at) return;
    
    const expiresAt = new Date(session.expires_at * 1000);
    const now = new Date();
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();
    const warningTime = timeUntilExpiry - 5 * 60 * 1000; // 5 min before
    
    if (warningTime > 0) {
      const timer = setTimeout(() => {
        setShowWarning(true);
      }, warningTime);
      
      return () => clearTimeout(timer);
    }
  }, [session]);
  
  return showWarning;
}

// Usage
function App() {
  const showWarning = useSessionExpiryWarning();
  
  if (showWarning) {
    return <SessionExpiryBanner />;
  }
  
  return <div>App Content</div>;
}
```

### 4. Conditional Provider Rendering

```tsx
// Skip provider for public routes
function App() {
  const location = useLocation();
  const isPublicRoute = ['/about', '/contact', '/pricing'].includes(location.pathname);
  
  if (isPublicRoute) {
    return <Routes>{/* public routes */}</Routes>;
  }
  
  return (
    <AuthProvider>
      <Routes>{/* protected routes */}</Routes>
    </AuthProvider>
  );
}
```

### 5. Lazy Loading Auth

```tsx
// Only load auth for authenticated routes
const AuthProvider = lazy(() => import('@/app/provider'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/public" element={<PublicPage />} />
        <Route
          path="/*"
          element={
            <AuthProvider>
              <ProtectedRoutes />
            </AuthProvider>
          }
        />
      </Routes>
    </Suspense>
  );
}
```

### 6. Auth Middleware Pattern

```tsx
// Create reusable auth middleware
function withAuth<P extends object>(
  Component: ComponentType<P & { user: User }>
) {
  return function WithAuthComponent(props: P) {
    const { user, loading } = useAuth();
    
    if (loading) return <LoadingSpinner />;
    if (!user) return <Navigate to="/auth" />;
    
    return <Component {...props} user={user} />;
  };
}

// Usage
const ProtectedPage = withAuth(({ user }) => {
  return <div>Welcome, {user.email}</div>;
});
```

### 7. Custom Auth Events

```tsx
// Extend auth with custom events
function useAuthWithEvents() {
  const auth = useAuth();
  
  const signInWithTracking = async (email: string) => {
    // Before
    analytics.track('sign_in_attempt', { email });
    
    try {
      await auth.signIn(email);
      // Success
      analytics.track('sign_in_success', { email });
    } catch (error) {
      // Error
      analytics.track('sign_in_error', { email, error });
      throw error;
    }
  };
  
  return {
    ...auth,
    signIn: signInWithTracking
  };
}
```

---

## Performance Benchmarks

### Measurement Tools

```tsx
// Measure render performance
function PerformanceMonitor({ children }: { children: ComponentChildren }) {
  useEffect(() => {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        console.log('Component render time:', entry.duration);
      }
    });
    
    observer.observe({ entryTypes: ['measure'] });
    
    return () => observer.disconnect();
  }, []);
  
  return <>{children}</>;
}

// Usage
<PerformanceMonitor>
  <AuthProvider>
    <App />
  </AuthProvider>
</PerformanceMonitor>
```

### Expected Metrics

| Metric | Target | Notes |
|--------|--------|-------|
| Initial auth check | < 100ms | getSession() from localStorage |
| Provider mount | < 50ms | Context creation |
| Guard decision | < 10ms | Synchronous check |
| Token refresh | < 500ms | Network call to Supabase |
| Re-render (optimized) | < 5ms | With useMemo |

---

## Troubleshooting Guide

### Issue: Infinite Redirect Loop

**Symptoms:**
- Browser URL keeps changing between `/auth` and `/`
- React warnings about too many updates

**Diagnosis:**
```tsx
// Add debug logs
console.log('Guard check:', { session, loading, pathname: location.pathname });
```

**Solutions:**
1. Check if `replace: true` in Navigate
2. Verify loading state is handled
3. Ensure auth state is initialized properly

### Issue: Session Not Persisting

**Symptoms:**
- User logged out after page refresh
- Session lost between tabs

**Diagnosis:**
```tsx
// Check localStorage
console.log(localStorage.getItem('supabase.auth.token'));
```

**Solutions:**
1. Verify Supabase is configured correctly
2. Check browser privacy settings (localStorage enabled?)
3. Ensure domain is consistent (not mixing www/non-www)

### Issue: Component Using useAuth Outside Provider

**Symptoms:**
- Error: "useAuth must be used within AuthProvider"

**Solutions:**
1. Verify component is wrapped in `<AuthProvider>`
2. Check router setup order
3. Look for conditional rendering issues

### Issue: Slow Initial Load

**Symptoms:**
- Loading spinner shows too long
- Delay before showing content

**Diagnosis:**
```tsx
// Measure auth check time
const start = performance.now();
await supabase.auth.getSession();
console.log('Auth check took:', performance.now() - start, 'ms');
```

**Solutions:**
1. Optimize Supabase initialization
2. Consider skeleton screens instead of spinner
3. Preload auth state if possible

---

## Summary: Key Takeaways

### Architecture Decisions

| Decision | Reason | Trade-off |
|----------|--------|-----------|
| Context API | Built-in, simple for auth state | Not for complex state management |
| Separate user & session | Better DX, less nesting | Slight redundancy |
| Loading state | Prevent UI flicker | Extra complexity |
| useMemo for value | Prevent unnecessary re-renders | Minimal perf overhead |
| Route guards | Declarative, reusable | Extra component layer |
| TypeScript strict mode | Catch errors early | More typing work |

### Best Practices Checklist

- ✅ Always handle loading state in guards
- ✅ Use `replace` in Navigate to prevent loops
- ✅ Clean up subscriptions in useEffect
- ✅ Use useMemo for context value
- ✅ Throw error in custom hooks if used outside provider
- ✅ Implement RLS at database level
- ✅ Test auth flows (unit + integration + e2e)
- ✅ Monitor performance metrics
- ✅ Handle token refresh gracefully
- ✅ Sync state across tabs if needed

### Common Patterns

```tsx
// 1. Context + Hook pattern
const Context = createContext(undefined);
export const Provider = ({ children }) => { /* ... */ };
export const useHook = () => { /* throw if undefined */ };

// 2. Guard pattern
const Guard = ({ children }) => {
  if (loading) return <Spinner />;
  if (!authorized) return <Navigate replace />;
  return <>{children}</>;
};

// 3. Type narrowing
if (context === undefined) throw new Error();
return context; // TypeScript knows it's not undefined

// 4. Cleanup pattern
useEffect(() => {
  const subscription = subscribe();
  return () => subscription.unsubscribe();
}, []);
```

---

## References & Further Reading

### Official Documentation
- [React Context API](https://react.dev/reference/react/useContext)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [React Router](https://reactrouter.com/en/main)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)

### Related Patterns
- Render Props
- Higher-Order Components (HOC)
- Custom Hooks
- Compound Components

### Performance
- [React Profiler](https://react.dev/reference/react/Profiler)
- [useMemo vs useCallback](https://react.dev/reference/react/useMemo)

---

**Last Updated:** October 2025  
**Version:** 1.0.0  
**Author:** Technical Documentation Team
