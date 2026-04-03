/**
 * Avatar library — 32 SVG avatars across 4 categories.
 * Each renders as a circle with a coloured background.
 */

export interface AvatarDef {
  id: string
  name: string
  category: 'people' | 'animals' | 'robots' | 'symbols'
  bg: string
  body: React.ReactNode
}

export const AVATARS: AvatarDef[] = [
  // ── People & Characters ───────────────────────────────────────
  { id: 'ninja',   name: 'Ninja',   category: 'people',  bg: '#1a1a2e',
    body: <g><ellipse cx="50" cy="42" rx="18" ry="20" fill="#2d2d44"/><rect x="32" y="36" width="36" height="8" rx="4" fill="#1a1a2e"/><ellipse cx="43" cy="40" rx="4" ry="3" fill="#fff"/><ellipse cx="57" cy="40" rx="4" ry="3" fill="#fff"/><ellipse cx="43" cy="40" rx="2" ry="2" fill="#1a1a2e"/><ellipse cx="57" cy="40" rx="2" ry="2" fill="#1a1a2e"/></g> },
  { id: 'astro',   name: 'Astro',   category: 'people',  bg: '#1e3a5f',
    body: <g><ellipse cx="50" cy="45" rx="22" ry="24" fill="#c8d8e8"/><ellipse cx="50" cy="42" rx="14" ry="15" fill="#3a6ea8"/><ellipse cx="50" cy="42" rx="10" ry="11" fill="#e8f4ff" opacity="0.7"/><circle cx="44" cy="40" r="3" fill="#1e3a5f"/><circle cx="56" cy="40" r="3" fill="#1e3a5f"/><path d="M44 47 Q50 52 56 47" stroke="#1e3a5f" strokeWidth="2" fill="none"/></g> },
  { id: 'samurai', name: 'Samurai', category: 'people',  bg: '#8b0000',
    body: <g><ellipse cx="50" cy="48" rx="20" ry="22" fill="#f4c5a0"/><path d="M30 30 Q50 20 70 30 L68 42 Q50 38 32 42Z" fill="#8b0000"/><path d="M32 30 L30 22 M68 30 L70 22" stroke="#8b0000" strokeWidth="3"/><ellipse cx="43" cy="48" rx="4" ry="3" fill="#5a3a1a"/><ellipse cx="57" cy="48" rx="4" ry="3" fill="#5a3a1a"/><path d="M43 56 Q50 61 57 56" stroke="#c0706a" strokeWidth="2.5" fill="none"/></g> },
  { id: 'punk',    name: 'Punk',    category: 'people',  bg: '#2d1b4e',
    body: <g><ellipse cx="50" cy="50" rx="19" ry="21" fill="#ffd0a0"/><path d="M31 32 Q50 15 69 32 L66 36 Q50 24 34 36Z" fill="#e040fb"/><path d="M40 20 L40 30 M50 16 L50 27 M60 20 L60 30" stroke="#e040fb" strokeWidth="4" strokeLinecap="round"/><ellipse cx="43" cy="50" rx="4" ry="3" fill="#5a3a1a"/><ellipse cx="57" cy="50" rx="4" ry="3" fill="#5a3a1a"/><path d="M43 58 Q50 63 57 58" stroke="#d0706a" strokeWidth="2.5" fill="none"/></g> },
  { id: 'knight',  name: 'Knight',  category: 'people',  bg: '#3d4a5c',
    body: <g><ellipse cx="50" cy="45" rx="22" ry="24" fill="#9aa8b8"/><rect x="30" y="28" width="40" height="30" rx="5" fill="#7a8898"/><ellipse cx="50" cy="40" rx="12" ry="14" fill="#c8d0d8"/><ellipse cx="43" cy="40" rx="4" ry="3" fill="#2a3340"/><ellipse cx="57" cy="40" rx="4" ry="3" fill="#2a3340"/><rect x="35" y="54" width="30" height="6" rx="2" fill="#7a8898"/></g> },
  { id: 'witch',   name: 'Witch',   category: 'people',  bg: '#1a0533',
    body: <g><ellipse cx="50" cy="50" rx="18" ry="20" fill="#c8a0d0"/><path d="M30 38 L50 10 L70 38Z" fill="#1a0533"/><rect x="26" y="36" width="48" height="5" rx="2" fill="#1a0533"/><ellipse cx="43" cy="50" rx="4" ry="3" fill="#5a3070"/><ellipse cx="57" cy="50" rx="4" ry="3" fill="#5a3070"/><path d="M43 58 Q50 64 57 58" stroke="#9a6080" strokeWidth="2.5" fill="none"/></g> },
  { id: 'pirate',  name: 'Pirate',  category: 'people',  bg: '#3b2107',
    body: <g><ellipse cx="50" cy="50" rx="19" ry="21" fill="#f0c888"/><rect x="31" y="22" width="38" height="20" rx="3" fill="#1a1a1a"/><rect x="29" y="39" width="42" height="4" rx="2" fill="#1a1a1a"/><ellipse cx="43" cy="49" rx="4" ry="3" fill="#3b2107"/><rect x="39" y="46" width="8" height="6" rx="1" fill="#c0a000"/><ellipse cx="57" cy="49" rx="4" ry="3" fill="#3b2107"/><path d="M43 58 Q50 63 57 58" stroke="#c07050" strokeWidth="2.5" fill="none"/><circle cx="38" cy="30" r="5" fill="#3b2107"/></g> },
  { id: 'reaper',  name: 'Reaper',  category: 'people',  bg: '#0d0d0d',
    body: <g><ellipse cx="50" cy="50" rx="20" ry="22" fill="#1a1a1a"/><path d="M26 30 Q50 8 74 30 L70 40 Q50 30 30 40Z" fill="#0d0d0d"/><ellipse cx="50" cy="45" rx="12" ry="14" fill="#101010"/><ellipse cx="43" cy="44" rx="5" ry="4" fill="#7700cc" opacity="0.8"/><ellipse cx="57" cy="44" rx="5" ry="4" fill="#7700cc" opacity="0.8"/><path d="M43 56 Q50 60 57 56" stroke="#550099" strokeWidth="2" fill="none"/></g> },

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
  { id: 'people',  label: 'Characters' },
  { id: 'animals', label: 'Animals' },
  { id: 'robots',  label: 'Robots' },
  { id: 'symbols', label: 'Symbols' },
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
