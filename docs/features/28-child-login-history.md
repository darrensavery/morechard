---
feature: 28-child-login-history
title: Child Login History
---

### Purpose

Gives parents a chronological audit trail of their child's last 50 sign-ins, showing the device used, IP address, and whether a session is still active. This lets a parent quickly spot unexpected logins or confirm a child is accessing the app from known devices.

### Methodology

- **Data fetch**: On mount, the component calls `getChildLoginHistory(childId)` from `lib/api`, which issues a GET request to the child login history endpoint. The response shape is `{ logins: LoginEntry[] }`.
- **Grouping**: Login entries (sorted newest-first by `logged_at` Unix timestamp) are grouped into day buckets using `groupByDay()`. Day labels resolve to "Today", "Yesterday", or a short weekday + date string.
- **Rendering**: Each group renders as a titled card. Within a card, each row shows:
  - A device icon (`Monitor`, `Smartphone`, or `Tablet`) derived from `LoginEntry.device_type`.
  - A pulsing green dot when `entry.is_current === true`, indicating the session is still live.
  - `device_label` (friendly device name) and `ip_address`.
  - A relative-time label (`relativeTime()`) with the full UTC timestamp exposed via `title` attribute on hover.
- **Loading state**: Three animated skeleton rows are shown while the request is in-flight.
- **Error / empty states**: A plain text message is shown if the fetch fails or no logins exist yet.
- **Entry point**: Rendered by `ChildProfileSettings` when `activeView === 'login-history'`; receives `childId`, `childName`, and an `onBack` callback. Navigation is handled entirely by the parent component via prop — no router involvement.

### Dependencies

- **External packages**: `lucide-react` (Monitor, Smartphone, Tablet icons); React (`useState`, `useEffect`)
- **Internal modules**:
  - `app/src/lib/api.ts` — `getChildLoginHistory()` function and `LoginEntry` type
  - `app/src/components/settings/shared` — `SectionHeader` shared UI component
  - `app/src/components/settings/sections/ChildProfileSettings.tsx` — parent component that mounts this view
- **APIs / services**: Morechard Worker — child login history endpoint (GET, path inferred from `api.ts`; returns up to 50 login records per child including `id`, `logged_at`, `device_type`, `device_label`, `ip_address`, `is_current`)
