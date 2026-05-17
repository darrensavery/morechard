// app/src/components/celebration/GrowthMedallion.tsx
// SVG growth mark: teal cloud-leaf with golden accent stars.
// Used in Seedling-view badge screens.
interface Props {
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = { sm: 64, md: 84, lg: 128 }

export function GrowthMedallion({ size = 'md' }: Props) {
  const px = SIZES[size]
  return (
    <svg width={px} height={px} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="gm-leaf" x1="20" y1="14" x2="80" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3fcf9b"/><stop offset="1" stopColor="#00959c"/>
        </linearGradient>
        <linearGradient id="gm-trunk" x1="50" y1="58" x2="50" y2="90" gradientUnits="userSpaceOnUse">
          <stop stopColor="#caa15a"/><stop offset="1" stopColor="#8a6a2f"/>
        </linearGradient>
      </defs>
      <path d="M50 88 V60" stroke="url(#gm-trunk)" strokeWidth="6.5" strokeLinecap="round"/>
      <path d="M50 70 C50 70 40 64 36 56" stroke="url(#gm-trunk)" strokeWidth="4" strokeLinecap="round"/>
      <path d="M50 64 C50 64 60 60 64 53" stroke="url(#gm-trunk)" strokeWidth="4" strokeLinecap="round"/>
      <path d="M50 12 C30 18 22 34 30 48 C16 50 14 66 30 70 C44 74 56 74 70 70 C86 66 84 50 70 48 C78 34 70 18 50 12 Z" fill="url(#gm-leaf)"/>
      <path d="M50 12 C50 30 50 52 50 66" stroke="#0f1a14" strokeOpacity=".18" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="38" cy="44" r="4.4" fill="#e6b222"/>
      <circle cx="63" cy="38" r="3.4" fill="#e6b222"/>
      <path d="M72 20 l2.4 5 5 2.4 -5 2.4 -2.4 5 -2.4 -5 -5 -2.4 5 -2.4 Z" fill="#ffe39a"/>
    </svg>
  )
}
