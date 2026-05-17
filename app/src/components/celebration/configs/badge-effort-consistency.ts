// app/src/components/celebration/configs/badge-effort-consistency.ts
import type { MilestoneConfig } from '../types'

export const BADGE_CONSISTENCY_SEED: MilestoneConfig = {
  key: 'BADGE_CONSISTENCY_SEED', bgColor: '#0f1a14', transition: 'shimmer', tier: 'standard',
  orchard: [
    {
      icon: '🌱', variant: 'badge',
      heading: 'Seedling Badge — Consistency',
      body: "You kept your streak going for 7 days in a row. Your first consistency badge is locked in.",
      headingColor: 'text-emerald-300', bodyColor: 'text-emerald-200/70', durationMs: 4000,
    },
  ],
  clean: [
    {
      icon: '', variant: 'badge',
      heading: 'Tier I — Consistency',
      body: '7-day streak achieved. Consistency Tier I badge recorded.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 3500,
    },
  ],
}

export const BADGE_CONSISTENCY_SAPLING: MilestoneConfig = {
  key: 'BADGE_CONSISTENCY_SAPLING', bgColor: '#0f1a14', transition: 'shimmer', tier: 'standard',
  orchard: [
    {
      icon: '🌿', variant: 'badge',
      heading: 'Sapling Badge — Consistency',
      body: "30 days straight. You're not just doing this when it's easy — you're doing it every day.",
      headingColor: 'text-emerald-300', bodyColor: 'text-emerald-200/70', durationMs: 4000,
    },
  ],
  clean: [
    {
      icon: '', variant: 'badge',
      heading: 'Tier II — Consistency',
      body: '30-day streak. Consistency Tier II badge recorded.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 3500,
    },
  ],
}

export const BADGE_CONSISTENCY_OAK: MilestoneConfig = {
  key: 'BADGE_CONSISTENCY_OAK', bgColor: '#0f1a14', transition: 'shimmer', tier: 'landmark',
  orchard: [
    {
      icon: '🌳', variant: 'badge',
      heading: 'Oak Badge — Consistency',
      body: "90 days in a row. That's three months of showing up every single day. This is who you are now.",
      headingColor: 'text-amber-300', bodyColor: 'text-emerald-200/70', durationMs: 4500,
    },
  ],
  clean: [
    {
      icon: '', variant: 'badge',
      heading: 'Tier III — Consistency',
      body: '90-day streak. Consistency Tier III badge recorded. Top 1% performance window.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 4000,
    },
  ],
}

export const BADGE_EFFORT_SEED: MilestoneConfig = {
  key: 'BADGE_EFFORT_SEED', bgColor: '#0f1a14', transition: 'shimmer', tier: 'standard',
  orchard: [
    {
      icon: '🌱', variant: 'badge',
      heading: "Seedling Badge — Effort",
      body: "25 jobs done and approved. You're no longer just starting out.",
      headingColor: 'text-emerald-300', bodyColor: 'text-emerald-200/70', durationMs: 4000,
    },
  ],
  clean: [
    {
      icon: '', variant: 'badge',
      heading: 'Tier I — Effort',
      body: '25 completed chores approved. Effort Tier I badge recorded.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 3500,
    },
  ],
}

export const BADGE_EFFORT_SAPLING: MilestoneConfig = {
  key: 'BADGE_EFFORT_SAPLING', bgColor: '#0f1a14', transition: 'shimmer', tier: 'standard',
  orchard: [
    {
      icon: '🌿', variant: 'badge',
      heading: 'Sapling Badge — Effort',
      body: "50 jobs done. You've put in real work to earn your money. Every approved job is on record.",
      headingColor: 'text-emerald-300', bodyColor: 'text-emerald-200/70', durationMs: 4000,
    },
  ],
  clean: [
    {
      icon: '', variant: 'badge',
      heading: 'Tier II — Effort',
      body: '50 approved chores. Effort Tier II badge recorded.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 3500,
    },
  ],
}

export const BADGE_EFFORT_OAK: MilestoneConfig = {
  key: 'BADGE_EFFORT_OAK', bgColor: '#0f1a14', transition: 'shimmer', tier: 'landmark',
  orchard: [
    {
      icon: '🌳', variant: 'badge',
      heading: 'Oak Badge — Effort',
      body: "100 jobs approved. One hundred. That's an actual work record now.",
      headingColor: 'text-amber-300', bodyColor: 'text-emerald-200/70', durationMs: 4500,
    },
  ],
  clean: [
    {
      icon: '', variant: 'badge',
      heading: 'Tier III — Effort',
      body: '100 approved completions. Effort Tier III badge recorded.',
      headingColor: 'text-white', bodyColor: 'text-white/60', durationMs: 4000,
    },
  ],
}
