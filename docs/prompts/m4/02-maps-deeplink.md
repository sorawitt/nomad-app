# Task: Google Maps Deeplink - เปิดแผนที่

## Context
เพิ่มปุ่ม "เปิดแผนที่" ใน ActivityCard สำหรับกิจกรรมที่มีพิกัด (lat/lng) เพื่อเปิด Google Maps app หรือ web view พร้อม analytics tracking

## Tech Stack
- **Preact + TypeScript**: Component และ Type Safety
- **Google Maps URL Scheme**: Deeplink format
- **Tailwind CSS v4**: Styling (mobile-first)

## Requirements

### Functional Requirements
- แสดงปุ่ม "เปิดแผนที่" เฉพาะกิจกรรมที่มี location_lat และ location_lng
- เปิด Google Maps:
  - Mobile: เปิดแอป Google Maps (ถ้ามี)
  - Desktop: เปิด Google Maps web
- Google Maps URL format: `https://www.google.com/maps/search/?api=1&query=lat,lng`
- Analytics: `open_map` event
- Error handling: แสดง toast ถ้าเปิดไม่ได้

## Step-by-Step Implementation

### Step 1: Database Migration

เพิ่มฟิลด์ `location_lat`, `location_lng`, `location_name` ในตาราง `activities`

**File: `supabase/migrations/008_activity_location.sql`**

```sql
-- เพิ่มฟิลด์ location ใน activities
ALTER TABLE activities ADD COLUMN IF NOT EXISTS location_name TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION;

-- Index สำหรับค้นหากิจกรรมที่มี location
CREATE INDEX IF NOT EXISTS idx_activities_has_location ON activities(trip_id) WHERE location_lat IS NOT NULL AND location_lng IS NOT NULL;

-- Constraint: ต้องมีทั้ง lat และ lng หรือไม่มีเลย
ALTER TABLE activities ADD CONSTRAINT check_location_pair
  CHECK (
    (location_lat IS NULL AND location_lng IS NULL) OR
    (location_lat IS NOT NULL AND location_lng IS NOT NULL)
  );

-- Constraint: lat/lng ต้องอยู่ในช่วงที่ถูกต้อง
ALTER TABLE activities ADD CONSTRAINT check_lat_range
  CHECK (location_lat IS NULL OR (location_lat >= -90 AND location_lat <= 90));

ALTER TABLE activities ADD CONSTRAINT check_lng_range
  CHECK (location_lng IS NULL OR (location_lng >= -180 AND location_lng <= 180));
```

**Run migration:**
```bash
supabase db push
```

---

### Step 2: Type Definitions

**File: `src/types/activity.ts`** (อัปเดต)

```typescript
export interface Activity {
  id: string;
  trip_id: string;
  day_id: string;
  title: string;
  description: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  location_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  created_at: string;
  updated_at: string;
}

export interface AddActivityInput {
  trip_id: string;
  day_id: string;
  title: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  location_name?: string;
  location_lat?: number;
  location_lng?: number;
}

export interface UpdateActivityInput {
  title?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  location_name?: string;
  location_lat?: number;
  location_lng?: number;
}
```

---

### Step 3: Utility Function - buildGoogleMapsUrl

**File: `src/lib/maps.ts`**

```typescript
export interface MapLocation {
  lat: number;
  lng: number;
  name?: string;
}

/**
 * สร้าง Google Maps URL สำหรับ deeplink
 * @param location - พิกัดและชื่อสถานที่
 * @returns URL สำหรับเปิด Google Maps
 */
export function buildGoogleMapsUrl(location: MapLocation): string {
  const { lat, lng, name } = location;

  // Google Maps Search API
  // Ref: https://developers.google.com/maps/documentation/urls/get-started
  const baseUrl = 'https://www.google.com/maps/search/';
  const params = new URLSearchParams({
    api: '1',
    query: `${lat},${lng}`
  });

  // เพิ่มชื่อสถานที่ถ้ามี (optional)
  if (name) {
    params.set('query', `${name}@${lat},${lng}`);
  }

  return `${baseUrl}?${params.toString()}`;
}

/**
 * ตรวจสอบว่ามีพิกัดหรือไม่
 */
export function hasLocation(activity: { location_lat: number | null; location_lng: number | null }): boolean {
  return activity.location_lat !== null && activity.location_lng !== null;
}

/**
 * เปิด Google Maps
 * @param location - พิกัดและชื่อสถานที่
 * @param onError - callback เมื่อเปิดไม่ได้
 */
export function openGoogleMaps(location: MapLocation, onError?: (error: Error) => void): void {
  try {
    const url = buildGoogleMapsUrl(location);

    // เปิดใน tab/window ใหม่
    const opened = window.open(url, '_blank', 'noopener,noreferrer');

    if (!opened) {
      throw new Error('Unable to open map. Please check popup blocker.');
    }
  } catch (error) {
    onError?.(error as Error);
  }
}
```

---

### Step 4: Component - MapButton

**File: `src/components/activity/MapButton.tsx`**

```typescript
import { buildGoogleMapsUrl, hasLocation, openGoogleMaps } from '@/lib/maps';
import { trackEvent } from '@/lib/analytics';
import type { Activity } from '@/types/activity';

interface Props {
  activity: Activity;
}

export function MapButton({ activity }: Props) {
  if (!hasLocation(activity)) return null;

  const handleOpenMap = () => {
    trackEvent('open_map', {
      activity_id: activity.id,
      trip_id: activity.trip_id,
      has_location_name: !!activity.location_name
    });

    openGoogleMaps(
      {
        lat: activity.location_lat!,
        lng: activity.location_lng!,
        name: activity.location_name || undefined
      },
      (error) => {
        // แสดง toast หรือ alert
        alert('ไม่สามารถเปิดแผนที่ได้');
        console.error('Failed to open map:', error);
      }
    );
  };

  return (
    <button
      onClick={handleOpenMap}
      class="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
      title="เปิดแผนที่"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <span>เปิดแผนที่</span>
    </button>
  );
}
```

---

### Step 5: Integration - Update ActivityCard

แก้ไข ActivityCard ให้แสดง MapButton และ location info

**File: `src/components/activity/ActivityCard.tsx`** (ส่วนที่เพิ่ม)

```typescript
import { MapButton } from './MapButton';

// ... existing code ...

export function ActivityCard({ activity, canEdit, onEdit }: Props) {
  // ... existing code ...

  return (
    <div class="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
      {/* ... existing content ... */}

      {/* Location Section */}
      {activity.location_name && (
        <div class="mt-3 flex items-start gap-2 text-sm text-gray-600">
          <svg class="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>{activity.location_name}</span>
        </div>
      )}

      {/* Map Button */}
      <div class="mt-3 pt-3 border-t border-gray-100">
        <MapButton activity={activity} />
      </div>

      {/* ... existing attachment section ... */}
    </div>
  );
}
```

---

### Step 6: Update ActivityModal (Form)

เพิ่มฟิลด์ location ในฟอร์มเพิ่ม/แก้ไขกิจกรรม

**File: `src/components/activity/ActivityModal.tsx`** (ส่วนที่เพิ่ม)

```typescript
// ... existing code ...

export function ActivityModal({ tripId, dayId, activity, onClose }: Props) {
  // ... existing state ...
  const [locationName, setLocationName] = useState(activity?.location_name || '');
  const [locationLat, setLocationLat] = useState(activity?.location_lat?.toString() || '');
  const [locationLng, setLocationLng] = useState(activity?.location_lng?.toString() || '');

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');

    // ... existing validation ...

    // Location validation
    const hasLat = locationLat.trim() !== '';
    const hasLng = locationLng.trim() !== '';

    if (hasLat !== hasLng) {
      setError('ต้องกรอกพิกัดทั้ง Latitude และ Longitude');
      return;
    }

    let lat: number | undefined;
    let lng: number | undefined;

    if (hasLat && hasLng) {
      lat = parseFloat(locationLat);
      lng = parseFloat(locationLng);

      if (isNaN(lat) || isNaN(lng)) {
        setError('พิกัดไม่ถูกต้อง');
        return;
      }

      if (lat < -90 || lat > 90) {
        setError('Latitude ต้องอยู่ระหว่าง -90 ถึง 90');
        return;
      }

      if (lng < -180 || lng > 180) {
        setError('Longitude ต้องอยู่ระหว่าง -180 ถึง 180');
        return;
      }
    }

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({
          title: title.trim(),
          description: description.trim() || null,
          start_time: startTime ? new Date(startTime).toISOString() : null,
          end_time: endTime ? new Date(endTime).toISOString() : null,
          location_name: locationName.trim() || null,
          location_lat: lat,
          location_lng: lng
        });
      } else {
        await addMutation.mutateAsync({
          trip_id: tripId,
          day_id: dayId,
          title: title.trim(),
          description: description.trim() || undefined,
          start_time: startTime ? new Date(startTime).toISOString() : undefined,
          end_time: endTime ? new Date(endTime).toISOString() : undefined,
          location_name: locationName.trim() || undefined,
          location_lat: lat,
          location_lng: lng
        });
      }
      onClose();
    } catch (err) {
      setError(isEditing ? 'ไม่สามารถแก้ไขกิจกรรมได้' : 'ไม่สามารถเพิ่มกิจกรรมได้');
    }
  };

  return (
    <div class="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
      <div class="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
        {/* ... existing header ... */}

        <form onSubmit={handleSubmit} class="p-6 space-y-5">
          {/* ... existing fields ... */}

          {/* Location Name */}
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              สถานที่ (ถ้ามี)
            </label>
            <input
              type="text"
              value={locationName}
              onInput={(e) => setLocationName((e.target as HTMLInputElement).value)}
              placeholder="ชื่อสถานที่"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Location Coordinates */}
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              พิกัด (ถ้ามี)
            </label>
            <div class="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={locationLat}
                onInput={(e) => setLocationLat((e.target as HTMLInputElement).value)}
                placeholder="Latitude"
                class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <input
                type="text"
                value={locationLng}
                onInput={(e) => setLocationLng((e.target as HTMLInputElement).value)}
                placeholder="Longitude"
                class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            <p class="text-xs text-gray-500 mt-2">
              เช่น 13.7563, 100.5018 (กรุงเทพฯ)
            </p>
          </div>

          {/* ... existing error and submit ... */}
        </form>
      </div>
    </div>
  );
}
```

---

## Testing Checklist

- [ ] กิจกรรมที่มีพิกัด → แสดงปุ่ม "เปิดแผนที่"
- [ ] กิจกรรมที่ไม่มีพิกัด → ไม่แสดงปุ่ม
- [ ] คลิกปุ่ม → เปิด Google Maps (app/web)
- [ ] Mobile → เปิดแอป Google Maps (ถ้ามี)
- [ ] Desktop → เปิด Google Maps web
- [ ] URL ถูกต้อง: `https://www.google.com/maps/search/?api=1&query=lat,lng`
- [ ] มีชื่อสถานที่ → URL มี `query=name@lat,lng`
- [ ] Analytics: `open_map` event tracked
- [ ] Popup blocker → แสดง error message
- [ ] Location validation: lat (-90 to 90), lng (-180 to 180)
- [ ] ต้องกรอกทั้ง lat และ lng หรือไม่กรอกเลย

---

## Best Practices

### 1. Google Maps URL Format
```typescript
// ✅ Use official Google Maps URL API
const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

// With name (optional)
const url = `https://www.google.com/maps/search/?api=1&query=${name}@${lat},${lng}`;

// ❌ Don't use old format
const url = `https://maps.google.com/?q=${lat},${lng}`;
```

### 2. Constraint Validation
```sql
-- ✅ Both lat/lng or none
CHECK (
  (location_lat IS NULL AND location_lng IS NULL) OR
  (location_lat IS NOT NULL AND location_lng IS NOT NULL)
)

-- ✅ Valid ranges
CHECK (location_lat >= -90 AND location_lat <= 90)
CHECK (location_lng >= -180 AND location_lng <= 180)
```

### 3. Error Handling
```typescript
// ✅ Handle popup blocker
const opened = window.open(url, '_blank', 'noopener,noreferrer');
if (!opened) {
  throw new Error('Unable to open map. Please check popup blocker.');
}
```

### 4. Conditional Rendering
```typescript
// ✅ Check location before rendering button
if (!hasLocation(activity)) return null;

// Helper function
export function hasLocation(activity: Activity): boolean {
  return activity.location_lat !== null && activity.location_lng !== null;
}
```

### 5. Analytics Tracking
```typescript
// ✅ Track with context
trackEvent('open_map', {
  activity_id: activity.id,
  trip_id: activity.trip_id,
  has_location_name: !!activity.location_name
});
```

---

## Common Issues

### Issue: URL encoding
```typescript
// ✅ Use URLSearchParams for proper encoding
const params = new URLSearchParams({
  api: '1',
  query: `${name}@${lat},${lng}`
});
const url = `${baseUrl}?${params.toString()}`;

// ❌ Manual concatenation may break with special characters
const url = `${baseUrl}?api=1&query=${name}@${lat},${lng}`;
```

### Issue: Popup blocker
```typescript
// ⚠️ window.open may be blocked
// ✅ Check return value and show error
const opened = window.open(url, '_blank');
if (!opened) {
  alert('กรุณาอนุญาต popup ในเบราว์เซอร์');
}
```

### Issue: ใส่แค่ lat หรือ lng อย่างเดียว
```sql
-- ✅ Constraint: ต้องมีทั้งคู่หรือไม่มีเลย
CHECK (
  (location_lat IS NULL AND location_lng IS NULL) OR
  (location_lat IS NOT NULL AND location_lng IS NOT NULL)
)
```

---

## Advanced: Location Picker (Optional)

หากต้องการ UI สำหรับเลือกพิกัดจากแผนที่:

```bash
bun add @vis.gl/react-google-maps
```

```typescript
import { Map, Marker } from '@vis.gl/react-google-maps';

export function LocationPicker({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  const [position, setPosition] = useState({ lat: 13.7563, lng: 100.5018 });

  return (
    <Map
      style={{ width: '100%', height: '400px' }}
      defaultCenter={position}
      defaultZoom={10}
      onClick={(e) => {
        const lat = e.detail.latLng?.lat;
        const lng = e.detail.latLng?.lng;
        if (lat && lng) {
          setPosition({ lat, lng });
          onSelect(lat, lng);
        }
      }}
    >
      <Marker position={position} />
    </Map>
  );
}
```

---

## Alternative: Apple Maps (iOS)

สำหรับ iOS, พิจารณาเพิ่ม Apple Maps deeplink:

```typescript
export function openMaps(location: MapLocation): void {
  const { lat, lng, name } = location;

  // Detect iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (isIOS) {
    // Apple Maps
    const url = `maps://maps.apple.com/?q=${name || 'Location'}&ll=${lat},${lng}`;
    window.location.href = url;
  } else {
    // Google Maps
    const url = buildGoogleMapsUrl(location);
    window.open(url, '_blank');
  }
}
```

---

## Notes

- **Google Maps URL**: ใช้ Search API format (official) ไม่ใช่ legacy format
- **Mobile**: จะเปิดแอป Google Maps ถ้ามีติดตั้ง, ถ้าไม่มีจะเปิด web
- **Coordinates**: Latitude (-90 to 90), Longitude (-180 to 180)
- **Optional Name**: เพิ่มชื่อสถานที่ช่วยให้ Maps แสดงผลดีขึ้น
- **Analytics**: Track เพื่อวิเคราะห์ว่า feature นี้ใช้งานบ่อยแค่ไหน
- **Popup Blocker**: ต้อง handle กรณี browser บล็อก popup
- **Security**: ใช้ `noopener,noreferrer` เพื่อความปลอดภัย
