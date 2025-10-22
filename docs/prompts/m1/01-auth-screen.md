# Task: Auth Screen (Mobile-First)

## Context
สร้างหน้า Authentication สำหรับ Trip Planner ที่รองรับ Magic Link และ Google OAuth

## Tech Stack
- Preact + TypeScript
- Tailwind CSS v4 (mobile-first)
- Supabase Auth
- React Router

## Requirements

### File Structure
```
src/features/auth/
├── AuthScreen.tsx          # Main screen
└── components/
    ├── EmailForm.tsx       # Email input form (optional)
    └── SocialButton.tsx    # OAuth button (optional)
```

### Core Features
1. ✅ Email input with validation
2. ✅ Magic Link button
3. ✅ Google OAuth button
4. ✅ Loading states
5. ✅ Error handling
6. ✅ Auto-redirect when logged in
7. ✅ Toast notifications

### UI Specifications

**Layout:**
- Centered card: `max-w-md mx-auto`
- Padding: `p-4 md:p-6`
- Background: gradient `from-blue-50 to-white`

**Form:**
- Email validation: regex pattern
- Inline error messages
- Disabled state during loading

**Buttons:**
- Primary: Magic Link (blue)
- Secondary: Google OAuth (white with border)
- Loading spinner when active

## Step-by-Step Implementation

### Step 1: Create Component Structure

```tsx
import { useState, useEffect } from 'preact/hooks';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Implementation here
}
```

### Step 2: Handle Magic Link

```tsx
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

    // Send magic link
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin
      }
    });

    if (error) throw error;

    // Show success message
    alert('ส่งลิงก์ไปที่อีเมลแล้ว กรุณาตรวจสอบ');
    setEmail('');
  } catch (err) {
    setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
  } finally {
    setLoading(false);
  }
};
```

### Step 3: Handle Google OAuth

```tsx
const handleGoogleLogin = async () => {
  setError(null);
  setLoading(true);

  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });

    if (error) throw error;
  } catch (err) {
    setError(err instanceof Error ? err.message : 'ไม่สามารถเข้าสู่ระบบด้วย Google');
    setLoading(false);
  }
};
```

### Step 4: Auto-Redirect Logic

```tsx
useEffect(() => {
  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) navigate('/', { replace: true });
  };

  checkSession();

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
      navigate('/', { replace: true });
    }
  });

  return () => subscription.unsubscribe();
}, [navigate]);
```

### Step 5: Build UI

```tsx
return (
  <div class="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
    <div class="max-w-md w-full">
      <div class="bg-white rounded-xl shadow-lg p-6 md:p-8 space-y-6">

        {/* Header */}
        <div class="text-center">
          <h1 class="text-2xl font-bold text-gray-900">Trip Planner</h1>
          <p class="text-sm text-gray-600 mt-2">เข้าสู่ระบบเพื่อจัดการทริปของคุณ</p>
        </div>

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
          class="w-full bg-white border border-gray-300 text-gray-700 font-medium py-3 rounded-lg hover:bg-gray-50 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          เข้าสู่ระบบด้วย Google
        </button>
      </div>
    </div>
  </div>
);
```

## Testing Checklist

- [ ] กรอกอีเมลถูกต้อง → ได้รับ Magic Link
- [ ] กรอกอีเมลผิด → error message
- [ ] คลิก Google → popup OAuth
- [ ] Login สำเร็จ → redirect ไป `/`
- [ ] มี session อยู่แล้ว → auto-redirect
- [ ] ทดสอบบน mobile (responsive)
- [ ] Loading states ทำงาน
- [ ] Disabled states ป้องกันคลิกซ้ำ

## Best Practices Applied

✅ **KISS:** ไม่แยก sub-components เพราะ logic ไม่ซับซ้อน
✅ **Type Safety:** TypeScript types ครบถ้วน
✅ **Error Handling:** try-catch + user-friendly messages
✅ **Accessibility:** label, semantic HTML, focus states
✅ **Mobile-First:** Tailwind responsive utilities
✅ **No Over-Engineering:** ไม่ใช้ form library (controlled component เพียงพอ)

## Dependencies

```json
{
  "preact": "^10.x",
  "react-router-dom": "^6.x",
  "@supabase/supabase-js": "^2.x"
}
```

## Environment Variables

```bash
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
```

## Next Steps

1. ทดสอบการทำงานบน development
2. เพิ่ม toast library (optional): `react-hot-toast`
3. เพิ่ม analytics tracking: `auth_attempt`, `auth_success`
4. ทดสอบบน production environment
