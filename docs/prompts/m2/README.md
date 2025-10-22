# Milestone 2: Activities, Today Mode, Budget, Attachments

## Tasks Overview

### 1. Activity CRUD (M2-S1)
- เพิ่ม/แก้/ลบกิจกรรม
- Modal form พร้อม validation
- Optimistic updates
- Mark complete

### 2. Today Mode (M2-S2)
- แสดงกิจกรรมวันนี้
- แยก Active/Completed sections
- Offline cache (read-only)

### 3. Budget Summary (M2-S3)
- เพิ่มค่าใช้จ่าย
- แสดง summary + คงเหลือ
- Tab: ทั้งหมด, ตามหมวด

### 4. Single Attachment (M2-S4)
- อัปโหลดไฟล์ ≤5MB (1 ไฟล์/กิจกรรม)
- Preview ภาพ/PDF
- ลบไฟล์ได้

## Database Schema

```sql
CREATE TABLE activities (
  id UUID PRIMARY KEY,
  trip_id UUID REFERENCES trips(id),
  day_id UUID REFERENCES trip_days(id),
  title TEXT NOT NULL,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE expenses (
  id UUID PRIMARY KEY,
  trip_id UUID REFERENCES trips(id),
  category TEXT,
  amount NUMERIC(12,2) NOT NULL,
  paid_by UUID REFERENCES profiles(id)
);

CREATE TABLE activity_attachments (
  id UUID PRIMARY KEY,
  activity_id UUID REFERENCES activities(id),
  file_name TEXT NOT NULL,
  file_size INTEGER CHECK (file_size <= 5242880),
  storage_path TEXT NOT NULL
);
```
