/**
 * Avatar library — 32 SVG avatars across 4 categories.
 * Each renders as a circle with a coloured background.
 */

export interface AvatarDef {
  id: string
  name: string
  category: 'professional' | 'animals' | 'robots' | 'symbols'
  bg: string
  body: React.ReactNode
}

export const AVATARS: AvatarDef[] = [
  // ── Professional ─────────────────────────────────────────────
  { id: 'monogram-a', name: 'Slate',    category: 'professional', bg: '#2d3748',
    body: <g><text x="50" y="66" textAnchor="middle" fontSize="52" fontWeight="700" fill="#e2e8f0" fontFamily="Georgia, serif" letterSpacing="-2">A</text></g> },
  { id: 'pen',        name: 'Pen',      category: 'professional', bg: '#1a2a1a',
    body: <g><rect x="47" y="18" width="6" height="46" rx="3" fill="#c8d8b0"/><path d="M44 58 L50 74 L56 58Z" fill="#a0b888"/><rect x="44" y="16" width="12" height="6" rx="2" fill="#8aaa60"/><rect x="46" y="22" width="2" height="30" rx="1" fill="#fff" opacity="0.3"/></g> },
  { id: 'compass',    name: 'Compass',  category: 'professional', bg: '#1c1c2e',
    body: <g><circle cx="50" cy="50" r="26" fill="none" stroke="#a0a8c8" strokeWidth="2.5"/><circle cx="50" cy="50" r="3" fill="#c8cce8"/><line x1="50" y1="24" x2="50" y2="38" stroke="#c8cce8" strokeWidth="2.5" strokeLinecap="round"/><line x1="50" y1="62" x2="50" y2="76" stroke="#6068a0" strokeWidth="2.5" strokeLinecap="round"/><line x1="24" y1="50" x2="38" y2="50" stroke="#6068a0" strokeWidth="2" strokeLinecap="round"/><line x1="62" y1="50" x2="76" y2="50" stroke="#6068a0" strokeWidth="2" strokeLinecap="round"/><path d="M50 26 L53 36 L50 38 L47 36Z" fill="#e8a030"/></g> },
  { id: 'key',        name: 'Key',      category: 'professional', bg: '#2a1f0e',
    body: <g><circle cx="42" cy="42" r="16" fill="none" stroke="#c8a84a" strokeWidth="5"/><circle cx="42" cy="42" r="6" fill="none" stroke="#c8a84a" strokeWidth="3"/><rect x="55" y="39" width="22" height="6" rx="3" fill="#c8a84a"/><rect x="68" y="45" width="6" height="8" rx="2" fill="#c8a84a"/><rect x="60" y="45" width="5" height="6" rx="1.5" fill="#c8a84a"/></g> },
  { id: 'lens',       name: 'Lens',     category: 'professional', bg: '#0f1e2e',
    body: <g><circle cx="46" cy="46" r="22" fill="none" stroke="#5a8ab0" strokeWidth="5"/><circle cx="46" cy="46" r="14" fill="none" stroke="#3a6a90" strokeWidth="2"/><circle cx="40" cy="40" r="4" fill="#5a8ab0" opacity="0.4"/><line x1="62" y1="62" x2="76" y2="76" stroke="#5a8ab0" strokeWidth="6" strokeLinecap="round"/></g> },
  { id: 'leaf',       name: 'Leaf',     category: 'professional', bg: '#0f1f0f',
    body: <g><path d="M50 75 C50 75 24 60 24 38 C24 22 38 16 50 20 C62 16 76 22 76 38 C76 60 50 75 50 75Z" fill="#2d5a2d"/><path d="M50 75 C50 75 24 60 24 38 C24 22 38 16 50 20 C62 16 76 22 76 38 C76 60 50 75 50 75Z" fill="none" stroke="#4a8a4a" strokeWidth="1.5"/><line x1="50" y1="72" x2="50" y2="22" stroke="#4a8a4a" strokeWidth="2" strokeLinecap="round"/><line x1="50" y1="38" x2="36" y2="30" stroke="#4a8a4a" strokeWidth="1.5" strokeLinecap="round"/><line x1="50" y1="48" x2="64" y2="40" stroke="#4a8a4a" strokeWidth="1.5" strokeLinecap="round"/><line x1="50" y1="58" x2="38" y2="52" stroke="#4a8a4a" strokeWidth="1.5" strokeLinecap="round"/></g> },
  { id: 'mountain',   name: 'Mountain', category: 'professional', bg: '#1a1f2e',
    body: <g><path d="M50 18 L78 70 L22 70Z" fill="#3a4a6a"/><path d="M50 18 L78 70 L22 70Z" fill="none" stroke="#5a6a8a" strokeWidth="1.5"/><path d="M50 18 L62 42 L38 42Z" fill="#c8d0e0"/><path d="M32 50 L50 70 L14 70Z" fill="#2a3a5a"/></g> },
  { id: 'hourglass',  name: 'Hourglass',category: 'professional', bg: '#1f1a2e',
    body: <g><rect x="30" y="20" width="40" height="6" rx="3" fill="#8878c8"/><rect x="30" y="74" width="40" height="6" rx="3" fill="#8878c8"/><path d="M34 26 L50 50 L66 26Z" fill="#6858a8"/><path d="M34 74 L50 50 L66 74Z" fill="#4a3a8a"/><ellipse cx="50" cy="50" rx="5" ry="5" fill="#c0b8e8" opacity="0.6"/><circle cx="42" cy="66" r="3" fill="#8878c8" opacity="0.5"/><circle cx="50" cy="68" r="2" fill="#8878c8" opacity="0.4"/></g> },

  // ── Animals ───────────────────────────────────────────────────
  { id: 'wolf',    name: 'Wolf',    category: 'animals', bg: '#4a5568',
    body: <g><ellipse cx="50" cy="52" rx="20" ry="18" fill="#a0aab4"/><ellipse cx="50" cy="38" rx="18" ry="16" fill="#c8d0d8"/><path d="M32 28 L36 14 L42 28Z" fill="#a0aab4"/><path d="M58 28 L64 14 L68 28Z" fill="#a0aab4"/><ellipse cx="44" cy="40" rx="4" ry="3" fill="#2d3748"/><ellipse cx="56" cy="40" rx="4" ry="3" fill="#2d3748"/><ellipse cx="50" cy="48" rx="8" ry="5" fill="#d8a090"/><path d="M42 54 Q50 60 58 54" stroke="#b08070" strokeWidth="2.5" fill="none"/></g> },
  { id: 'fox',     name: 'Fox',     category: 'animals', bg: '#8b3a00',
    body: <g><ellipse cx="50" cy="52" rx="19" ry="17" fill="#e07030"/><ellipse cx="50" cy="38" rx="17" ry="16" fill="#f08840"/><path d="M33 28 L28 10 L45 28Z" fill="#e07030"/><path d="M67 28 L72 10 L55 28Z" fill="#e07030"/><ellipse cx="44" cy="40" rx="4" ry="3" fill="#2d1a00"/><ellipse cx="56" cy="40" rx="4" ry="3" fill="#2d1a00"/><ellipse cx="50" cy="50" rx="9" ry="6" fill="#f0d0c0"/><path d="M42 55 Q50 62 58 55" stroke="#c06840" strokeWidth="2.5" fill="none"/></g> },
  { id: 'owl',     name: 'Owl',     category: 'animals', bg: '#553a1a',
    body: <g><ellipse cx="50" cy="52" rx="20" ry="18" fill="#8b6a40"/><ellipse cx="50" cy="36" rx="18" ry="16" fill="#c0a070"/><ellipse cx="42" cy="36" rx="9" ry="9" fill="#f0e8d0"/><ellipse cx="58" cy="36" rx="9" ry="9" fill="#f0e8d0"/><ellipse cx="42" cy="36" rx="6" ry="6" fill="#f0a000"/><ellipse cx="58" cy="36" rx="6" ry="6" fill="#f0a000"/><ellipse cx="42" cy="36" rx="3" ry="3" fill="#1a1a00"/><ellipse cx="58" cy="36" rx="3" ry="3" fill="#1a1a00"/><path d="M46 45 L50 48 L54 45" fill="#d08030"/><path d="M34 26 L38 14 L44 26Z" fill="#8b6a40"/><path d="M56 26 L62 14 L66 26Z" fill="#8b6a40"/></g> },
  { id: 'bear',    name: 'Bear',    category: 'animals', bg: '#5c3a1a',
    body: <g><ellipse cx="50" cy="52" rx="22" ry="18" fill="#8b5e3c"/><ellipse cx="50" cy="38" rx="18" ry="16" fill="#a07050"/><circle cx="36" cy="28" r="8" fill="#8b5e3c"/><circle cx="64" cy="28" r="8" fill="#8b5e3c"/><ellipse cx="44" cy="40" rx="4" ry="3" fill="#2d1a00"/><ellipse cx="56" cy="40" rx="4" ry="3" fill="#2d1a00"/><ellipse cx="50" cy="50" rx="10" ry="6" fill="#c09070"/><circle cx="50" cy="47" r="4" fill="#3a1a00"/><path d="M42 56 Q50 62 58 56" stroke="#805030" strokeWidth="2.5" fill="none"/></g> },
  { id: 'shark',   name: 'Shark',   category: 'animals', bg: '#1a3a5c',
    body: <g><ellipse cx="50" cy="52" rx="24" ry="18" fill="#5080a0"/><ellipse cx="50" cy="38" rx="18" ry="16" fill="#6090b0"/><path d="M50 18 L44 36 L56 36Z" fill="#5080a0"/><ellipse cx="43" cy="40" rx="4" ry="3" fill="#1a2a3a"/><ellipse cx="57" cy="40" rx="4" ry="3" fill="#1a2a3a"/><path d="M38 54 L50 60 L62 54 L56 50 L44 50Z" fill="#e8f0f8"/><ellipse cx="50" cy="48" rx="6" ry="4" fill="#e8f0f8"/></g> },
  { id: 'lion',    name: 'Lion',    category: 'animals', bg: '#7a5000',
    body: <g><circle cx="50" cy="42" r="26" fill="#e0a030" opacity="0.5"/><ellipse cx="50" cy="45" rx="18" ry="18" fill="#f0c060"/><ellipse cx="44" cy="44" rx="4" ry="3" fill="#3a2000"/><ellipse cx="56" cy="44" rx="4" ry="3" fill="#3a2000"/><ellipse cx="50" cy="53" rx="10" ry="6" fill="#f8d890"/><circle cx="50" cy="51" r="4" fill="#d08020"/><path d="M41 58 Q50 65 59 58" stroke="#b06010" strokeWidth="2.5" fill="none"/></g> },
  { id: 'eagle',   name: 'Eagle',   category: 'animals', bg: '#1a2a0a',
    body: <g><ellipse cx="50" cy="48" rx="20" ry="20" fill="#3a3a3a"/><ellipse cx="50" cy="36" rx="16" ry="16" fill="#f0f0f0"/><ellipse cx="44" cy="36" rx="5" ry="4" fill="#f0a000"/><ellipse cx="56" cy="36" rx="5" ry="4" fill="#f0a000"/><ellipse cx="44" cy="36" rx="3" ry="3" fill="#0a0a0a"/><ellipse cx="56" cy="36" rx="3" ry="3" fill="#0a0a0a"/><path d="M43 44 L50 48 L57 44" fill="#e0c000"/><path d="M26 38 L18 44 L30 46Z" fill="#3a3a3a"/><path d="M74 38 L82 44 L70 46Z" fill="#3a3a3a"/></g> },
  { id: 'cat',     name: 'Cat',     category: 'animals', bg: '#2a2a3a',
    body: <g><ellipse cx="50" cy="50" rx="19" ry="19" fill="#e8c090"/><ellipse cx="50" cy="38" rx="17" ry="16" fill="#f0c8a0"/><path d="M33 26 L30 12 L43 26Z" fill="#e8c090"/><path d="M67 26 L70 12 L57 26Z" fill="#e8c090"/><ellipse cx="43" cy="40" rx="5" ry="4" fill="#4a6a9a"/><ellipse cx="57" cy="40" rx="5" ry="4" fill="#4a6a9a"/><ellipse cx="43" cy="40" rx="2" ry="3" fill="#1a1a1a"/><ellipse cx="57" cy="40" rx="2" ry="3" fill="#1a1a1a"/><ellipse cx="50" cy="49" rx="7" ry="5" fill="#f8e0d0"/><circle cx="50" cy="47" r="3" fill="#f07080"/><path d="M30 46 L42 48 M70 46 L58 48" stroke="#c0a080" strokeWidth="1.5"/></g> },

  // ── Robots & Sci-Fi ───────────────────────────────────────────
  { id: 'bot',     name: 'Bot',     category: 'robots',  bg: '#0f4c81',
    body: <g><rect x="28" y="30" width="44" height="40" rx="8" fill="#2980b9"/><rect x="36" y="20" width="28" height="14" rx="4" fill="#1a6a9a"/><rect x="44" y="14" width="12" height="8" rx="2" fill="#2980b9"/><rect x="36" y="37" width="12" height="10" rx="3" fill="#85c1e9"/><rect x="52" y="37" width="12" height="10" rx="3" fill="#85c1e9"/><rect x="38" y="54" width="24" height="6" rx="3" fill="#1a6a9a"/><rect x="22" y="34" width="8" height="12" rx="4" fill="#2980b9"/><rect x="70" y="34" width="8" height="12" rx="4" fill="#2980b9"/></g> },
  { id: 'mech',    name: 'Mech',    category: 'robots',  bg: '#1a1a2e',
    body: <g><rect x="30" y="32" width="40" height="36" rx="4" fill="#4a4a6a"/><rect x="34" y="22" width="32" height="14" rx="3" fill="#3a3a5a"/><rect x="37" y="36" width="10" height="8" rx="2" fill="#00e5ff"/><rect x="53" y="36" width="10" height="8" rx="2" fill="#00e5ff"/><path d="M40 52 L44 58 L56 58 L60 52Z" fill="#3a3a5a"/><rect x="22" y="36" width="9" height="16" rx="2" fill="#4a4a6a"/><rect x="69" y="36" width="9" height="16" rx="2" fill="#4a4a6a"/><circle cx="50" cy="28" r="3" fill="#ff4444"/></g> },
  { id: 'alien',   name: 'Alien',   category: 'robots',  bg: '#003320',
    body: <g><ellipse cx="50" cy="45" rx="22" ry="28" fill="#40c060"/><ellipse cx="50" cy="35" rx="18" ry="20" fill="#50d070"/><ellipse cx="40" cy="34" rx="9" ry="7" fill="#001a0a"/><ellipse cx="60" cy="34" rx="9" ry="7" fill="#001a0a"/><ellipse cx="40" cy="34" rx="5" ry="4" fill="#00ff88"/><ellipse cx="60" cy="34" rx="5" ry="4" fill="#00ff88"/><path d="M43 54 Q50 60 57 54" stroke="#30a040" strokeWidth="2.5" fill="none"/><path d="M30 28 L24 22 M70 28 L76 22" stroke="#40c060" strokeWidth="3"/></g> },
  { id: 'cyborg',  name: 'Cyborg',  category: 'robots',  bg: '#1a0a2e',
    body: <g><ellipse cx="50" cy="48" rx="20" ry="22" fill="#c8a080"/><ellipse cx="44" cy="44" rx="6" ry="5" fill="#1a1a1a"/><ellipse cx="44" cy="44" rx="3" ry="3" fill="#ff4444"/><ellipse cx="56" cy="44" rx="5" ry="4" fill="#3a3a3a"/><ellipse cx="56" cy="44" rx="3" ry="3" fill="#4444ff"/><rect x="38" y="25" width="24" height="16" rx="3" fill="#888" opacity="0.4"/><path d="M64 30 L74 26 M64 40 L72 42" stroke="#aaa" strokeWidth="2"/><path d="M43 56 Q50 62 57 56" stroke="#b08060" strokeWidth="2.5" fill="none"/></g> },
  { id: 'android', name: 'Android', category: 'robots',  bg: '#00352e',
    body: <g><rect x="32" y="34" width="36" height="34" rx="6" fill="#00897b"/><ellipse cx="50" cy="26" rx="16" ry="14" fill="#00897b"/><rect x="36" y="40" width="10" height="8" rx="3" fill="#b2dfdb"/><rect x="54" y="40" width="10" height="8" rx="3" fill="#b2dfdb"/><rect x="40" y="56" width="20" height="5" rx="2" fill="#00695c"/><rect x="24" y="38" width="9" height="14" rx="4" fill="#00897b"/><rect x="67" y="38" width="9" height="14" rx="4" fill="#00897b"/><circle cx="38" cy="18" r="3" fill="#00897b"/><circle cx="62" cy="18" r="3" fill="#00897b"/><rect x="37" y="18" width="26" height="4" fill="#00897b"/></g> },
  { id: 'ufo',     name: 'UFO',     category: 'robots',  bg: '#050520',
    body: <g><ellipse cx="50" cy="55" rx="32" ry="10" fill="#6040c0"/><ellipse cx="50" cy="50" rx="22" ry="8" fill="#8060e0"/><ellipse cx="50" cy="38" rx="14" ry="16" fill="#9070f0"/><ellipse cx="50" cy="36" rx="9" ry="10" fill="#c0e0ff" opacity="0.5"/><circle cx="36" cy="57" r="3" fill="#ffff00" opacity="0.8"/><circle cx="50" cy="60" r="3" fill="#00ffff" opacity="0.8"/><circle cx="64" cy="57" r="3" fill="#ff8800" opacity="0.8"/></g> },
  { id: 'circuit', name: 'Circuit', category: 'robots',  bg: '#0a1a0a',
    body: <g><rect x="26" y="26" width="48" height="48" rx="6" fill="#1a3a1a"/><rect x="34" y="34" width="14" height="14" rx="2" fill="#00aa44"/><rect x="52" y="34" width="14" height="14" rx="2" fill="#00aa44"/><rect x="34" y="52" width="14" height="14" rx="2" fill="#00aa44"/><rect x="52" y="52" width="14" height="14" rx="2" fill="#00aa44"/><path d="M48 41 L48 34 M52 41 L52 34 M41 48 L34 48 M41 52 L34 52 M59 48 L66 48 M59 52 L66 52 M48 59 L48 66 M52 59 L52 66" stroke="#00ff44" strokeWidth="2"/><circle cx="50" cy="50" r="5" fill="#00ff44"/></g> },

  // ── Symbols & Abstract ────────────────────────────────────────
  { id: 'flame',   name: 'Flame',   category: 'symbols', bg: '#3a0a00',
    body: <g><path d="M50 80 C30 70 22 54 28 38 C32 26 40 22 40 22 C36 32 42 34 44 28 C46 22 50 16 50 16 C50 16 54 22 56 28 C58 34 64 32 60 22 C60 22 68 26 72 38 C78 54 70 70 50 80Z" fill="#ff6b00"/><path d="M50 72 C36 64 30 52 34 40 C36 33 40 30 40 30 C38 36 44 38 46 34 C48 30 50 24 50 24 C50 24 52 30 54 34 C56 38 62 36 60 30 C64 38 66 50 50 72Z" fill="#ffa500"/><path d="M50 62 C40 56 36 46 40 38 C43 35 46 36 50 32 C54 36 57 35 60 38 C64 46 60 56 50 62Z" fill="#ffdd00"/></g> },
  { id: 'galaxy',  name: 'Galaxy',  category: 'symbols', bg: '#040410',
    body: <g><ellipse cx="50" cy="50" rx="30" ry="10" fill="#7040c0" opacity="0.4" transform="rotate(-30 50 50)"/><ellipse cx="50" cy="50" rx="30" ry="10" fill="#4060ff" opacity="0.4" transform="rotate(30 50 50)"/><circle cx="50" cy="50" r="8" fill="#ffffff"/><circle cx="50" cy="50" r="4" fill="#ffffc0"/><circle cx="30" cy="40" r="2" fill="#fff" opacity="0.7"/><circle cx="70" cy="60" r="2" fill="#fff" opacity="0.7"/><circle cx="38" cy="65" r="1.5" fill="#aaf" opacity="0.8"/><circle cx="65" cy="38" r="1.5" fill="#faa" opacity="0.8"/></g> },
  { id: 'crystal', name: 'Crystal', category: 'symbols', bg: '#0a1a3a',
    body: <g><polygon points="50,12 68,30 62,70 38,70 32,30" fill="#60a0e0" opacity="0.6"/><polygon points="50,12 68,30 62,70 38,70 32,30" fill="none" stroke="#a0d0ff" strokeWidth="2"/><polygon points="50,22 62,34 58,60 42,60 38,34" fill="#90c8f8" opacity="0.5"/><line x1="50" y1="12" x2="50" y2="70" stroke="#c0e0ff" strokeWidth="1"/><line x1="32" y1="30" x2="68" y2="30" stroke="#c0e0ff" strokeWidth="1"/></g> },
  { id: 'bolt',    name: 'Bolt',    category: 'symbols', bg: '#3a2a00',
    body: <g><polygon points="58,12 30,52 50,52 42,88 72,44 50,44" fill="#ffd700"/><polygon points="58,12 30,52 50,52 42,88 72,44 50,44" fill="none" stroke="#ffec80" strokeWidth="1.5"/></g> },
  { id: 'vortex',  name: 'Vortex',  category: 'symbols', bg: '#0a0a2a',
    body: <g><path d="M50 50 m-28 0 a28 28 0 1 1 56 0" stroke="#6060ff" strokeWidth="6" fill="none"/><path d="M50 50 m-20 0 a20 20 0 1 1 40 0" stroke="#8080ff" strokeWidth="5" fill="none"/><path d="M50 50 m-12 0 a12 12 0 1 1 24 0" stroke="#a0a0ff" strokeWidth="4" fill="none"/><circle cx="50" cy="50" r="5" fill="#c0c0ff"/></g> },
  { id: 'skull',   name: 'Skull',   category: 'symbols', bg: '#1a1a1a',
    body: <g><ellipse cx="50" cy="40" rx="22" ry="24" fill="#e8e8e8"/><rect x="30" y="56" width="40" height="14" rx="3" fill="#e8e8e8"/><ellipse cx="41" cy="40" rx="8" ry="8" fill="#1a1a1a"/><ellipse cx="59" cy="40" rx="8" ry="8" fill="#1a1a1a"/><ellipse cx="41" cy="40" rx="5" ry="5" fill="#2a2a2a"/><ellipse cx="59" cy="40" rx="5" ry="5" fill="#2a2a2a"/><rect x="36" y="56" width="6" height="10" rx="1" fill="#1a1a1a"/><rect x="47" y="56" width="6" height="10" rx="1" fill="#1a1a1a"/><rect x="58" y="56" width="6" height="10" rx="1" fill="#1a1a1a"/><path d="M38 52 L50 54 L62 52" stroke="#c8c8c8" strokeWidth="2" fill="none"/></g> },
  { id: 'crown',   name: 'Crown',   category: 'symbols', bg: '#3a2a00',
    body: <g><path d="M18 70 L18 42 L32 58 L50 30 L68 58 L82 42 L82 70Z" fill="#ffd700"/><path d="M18 70 L82 70 L78 78 L22 78Z" fill="#e0b800"/><circle cx="50" cy="30" r="6" fill="#ff4444"/><circle cx="18" cy="42" r="5" fill="#4444ff"/><circle cx="82" cy="42" r="5" fill="#44ff44"/></g> },
  { id: 'shield',  name: 'Shield',  category: 'symbols', bg: '#0a1a3a',
    body: <g><path d="M50 15 L78 26 L78 50 Q78 68 50 82 Q22 68 22 50 L22 26Z" fill="#2a5aa0"/><path d="M50 22 L72 31 L72 50 Q72 64 50 76 Q28 64 28 50 L28 31Z" fill="#3a6ab0"/><path d="M50 35 L58 50 L50 65 L42 50Z" fill="#ffd700"/><circle cx="50" cy="50" r="6" fill="#ffd700"/></g> },
  { id: 'target',  name: 'Target',  category: 'symbols', bg: '#2a0a0a',
    body: <g><circle cx="50" cy="50" r="32" fill="#cc0000"/><circle cx="50" cy="50" r="24" fill="#ffffff"/><circle cx="50" cy="50" r="16" fill="#cc0000"/><circle cx="50" cy="50" r="8"  fill="#ffffff"/><circle cx="50" cy="50" r="3"  fill="#cc0000"/></g> },
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
