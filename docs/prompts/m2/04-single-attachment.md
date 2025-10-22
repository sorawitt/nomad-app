# Task: Single Attachment - แนบไฟล์

## Context
สร้างระบบแนบไฟล์ (ภาพหรือ PDF) ให้กับกิจกรรม โดยแต่ละกิจกรรมสามารถแนบไฟล์ได้ 1 ไฟล์ ขนาดไม่เกิน 5MB ใช้ Supabase Storage พร้อม preview และ progress bar ขณะอัปโหลด

## Tech Stack
- **Preact + TypeScript**: Component และ Type Safety
- **TanStack Query**: Data fetching, mutations, cache
- **Supabase Storage**: File storage (private bucket)
- **Supabase Database**: เก็บ metadata ของไฟล์
- **Tailwind CSS v4**: Styling (mobile-first)

## Requirements

### Functional Requirements
- อัปโหลดไฟล์: ภาพ (JPEG, PNG, WebP) หรือ PDF
- จำกัดขนาด: ≤ 5MB
- จำนวน: 1 ไฟล์ต่อ 1 กิจกรรม
- Preview: แสดงภาพ หรือ icon+download สำหรับ PDF
- Progress bar แสดงขณะอัปโหลด
- ลบไฟล์ (owner/editor เท่านั้น)
- ใช้ signed URL (60 วินาที expiry) สำหรับ private files
- Analytics tracking

### File Types & Size
```typescript
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
```

## Step-by-Step Implementation

### Step 1: Database Migration

สร้างตาราง `activity_attachments` และ RLS policies

**File: `supabase/migrations/003_activity_attachments.sql`**

```sql
-- ตาราง activity_attachments
CREATE TABLE activity_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 5242880),
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID NOT NULL REFERENCES profiles(id),
  CONSTRAINT one_file_per_activity UNIQUE (activity_id)
);

-- Index
CREATE INDEX idx_attachments_activity ON activity_attachments(activity_id);

-- RLS Enable
ALTER TABLE activity_attachments ENABLE ROW LEVEL SECURITY;

-- Policy: อ่านได้ถ้าเป็นสมาชิกทริป
CREATE POLICY "Members can view attachments"
  ON activity_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM activities a
      JOIN trip_members tm ON tm.trip_id = a.trip_id
      WHERE a.id = activity_attachments.activity_id
        AND tm.user_id = auth.uid()
    )
  );

-- Policy: เพิ่มได้ถ้าเป็น owner/editor และยังไม่มีไฟล์
CREATE POLICY "Owner/Editor can insert attachment"
  ON activity_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM activities a
      JOIN trip_members tm ON tm.trip_id = a.trip_id
      WHERE a.id = activity_attachments.activity_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'editor')
    )
    AND NOT EXISTS (
      SELECT 1 FROM activity_attachments aa
      WHERE aa.activity_id = activity_attachments.activity_id
    )
  );

-- Policy: ลบได้ถ้าเป็น owner/editor
CREATE POLICY "Owner/Editor can delete attachment"
  ON activity_attachments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM activities a
      JOIN trip_members tm ON tm.trip_id = a.trip_id
      WHERE a.id = activity_attachments.activity_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'editor')
    )
  );
```

**Run migration:**
```bash
supabase db push
```

---

### Step 2: Supabase Storage Setup

สร้าง bucket และ policies ผ่าน Supabase Dashboard หรือ SQL

**File: `supabase/migrations/004_storage_bucket.sql`**

```sql
-- สร้าง bucket: trip-attachments (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('trip-attachments', 'trip-attachments', false);

-- Policy: อ่านได้ถ้าเป็นสมาชิกทริป
CREATE POLICY "Members can view files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'trip-attachments'
    AND EXISTS (
      SELECT 1 FROM activity_attachments aa
      JOIN activities a ON a.id = aa.activity_id
      JOIN trip_members tm ON tm.trip_id = a.trip_id
      WHERE aa.storage_path = name
        AND tm.user_id = auth.uid()
    )
  );

-- Policy: owner/editor สามารถอัปโหลดได้
CREATE POLICY "Owner/Editor can upload files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'trip-attachments'
    AND (storage.foldername(name))[1] IN (
      SELECT a.trip_id::text
      FROM activities a
      JOIN trip_members tm ON tm.trip_id = a.trip_id
      WHERE tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'editor')
    )
  );

-- Policy: owner/editor สามารถลบได้
CREATE POLICY "Owner/Editor can delete files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'trip-attachments'
    AND EXISTS (
      SELECT 1 FROM activity_attachments aa
      JOIN activities a ON a.id = aa.activity_id
      JOIN trip_members tm ON tm.trip_id = a.trip_id
      WHERE aa.storage_path = name
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'editor')
    )
  );
```

**Run migration:**
```bash
supabase db push
```

---

### Step 3: Type Definitions

**File: `src/types/attachment.ts`**

```typescript
export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
] as const;

export type AllowedFileType = typeof ALLOWED_FILE_TYPES[number];

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export interface Attachment {
  id: string;
  activity_id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  storage_path: string;
  created_at: string;
  created_by: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadAttachmentInput {
  activity_id: string;
  file: File;
}
```

---

### Step 4: Hooks - useAttachment

**File: `src/hooks/useAttachment.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Attachment } from '@/types/attachment';

export function useAttachment(activityId: string) {
  return useQuery({
    queryKey: ['attachment', activityId],
    queryFn: async (): Promise<Attachment | null> => {
      const { data, error } = await supabase
        .from('activity_attachments')
        .select('*')
        .eq('activity_id', activityId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
```

---

### Step 5: Hooks - useUploadAttachment

**File: `src/hooks/useUploadAttachment.ts`**

```typescript
import { useState } from 'preact/hooks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { UploadAttachmentInput, Attachment, UploadProgress, AllowedFileType } from '@/types/attachment';
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from '@/types/attachment';
import { trackEvent } from '@/lib/analytics';

export function useUploadAttachment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<UploadProgress | null>(null);

  const mutation = useMutation({
    mutationFn: async ({ activity_id, file }: UploadAttachmentInput): Promise<Attachment> => {
      // Validation: file type
      if (!ALLOWED_FILE_TYPES.includes(file.type as AllowedFileType)) {
        throw new Error('ไฟล์ต้องเป็นรูปภาพ (JPEG, PNG, WebP) หรือ PDF เท่านั้น');
      }

      // Validation: file size
      if (file.size > MAX_FILE_SIZE) {
        throw new Error('ไฟล์มีขนาดเกิน 5MB');
      }

      // Step 1: ดึงข้อมูล trip_id จาก activity
      const { data: activity, error: activityError } = await supabase
        .from('activities')
        .select('trip_id')
        .eq('id', activity_id)
        .single();

      if (activityError) throw activityError;

      // Step 2: สร้าง storage path
      const fileExt = file.name.split('.').pop();
      const fileName = `${activity_id}_${Date.now()}.${fileExt}`;
      const storagePath = `${activity.trip_id}/${fileName}`;

      // Step 3: อัปโหลดไฟล์ไปยัง Storage
      setProgress({ loaded: 0, total: file.size, percentage: 0 });

      const { error: uploadError } = await supabase.storage
        .from('trip-attachments')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
          // Note: supabase-js ไม่ support upload progress ใน browser
          // ใช้ setTimeout เพื่อจำลอง progress แทน
        });

      if (uploadError) {
        setProgress(null);
        throw uploadError;
      }

      // Simulate progress (supabase-js doesn't support onUploadProgress)
      setProgress({ loaded: file.size, total: file.size, percentage: 100 });

      // Step 4: บันทึก metadata ลง database
      const { data: attachment, error: dbError } = await supabase
        .from('activity_attachments')
        .insert({
          activity_id,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          storage_path: storagePath,
          created_by: user!.id
        })
        .select()
        .single();

      if (dbError) {
        // Rollback: ลบไฟล์จาก storage
        await supabase.storage.from('trip-attachments').remove([storagePath]);
        setProgress(null);
        throw dbError;
      }

      setProgress(null);
      return attachment;
    },
    onSuccess: (attachment) => {
      // Invalidate cache
      queryClient.invalidateQueries({ queryKey: ['attachment', attachment.activity_id] });

      // Track analytics
      trackEvent('upload_attachment', {
        activity_id: attachment.activity_id,
        file_type: attachment.file_type,
        file_size: attachment.file_size
      });
    },
    onError: () => {
      setProgress(null);
    }
  });

  return {
    ...mutation,
    progress
  };
}
```

---

### Step 6: Hooks - useDeleteAttachment

**File: `src/hooks/useDeleteAttachment.ts`**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Attachment } from '@/types/attachment';

export function useDeleteAttachment(activityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (attachment: Attachment): Promise<void> => {
      // Step 1: ลบไฟล์จาก Storage
      const { error: storageError } = await supabase.storage
        .from('trip-attachments')
        .remove([attachment.storage_path]);

      if (storageError) throw storageError;

      // Step 2: ลบ metadata จาก Database
      const { error: dbError } = await supabase
        .from('activity_attachments')
        .delete()
        .eq('id', attachment.id);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      // Invalidate cache
      queryClient.invalidateQueries({ queryKey: ['attachment', activityId] });
    }
  });
}
```

---

### Step 7: Hooks - useSignedUrl

**File: `src/hooks/useSignedUrl.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useSignedUrl(storagePath: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: ['signed-url', storagePath],
    queryFn: async (): Promise<string | null> => {
      if (!storagePath) return null;

      const { data, error } = await supabase.storage
        .from('trip-attachments')
        .createSignedUrl(storagePath, 60); // 60 seconds expiry

      if (error) throw error;
      return data.signedUrl;
    },
    enabled: enabled && !!storagePath,
    staleTime: 1000 * 50, // 50 seconds (before expiry)
    refetchInterval: 1000 * 50, // refresh before expiry
  });
}
```

---

### Step 8: Component - AttachmentButton

แสดงปุ่มแนบไฟล์ใน ActivityCard

**File: `src/components/activity/AttachmentButton.tsx`**

```typescript
import { useRef, useState } from 'preact/hooks';
import { useAttachment } from '@/hooks/useAttachment';
import { useUploadAttachment } from '@/hooks/useUploadAttachment';
import { useDeleteAttachment } from '@/hooks/useDeleteAttachment';
import { AttachmentPreview } from './AttachmentPreview';
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from '@/types/attachment';

interface Props {
  activityId: string;
  canEdit: boolean;
}

export function AttachmentButton({ activityId, canEdit }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPreview, setShowPreview] = useState(false);

  const { data: attachment, isLoading } = useAttachment(activityId);
  const uploadMutation = useUploadAttachment();
  const deleteMutation = useDeleteAttachment(activityId);

  const handleFileSelect = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      await uploadMutation.mutateAsync({ activity_id: activityId, file });
    } catch (error: any) {
      alert(error.message || 'ไม่สามารถอัปโหลดไฟล์ได้');
    }

    // Reset input
    input.value = '';
  };

  const handleDelete = async () => {
    if (!attachment) return;
    if (!confirm('ต้องการลบไฟล์นี้?')) return;

    try {
      await deleteMutation.mutateAsync(attachment);
    } catch (error) {
      alert('ไม่สามารถลบไฟล์ได้');
    }
  };

  if (isLoading) {
    return (
      <div class="w-6 h-6 bg-gray-200 rounded animate-pulse" />
    );
  }

  // Has attachment
  if (attachment) {
    const isImage = attachment.file_type.startsWith('image/');

    return (
      <>
        <div class="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(true)}
            class="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
          >
            {isImage ? (
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            ) : (
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            )}
            <span>{attachment.file_name}</span>
          </button>

          {canEdit && (
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              class="text-red-500 hover:text-red-600 disabled:opacity-50"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>

        {showPreview && (
          <AttachmentPreview
            attachment={attachment}
            onClose={() => setShowPreview(false)}
          />
        )}
      </>
    );
  }

  // No attachment - show upload button
  if (!canEdit) return null;

  return (
    <>
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploadMutation.isPending}
        class="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
      >
        {uploadMutation.isPending ? (
          <>
            <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {uploadMutation.progress && (
              <span>{uploadMutation.progress.percentage.toFixed(0)}%</span>
            )}
          </>
        ) : (
          <>
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <span>แนบไฟล์</span>
          </>
        )}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_FILE_TYPES.join(',')}
        onChange={handleFileSelect}
        class="hidden"
      />
    </>
  );
}
```

---

### Step 9: Component - AttachmentPreview (Modal)

**File: `src/components/activity/AttachmentPreview.tsx`**

```typescript
import { useSignedUrl } from '@/hooks/useSignedUrl';
import type { Attachment } from '@/types/attachment';

interface Props {
  attachment: Attachment;
  onClose: () => void;
}

export function AttachmentPreview({ attachment, onClose }: Props) {
  const { data: signedUrl, isLoading } = useSignedUrl(attachment.storage_path);

  const isImage = attachment.file_type.startsWith('image/');
  const isPdf = attachment.file_type === 'application/pdf';

  const handleDownload = () => {
    if (!signedUrl) return;

    const a = document.createElement('a');
    a.href = signedUrl;
    a.download = attachment.file_name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        class="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div class="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div class="flex-1 min-w-0">
            <h3 class="font-semibold text-gray-900 truncate">{attachment.file_name}</h3>
            <p class="text-sm text-gray-500">
              {(attachment.file_size / 1024).toFixed(1)} KB
            </p>
          </div>
          <div class="flex items-center gap-3">
            {signedUrl && (
              <button
                onClick={handleDownload}
                class="text-blue-600 hover:text-blue-700"
                title="ดาวน์โหลด"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              class="text-gray-400 hover:text-gray-600"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div class="p-6">
          {isLoading && (
            <div class="flex items-center justify-center h-64">
              <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
            </div>
          )}

          {!isLoading && signedUrl && (
            <>
              {/* Image Preview */}
              {isImage && (
                <img
                  src={signedUrl}
                  alt={attachment.file_name}
                  class="max-w-full h-auto rounded-lg"
                />
              )}

              {/* PDF Preview */}
              {isPdf && (
                <div class="text-center space-y-4">
                  <div class="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                    <svg class="w-12 h-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p class="text-gray-600">ไฟล์ PDF</p>
                  <button
                    onClick={handleDownload}
                    class="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    ดาวน์โหลด
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

### Step 10: Integration - Update ActivityCard

แก้ไข ActivityCard ให้แสดง AttachmentButton

**File: `src/components/activity/ActivityCard.tsx`** (ส่วนที่เพิ่ม)

```typescript
import { AttachmentButton } from './AttachmentButton';

// ... existing code ...

export function ActivityCard({ activity, canEdit, onEdit }: Props) {
  // ... existing code ...

  return (
    <div class="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
      {/* ... existing content ... */}

      {/* Attachment Section - เพิ่มส่วนนี้ */}
      <div class="mt-3 pt-3 border-t border-gray-100">
        <AttachmentButton activityId={activity.id} canEdit={canEdit} />
      </div>
    </div>
  );
}
```

---

## Testing Checklist

- [ ] อัปโหลดภาพ (JPEG, PNG, WebP) → แสดง preview ได้
- [ ] อัปโหลด PDF → แสดง icon และ download button
- [ ] อัปโหลดไฟล์ >5MB → error "ไฟล์มีขนาดเกิน 5MB"
- [ ] อัปโหลดไฟล์ประเภทอื่น → error "ไฟล์ต้องเป็นรูปภาพหรือ PDF"
- [ ] อัปโหลดไฟล์ที่สอง → error (unique constraint)
- [ ] Progress bar แสดงขณะอัปโหลด
- [ ] ลบไฟล์ → หายจาก Storage + Database
- [ ] Signed URL หมดอายุ → auto refresh (refetch after 50s)
- [ ] RLS: viewer ไม่สามารถอัปโหลด/ลบได้
- [ ] RLS: owner/editor อัปโหลด/ลบได้
- [ ] Analytics: `upload_attachment` event tracked
- [ ] Download PDF ได้จาก preview modal

---

## Best Practices

### 1. File Validation
```typescript
// ✅ Validate file type and size before upload
if (!ALLOWED_FILE_TYPES.includes(file.type as AllowedFileType)) {
  throw new Error('ไฟล์ต้องเป็นรูปภาพหรือ PDF เท่านั้น');
}

if (file.size > MAX_FILE_SIZE) {
  throw new Error('ไฟล์มีขนาดเกิน 5MB');
}

// ✅ Database constraint
CHECK (file_size > 0 AND file_size <= 5242880)
```

### 2. Rollback on Error
```typescript
// ✅ Rollback if database insert fails
if (dbError) {
  await supabase.storage.from('trip-attachments').remove([storagePath]);
  throw dbError;
}
```

### 3. Signed URLs
```typescript
// ✅ Use signed URL for private files with auto-refresh
return useQuery({
  queryKey: ['signed-url', storagePath],
  queryFn: async () => {
    const { data } = await supabase.storage
      .from('trip-attachments')
      .createSignedUrl(storagePath, 60);
    return data.signedUrl;
  },
  staleTime: 1000 * 50, // 50s (before expiry)
  refetchInterval: 1000 * 50, // refresh before expiry
});
```

### 4. Storage Path Structure
```typescript
// ✅ Organize by trip_id for easier management
const storagePath = `${trip_id}/${activity_id}_${timestamp}.${ext}`;
// Example: "abc-123/def-456_1234567890.jpg"

// ❌ Flat structure
const storagePath = `${activity_id}.${ext}`;
```

### 5. Unique Constraint
```typescript
// ✅ Database constraint for 1 file per activity
CONSTRAINT one_file_per_activity UNIQUE (activity_id)

// ✅ RLS policy check
AND NOT EXISTS (
  SELECT 1 FROM activity_attachments aa
  WHERE aa.activity_id = activity_attachments.activity_id
)
```

---

## Common Issues

### Issue: Progress bar ไม่แสดง
```typescript
// ⚠️ supabase-js ไม่ support upload progress ใน browser
// Solution: ใช้ XMLHttpRequest หรือ fetch API กับ Supabase signed upload URL

// Alternative: จำลอง progress
setProgress({ loaded: 0, total: file.size, percentage: 0 });
await supabase.storage.from('bucket').upload(path, file);
setProgress({ loaded: file.size, total: file.size, percentage: 100 });
```

### Issue: CORS error เมื่อ download
```typescript
// ❌ Direct storage URL (may cause CORS)
const url = supabase.storage.from('bucket').getPublicUrl(path).data.publicUrl;

// ✅ Use signed URL instead (works with private bucket)
const { data } = await supabase.storage
  .from('bucket')
  .createSignedUrl(path, 60);
```

### Issue: ไม่สามารถลบไฟล์ได้
```typescript
// ✅ ลบในลำดับที่ถูกต้อง
// 1. ลบจาก Storage ก่อน
await supabase.storage.from('bucket').remove([path]);

// 2. ลบจาก Database ทีหลัง
await supabase.from('attachments').delete().eq('id', id);
```

### Issue: Preview ไม่แสดง
```typescript
// ❌ ลืม check signed URL loading
{signedUrl && <img src={signedUrl} />}

// ✅ Show loading state
{isLoading && <Spinner />}
{!isLoading && signedUrl && <img src={signedUrl} />}
```

---

## Advanced: Real Upload Progress (Optional)

หากต้องการ progress bar ที่แม่นยำ ใช้ XMLHttpRequest กับ signed upload URL

**File: `src/hooks/useUploadWithProgress.ts`**

```typescript
export function uploadFileWithProgress(
  file: File,
  signedUploadUrl: string,
  onProgress: (progress: UploadProgress) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress({
          loaded: e.loaded,
          total: e.total,
          percentage: (e.loaded / e.total) * 100
        });
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed'));
    });

    xhr.open('PUT', signedUploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}
```

---

## Notes

- **Signed URLs**: ใช้ expiry 60 วินาที เพื่อความปลอดภัย, auto-refresh ทุก 50 วินาที
- **Private Bucket**: ใช้ private bucket เพื่อให้ควบคุม access ผ่าน RLS policies
- **File Naming**: ใช้ `activity_id_timestamp.ext` เพื่อป้องกัน collision
- **Storage Path**: เก็บตาม structure `trip_id/filename` สำหรับจัดการง่าย
- **Rollback**: ลบไฟล์จาก Storage ถ้า database insert ล้มเหลว
- **Progress**: supabase-js ไม่ support native progress, ใช้ XMLHttpRequest สำหรับ real progress
- **Analytics**: Track `upload_attachment` event สำหรับวิเคราะห์การใช้งาน
