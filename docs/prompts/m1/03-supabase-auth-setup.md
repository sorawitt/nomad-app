# Task: Supabase Auth Configuration

## Context
ตั้งค่า Supabase Auth สำหรับ Magic Link และ Google OAuth

## Requirements

### Supabase Dashboard Setup
1. ✅ Email OTP (Magic Link)
2. ✅ Google OAuth Provider
3. ✅ Redirect URLs
4. ✅ Email Templates
5. ✅ Environment Variables

## Step-by-Step Setup

### Step 1: Supabase Project Setup

1. ไปที่ [Supabase Dashboard](https://app.supabase.com)
2. เลือกโปรเจกต์หรือสร้างใหม่
3. ไปที่ **Project Settings** → **General**
4. บันทึก **Reference ID** และ **API URL**

### Step 2: Enable Email Auth (Magic Link)

1. ไปที่ **Authentication** → **Providers**
2. เลือก **Email**
3. เปิด toggle **Enable Email provider**
4. เปิด **Confirm email** (optional)
5. คลิก **Save**

**Custom Email Template (Optional):**
- ไปที่ **Authentication** → **Email Templates**
- เลือก **Magic Link**
- แก้ subject/body ตามต้องการ

### Step 3: Setup Google OAuth

#### 3.1 Google Cloud Console

1. ไปที่ [Google Cloud Console](https://console.cloud.google.com)
2. สร้าง Project ใหม่หรือเลือก existing project
3. ไปที่ **APIs & Services** → **OAuth consent screen**

**OAuth Consent Screen:**
- User Type: **External**
- App name: `Trip Planner`
- User support email: your@email.com
- Developer contact: your@email.com
- คลิก **Save and Continue**

#### 3.2 Create OAuth Credentials

1. ไปที่ **Credentials** → **Create Credentials** → **OAuth Client ID**
2. Application type: **Web application**
3. Name: `Trip Planner Web`

**Authorized JavaScript origins:**
```
http://localhost:5173
https://yourdomain.com
```

**Authorized redirect URIs:**
```
https://<project-ref>.supabase.co/auth/v1/callback
http://localhost:5173/auth/callback
https://yourdomain.com/auth/callback
```

4. คลิก **Create**
5. คัดลอก **Client ID** และ **Client Secret**

#### 3.3 Configure Supabase

1. กลับไปที่ Supabase Dashboard
2. ไปที่ **Authentication** → **Providers**
3. เลือก **Google**
4. เปิด toggle **Enable Sign in with Google**
5. วาง **Client ID** และ **Client Secret**
6. คลิก **Save**

### Step 4: Configure Redirect URLs

1. ไปที่ **Authentication** → **URL Configuration**
2. ตั้งค่า **Site URL:**

**Development:**
```
http://localhost:5173
```

**Production:**
```
https://yourdomain.com
```

3. ตั้งค่า **Redirect URLs:**

```
http://localhost:5173/**
https://yourdomain.com/**
```

4. คลิก **Save**

### Step 5: Setup Environment Variables

สร้างไฟล์ `.env.local`:

```bash
# Supabase
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>

# App
VITE_APP_VERSION=0.1.0
```

**หา Anon Key:**
1. ไปที่ **Project Settings** → **API**
2. คัดลอก **anon public** key

### Step 6: Initialize Supabase Client

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

### Step 7: Create Auth Callback Handler (Optional)

```tsx
// src/features/auth/AuthCallback.tsx
import { useEffect } from 'preact/hooks';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Handle OAuth callback
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/', { replace: true });
      } else {
        navigate('/auth', { replace: true });
      }
    });
  }, [navigate]);

  return (
    <div class="min-h-screen flex items-center justify-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
}
```

**เพิ่ม route:**
```tsx
// src/app/router.tsx
<Route path="/auth/callback" element={<AuthCallback />} />
```

## Testing Checklist

### Magic Link
- [ ] กรอกอีเมล → ได้รับ Magic Link ใน inbox
- [ ] คลิกลิงก์ → redirect กลับแอปพร้อม session
- [ ] ตรวจ spam/junk folder ถ้าไม่เจอ
- [ ] ทดสอบ expired link → error message

### Google OAuth
- [ ] คลิกปุ่ม Google → popup OAuth consent
- [ ] เลือก account → redirect กลับแอป
- [ ] ตรวจว่า session ถูกสร้าง
- [ ] ยกเลิก OAuth → กลับหน้า auth ไม่ error

### Environment
- [ ] Dev: localhost:5173 ทำงาน
- [ ] Production: domain จริงทำงาน
- [ ] Environment variables โหลดถูกต้อง
- [ ] Redirect URLs ถูกต้องทั้ง dev/prod

## Common Issues

**Q: Magic Link ไม่ได้รับ?**
- ตรวจ spam folder
- ตรวจว่า email provider block หรือไม่
- ตรวจ Supabase logs: Authentication → Logs

**Q: Google OAuth error `redirect_uri_mismatch`?**
- ตรวจว่า redirect URI ใน Google Console ตรงกับ Supabase
- Format: `https://<project-ref>.supabase.co/auth/v1/callback`

**Q: CORS error?**
- ตรวจ Site URL และ Redirect URLs ใน Supabase
- ตรวจ Authorized JavaScript origins ใน Google Console

**Q: Session ไม่ persist?**
- ตรวจ `persistSession: true` ใน supabase client
- ตรวจ browser cookies ไม่ถูก block

## Security Best Practices

🔒 **ไม่ commit `.env.local`** → เพิ่มใน `.gitignore`
🔒 **ใช้ anon key** (ไม่ใช่ service role key) สำหรับ client
🔒 **Rotate secrets** เมื่อมี security incident
🔒 **Enable email confirmation** สำหรับ production
🔒 **Setup rate limiting** ใน Supabase dashboard

## Environment Files

**`.env.local` (local dev):**
```bash
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
```

**`.env.production` (production):**
```bash
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
```

**`.gitignore`:**
```
.env*.local
.env.production
```

## Next Steps

1. ทดสอบ Magic Link end-to-end
2. ทดสอบ Google OAuth end-to-end
3. Custom email template (optional)
4. Setup email rate limiting
5. Monitor auth logs ใน Supabase
6. เพิ่ม analytics tracking
