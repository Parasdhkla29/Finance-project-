/** Keyword → category mapping for auto-categorization */
const RULES: Array<{ keywords: string[]; category: string; subcategory?: string }> = [
  // Food & Drink
  { keywords: ['tesco', 'sainsbury', 'lidl', 'asda', 'waitrose', 'aldi', 'morrisons', 'marks&spencer', 'marks & spencer', 'm&s', 'co-op', 'coop', 'iceland', 'farmfoods', 'wholefood', 'whole foods', 'trader joe'], category: 'Groceries' },
  { keywords: ['mcdonald', 'kfc', 'burger king', 'subway', 'domino', 'pizza hut', 'nando', 'greggs', 'costa', 'starbucks', 'caffe nero', 'pret', 'wasabi', 'wagamama', 'five guys', 'deliveroo', 'uber eats', 'just eat', 'takeaway'], category: 'Eating Out', subcategory: 'Fast Food' },
  { keywords: ['restaurant', 'cafe', 'bistro', 'kitchen', 'grill', 'diner', 'brasserie'], category: 'Eating Out' },

  // Transport
  { keywords: ['shell', 'bp', 'esso', 'texaco', 'total', 'petrol', 'fuel', 'gas station', 'forecourt'], category: 'Transport', subcategory: 'Fuel' },
  { keywords: ['uber', 'lyft', 'bolt', 'addison lee', 'taxi', 'cab'], category: 'Transport', subcategory: 'Taxi' },
  { keywords: ['tfl', 'national rail', 'gwr', 'lner', 'avanti', 'trainline', 'southern', 'southeastern', 'northern rail', 'eurostar', 'bus', 'coach', 'megabus', 'flixbus'], category: 'Transport', subcategory: 'Public Transport' },
  { keywords: ['parking', 'ringo', 'justpark', 'ncp', 'q-park'], category: 'Transport', subcategory: 'Parking' },

  // Entertainment & Subscriptions
  { keywords: ['netflix', 'hulu', 'disney', 'hbo', 'apple tv', 'paramount', 'amazon prime', 'now tv', 'britbox', 'bbc iplayer'], category: 'Entertainment', subcategory: 'Streaming' },
  { keywords: ['spotify', 'apple music', 'youtube music', 'deezer', 'tidal', 'audible'], category: 'Entertainment', subcategory: 'Music' },
  { keywords: ['xbox', 'playstation', 'nintendo', 'steam', 'epic games', 'ea play'], category: 'Entertainment', subcategory: 'Gaming' },
  { keywords: ['cinema', 'odeon', 'cineworld', 'vue', 'curzon', 'picturehouse', 'everyman'], category: 'Entertainment', subcategory: 'Cinema' },

  // Health
  { keywords: ['gym', 'pure gym', 'david lloyd', 'nuffield', 'fitness first', 'anytime fitness', 'virgin active', 'planet fitness', 'crossfit'], category: 'Health', subcategory: 'Gym' },
  { keywords: ['pharmacy', 'boots', 'lloyds pharmacy', 'well pharmacy', 'superdrug'], category: 'Health', subcategory: 'Pharmacy' },
  { keywords: ['doctor', 'dentist', 'optician', 'hospital', 'nhs', 'bupa', 'axa health', 'vitality'], category: 'Health', subcategory: 'Medical' },

  // Shopping
  { keywords: ['amazon', 'ebay', 'asos', 'next', 'h&m', 'zara', 'primark', 'topshop', 'john lewis', 'argos', 'currys', 'pc world', 'apple store', 'ikea', 'dunelm'], category: 'Shopping' },

  // Bills & Utilities
  { keywords: ['british gas', 'eon', 'ovo', 'octopus energy', 'bulb', 'edf', 'npower', 'electricity', 'gas bill', 'water bill', 'thames water', 'southern water'], category: 'Utilities' },
  { keywords: ['bt', 'sky', 'virgin media', 'talktalk', 'plusnet', 'vodafone', 'ee', 'o2', 'three', 'giffgaff', 'broadband', 'mobile', 'phone bill'], category: 'Bills', subcategory: 'Phone & Internet' },
  { keywords: ['council tax', 'local council', 'rates'], category: 'Bills', subcategory: 'Council Tax' },
  { keywords: ['insurance', 'aviva', 'admiral', 'direct line', 'comparethemarket', 'compare the market', 'go compare'], category: 'Bills', subcategory: 'Insurance' },

  // Finance
  { keywords: ['barclays', 'hsbc', 'lloyds', 'natwest', 'santander', 'nationwide', 'monzo', 'starling', 'revolut', 'halifax', 'first direct'], category: 'Finance', subcategory: 'Bank' },
  { keywords: ['interest', 'loan payment', 'mortgage', 'credit card payment', 'minimum payment'], category: 'Finance', subcategory: 'Debt Repayment' },
  { keywords: ['salary', 'wages', 'payroll', 'paycheck', 'bacs'], category: 'Income', subcategory: 'Salary' },
  { keywords: ['freelance', 'invoice', 'client payment', 'consulting'], category: 'Income', subcategory: 'Freelance' },
  { keywords: ['dividend', 'interest income', 'investment income'], category: 'Income', subcategory: 'Investment' },

  // Travel
  { keywords: ['hotel', 'airbnb', 'booking.com', 'expedia', 'hostel', 'trivago', 'hotels.com'], category: 'Travel', subcategory: 'Accommodation' },
  { keywords: ['ryanair', 'easyjet', 'british airways', 'virgin atlantic', 'emirates', 'lufthansa', 'flights', 'airline'], category: 'Travel', subcategory: 'Flights' },

  // Education
  { keywords: ['udemy', 'coursera', 'skillshare', 'linkedin learning', 'pluralsight', 'codecademy', 'tuition', 'school', 'university', 'college'], category: 'Education' },

  // Charity
  { keywords: ['charity', 'donation', 'oxfam', 'cancer research', 'british heart', 'nspcc', 'rspca', 'justgiving', 'virgin money giving'], category: 'Charity' },
];

/** Local user-trained preference map stored in localStorage */
const PREF_KEY = 'pl_category_prefs';

function loadPrefs(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function savePrefs(prefs: Record<string, string>): void {
  localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
}

/** Suggest a category from merchant name. Returns { category, subcategory } or null. */
export function suggestCategory(merchant: string): { category: string; subcategory?: string } | null {
  const lower = merchant.toLowerCase();

  // Check user prefs first
  const prefs = loadPrefs();
  if (prefs[lower]) return { category: prefs[lower] };

  for (const rule of RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return { category: rule.category, subcategory: rule.subcategory };
    }
  }
  return null;
}

/** Train the categorizer with a user correction */
export function trainCategorizer(merchant: string, category: string): void {
  const prefs = loadPrefs();
  prefs[merchant.toLowerCase()] = category;
  savePrefs(prefs);
}

/** All unique categories available */
export const ALL_CATEGORIES = [
  'Groceries',
  'Eating Out',
  'Transport',
  'Entertainment',
  'Health',
  'Shopping',
  'Utilities',
  'Bills',
  'Finance',
  'Income',
  'Travel',
  'Education',
  'Charity',
  'Savings',
  'Other',
  'Uncategorized',
];
