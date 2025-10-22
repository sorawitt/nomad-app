# Milestone 3: Settings, Offline Cache, Share

## Tasks Overview

### 1. Settings Screen (M3-S1)
- โปรไฟล์, default currency
- Toggle: analytics, offline cache
- Logout button

### 2. Offline Cache (M3-S2)
- IndexedDB cache: trips/days/activities/expenses
- Background sync ทุก 5 นาที
- Conflict detection (last-write-wins)

### 3. Share Trip (M3-S3)
- Generate share token
- Read-only view
- Revoke token ได้
- Web Share API

## Database Schema

```sql
ALTER TABLE trips ADD COLUMN shared_token TEXT UNIQUE;

CREATE TABLE user_settings (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES profiles(id),
  default_currency TEXT DEFAULT 'THB',
  offline_cache_enabled BOOLEAN DEFAULT true,
  analytics_enabled BOOLEAN DEFAULT true
);
```

## Dependencies

```bash
bun add localforage  # IndexedDB wrapper
```
