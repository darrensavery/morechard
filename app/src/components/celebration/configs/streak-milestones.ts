// app/src/components/celebration/configs/streak-milestones.ts
import type { MilestoneConfig } from '../types'

export const STREAK_3: MilestoneConfig = {
  key: 'STREAK_3', bgColor: '#0f1a14', transition: 'shimmer', tier: 'standard',
  orchard: [
    {
      icon: '🔥', variant: 'streak-ring',
      heading: '3 days in a row!',
      body: "You've shown up 3 days straight. That's a real streak starting.",
      headingColor: 'text-emerald-300', bodyColor: 'text-emerald-200/70', durationMs: 3500,
    },
  ],
  clean: [
    {
      icon: '', variant: 'streak-ring',
      heading: '3-day streak.',
      body: 'Three consecutive scheduled days completed on time.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 3500,
    },
  ],
}

export const STREAK_7: MilestoneConfig = {
  key: 'STREAK_7', bgColor: '#0f1a14', transition: 'shimmer', tier: 'standard',
  orchard: [
    {
      icon: '🌟', variant: 'streak-ring',
      heading: 'You did it 7 days straight!',
      body: "Every job done on time, a whole week. That's not luck — that's you showing up. Keep going!",
      headingColor: 'text-amber-300', bodyColor: 'text-emerald-200/70', durationMs: 4000,
    },
  ],
  clean: [
    {
      icon: '', variant: 'streak-ring',
      heading: '7-day streak.',
      body: "Every scheduled task cleared, on time, for a full week. That's what consistency looks like on a record.",
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 4000,
    },
  ],
}

export const STREAK_14: MilestoneConfig = {
  key: 'STREAK_14', bgColor: '#0f1a14', transition: 'shimmer', tier: 'standard',
  orchard: [
    {
      icon: '🌳', variant: 'streak-ring',
      heading: '14 days in a row!',
      body: "Two full weeks without missing a thing. You're building a real habit here.",
      headingColor: 'text-emerald-300', bodyColor: 'text-emerald-200/70', durationMs: 4000,
    },
  ],
  clean: [
    {
      icon: '', variant: 'streak-ring',
      heading: '14-day streak.',
      body: 'Two consecutive weeks. Sustained performance at this level is rare.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 4000,
    },
  ],
}

export const STREAK_30: MilestoneConfig = {
  key: 'STREAK_30', bgColor: '#0f1a14', transition: 'shimmer', tier: 'landmark',
  orchard: [
    {
      icon: '🏆', variant: 'streak-ring',
      heading: '30 days in a row!',
      body: "A whole month without missing a single job. Most people give up long before this. You didn't.",
      headingColor: 'text-amber-300', bodyColor: 'text-emerald-200/70', durationMs: 4500,
    },
    {
      icon: '📊',
      heading: 'Check your Consistency Score.',
      body: "After 30 days, your score is locked in. This is the number that shows up when it counts.",
      headingColor: 'text-emerald-300', bodyColor: 'text-emerald-200/70', durationMs: 4000,
    },
  ],
  clean: [
    {
      icon: '', variant: 'streak-ring',
      heading: '30-day streak.',
      body: 'Thirty consecutive scheduled days. This appears on your Consistency Score and goes on record.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 4500,
    },
    {
      icon: '📊',
      heading: 'Consistency Score updated.',
      body: 'Your 30-day window is now fully loaded. The score reflects every scheduled day this month.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 3500,
    },
  ],
}

export const STREAK_LOST: MilestoneConfig = {
  key: 'STREAK_LOST', bgColor: '#0f1a14', transition: 'wipe', tier: 'micro',
  orchard: [
    {
      icon: '🌧️',
      heading: 'Streak paused.',
      body: 'You missed a day. It happens. A new streak starts the moment you get back on it.',
      headingColor: 'text-white/70', bodyColor: 'text-white/50', durationMs: 3000,
    },
  ],
  clean: [
    {
      icon: '—',
      heading: 'Streak reset.',
      body: 'A scheduled day was missed. Start fresh today.',
      headingColor: 'text-white/70', bodyColor: 'text-white/50', durationMs: 2500,
    },
  ],
}

export const STREAK_REVIVED: MilestoneConfig = {
  key: 'STREAK_REVIVED', bgColor: '#0f1a14', transition: 'shimmer', tier: 'standard',
  orchard: [
    {
      icon: '⛅',
      heading: 'Rain Day used.',
      body: "Yesterday was tough — your Rain Day protected your streak. You've still got this.",
      headingColor: 'text-teal-300', bodyColor: 'text-emerald-200/70', durationMs: 3500,
    },
  ],
  clean: [
    {
      icon: '🛡️',
      heading: 'Grace day applied.',
      body: "A grace day covered yesterday's miss. Your streak is intact.",
      headingColor: 'text-teal-300', bodyColor: 'text-white/60', durationMs: 3000,
    },
  ],
}
