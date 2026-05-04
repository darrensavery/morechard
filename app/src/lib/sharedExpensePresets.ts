// app/src/lib/sharedExpensePresets.ts

export type ExpenseCategory =
  | 'education' | 'health' | 'clothing' | 'travel' | 'activities'
  | 'childcare' | 'food'   | 'tech'     | 'gifts'  | 'other';

export type ExpenseRegion = 'UK' | 'US' | 'PL';
export type ExpenseLocale = 'en' | 'en-US' | 'pl';

export interface ExpensePreset {
  id: string;
  name: string;
  category: ExpenseCategory;
  is_top_8: boolean;
  regions?: ExpenseRegion[];
  locale_overrides?: Partial<Record<ExpenseLocale, string>>;
  search_aliases?: string[];
  legally_distinguishable?: boolean;
}

export const PRESETS: ExpensePreset[] = [
  // --- Education (8) ---
  {
    id: 'school-trip',
    name: 'School trip / field trip',
    category: 'education',
    is_top_8: true,
    search_aliases: ['school trip', 'field trip', 'residential', 'day trip', 'excursion', 'PGL'],
  },
  {
    id: 'school-supplies',
    name: 'School supplies & stationery',
    category: 'education',
    is_top_8: false,
    search_aliases: ['stationery', 'pens', 'pencils', 'notebooks', 'folders', 'art supplies'],
  },
  {
    id: 'textbooks',
    name: 'Textbooks',
    category: 'education',
    is_top_8: false,
    search_aliases: ['books', 'revision guides', 'CGP', 'workbooks', 'course books'],
  },
  {
    id: 'tutoring',
    name: 'Tutoring / extra lessons',
    category: 'education',
    is_top_8: false,
    search_aliases: ['tutor', 'private lessons', 'extra tuition', 'coaching', 'academic support'],
    legally_distinguishable: true,
  },
  {
    id: 'exam-fees',
    name: 'Exam fees',
    category: 'education',
    is_top_8: false,
    search_aliases: ['GCSE', 'A-Level', 'SAT', 'ACT', 'AP exam', 'matura', 'resit', 'examination'],
    legally_distinguishable: true,
  },
  {
    id: 'music-lessons',
    name: 'Music lessons',
    category: 'education',
    is_top_8: false,
    search_aliases: ['piano lessons', 'guitar lessons', 'violin', 'instrument lessons', 'singing lessons'],
  },
  {
    id: 'yearbook',
    name: 'Yearbook',
    category: 'education',
    is_top_8: false,
    regions: ['US'],
    search_aliases: ['annual', 'school book', 'graduating yearbook'],
  },
  {
    id: 'school-photos',
    name: 'School photos',
    category: 'education',
    is_top_8: false,
    search_aliases: ['school picture', 'class photo', 'portrait', 'photographs'],
  },

  // --- Health (8) ---
  {
    id: 'doctor-dentist-visit',
    name: 'Doctor / dentist visit',
    category: 'health',
    is_top_8: true,
    search_aliases: ['medical', 'GP', 'doctor', 'dentist', 'check-up', 'appointment', 'NHS'],
  },
  {
    id: 'orthodontist-braces',
    name: 'Orthodontist / braces',
    category: 'health',
    is_top_8: false,
    search_aliases: ['braces', 'orthodontic', 'retainer', 'Invisalign', 'teeth straightening'],
    legally_distinguishable: true,
  },
  {
    id: 'optician-glasses',
    name: 'Optician / glasses / contact lenses',
    category: 'health',
    is_top_8: false,
    search_aliases: ['optician', 'glasses', 'spectacles', 'contact lenses', 'eye test', 'vision'],
  },
  {
    id: 'prescription-medicine',
    name: 'Prescription medicine',
    category: 'health',
    is_top_8: false,
    search_aliases: ['medication', 'pharmacy', 'prescription', 'medicine', 'tablets'],
    legally_distinguishable: true,
  },
  {
    id: 'therapy-counselling',
    name: 'Therapy / counselling',
    category: 'health',
    is_top_8: false,
    search_aliases: ['mental health', 'counselling', 'CBT', 'therapy', 'psychologist', 'CAMHS'],
  },
  {
    id: 'vaccinations',
    name: 'Vaccinations',
    category: 'health',
    is_top_8: false,
    search_aliases: ['vaccine', 'immunisation', 'flu jab', 'travel jabs', 'booster'],
  },
  {
    id: 'medical-equipment',
    name: 'Medical equipment / orthotics',
    category: 'health',
    is_top_8: false,
    search_aliases: ['orthotics', 'splint', 'crutches', 'hearing aid', 'medical device'],
    legally_distinguishable: true,
  },
  {
    id: 'sports-injury',
    name: 'Sports injury treatment',
    category: 'health',
    is_top_8: false,
    search_aliases: ['physio', 'physiotherapy', 'sports injury', 'osteopath', 'massage therapy'],
  },

  // --- Clothing (6) ---
  {
    id: 'school-uniform',
    name: 'School uniform',
    category: 'clothing',
    is_top_8: true,
    search_aliases: ['uniform', 'shirt', 'trousers', 'skirt', 'tie', 'blazer', 'PE kit', 'polo shirt'],
  },
  {
    id: 'shoes',
    name: 'Shoes',
    category: 'clothing',
    is_top_8: true,
    search_aliases: ['uniform', 'trainers', 'school shoes', 'football boots', 'pumps', 'wellies', 'sneakers'],
  },
  {
    id: 'coat-outerwear',
    name: 'Coat / outerwear',
    category: 'clothing',
    is_top_8: false,
    search_aliases: ['coat', 'jacket', 'parka', 'raincoat', 'winter jacket', 'anorak'],
  },
  {
    id: 'sportswear-kit',
    name: 'Sportswear / kit',
    category: 'clothing',
    is_top_8: false,
    search_aliases: ['kit', 'football kit', 'rugby kit', 'PE', 'tracksuit', 'sports kit'],
  },
  {
    id: 'everyday-clothes',
    name: 'Everyday clothes',
    category: 'clothing',
    is_top_8: false,
    search_aliases: ['clothes', 'clothing', 'jeans', 'tops', 'outfits', 'wardrobe'],
  },
  {
    id: 'special-occasion-outfit',
    name: 'Special-occasion outfit',
    category: 'clothing',
    is_top_8: false,
    search_aliases: ['prom dress', 'suit', 'formal wear', 'party outfit', 'smart clothes'],
  },

  // --- Travel (6) ---
  {
    id: 'family-holiday-share',
    name: 'Family holiday share',
    category: 'travel',
    is_top_8: false,
    search_aliases: ['holiday', 'vacation', 'flights', 'hotel', 'travel costs', 'abroad'],
    legally_distinguishable: true,
  },
  {
    id: 'visiting-other-parent-transport',
    name: 'Visiting other parent (transport)',
    category: 'travel',
    is_top_8: false,
    search_aliases: ['transport', 'train', 'bus', 'taxi', 'travel', 'contact visit'],
    legally_distinguishable: true,
  },
  {
    id: 'school-residential-trip',
    name: 'School residential / overnight trip',
    category: 'travel',
    is_top_8: false,
    search_aliases: ['overnight trip', 'residential', 'camping trip', 'outward bound', 'PGL', 'school tour'],
  },
  {
    id: 'transport-pass',
    name: 'Public transport pass',
    category: 'travel',
    is_top_8: false,
    search_aliases: ['bus pass', 'train pass', 'travel card', 'Oyster card', 'Metro card', 'season ticket'],
  },
  {
    id: 'passport-visa-fees',
    name: 'Passport / visa fees',
    category: 'travel',
    is_top_8: false,
    search_aliases: ['passport', 'visa', 'travel document', 'ID card', 'ESTA'],
    legally_distinguishable: true,
  },
  {
    id: 'school-transport',
    name: 'School transport (bus / taxi)',
    category: 'travel',
    is_top_8: false,
    search_aliases: ['school bus', 'school taxi', 'minibus', 'transport to school', 'school run'],
  },

  // --- Activities (10) ---
  {
    id: 'sports-club-fees',
    name: 'Sports club / team fees',
    category: 'activities',
    is_top_8: true,
    search_aliases: ['football', 'rugby', 'swimming', 'cricket', 'netball', 'athletics', 'club fees', 'team fees'],
  },
  {
    id: 'school-clubs-extra-curricular',
    name: 'School clubs / extra-curricular',
    category: 'activities',
    is_top_8: false,
    search_aliases: ['chess club', 'drama society', 'coding club', 'choir', 'debate', 'art club', 'science club'],
  },
  {
    id: 'sports-equipment-kit',
    name: 'Sports equipment & kit',
    category: 'activities',
    is_top_8: false,
    search_aliases: ['football boots', 'shin pads', 'gum shield', 'sports bag', 'cricket bat', 'tennis racket'],
  },
  {
    id: 'music-instrument-lessons',
    name: 'Music / instrument lessons',
    category: 'activities',
    is_top_8: false,
    search_aliases: ['music lessons', 'piano', 'guitar', 'violin', 'drums', 'singing', 'instrument'],
  },
  {
    id: 'drama-dance-classes',
    name: 'Drama / dance classes',
    category: 'activities',
    is_top_8: false,
    search_aliases: ['ballet', 'tap', 'contemporary dance', 'acting classes', 'stage school', 'performing arts'],
  },
  {
    id: 'scouts-guides-cadets',
    name: 'Scouts / Guides / cadets',
    category: 'activities',
    is_top_8: false,
    search_aliases: ['scouting', 'scouts', 'girl guides', 'brownies', 'air cadets', 'sea cadets', 'harcerze'],
  },
  {
    id: 'summer-camp-holiday-club',
    name: 'Summer camp / holiday club',
    category: 'activities',
    is_top_8: false,
    search_aliases: ['summer camp', 'holiday club', 'kids club', 'activity camp', 'sports camp', 'art camp'],
  },
  {
    id: 'swimming-lessons',
    name: 'Swimming lessons',
    category: 'activities',
    is_top_8: false,
    search_aliases: ['swimming', 'swim school', 'lessons', 'pool', 'aquatics'],
  },
  {
    id: 'martial-arts',
    name: 'Martial arts',
    category: 'activities',
    is_top_8: false,
    search_aliases: ['karate', 'judo', 'taekwondo', 'kickboxing', 'BJJ', 'self-defence'],
  },
  {
    id: 'art-craft-classes',
    name: 'Art / craft classes',
    category: 'activities',
    is_top_8: false,
    search_aliases: ['art class', 'craft class', 'pottery', 'ceramics', 'painting', 'drawing class'],
  },

  // --- Childcare (5) ---
  {
    id: 'childcare-wraparound',
    name: 'Childcare / wraparound',
    category: 'childcare',
    is_top_8: true,
    search_aliases: ['childminder', 'nursery', 'after-school club', 'breakfast club', 'wraparound care', 'childcare'],
  },
  {
    id: 'childminder-nursery',
    name: 'Childminder / nursery',
    category: 'childcare',
    is_top_8: false,
    search_aliases: ['childminder', 'nursery', 'daycare', 'day nursery', 'creche'],
  },
  {
    id: 'babysitter',
    name: 'Babysitter',
    category: 'childcare',
    is_top_8: false,
    search_aliases: ['babysitter', 'sitter', 'au pair', 'nanny', 'childcare'],
    legally_distinguishable: true,
  },
  {
    id: 'nanny-share',
    name: 'Nanny share',
    category: 'childcare',
    is_top_8: false,
    search_aliases: ['nanny', 'nanny share', 'au pair', 'full-time childcare'],
    legally_distinguishable: true,
  },
  {
    id: 'holiday-childcare',
    name: 'Holiday childcare',
    category: 'childcare',
    is_top_8: false,
    search_aliases: ['holiday care', 'childcare cover', 'school holiday club', 'inset day cover'],
  },

  // --- Food (3) ---
  {
    id: 'lunch-money',
    name: 'Lunch money / lunch account',
    category: 'food',
    is_top_8: true,
    search_aliases: ['dinner money', 'lunch', 'ParentPay', 'school meals', 'canteen', 'lunch account'],
  },
  {
    id: 'special-diet-groceries',
    name: 'Special diet groceries',
    category: 'food',
    is_top_8: false,
    search_aliases: ['gluten-free', 'dairy-free', 'kosher', 'halal', 'allergy food', 'diet food'],
    legally_distinguishable: true,
  },
  {
    id: 'birthday-event-catering',
    name: 'Birthday / event catering',
    category: 'food',
    is_top_8: false,
    search_aliases: ['birthday food', 'party catering', 'event food', 'cake', 'buffet'],
  },
  {
    id: 'packed-lunch-supplies',
    name: 'Packed lunch supplies',
    category: 'food',
    is_top_8: false,
    search_aliases: ['packed lunch', 'lunchbox', 'sandwich', 'snacks', 'lunchbox supplies'],
  },

  // --- Tech & Devices (5) ---
  {
    id: 'school-laptop-tablet',
    name: 'School laptop / tablet',
    category: 'tech',
    is_top_8: false,
    search_aliases: ['laptop', 'tablet', 'iPad', 'Chromebook', 'computer', 'device'],
  },
  {
    id: 'phone-device',
    name: 'Phone (device)',
    category: 'tech',
    is_top_8: false,
    search_aliases: ['mobile', 'smartphone', 'iPhone', 'Android', 'handset'],
    legally_distinguishable: true,
  },
  {
    id: 'phone-bill-data-plan',
    name: 'Phone bill / data plan',
    category: 'tech',
    is_top_8: false,
    search_aliases: ['phone bill', 'SIM', 'data plan', 'mobile contract', 'top-up'],
    legally_distinguishable: true,
  },
  {
    id: 'headphones-accessories',
    name: 'Headphones / accessories',
    category: 'tech',
    is_top_8: false,
    search_aliases: ['headphones', 'earphones', 'AirPods', 'earbuds', 'case', 'charger', 'accessories'],
  },
  {
    id: 'software-subscriptions',
    name: 'Software / app subscriptions (educational)',
    category: 'tech',
    is_top_8: false,
    search_aliases: ['software', 'app', 'subscription', 'Microsoft 365', 'Adobe', 'Duolingo', 'educational app'],
  },

  // --- Gifts & Celebrations (6) ---
  {
    id: 'birthday-gift',
    name: 'Birthday gift (for child)',
    category: 'gifts',
    is_top_8: true,
    search_aliases: ['gift', 'present', 'birthday present', 'toy', 'game', 'console'],
  },
  {
    id: 'christmas-holiday-gift',
    name: 'Christmas / holiday gift',
    category: 'gifts',
    is_top_8: false,
    search_aliases: ['Christmas present', 'Hanukkah gift', 'holiday present', 'Eid gift', 'Diwali gift'],
  },
  {
    id: 'birthday-party-costs',
    name: 'Birthday party costs',
    category: 'gifts',
    is_top_8: false,
    search_aliases: ['party venue', 'entertainer', 'party food', 'party supplies', 'invitations'],
  },
  {
    id: 'other-family-gift',
    name: 'Other family gift (from child)',
    category: 'gifts',
    is_top_8: false,
    search_aliases: ['gift from child', 'present for relative', "Mother's Day", "Father's Day"],
  },
  {
    id: 'religious-milestone',
    name: 'Religious milestone gift / ceremony',
    category: 'gifts',
    is_top_8: false,
    search_aliases: ['communion', 'confirmation', 'bar mitzvah', 'bat mitzvah', 'christening', 'baptism'],
    legally_distinguishable: true,
  },
  {
    id: 'prom-graduation',
    name: 'School prom / graduation',
    category: 'gifts',
    is_top_8: false,
    search_aliases: ['prom', 'graduation', "leaver's ball", 'school ball', 'leavers', 'school dance'],
  },

  // --- Other (6) ---
  {
    id: 'pocket-money-top-up',
    name: 'Pocket money top-up',
    category: 'other',
    is_top_8: false,
    search_aliases: ['pocket money', 'allowance', 'top-up', 'spending money'],
  },
  {
    id: 'pet-costs',
    name: "Pet costs (child's pet)",
    category: 'other',
    is_top_8: false,
    search_aliases: ['pet', 'vet', 'pet food', 'animal', 'dog', 'cat', 'hamster'],
    legally_distinguishable: true,
  },
  {
    id: 'hobby-supplies',
    name: 'Hobby supplies',
    category: 'other',
    is_top_8: false,
    search_aliases: ['craft', 'art supplies', 'Lego', 'model kit', 'hobby materials', 'collectibles'],
  },
  {
    id: 'hairdresser-barber',
    name: 'Hairdresser / barber',
    category: 'other',
    is_top_8: false,
    search_aliases: ['haircut', 'hairdresser', 'barber', 'hair', 'trim'],
  },
  {
    id: 'subscription-membership',
    name: 'Subscription / membership',
    category: 'other',
    is_top_8: false,
    search_aliases: ['subscription', 'streaming', 'Netflix', 'Disney+', 'membership', 'annual pass'],
  },
  {
    id: 'bedding-toiletries',
    name: 'Bedding / toiletries',
    category: 'other',
    is_top_8: false,
    search_aliases: ['bedding', 'toiletries', 'towels', 'shampoo', 'toothbrush', 'personal care'],
  },
  {
    id: 'custom-expense',
    name: 'Custom expense',
    category: 'other',
    is_top_8: false,
    search_aliases: ['other', 'custom', 'miscellaneous', 'misc', 'bespoke'],
  },
];

export function getPresetsForRegion(region: ExpenseRegion): ExpensePreset[] {
  return PRESETS.filter(p => !p.regions || p.regions.includes(region));
}

export function localiseName(preset: ExpensePreset, locale: ExpenseLocale): string {
  return preset.locale_overrides?.[locale] ?? preset.name;
}

export function findPreset(id: string): ExpensePreset | undefined {
  return PRESETS.find(p => p.id === id);
}

export function fuzzyMatchPreset(preset: ExpensePreset, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (preset.name.toLowerCase().includes(q)) return true;
  if (preset.search_aliases?.some(a => a.toLowerCase().includes(q))) return true;
  return false;
}
