// app/src/components/celebration/configs/badge-saver-scholar-landmark.ts
import type { MilestoneConfig } from '../types'

export const BADGE_SAVER_SEED: MilestoneConfig = {
  key: 'BADGE_SAVER_SEED', bgColor: '#0f1a14', transition: 'shimmer', tier: 'standard',
  orchard: [
    {
      icon: '🌱', variant: 'badge',
      heading: 'Seedling Badge — Saver',
      body: "Your first saving goal is done. You set a target, and you hit it. That's what saving looks like.",
      headingColor: 'text-emerald-300', bodyColor: 'text-emerald-200/70', durationMs: 4000,
    },
  ],
  clean: [
    {
      icon: '', variant: 'badge',
      heading: 'Tier I — Saver',
      body: 'First savings goal completed. Saver Tier I badge recorded.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 3500,
    },
  ],
}

export const BADGE_SAVER_SAPLING: MilestoneConfig = {
  key: 'BADGE_SAVER_SAPLING', bgColor: '#0f1a14', transition: 'shimmer', tier: 'standard',
  orchard: [
    {
      icon: '🌿', variant: 'badge',
      heading: 'Sapling Badge — Saver',
      body: "£100 saved in total. That's real money you earned yourself.",
      headingColor: 'text-emerald-300', bodyColor: 'text-emerald-200/70', durationMs: 4000,
    },
  ],
  clean: [
    {
      icon: '', variant: 'badge',
      heading: 'Tier II — Saver',
      body: '£100 cumulative savings. Saver Tier II badge recorded.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 3500,
    },
  ],
}

export const BADGE_SAVER_OAK: MilestoneConfig = {
  key: 'BADGE_SAVER_OAK', bgColor: '#0f1a14', transition: 'shimmer', tier: 'landmark',
  orchard: [
    {
      icon: '🌳', variant: 'badge',
      heading: 'Oak Badge — Saver',
      body: "Three saving goals completed. You're not just saving — you're planning ahead.",
      headingColor: 'text-amber-300', bodyColor: 'text-emerald-200/70', durationMs: 4500,
    },
  ],
  clean: [
    {
      icon: '', variant: 'badge',
      heading: 'Tier III — Saver',
      body: 'Three savings goals completed. Saver Tier III badge recorded.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 4000,
    },
  ],
}

export const BADGE_SCHOLAR_SEED: MilestoneConfig = {
  key: 'BADGE_SCHOLAR_SEED', bgColor: '#0f1a14', transition: 'shimmer', tier: 'standard',
  orchard: [
    {
      icon: '📚', variant: 'badge',
      heading: 'Seedling Badge — Scholar',
      body: "First lesson completed. You didn't just earn money today — you learned something about it too.",
      headingColor: 'text-emerald-300', bodyColor: 'text-emerald-200/70', durationMs: 4000,
    },
  ],
  clean: [
    {
      icon: '', variant: 'badge',
      heading: 'Tier I — Scholar',
      body: 'First lesson completed. Scholar Tier I badge recorded.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 3500,
    },
  ],
}

export const BADGE_SCHOLAR_SAPLING: MilestoneConfig = {
  key: 'BADGE_SCHOLAR_SAPLING', bgColor: '#0f1a14', transition: 'shimmer', tier: 'standard',
  orchard: [
    {
      icon: '📖', variant: 'badge',
      heading: 'Sapling Badge — Scholar',
      body: "Five lessons done. You know things about money most adults wish they'd learned earlier.",
      headingColor: 'text-emerald-300', bodyColor: 'text-emerald-200/70', durationMs: 4000,
    },
  ],
  clean: [
    {
      icon: '', variant: 'badge',
      heading: 'Tier II — Scholar',
      body: '5 lessons completed. Scholar Tier II badge recorded.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 3500,
    },
  ],
}

export const BADGE_SCHOLAR_OAK: MilestoneConfig = {
  key: 'BADGE_SCHOLAR_OAK', bgColor: '#0f1a14', transition: 'shimmer', tier: 'landmark',
  orchard: [
    {
      icon: '🎓', variant: 'badge',
      heading: 'Oak Badge — Scholar',
      body: "All lessons completed. You've finished the full course. That knowledge goes with you forever.",
      headingColor: 'text-amber-300', bodyColor: 'text-emerald-200/70', durationMs: 4500,
    },
  ],
  clean: [
    {
      icon: '', variant: 'badge',
      heading: 'Tier III — Scholar',
      body: 'All lessons completed. Scholar Tier III badge recorded.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 4000,
    },
  ],
}

export const BADGE_LANDMARK_SEED: MilestoneConfig = {
  key: 'BADGE_LANDMARK_SEED', bgColor: '#0f1a14', transition: 'shimmer', tier: 'standard',
  orchard: [
    {
      icon: '🌱', variant: 'badge',
      heading: 'Your first approved job!',
      body: "One job, checked and approved. Your earning record has started. This is day one.",
      headingColor: 'text-emerald-300', bodyColor: 'text-emerald-200/70', durationMs: 4000,
    },
  ],
  clean: [
    {
      icon: '', variant: 'badge',
      heading: 'First completion approved.',
      body: 'Your ledger entry has been written. Landmark Tier I badge recorded.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 3500,
    },
  ],
}

export const BADGE_LANDMARK_SAPLING: MilestoneConfig = {
  key: 'BADGE_LANDMARK_SAPLING', bgColor: '#0f1a14', transition: 'shimmer', tier: 'standard',
  orchard: [
    {
      icon: '💰', variant: 'badge',
      heading: 'First payday!',
      body: "Your first real payout is done. That's money you earned yourself, from actual work.",
      headingColor: 'text-amber-300', bodyColor: 'text-emerald-200/70', durationMs: 4000,
    },
  ],
  clean: [
    {
      icon: '', variant: 'badge',
      heading: 'First payout received.',
      body: 'First cash payout confirmed. Landmark Tier II badge recorded.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 3500,
    },
  ],
}

export const BADGE_LANDMARK_OAK: MilestoneConfig = {
  key: 'BADGE_LANDMARK_OAK', bgColor: '#0f1a14', transition: 'shimmer', tier: 'landmark',
  orchard: [
    {
      icon: '🌳', variant: 'badge',
      heading: 'One full year in a row!',
      body: "365 days. Every scheduled job, every day, for a whole year. This doesn't happen by accident.",
      headingColor: 'text-amber-300', bodyColor: 'text-emerald-200/70', durationMs: 5000,
    },
  ],
  clean: [
    {
      icon: '', variant: 'badge',
      heading: '365-day streak.',
      body: 'One year of consecutive scheduled completions. Landmark Tier III badge recorded.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 4500,
    },
  ],
}
