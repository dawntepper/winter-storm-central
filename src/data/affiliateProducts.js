/**
 * Affiliate Products Catalog
 *
 * Single source of truth for every Amazon Associates product surfaced on the
 * site (full /prep grid and the smaller EssentialsCard embeds).
 *
 * Updating Amazon URLs
 * --------------------
 * The `amazonUrl` field below uses placeholder URLs until Dawn fills in the
 * real Amazon Associates tagged URLs from her dashboard. The placeholder
 * format follows: https://www.amazon.com/dp/PLACEHOLDER-<sku>?tag=stormtrackingio-20
 * Replace `PLACEHOLDER-<sku>` with the actual ASIN. Keep `tag=stormtrackingio-20`.
 *
 * Adding a new product
 * --------------------
 * 1. Add an entry to AFFILIATE_PRODUCTS with a unique productId (kebab-case).
 * 2. Reference the product in AFFILIATE_CATEGORIES (it'll auto-render on /prep).
 * 3. Optionally surface it in an ESSENTIALS_CARD_VARIANTS list to embed
 *    it on homepage / state / storm pages.
 *
 * Tier guidance (for analytics — not rendered in UI):
 *   S = household-essential, multi-day investment (generators, large power stations)
 *   A = first-buy starter kit (radios, basic power banks, water filtration)
 *   B = specialty / secondary tier (pet prep, single-room AC, tarps)
 *   C = nice-to-have / accessory (headlamps, satellite communicators)
 */

const PLACEHOLDER_TAG = 'stormtrackingio-20';
//const ph = (sku) => `https://www.amazon.com/dp/PLACEHOLDER-${sku}?tag=${PLACEHOLDER_TAG}`;

/**
 * @typedef {Object} AffiliateProduct
 * @property {string} productId       Unique kebab-case slug used in analytics + EssentialsCard refs
 * @property {string} productName     Display name
 * @property {string} category        Matches an id in AFFILIATE_CATEGORIES
 * @property {'S'|'A'|'B'|'C'} tier   Recommendation tier (analytics only)
 * @property {string} price           Display price, e.g. "$30" or "$60-150"
 * @property {string} priceDescriptor Small caps label above price, e.g. "BASIC PICK"
 * @property {string} description     1-2 sentence honest take (StormTracking voice)
 * @property {string} amazonUrl       Tagged Amazon URL (placeholder until Dawn fills it in)
 * @property {boolean} [isFeatured]   Show "Our pick" badge + accent border
 */

/** @type {AffiliateProduct[]} */
export const AFFILIATE_PRODUCTS = [
  // --- Stay informed ---
  {
    productId: 'midland-wr120b',
    productName: 'Midland WR120B',
    category: 'stay-informed',
    tier: 'A',
    price: 'Around $48',
    priceDescriptor: 'BASIC PICK',
    description: 'Plug-in NOAA radio. Wakes you up when severe weather hits your county. Just works.',
    amazonUrl: 'https://amzn.to/4wQ2XGS',
  },
  {
    productId: 'midland-er310',
    productName: 'Midland ER310',
    category: 'stay-informed',
    tier: 'A',
    price: 'Around $79.99+',
    priceDescriptor: 'BEST OVERALL',
    description: 'Hand-crank + solar + battery. 26 minutes runtime per minute of cranking. Built for actual emergencies.',
    amazonUrl: 'https://amzn.to/4fGESMF',
    isFeatured: true,
  },
  {
    productId: 'fospower-a1',
    productName: 'FosPower A1',
    category: 'stay-informed',
    tier: 'A',
    price: 'Between $26 - $39.99+',
    priceDescriptor: 'PORTABLE',
    description: "Amazon's most-reviewed emergency radio. Budget option for go-bags or backup.",
    amazonUrl: 'https://amzn.to/4wOVd88',
  },

  // --- Backup power ---
  {
    productId: 'anker-powercore',
    productName: 'Anker Powerbank',
    category: 'backup-power',
    tier: 'A',
    price: 'Between $59.99 - $69.99+',
    priceDescriptor: 'PHONE BACKUP',
    description: 'Charges most phones 5-7 times. Quickly charge a 14" MacBook Pro to 50% in under 40 minutes',
    amazonUrl: 'https://amzn.to/3RHkxgg',
  },
  {
    productId: 'ecoflow-delta-3-plus',
    productName: 'EcoFlow Delta 3 Plus',
    category: 'backup-power',
    tier: 'S',
    price: 'Between $599 - $899+',
    priceDescriptor: 'FRIDGE BACKUP',
    description: 'Keeps your fridge running 12+ hours. UPS-grade switchover. Expandable when you need more.',
    amazonUrl: 'https://amzn.to/4nW7dAU',
    isFeatured: true,
  },
  {
    productId: 'jackery-explorer-2000-pro',
    productName: 'Jackery Explorer 2000 Pro',
    category: 'backup-power',
    tier: 'S',
    price: 'Between $1,298 - $1,599+',
    priceDescriptor: 'MULTI-DAY',
    description: 'For hurricane-zone households. Fridge + essentials for 2-3 days. Add solar for indefinite runtime.',
    amazonUrl: 'https://amzn.to/4wPhByi',
  },

  // --- Food & water ---
  {
    productId: 'lifestraw',
    productName: 'LifeStraw Personal',
    category: 'food-water',
    tier: 'A',
    price: '$15 - $19.99+',
    priceDescriptor: 'WATER',
    description: 'Filters 99.999% of bacteria. One per family member. Belongs in every go-bag.',
    amazonUrl: 'https://amzn.to/4uvuLyO',
  },
  {
    productId: 'mainstay-water-pouches',
    productName: 'Mayday Pouch Water,',
    category: 'food-water',
    tier: 'A',
    price: 'Around $28',
    priceDescriptor: 'WATER RATIONS',
    description: '5-year shelf life. Coast Guard approved. Set it, forget it, rotate every 5 years.',
    amazonUrl: 'https://amzn.to/4dIn29k',
  },
  {
    productId: 'mountain-house',
    productName: 'Mountain House Bucket',
    category: 'food-water',
    tier: 'A',
    price: 'Around $134+',
    priceDescriptor: 'FOOD',
    description: '30-day food supply. Just add water. Tastes good, lasts 30 years.',
    amazonUrl: 'https://amzn.to/49ktr9F',
  },

  // --- Pet prep ---
  {
    productId: 'pet-carrier',
    productName: 'Pet Carrier (TSA-approved)',
    category: 'pet-prep',
    tier: 'B',
    price: 'Around $49.99+',
    priceDescriptor: 'EVACUATION',
    description: "Even if you don't fly. Shelters that accept pets often require carriers.",
    amazonUrl: 'Pet Carrier (TSA-approved)',
  },
  {
    productId: 'pet-first-aid-kit',
    productName: 'Pet First Aid Kit',
    category: 'pet-prep',
    tier: 'B',
    price: 'Around $34.95+',
    priceDescriptor: 'FIRST AID',
    description: 'Pet-specific supplies vets recommend. Different from human kits in important ways.',
    amazonUrl: 'https://amzn.to/4e4B3Q4',
  },
  {
    productId: 'pet-food-container',
    productName: 'Waterproof Pet Food Container',
    category: 'pet-prep',
    tier: 'B',
    price: 'Around $29.99+',
    priceDescriptor: 'FOOD STORAGE',
    description: '7-day supply container, airtight, easy to grab when evacuating.',
    amazonUrl: 'https://amzn.to/3PAO6j5',
  },

  // --- Florida & coastal ---
  {
    productId: 'generac-3500w',
    productName: 'Generac 3300W Portable',
    category: 'florida-coastal',
    tier: 'S',
    price: 'Between $699 - $849+',
    priceDescriptor: 'GENERATOR',
    description: 'Whole-essential coverage. Tax-free in FL year-round (up to 10kW).',
    amazonUrl: 'https://amzn.to/4uqM7wM',
  },
  {
    productId: 'heavy-duty-tarp',
    productName: 'Heavy-Duty Tarp 20x30',
    category: 'florida-coastal',
    tier: 'B',
    price: 'Between $68 - $72+',
    priceDescriptor: 'ROOF PROTECTION',
    description: "Roof emergency cover. Tax-free in FL. Keep one in the garage; you'll be glad.",
    amazonUrl: 'https://amzn.to/4wNxtBl',
  },
  {
    productId: 'portable-ac',
    productName: 'Portable Air Conditioner',
    category: 'florida-coastal',
    tier: 'B',
    price: 'Around $400+',
    priceDescriptor: 'COOLING',
    description: 'FL summer outages are brutal. A single-room unit on a power station saves sleep.',
    amazonUrl: 'https://amzn.to/4f7R0pS',
  },

  // --- Communication ---
  {
    productId: 'garmin-inreach-mini-2',
    productName: 'Garmin inReach Mini 2',
    category: 'communication',
    tier: 'C',
    price: '$400',
    priceDescriptor: 'SATELLITE',
    description: 'Two-way satellite messaging. Works anywhere with sky visibility. Subscription required.',
    amazonUrl: 'https://amzn.to/4tVu68S',
  },
  {
    productId: 'midland-mxt275',
    productName: 'Midland MXT275',
    category: 'communication',
    tier: 'C',
    price: 'Around $344.95+',
    priceDescriptor: 'FAMILY RADIO',
    description: 'GMRS radio for family communication when cell goes down. No subscription needed.',
    amazonUrl: 'https://amzn.to/42U1mCw',
  },
  {
    productId: 'headlamp-flashlight',
    productName: 'LHKNL Headlamp Flashlight',
    category: 'communication',
    tier: 'C',
    price: '$25',
    priceDescriptor: 'HEADLAMP',
    description: 'Hands-free lighting matters more than you think during a real outage.',
    amazonUrl: 'https://amzn.to/4dLjNyf',
  },
];

/**
 * @typedef {Object} AffiliateCategory
 * @property {string} id             Matches AffiliateProduct.category
 * @property {string} anchor         URL fragment for in-page navigation
 * @property {string} icon           Emoji or short string rendered in section header
 * @property {string} navLabel       Short label for the sticky anchor nav
 * @property {string} title          Section heading
 * @property {string} description    Section body copy (StormTracking voice)
 * @property {string} [personalNote]  Optional italicized first-person note appended after description
 * @property {boolean} [isPetSection] Triggers warm coral background treatment
 */

/** @type {AffiliateCategory[]} */
export const AFFILIATE_CATEGORIES = [
  {
    id: 'stay-informed',
    anchor: 'stay-informed',
    icon: '📡',
    navLabel: 'Stay informed',
    title: 'Stay informed when power fails',
    description: "When cell towers go down and Wi-Fi is dead, NOAA Weather Radio keeps broadcasting. A $30 weather radio is the cheapest insurance you'll ever buy.",
  },
  {
    id: 'backup-power',
    anchor: 'backup-power',
    icon: '🔋',
    navLabel: 'Backup power',
    title: 'Power through the outage',
    description: 'From phone backup to full home power. Start with a power bank, scale up if you live somewhere outages last days.',
  },
  {
    id: 'food-water',
    anchor: 'food-water',
    icon: '💧',
    navLabel: 'Food & water',
    title: 'Food & water for the long haul',
    description: 'Florida and most hurricane-prone areas recommend a 7-day supply. Start with water filtration, add shelf-stable food, refresh annually.',
  },
  {
    id: 'pet-prep',
    anchor: 'pet-prep',
    icon: '🐾',
    navLabel: 'Pet prep',
    title: "Don't forget your pets",
    description: "Most evacuation shelters don't accept pets. Most hurricane prep guides skip this section entirely. Mackie says: prep for your whole family.",
    isPetSection: true,
  },
  {
    id: 'florida-coastal',
    anchor: 'florida-coastal',
    icon: '☀️',
    navLabel: 'Florida & coastal',
    title: 'Florida & coastal residents',
    description: 'For households facing hurricane-force winds or multi-day outages. Worth the investment if you live in a Cat 3+ landfall zone.',
    personalNote: "I live in Fort Myers. These are items I actually own (or wish I did). Local knowledge from someone who's lived through this.",
  },
  {
    id: 'communication',
    anchor: 'communication',
    icon: '📻',
    navLabel: 'Communication',
    title: 'When cell towers fail',
    description: "Cell networks fail constantly during major storms. These keep you connected when everything else doesn't.",
  },
];

/**
 * EssentialsCard variants. Each variant defines which products surface in
 * the compact card on homepage / state / storm pages.
 *
 * The `placement` analytics prop is set at the callsite (e.g., 'homepage',
 * 'state-fl', 'storm-hurricane') — the keys here just select the variant.
 */
export const ESSENTIALS_CARD_VARIANTS = {
  homepage: {
    title: '🌀 Before the storm',
    productIds: ['midland-wr120b', 'ecoflow-delta-3-plus', 'pet-first-aid-kit'],
  },
  'state-fl': {
    title: '🌴 Florida hurricane essentials',
    productIds: ['generac-3500w', 'heavy-duty-tarp', 'portable-ac', 'pet-carrier'],
  },
  'state-tx': {
    title: '⛈️ Texas weather essentials',
    productIds: ['midland-wr120b', 'ecoflow-delta-3-plus', 'heavy-duty-tarp'],
  },
  'state-tornado': {
    title: '🌪️ Tornado prep essentials',
    productIds: ['midland-wr120b', 'midland-er310', 'lifestraw'],
  },
  'storm-hurricane': {
    title: '🌀 Hurricane prep recommendations',
    productIds: ['ecoflow-delta-3-plus', 'midland-wr120b', 'pet-carrier', 'mountain-house'],
  },
  'storm-severe': {
    title: '⛈️ Severe weather essentials',
    productIds: ['midland-wr120b', 'anker-powercore', 'lifestraw'],
  },
};

const PRODUCTS_BY_ID = Object.fromEntries(AFFILIATE_PRODUCTS.map(p => [p.productId, p]));
const CATEGORIES_BY_ID = Object.fromEntries(AFFILIATE_CATEGORIES.map(c => [c.id, c]));

/** @returns {AffiliateProduct|null} */
export function getProductById(productId) {
  return PRODUCTS_BY_ID[productId] || null;
}

/** @returns {AffiliateCategory|null} */
export function getCategoryById(categoryId) {
  return CATEGORIES_BY_ID[categoryId] || null;
}

/** @returns {AffiliateProduct[]} */
export function getProductsByCategory(categoryId) {
  return AFFILIATE_PRODUCTS.filter(p => p.category === categoryId);
}
