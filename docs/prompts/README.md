# Trip Planner AI Prompts

คู่มือ prompts สำหรับใช้กับ AI ในการพัฒนา Trip Planner แต่ละ milestone

## โครงสร้าง

```
prompts/
├── m1/    # Milestone 1: Auth, Home, New Trip, Trip Detail
├── m2/    # Milestone 2: Activities, Today Mode, Budget, Attachments
├── m3/    # Milestone 3: Settings, Offline Cache, Share
└── m4/    # Milestone 4: Collaborators, Maps, Conflict, Multi-attachments
```

## Milestone 1: Auth, Home, New Trip, Analytics

### ✅ สร้างแล้ว (6 prompts)

1. **01-auth-screen.md** - Authentication หน้าแรก (Magic Link + Google OAuth)
2. **02-auth-provider.md** - Auth Context Provider + Route Guards
3. **03-supabase-auth-setup.md** - Setup Supabase Dashboard
4. **04-home-screen.md** - หน้า Home แสดงรายการทริป
5. **05-new-trip-form.md** - ฟอร์มสร้างทริปใหม่
6. **06-trip-detail-screen.md** - หน้า Trip Detail แสดง Day list

## Milestone 2: Activities, Today Mode, Budget, Attachments

**Tasks to create:**
- Activity Form + CRUD
- Today Mode view
- Budget summary
- Single attachment upload

## Milestone 3: Settings, Offline Cache, Share

**Tasks to create:**
- Settings screen
- Offline cache layer
- Share trip via token

## Milestone 4: Collaborators, Maps, Conflict, Multi-attachments

**Tasks to create:**
- Collaborator management
- Multi-attachments + queue
- Google Maps deeplink
- Conflict detection

---

## วิธีใช้

### 1. เลือก Prompt ตาม Task
```bash
# ดู list prompts
ls docs/prompts/m1/

# อ่าน prompt
cat docs/prompts/m1/01-auth-screen.md
```

### 2. Copy Prompt ให้ AI

เปิดไฟล์ `.md` → copy เนื้อหาทั้งหมด → paste ให้ AI

### 3. AI จะ Generate Code

AI จะสร้าง code ตามที่ระบุใน prompt พร้อม:
- ✅ Component structure
- ✅ Type definitions
- ✅ Error handling
- ✅ Loading states
- ✅ Best practices

### 4. Test & Iterate

- ทดสอบ code ที่ได้
- ถ้ามี issue → copy error message กลับไปให้ AI
- Iterate จนได้ตามต้องการ

---

## Prompt Design Principles

### KISS (Keep It Simple, Stupid)
- ไม่ over-engineer
- ไม่แตก component เล็กเกินไป
- ใช้ built-in features ก่อน library

### Type Safety
- TypeScript strict mode
- Define types ทุก props
- ไม่ใช้ `any`

### Best Practices
- Error handling ครบถ้วน
- Loading states
- Accessibility (labels, semantic HTML)
- Mobile-first responsive

### No Over-Engineering
- ไม่ใช้ form library ถ้า controlled input พอ
- ไม่ใช้ state management ถ้า React Query พอ
- ไม่แยก file เยอะถ้าโค้ดไม่ซับซ้อน

---

## เพิ่ม Prompt ใหม่

### Template

````markdown
# Task: [Task Name]

## Context
[อธิบายว่าจะทำอะไร 1-2 ประโยค]

## Tech Stack
- Preact + TypeScript
- [อื่นๆ]

## Requirements

### File Structure
```
src/features/xxx/
├── Component.tsx
└── hooks/
    └── useXxx.ts
```

### Core Features
1. ✅ Feature 1
2. ✅ Feature 2

## Step-by-Step Implementation

### Step 1: [Title]
```tsx
// code here
```

### Step 2: [Title]
```tsx
// code here
```

## Testing Checklist
- [ ] Test case 1
- [ ] Test case 2

## Best Practices Applied
✅ KISS
✅ Type Safety

## Next Steps
1. Step 1
2. Step 2
````

---

## Contributing

เมื่อเพิ่ม prompt ใหม่:
1. ตั้งชื่อไฟล์: `{number}-{kebab-case}.md`
2. ใช้ template ด้านบน
3. ให้รายละเอียดครบตาม sections
4. ทดสอบ prompt กับ AI ก่อน commit

---

## หมายเหตุ

- Prompts ถูกออกแบบสำหรับ Claude/GPT-4
- เน้น step-by-step เพื่อให้ AI เข้าใจง่าย
- มี code examples ให้ AI copy pattern ได้
- มี testing checklist เพื่อ QA
