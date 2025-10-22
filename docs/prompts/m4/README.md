# Milestone 4: Collaborators, Maps, Conflict, Multi-attachments

## Tasks Overview

### 1. Collaborator Editor (M4-S1)
- Owner เชิญ editor ผ่านอีเมล
- Editor CRUD กิจกรรม/ค่าใช้จ่าย/ไฟล์
- แสดงรายการสมาชิก + role

### 2. Multi-attachments + Conflict (M4-S2)
- หลายไฟล์/กิจกรรม (รวม ≤20MB)
- Offline upload queue
- Conflict alert + toast

### 3. Google Maps Deeplink (M4-S3)
- ปุ่ม "เปิดแผนที่" ใน ActivityCard
- Deeplink: `https://www.google.com/maps/search/?api=1&query=lat,lng`

### 4. Conflict Alert (M4-S4)
- ตรวจ `updated_at` local vs server
- Toast แจ้งเตือน
- Server-wins strategy

## Database Schema

```sql
CREATE TABLE trip_members (
  id UUID PRIMARY KEY,
  trip_id UUID REFERENCES trips(id),
  user_id UUID REFERENCES profiles(id),
  role TEXT CHECK (role IN ('owner','editor')),
  UNIQUE (trip_id, user_id)
);

-- Remove 1-file constraint from activity_attachments
-- Add version field for conflict detection
ALTER TABLE activity_attachments 
  ADD COLUMN version INTEGER DEFAULT 1,
  ADD COLUMN updated_by UUID REFERENCES profiles(id);
```
