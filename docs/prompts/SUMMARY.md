# Trip Planner AI Prompts - สรุปภาพรวม

## 📁 โครงสร้างไฟล์

```
docs/prompts/
├── README.md              # คู่มือหลัก + วิธีใช้
├── SUMMARY.md            # ไฟล์นี้ - สรุปภาพรวม
├── m1/                   # Milestone 1 (6 prompts)
│   ├── 01-auth-screen.md
│   ├── 02-auth-provider.md
│   ├── 03-supabase-auth-setup.md
│   ├── 04-home-screen.md
│   ├── 05-new-trip-form.md
│   └── 06-trip-detail-screen.md
├── m2/                   # Milestone 2 (README only)
│   └── README.md
├── m3/                   # Milestone 3 (README only)
│   └── README.md
└── m4/                   # Milestone 4 (README only)
    └── README.md
```

## ✅ สถานะการสร้าง Prompts

### Milestone 1: Auth, Home, New Trip, Analytics ✅ COMPLETE

| #  | Task | File | สถานะ |
|----|------|------|-------|
| 1  | Auth Screen | 01-auth-screen.md | ✅ |
| 2  | Auth Provider & Guards | 02-auth-provider.md | ✅ |
| 3  | Supabase Auth Setup | 03-supabase-auth-setup.md | ✅ |
| 4  | Home Screen - Trip List | 04-home-screen.md | ✅ |
| 5  | New Trip Form | 05-new-trip-form.md | ✅ |
| 6  | Trip Detail - Day List | 06-trip-detail-screen.md | ✅ |

### Milestone 2: Activities, Today, Budget, Attachments 📋 PLANNED

| #  | Task | สถานะ |
|----|------|-------|
| 1  | Activity CRUD | 📝 ต้องสร้าง |
| 2  | Today Mode | 📝 ต้องสร้าง |
| 3  | Budget Summary | 📝 ต้องสร้าง |
| 4  | Single Attachment | 📝 ต้องสร้าง |

### Milestone 3: Settings, Offline, Share 📋 PLANNED

| #  | Task | สถานะ |
|----|------|-------|
| 1  | Settings Screen | 📝 ต้องสร้าง |
| 2  | Offline Cache | 📝 ต้องสร้าง |
| 3  | Share Trip Token | 📝 ต้องสร้าง |

### Milestone 4: Collaborators, Maps, Conflict 📋 PLANNED

| #  | Task | สถานะ |
|----|------|-------|
| 1  | Collaborator Editor | 📝 ต้องสร้าง |
| 2  | Multi-attachments + Conflict | 📝 ต้องสร้าง |
| 3  | Google Maps Deeplink | 📝 ต้องสร้าง |
| 4  | Conflict Alert | 📝 ต้องสร้าง |

## 🎯 วิธีใช้งาน

### 1. เริ่มต้นกับ M1 (พร้อมใช้งาน)

```bash
# อ่าน prompt
cat docs/prompts/m1/01-auth-screen.md

# Copy เนื้อหาทั้งหมด → Paste ให้ AI (Claude/GPT-4)
# AI จะ generate code ตาม prompt

# ทดสอบ code
bun run dev

# ถ้ามี error → copy error message กลับไปให้ AI
# Iterate จนได้ตามต้องการ
```

### 2. สำหรับ M2-M4 (ต้องสร้าง prompts เพิ่ม)

ตอนนี้มีแค่ README ที่สรุป overview
ต้องสร้าง detailed prompts แบบ M1 เพิ่ม

**Template:**
- ดู `m1/01-auth-screen.md` เป็นตัวอย่าง
- ใช้โครงสร้างเดียวกัน
- ปรับเนื้อหาตาม task

## 📊 สถิติ

- **Total Prompts Created:** 6 (M1 only)
- **Total Prompts Needed:** ~16-20 prompts
- **Progress:** 30-35%
- **Next Priority:** M2 detailed prompts

## 🔄 Development Flow แนะนำ

### Phase 1: M1 Implementation (2 สัปดาห์)
1. ใช้ prompts ที่มี (6 files)
2. Generate code ด้วย AI
3. Test + iterate
4. Commit เมื่อ task เสร็จ

### Phase 2: M2 Implementation (2 สัปดาห์)
1. **สร้าง detailed prompts ก่อน** (ใช้ M1 เป็น template)
2. Generate code ด้วย AI
3. Integration testing
4. Deploy + QA

### Phase 3: M3 Implementation (2 สัปดาห์)
1. สร้าง prompts
2. Implement offline sync (ซับซ้อน - ใช้เวลามาก)
3. Test offline scenarios

### Phase 4: M4 Implementation (2 สัปดาห์)
1. สร้าง prompts
2. Implement collaboration features
3. End-to-end testing ทั้งระบบ

## 💡 Best Practices

### เมื่อสร้าง Prompt ใหม่
✅ ใช้โครงสร้างเดียวกับ M1
✅ ระบุ file structure ชัดเจน
✅ มี step-by-step implementation
✅ มี code examples
✅ มี testing checklist
✅ อธิบาย "ทำไม" สำหรับ design decisions

### เมื่อใช้ Prompt กับ AI
✅ Copy เนื้อหาทั้งหมด (including code blocks)
✅ บอก AI ว่าใช้ tech stack อะไร
✅ Ask for clarification ถ้าไม่แน่ใจ
✅ Iterate จนได้ code ที่ต้องการ
✅ Test thoroughly ก่อน commit

## 🚀 Quick Start Commands

```bash
# ดู structure
tree docs/prompts

# อ่าน prompt
cat docs/prompts/m1/01-auth-screen.md

# ค้นหา keyword
grep -r "useAuth" docs/prompts

# นับจำนวน prompts
find docs/prompts -name "*.md" -not -name "README.md" | wc -l
```

## 📝 Next Steps

### Priority 1: สร้าง M2 Detailed Prompts
- [ ] 01-activity-crud.md
- [ ] 02-today-mode.md
- [ ] 03-budget-summary.md
- [ ] 04-single-attachment.md

### Priority 2: สร้าง M3 Detailed Prompts
- [ ] 01-settings.md
- [ ] 02-offline-cache.md
- [ ] 03-share-trip.md

### Priority 3: สร้าง M4 Detailed Prompts
- [ ] 01-collaborator-editor.md
- [ ] 02-multi-attachments.md
- [ ] 03-maps-deeplink.md
- [ ] 04-conflict-alert.md

## 🔗 Resources

- **Main PRD:** `docs/trip-planner-mini-app-prd.md`
- **User Stories:** `docs/trip-planner-stories.md`
- **Learning Path:** `docs/learning-todo.md`
- **Prompts README:** `docs/prompts/README.md`

---

**สร้างเมื่อ:** 2025-10-22
**Version:** 1.0
**Status:** M1 Complete, M2-M4 Planned
