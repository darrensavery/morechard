# Legacy UI Reference — Morechard (index.html)

Captured before migration to React. Use this as the design source of truth
when rebuilding each screen as a React component.

---

## Color Tokens (CSS variables)

| Token       | Value     | Usage                        |
|-------------|-----------|------------------------------|
| --green     | #2E7A33   | Dad / primary income         |
| --green-l   | #EEF7EE   | Green light bg               |
| --green-m   | #3D8B40   | Borders, focus states        |
| --amber     | #B45309   | Pending / warning            |
| --amber-l   | #FEF3C7   | Amber light bg               |
| --red       | #B91C1C   | Rejected / error             |
| --red-l     | #FEF2F2   | Red light bg                 |
| --blue      | #1D4ED8   | Suggestions / info           |
| --blue-l    | #EFF6FF   | Blue light bg                |
| --purple    | #5B21B6   | Mum / second parent          |
| --purple-l  | #F5F3FF   | Purple light bg              |
| --teal      | #0F766E   | Child / approve / CTA        |
| --teal-l    | #F0FDFA   | Teal light bg                |
| --gray      | #5F5E5A   | Secondary text               |
| --gray-l    | #F1EFE8   | Subtle backgrounds           |
| --border    | #D3D1C7   | All borders                  |
| --text      | #1C1C1A   | Primary text                 |
| --muted     | #6b6a66   | Subtext                      |
| --bg        | #F5F4F0   | Page background (warm off-white) |
| --white     | #ffffff   | Cards / modals               |

Dark mode overrides the same tokens via `html[data-theme="dark"]`.

---

## Typography

- Font: **Manrope** (400, 500, 600, 700, 800)
- Base size: 17px, line-height 1.45
- Headings: font-weight 800, tight tracking
- Subtext: 13–14px, --muted color
- Numbers (amounts): `font-variant-numeric: tabular-nums`

---

## Layout

- `max-width: 560px` content area, centred
- `padding: 18px 14px`
- Sticky header: white, 1px border-bottom, `box-shadow: 0 1px 4px rgba(0,0,0,.05)`
- Safe area insets applied to header top and body bottom

---

## Screens & Components

### 1. Landing / Login Screen
- Title + subtitle centred
- **Landing tiles** — white card, 2px border, 16px radius, 18px 20px padding
  - Icon (52px square, centred)
  - Name (16px 700) + description (13px muted)
  - Arrow right (muted)
  - Hover: translateY(-1px) + shadow
  - Parent tiles: green hover bg; child tile: teal border + teal hover bg
- Child tile has `border-color: var(--teal-b)` default

### 2. PIN Screen
- Centred layout, 48px top padding
- 4× PIN boxes: 54×66px, 2px border, 12px radius, 28px font, 800 weight
- Focus: green border
- Error text: red, 14px, 600 weight
- Back link: underlined, muted

### 3. Parent Dashboard — Header
- Left: sync dot (7px circle, green=online/amber=offline) + "Morechard" title
- Right: session label + lock button
- Child selector: horizontal scroll pill buttons (teal active state)

### 4. Earnings Card
- White card, 16px radius, coloured top border (green=dad, purple=mum, teal=child)
- Label: 12px muted uppercase
- Amount: 46px 800 weight, tabular nums, tight tracking
- Sub-stats: 13px muted, flex row, centred

### 5. Chore Cards
- White, 1px border, 12px radius, 14px 15px padding
- Hover: translateY(-1px) + shadow
- **Priority**: amber border (2px), amber bg
- **Overdue**: red-light bg, red border
- **Flash deadline**: red border (2px)
- Name: 15px 600; Freq: 12px muted; Price: 18px 800 green/purple
- "Mark done" button: teal-light bg, teal text, 10px 14px padding, 10px radius

### 6. Tabs (Parent)
- Tabs: Jobs / Pending / History / Insights / Settings
- Tab bar: border-bottom, no scrollbar, arrows on sides if overflow
- Active tab: green text + green 2.5px bottom border
- Badge on tab (overdue count): red pill

### 7. Pending Cards (Parent approval queue)
- White card, 12px radius
- Name (16px 700) + time (12px muted)
- Price: 24px 800, amber=completion / blue=suggestion
- Note in gray-light bg box, italic
- Approve/Reject buttons: full width flex, teal approve / red reject

### 8. History Items
- White, 1px border, 10px radius, 12px 14px padding
- Status badge: pill, approved=green / pending=amber / rejected=red / suggestion=blue
- Name (14px 600) + date (12px muted)
- Price right-aligned: colour matches status

### 9. Insights Tab
- 2-col grid of score cards (white, 1.5px border, 14px radius)
- Score number: 36px 800
- Band badge: colour-coded pill (low=red, medium=amber, high=green, excellent=teal)
- Progress bar: 6px, gray track, coloured fill
- Notification cards: white, coloured border based on priority (action=red, warning=amber, positive=green, info=blue)

### 10. Manage Jobs (Parent)
- View toggle: list / calendar (segmented pill)
- Job cards: white, 1px border, 11px radius — name + freq + price + edit button
- Priority jobs: amber border + amber bg
- Add button: dashed green border, green text, hover fills green

### 11. Calendar View
- 7-col grid, day cells min-height 60px
- Today: green border + green-light bg
- Chips inside days: 9px font, colour-coded (due=green, plan=teal)
- Month nav: prev/next buttons

### 12. Settings (Parent)
- **Home**: column of nav tiles
  - 46×46 coloured icon square (12px radius)
  - Title (17px 700) + subtitle (14px muted)
  - Chevron right
  - Hover: shadow + translateY(-1px)
- **Groups**: back button + group title (18px 800) + settings-cards
- **Settings card**: white, 1px border, 12px radius, 18px padding
- Groups: Profile & Appearance / Pocket Money / Parental Controls / Login & Security / Family & Governance / Language

### 13. Child Dashboard
- Earnings card (teal top border)
- House toggle if split-homes enabled
- Weekly planner: 7-day horizontal scroll, chips per day
- Goal progress bar: chunky 12px track, green fill, match portion teal
- Goal card: emoji + name + % + progress bar + labels

### 14. Modals
- Overlay: rgba(0,0,0,.45)
- Modal: white, 18px radius, 24px padding, max 520px wide, max 92vh, scrollable
- Close: 30px circle, top-right, gray bg
- Title: 19px 800
- Inputs: 1px border, 10px radius, 11px 13px padding, 15px font
- Focus: green border
- Buttons: full-width teal primary / muted secondary / red danger

### 15. Toast Notifications
- Fixed bottom centre
- Dark bg (#1a1a18), white text, 22px radius pill
- Slides up on show, 14px 600 weight

### 16. Animations
- `btnPop`: scale .95 → 1.03 → 1, 0.22s ease-out (on primary button active)
- `flashPop`: scale .3 → 1, 0.4s cubic-bezier (success flash overlay)
- Submit flash: full-screen green overlay with white checkmark SVG

---

## Key Interactions

- **Child selector**: pill tabs above content, teal active, scroll horizontally
- **Expandable month summaries**: tap to show breakdown rows
- **Job priority toggle**: star button in job editor
- **Flash deadline jobs**: red badge + red border, disappear for child after time
- **Reject with note**: red button → rejection note stored and shown in history
- **Rating buttons**: thumbs up/down on history items (border highlight)
- **Weekly planner chips**: tap day to see task list modal
- **Governance mode display**: shown in Family & Governance settings group
