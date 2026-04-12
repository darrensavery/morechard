/**
 * Avatar library — 32 SVG avatars across 4 categories.
 * Each renders as a circle with a coloured background.
 * Designed to appeal to teenagers: geometric, minimal, and premium-feeling.
 */

export interface AvatarDef {
  id: string
  name: string
  category: 'professional' | 'animals' | 'robots' | 'symbols'
  bg: string
  body: React.ReactNode
}

export const AVATARS: AvatarDef[] = [
  // ── Style (geometric / abstract marks) ───────────────────────
  { id: 'monogram-a', name: 'Monogram', category: 'professional', bg: '#0f0f14',
    body: <g><text x="50" y="67" textAnchor="middle" fontSize="54" fontWeight="200" fill="#e8e8f0" fontFamily="Georgia, serif" letterSpacing="-3">A</text><line x1="24" y1="78" x2="76" y2="78" stroke="#5a5a7a" strokeWidth="1.5"/></g> },

  { id: 'prism', name: 'Prism', category: 'professional', bg: '#0a0a18',
    body: <g><polygon points="50,14 82,68 18,68" fill="none" stroke="#6060c0" strokeWidth="2"/><polygon points="50,14 82,68 18,68" fill="#2020a0" opacity="0.15"/><line x1="50" y1="14" x2="50" y2="68" stroke="#8080ff" strokeWidth="1" opacity="0.6"/><line x1="50" y1="14" x2="18" y2="68" stroke="#4040a0" strokeWidth="1" opacity="0.5"/><polygon points="50,24 74,62 26,62" fill="none" stroke="#9090ff" strokeWidth="0.8" opacity="0.5"/></g> },

  { id: 'wave', name: 'Wave', category: 'professional', bg: '#020d18',
    body: <g><path d="M16 50 C24 36 32 36 40 50 C48 64 56 64 64 50 C72 36 80 36 88 50" stroke="#00aaff" strokeWidth="3" fill="none" strokeLinecap="round"/><path d="M16 60 C24 46 32 46 40 60 C48 74 56 74 64 60 C72 46 80 46 88 60" stroke="#0066cc" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5"/><path d="M16 40 C24 26 32 26 40 40 C48 54 56 54 64 40 C72 26 80 26 88 40" stroke="#0044aa" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.4"/></g> },

  { id: 'delta', name: 'Delta', category: 'professional', bg: '#100808',
    body: <g><polygon points="50,15 82,72 18,72" fill="none" stroke="#ff4444" strokeWidth="2.5" strokeLinejoin="round"/><polygon points="50,28 70,64 30,64" fill="#ff1a1a" opacity="0.12"/><circle cx="50" cy="50" r="3" fill="#ff4444"/><line x1="50" y1="15" x2="50" y2="47" stroke="#ff6666" strokeWidth="1" opacity="0.5"/></g> },

  { id: 'ink', name: 'Ink', category: 'professional', bg: '#080810',
    body: <g><path d="M50 18 C50 18 58 32 62 44 C66 56 62 70 50 76 C38 70 34 56 38 44 C42 32 50 18 50 18Z" fill="#2a2a4a"/><path d="M50 18 C50 18 58 32 62 44 C66 56 62 70 50 76 C38 70 34 56 38 44 C42 32 50 18 50 18Z" fill="none" stroke="#8888cc" strokeWidth="1.5"/><path d="M50 30 C52 38 54 48 52 60 C51 66 50 70 50 76 C50 70 49 66 48 60 C46 48 48 38 50 30Z" fill="#5555aa" opacity="0.4"/></g> },

  { id: 'grid', name: 'Grid', category: 'professional', bg: '#080f08',
    body: <g><rect x="20" y="20" width="60" height="60" fill="none" stroke="#224422" strokeWidth="1.5"/><line x1="40" y1="20" x2="40" y2="80" stroke="#224422" strokeWidth="1"/><line x1="60" y1="20" x2="60" y2="80" stroke="#224422" strokeWidth="1"/><line x1="20" y1="40" x2="80" y2="40" stroke="#224422" strokeWidth="1"/><line x1="20" y1="60" x2="80" y2="60" stroke="#224422" strokeWidth="1"/><rect x="42" y="42" width="16" height="16" fill="#00cc44" opacity="0.8"/><circle cx="50" cy="50" r="3" fill="#00ff66"/></g> },

  { id: 'arc', name: 'Arc', category: 'professional', bg: '#10080a',
    body: <g><path d="M20 70 A36 36 0 0 1 80 70" stroke="#cc4488" strokeWidth="3" fill="none" strokeLinecap="round"/><path d="M28 70 A28 28 0 0 1 72 70" stroke="#aa3366" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.7"/><path d="M36 70 A20 20 0 0 1 64 70" stroke="#882244" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.5"/><circle cx="50" cy="70" r="4" fill="#cc4488"/><line x1="50" y1="66" x2="50" y2="30" stroke="#cc4488" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/></g> },

  { id: 'facet', name: 'Facet', category: 'professional', bg: '#0a0e12',
    body: <g><polygon points="50,14 72,32 72,64 50,80 28,64 28,32" fill="none" stroke="#40708a" strokeWidth="2"/><polygon points="50,22 66,36 66,60 50,72 34,60 34,36" fill="#1a3a4a" opacity="0.5"/><line x1="50" y1="14" x2="50" y2="80" stroke="#60a0c0" strokeWidth="0.8" opacity="0.4"/><line x1="28" y1="32" x2="72" y2="64" stroke="#60a0c0" strokeWidth="0.8" opacity="0.4"/><line x1="72" y1="32" x2="28" y2="64" stroke="#60a0c0" strokeWidth="0.8" opacity="0.4"/><circle cx="50" cy="47" r="5" fill="#60a0c0" opacity="0.7"/></g> },

  // ── Animals (minimal line-art, angular) ───────────────────────
  { id: 'wolf', name: 'Wolf', category: 'animals', bg: '#0c0c14',
    body: <g><path d="M50 72 C36 72 22 62 22 48 C22 36 30 28 38 26 L32 14 L44 30 C46 29 48 28 50 28 C52 28 54 29 56 30 L68 14 L62 26 C70 28 78 36 78 48 C78 62 64 72 50 72Z" fill="none" stroke="#8888aa" strokeWidth="2" strokeLinejoin="round"/><circle cx="40" cy="46" r="4" fill="#aaaacc"/><circle cx="60" cy="46" r="4" fill="#aaaacc"/><path d="M44 58 Q50 64 56 58" stroke="#6666aa" strokeWidth="2" fill="none" strokeLinecap="round"/></g> },

  { id: 'fox', name: 'Fox', category: 'animals', bg: '#140800',
    body: <g><path d="M50 72 C36 72 22 60 24 46 C26 36 32 30 36 28 L26 12 L46 30 C47 29 48 29 50 29 C52 29 53 29 54 30 L74 12 L64 28 C68 30 74 36 76 46 C78 60 64 72 50 72Z" fill="none" stroke="#cc6622" strokeWidth="2" strokeLinejoin="round"/><circle cx="40" cy="46" r="4" fill="#ee8844"/><circle cx="60" cy="46" r="4" fill="#ee8844"/><path d="M42 58 Q50 65 58 58" stroke="#cc6622" strokeWidth="2" fill="none" strokeLinecap="round"/><path d="M38 44 L44 50 M62 44 L56 50" stroke="#cc6622" strokeWidth="1" opacity="0.5"/></g> },

  { id: 'owl', name: 'Owl', category: 'animals', bg: '#0e0c06',
    body: <g><path d="M50 74 C36 74 26 62 26 50 C26 36 36 26 50 26 C64 26 74 36 74 50 C74 62 64 74 50 74Z" fill="none" stroke="#a08840" strokeWidth="2"/><circle cx="40" cy="46" r="8" fill="none" stroke="#c0a850" strokeWidth="2"/><circle cx="60" cy="46" r="8" fill="none" stroke="#c0a850" strokeWidth="2"/><circle cx="40" cy="46" r="4" fill="#c0a850" opacity="0.7"/><circle cx="60" cy="46" r="4" fill="#c0a850" opacity="0.7"/><path d="M36 26 L30 14 M64 26 L70 14" stroke="#a08840" strokeWidth="2.5" strokeLinecap="round"/><path d="M46 54 L50 58 L54 54" stroke="#a08840" strokeWidth="1.5" fill="none"/></g> },

  { id: 'bear', name: 'Bear', category: 'animals', bg: '#100a06',
    body: <g><path d="M28 66 C28 52 34 42 50 40 C66 42 72 52 72 66" fill="none" stroke="#886644" strokeWidth="2"/><path d="M34 44 C34 34 42 26 50 26 C58 26 66 34 66 44" fill="none" stroke="#886644" strokeWidth="2"/><circle cx="34" cy="28" r="8" fill="none" stroke="#886644" strokeWidth="2"/><circle cx="66" cy="28" r="8" fill="none" stroke="#886644" strokeWidth="2"/><circle cx="42" cy="40" r="3.5" fill="#886644" opacity="0.8"/><circle cx="58" cy="40" r="3.5" fill="#886644" opacity="0.8"/><path d="M42 52 Q50 58 58 52" stroke="#886644" strokeWidth="2" fill="none" strokeLinecap="round"/></g> },

  { id: 'shark', name: 'Shark', category: 'animals', bg: '#040c14',
    body: <g><path d="M18 56 C18 56 34 44 50 44 C66 44 82 56 82 56 C82 56 66 68 50 68 C34 68 18 56 18 56Z" fill="none" stroke="#4488aa" strokeWidth="2"/><path d="M50 44 L50 20" stroke="#4488aa" strokeWidth="2.5" strokeLinecap="round"/><path d="M50 20 L42 38 M50 20 L58 38" stroke="#336688" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/><circle cx="40" cy="54" r="3" fill="#4488aa" opacity="0.8"/><circle cx="60" cy="54" r="3" fill="#4488aa" opacity="0.8"/><path d="M34 62 Q50 70 66 62" stroke="#2266aa" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.6"/></g> },

  { id: 'lion', name: 'Lion', category: 'animals', bg: '#120c00',
    body: <g><circle cx="50" cy="48" r="28" fill="none" stroke="#886622" strokeWidth="1.5" strokeDasharray="4 3"/><circle cx="50" cy="48" r="20" fill="none" stroke="#cc9933" strokeWidth="2"/><circle cx="41" cy="44" r="4" fill="#cc9933" opacity="0.8"/><circle cx="59" cy="44" r="4" fill="#cc9933" opacity="0.8"/><path d="M43 56 Q50 62 57 56" stroke="#aa7722" strokeWidth="2" fill="none" strokeLinecap="round"/><path d="M30 38 L22 32 M70 38 L78 32 M30 56 L22 62 M70 56 L78 62" stroke="#886622" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/></g> },

  { id: 'eagle', name: 'Eagle', category: 'animals', bg: '#080c04',
    body: <g><path d="M50 24 C50 24 62 32 70 44 C74 50 76 58 70 66 L50 78 L30 66 C24 58 26 50 30 44 C38 32 50 24 50 24Z" fill="none" stroke="#4a6a30" strokeWidth="2"/><path d="M50 24 L50 78" stroke="#6a9a44" strokeWidth="1" opacity="0.4"/><path d="M30 44 L70 44" stroke="#6a9a44" strokeWidth="1" opacity="0.4"/><circle cx="42" cy="42" r="4" fill="#6a9a44" opacity="0.8"/><circle cx="58" cy="42" r="4" fill="#6a9a44" opacity="0.8"/><path d="M44 54 L50 60 L56 54" stroke="#4a6a30" strokeWidth="2" fill="none"/></g> },

  { id: 'cat', name: 'Cat', category: 'animals', bg: '#0c0c10',
    body: <g><path d="M30 66 C26 56 28 42 36 34 L28 16 L44 34 C46 33 48 32 50 32 C52 32 54 33 56 34 L72 16 L64 34 C72 42 74 56 70 66" fill="none" stroke="#8888aa" strokeWidth="2" strokeLinejoin="round"/><circle cx="41" cy="48" r="5" fill="none" stroke="#aaaacc" strokeWidth="1.5"/><circle cx="59" cy="48" r="5" fill="none" stroke="#aaaacc" strokeWidth="1.5"/><circle cx="41" cy="48" r="2" fill="#aaaacc" opacity="0.7"/><circle cx="59" cy="48" r="2" fill="#aaaacc" opacity="0.7"/><path d="M42 58 Q50 64 58 58" stroke="#6666aa" strokeWidth="2" fill="none" strokeLinecap="round"/><path d="M28 48 L40 50 M72 48 L60 50" stroke="#6666aa" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/></g> },

  // ── Robots & Cyberpunk ────────────────────────────────────────
  { id: 'bot', name: 'Bot', category: 'robots', bg: '#020c18',
    body: <g><rect x="30" y="30" width="40" height="36" rx="4" fill="none" stroke="#0088ff" strokeWidth="2"/><rect x="36" y="20" width="28" height="12" rx="2" fill="none" stroke="#0066cc" strokeWidth="1.5"/><rect x="37" y="36" width="10" height="8" rx="2" fill="#0088ff" opacity="0.7"/><rect x="53" y="36" width="10" height="8" rx="2" fill="#0088ff" opacity="0.7"/><line x1="37" y1="54" x2="63" y2="54" stroke="#0066cc" strokeWidth="1.5" strokeLinecap="round"/><line x1="37" y1="59" x2="55" y2="59" stroke="#004499" strokeWidth="1" strokeLinecap="round"/><rect x="22" y="34" width="8" height="12" rx="3" fill="none" stroke="#0066cc" strokeWidth="1.5"/><rect x="70" y="34" width="8" height="12" rx="3" fill="none" stroke="#0066cc" strokeWidth="1.5"/><circle cx="44" cy="26" r="2" fill="#00aaff"/><circle cx="56" cy="26" r="2" fill="#00aaff"/></g> },

  { id: 'mech', name: 'Mech', category: 'robots', bg: '#08080e',
    body: <g><rect x="32" y="32" width="36" height="32" rx="3" fill="none" stroke="#6644aa" strokeWidth="2"/><rect x="36" y="22" width="28" height="12" rx="2" fill="none" stroke="#5533aa" strokeWidth="1.5"/><rect x="38" y="36" width="9" height="7" rx="1" fill="#9955ee" opacity="0.8"/><rect x="53" y="36" width="9" height="7" rx="1" fill="#9955ee" opacity="0.8"/><path d="M38 52 L46 56 L54 56 L62 52" stroke="#6644aa" strokeWidth="1.5" fill="none"/><rect x="22" y="36" width="10" height="14" rx="2" fill="none" stroke="#5533aa" strokeWidth="1.5"/><rect x="68" y="36" width="10" height="14" rx="2" fill="none" stroke="#5533aa" strokeWidth="1.5"/><circle cx="50" cy="26" r="3" fill="#cc44ff"/><line x1="44" y1="22" x2="44" y2="32" stroke="#9933cc" strokeWidth="1"/><line x1="56" y1="22" x2="56" y2="32" stroke="#9933cc" strokeWidth="1"/></g> },

  { id: 'alien', name: 'Alien', category: 'robots', bg: '#020e06',
    body: <g><path d="M50 74 C34 74 22 62 22 48 C22 34 34 22 50 22 C66 22 78 34 78 48 C78 62 66 74 50 74Z" fill="none" stroke="#00cc44" strokeWidth="2"/><path d="M36 42 C36 36 42 30 50 30 C58 30 64 36 64 42" fill="none" stroke="#00aa33" strokeWidth="1.5"/><ellipse cx="38" cy="46" rx="7" ry="5" fill="none" stroke="#00ff66" strokeWidth="1.5"/><ellipse cx="62" cy="46" rx="7" ry="5" fill="none" stroke="#00ff66" strokeWidth="1.5"/><ellipse cx="38" cy="46" rx="3" ry="2.5" fill="#00ff66" opacity="0.6"/><ellipse cx="62" cy="46" rx="3" ry="2.5" fill="#00ff66" opacity="0.6"/><path d="M42 58 Q50 64 58 58" stroke="#00cc44" strokeWidth="2" fill="none" strokeLinecap="round"/><line x1="28" y1="30" x2="20" y2="22" stroke="#009933" strokeWidth="2" strokeLinecap="round"/><line x1="72" y1="30" x2="80" y2="22" stroke="#009933" strokeWidth="2" strokeLinecap="round"/></g> },

  { id: 'cyborg', name: 'Cyborg', category: 'robots', bg: '#0e0410',
    body: <g><path d="M50 72 C36 72 26 62 26 50 C26 38 36 28 50 28 C64 28 74 38 74 50 C74 62 64 72 50 72Z" fill="none" stroke="#8844aa" strokeWidth="2"/><circle cx="40" cy="46" r="7" fill="none" stroke="#cc44ff" strokeWidth="2"/><circle cx="40" cy="46" r="3" fill="#cc44ff" opacity="0.7"/><circle cx="60" cy="46" r="5" fill="none" stroke="#886688" strokeWidth="1.5"/><circle cx="60" cy="46" r="2.5" fill="#aa66cc" opacity="0.6"/><path d="M66 36 L76 30" stroke="#8844aa" strokeWidth="2" strokeLinecap="round"/><path d="M66 44 L74 44" stroke="#8844aa" strokeWidth="1.5" strokeLinecap="round"/><path d="M42 58 Q50 64 58 58" stroke="#8844aa" strokeWidth="2" fill="none" strokeLinecap="round"/><line x1="26" y1="50" x2="20" y2="50" stroke="#cc44ff" strokeWidth="1.5" opacity="0.5"/></g> },

  { id: 'android', name: 'Android', category: 'robots', bg: '#020e0c',
    body: <g><rect x="30" y="32" width="40" height="36" rx="6" fill="none" stroke="#00aa88" strokeWidth="2"/><path d="M36 32 C36 26 40 20 50 20 C60 20 64 26 64 32" fill="none" stroke="#008866" strokeWidth="2"/><rect x="36" y="40" width="10" height="8" rx="2" fill="#00cc99" opacity="0.7"/><rect x="54" y="40" width="10" height="8" rx="2" fill="#00cc99" opacity="0.7"/><line x1="36" y1="56" x2="64" y2="56" stroke="#00aa88" strokeWidth="1.5" strokeLinecap="round"/><rect x="20" y="36" width="10" height="16" rx="4" fill="none" stroke="#008866" strokeWidth="1.5"/><rect x="70" y="36" width="10" height="16" rx="4" fill="none" stroke="#008866" strokeWidth="1.5"/><circle cx="38" cy="20" r="2" fill="#00aa88"/><circle cx="62" cy="20" r="2" fill="#00aa88"/></g> },

  { id: 'ufo', name: 'UFO', category: 'robots', bg: '#04020e',
    body: <g><ellipse cx="50" cy="54" rx="30" ry="8" fill="none" stroke="#5533cc" strokeWidth="2"/><ellipse cx="50" cy="50" rx="20" ry="6" fill="#2211aa" opacity="0.4"/><path d="M36 50 C36 38 42 28 50 28 C58 28 64 38 64 50" fill="none" stroke="#7755ee" strokeWidth="2"/><ellipse cx="50" cy="38" rx="8" ry="10" fill="none" stroke="#9977ff" strokeWidth="1.5"/><circle cx="32" cy="56" r="2.5" fill="#aaffff" opacity="0.9"/><circle cx="44" cy="60" r="2" fill="#ffaaff" opacity="0.8"/><circle cx="56" cy="60" r="2" fill="#aaffaa" opacity="0.8"/><circle cx="68" cy="56" r="2.5" fill="#ffffaa" opacity="0.9"/></g> },

  { id: 'circuit', name: 'Circuit', category: 'robots', bg: '#020a02',
    body: <g><rect x="24" y="24" width="52" height="52" rx="4" fill="none" stroke="#004400" strokeWidth="1.5"/><circle cx="36" cy="36" r="6" fill="none" stroke="#00aa22" strokeWidth="1.5"/><circle cx="64" cy="36" r="6" fill="none" stroke="#00aa22" strokeWidth="1.5"/><circle cx="36" cy="64" r="6" fill="none" stroke="#00aa22" strokeWidth="1.5"/><circle cx="64" cy="64" r="6" fill="none" stroke="#00aa22" strokeWidth="1.5"/><path d="M42 36 L58 36 M36 42 L36 58 M64 42 L64 58 M42 64 L58 64" stroke="#006600" strokeWidth="1.5" strokeLinecap="round"/><rect x="43" y="43" width="14" height="14" rx="2" fill="none" stroke="#00ff44" strokeWidth="1.5"/><circle cx="50" cy="50" r="3" fill="#00ff44" opacity="0.8"/></g> },

  // ── Symbols & Abstract ────────────────────────────────────────
  { id: 'flame', name: 'Flame', category: 'symbols', bg: '#100400',
    body: <g><path d="M50 78 C38 68 30 54 34 40 C36 33 40 29 40 29 C39 36 44 38 46 33 C48 28 50 22 50 22 C50 22 52 28 54 33 C56 38 61 36 60 29 C60 29 64 33 66 40 C70 54 62 68 50 78Z" fill="none" stroke="#ff5500" strokeWidth="2"/><path d="M50 68 C42 60 38 50 42 40 C43 37 46 35 46 35 C45 40 48 42 50 38 C52 42 55 40 54 35 C56 42 58 50 50 68Z" fill="#ff3300" opacity="0.4"/></g> },

  { id: 'galaxy', name: 'Galaxy', category: 'symbols', bg: '#040408',
    body: <g><ellipse cx="50" cy="50" rx="28" ry="8" fill="none" stroke="#4444cc" strokeWidth="1.5" transform="rotate(-30 50 50)"/><ellipse cx="50" cy="50" rx="28" ry="8" fill="none" stroke="#2244aa" strokeWidth="1.5" transform="rotate(30 50 50)"/><circle cx="50" cy="50" r="6" fill="none" stroke="#ffffff" strokeWidth="1.5"/><circle cx="50" cy="50" r="3" fill="#ffffc0" opacity="0.9"/><circle cx="28" cy="38" r="1.5" fill="#aaaaff" opacity="0.8"/><circle cx="72" cy="62" r="1.5" fill="#aaaaff" opacity="0.8"/><circle cx="34" cy="64" r="1" fill="#ffffff" opacity="0.6"/><circle cx="68" cy="36" r="1" fill="#ffaaaa" opacity="0.7"/><circle cx="22" cy="52" r="1" fill="#aaffaa" opacity="0.6"/></g> },

  { id: 'crystal', name: 'Crystal', category: 'symbols', bg: '#040810',
    body: <g><polygon points="50,14 66,32 62,68 38,68 34,32" fill="none" stroke="#4488cc" strokeWidth="2"/><polygon points="50,20 62,34 58,62 42,62 38,34" fill="none" stroke="#2266aa" strokeWidth="1" opacity="0.6"/><line x1="50" y1="14" x2="50" y2="68" stroke="#6699dd" strokeWidth="1" opacity="0.4"/><line x1="34" y1="32" x2="66" y2="32" stroke="#6699dd" strokeWidth="1" opacity="0.4"/><circle cx="50" cy="14" r="2.5" fill="#88bbff"/><circle cx="50" cy="68" r="2" fill="#4488cc" opacity="0.7"/></g> },

  { id: 'bolt', name: 'Bolt', category: 'symbols', bg: '#0e0a00',
    body: <g><polygon points="56,14 28,52 50,52 44,86 74,44 50,44" fill="none" stroke="#ffcc00" strokeWidth="2.5" strokeLinejoin="round"/><polygon points="56,14 28,52 50,52 44,86 74,44 50,44" fill="#ffcc00" opacity="0.08"/></g> },

  { id: 'vortex', name: 'Vortex', category: 'symbols', bg: '#060612',
    body: <g><path d="M50 22 C64 22 76 34 76 48 C76 58 70 66 62 70" stroke="#4444ff" strokeWidth="2.5" fill="none" strokeLinecap="round"/><path d="M62 70 C54 74 44 72 38 64 C32 56 34 44 42 38" stroke="#3333cc" strokeWidth="2" fill="none" strokeLinecap="round"/><path d="M42 38 C46 30 54 28 60 32 C66 36 68 44 64 50" stroke="#2222aa" strokeWidth="1.5" fill="none" strokeLinecap="round"/><path d="M64 50 C62 54 58 56 54 54 C50 52 50 48 52 46" stroke="#3333cc" strokeWidth="1" fill="none" strokeLinecap="round"/><circle cx="50" cy="50" r="3" fill="#6666ff" opacity="0.9"/></g> },

  { id: 'skull', name: 'Skull', category: 'symbols', bg: '#080808',
    body: <g><path d="M26 52 C26 34 36 20 50 20 C64 20 74 34 74 52 C74 62 68 70 60 72 L60 78 L40 78 L40 72 C32 70 26 62 26 52Z" fill="none" stroke="#888888" strokeWidth="2"/><circle cx="40" cy="48" r="7" fill="none" stroke="#aaaaaa" strokeWidth="1.5"/><circle cx="60" cy="48" r="7" fill="none" stroke="#aaaaaa" strokeWidth="1.5"/><circle cx="40" cy="48" r="3" fill="#aaaaaa" opacity="0.6"/><circle cx="60" cy="48" r="3" fill="#aaaaaa" opacity="0.6"/><line x1="44" y1="72" x2="44" y2="78" stroke="#666666" strokeWidth="2"/><line x1="50" y1="72" x2="50" y2="78" stroke="#666666" strokeWidth="2"/><line x1="56" y1="72" x2="56" y2="78" stroke="#666666" strokeWidth="2"/></g> },

  { id: 'crown', name: 'Crown', category: 'symbols', bg: '#100a00',
    body: <g><path d="M18 72 L18 44 L32 58 L50 28 L68 58 L82 44 L82 72Z" fill="none" stroke="#cc9900" strokeWidth="2" strokeLinejoin="round"/><line x1="18" y1="72" x2="82" y2="72" stroke="#cc9900" strokeWidth="2"/><circle cx="50" cy="28" r="4" fill="none" stroke="#ffcc00" strokeWidth="1.5"/><circle cx="18" cy="44" r="3" fill="none" stroke="#cc9900" strokeWidth="1.5"/><circle cx="82" cy="44" r="3" fill="none" stroke="#cc9900" strokeWidth="1.5"/></g> },

  { id: 'shield', name: 'Shield', category: 'symbols', bg: '#040a14',
    body: <g><path d="M50 16 L76 26 L76 50 Q76 66 50 82 Q24 66 24 50 L24 26Z" fill="none" stroke="#2266aa" strokeWidth="2"/><path d="M50 24 L70 32 L70 50 Q70 62 50 76 Q30 62 30 50 L30 32Z" fill="none" stroke="#1144aa" strokeWidth="1" opacity="0.5"/><path d="M42 48 L48 54 L60 40" stroke="#4488ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></g> },

  { id: 'target', name: 'Target', category: 'symbols', bg: '#100202',
    body: <g><circle cx="50" cy="50" r="30" fill="none" stroke="#880000" strokeWidth="2"/><circle cx="50" cy="50" r="20" fill="none" stroke="#aa0000" strokeWidth="1.5"/><circle cx="50" cy="50" r="10" fill="none" stroke="#cc2200" strokeWidth="1.5"/><circle cx="50" cy="50" r="3" fill="#ff2200" opacity="0.9"/><line x1="50" y1="16" x2="50" y2="26" stroke="#880000" strokeWidth="1.5" strokeLinecap="round"/><line x1="50" y1="74" x2="50" y2="84" stroke="#880000" strokeWidth="1.5" strokeLinecap="round"/><line x1="16" y1="50" x2="26" y2="50" stroke="#880000" strokeWidth="1.5" strokeLinecap="round"/><line x1="74" y1="50" x2="84" y2="50" stroke="#880000" strokeWidth="1.5" strokeLinecap="round"/></g> },
]

export const AVATAR_CATEGORIES = [
  { id: 'professional', label: 'Style' },
  { id: 'animals',      label: 'Animals' },
  { id: 'robots',       label: 'Robots' },
  { id: 'symbols',      label: 'Symbols' },
] as const

export function AvatarSVG({ id, size = 52 }: { id: string; size?: number }) {
  const avatar = AVATARS.find(a => a.id === id)
  if (!avatar) return <DefaultAvatar size={size} />
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      style={{ borderRadius: '50%', display: 'block', flexShrink: 0 }}
    >
      <circle cx="50" cy="50" r="50" fill={avatar.bg} />
      {avatar.body}
    </svg>
  )
}

export function DefaultAvatar({ size = 52, initials = '?', color = '#0d9488' }: {
  size?: number; initials?: string; color?: string
}) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ borderRadius: '50%', display: 'block', flexShrink: 0 }}>
      <circle cx="50" cy="50" r="50" fill={color} />
      <text x="50" y="62" textAnchor="middle" fontSize="42" fontWeight="800"
        fill="#ffffff" fontFamily="Manrope, sans-serif">{initials[0]?.toUpperCase()}</text>
    </svg>
  )
}
