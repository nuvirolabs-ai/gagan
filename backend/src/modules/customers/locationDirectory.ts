type PinEntry = {
  state: string;
  district: string;
  tehsil: string;
  cities: string[];
};

export const INDIAN_STATES: string[] = [
  "Madhya Pradesh",
  "Maharashtra",
  "Rajasthan",
  "Gujarat",
  "Uttar Pradesh",
  "Chhattisgarh",
  "Delhi",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Goa",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttarakhand",
  "West Bengal",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Jammu and Kashmir",
  "Ladakh",
  "Puducherry",
];

type DistrictSeed = {
  state: string;
  district: string;
  tehsils: string[];
  cities: string[];
};

const MP_DISTRICTS: DistrictSeed[] = [
  { state: "Madhya Pradesh", district: "Indore", tehsils: ["Indore", "Dr. Ambedkar Nagar (Mhow)", "Sanwer", "Depalpur", "Hatod", "Rau"], cities: ["Indore", "Mhow", "Sanwer", "Depalpur", "Hatod", "Rau", "Betma", "Manglia", "Gautampura"] },
  { state: "Madhya Pradesh", district: "Bhopal", tehsils: ["Huzur", "Berasia", "Kolar"], cities: ["Bhopal", "Berasia", "Kolar", "Mandideep"] },
  { state: "Madhya Pradesh", district: "Ujjain", tehsils: ["Ujjain", "Nagda", "Khachrod", "Barnagar", "Mahidpur", "Tarana", "Ghatiya", "Makdon"], cities: ["Ujjain", "Nagda", "Khachrod", "Barnagar", "Mahidpur", "Tarana", "Unhel"] },
  { state: "Madhya Pradesh", district: "Dewas", tehsils: ["Dewas", "Sonkatch", "Bagli", "Kannod", "Khategaon", "Tonk Khurd", "Hatpipliya", "Satwas", "Udainagar"], cities: ["Dewas", "Sonkatch", "Bagli", "Kannod", "Khategaon", "Hatpipliya", "Bhaurasa", "Satwas", "Kantaphod"] },
  { state: "Madhya Pradesh", district: "Dhar", tehsils: ["Dhar", "Kukshi", "Manawar", "Badnawar", "Sardarpur", "Gandhwani", "Dharampuri", "Dahi", "Pithampur"], cities: ["Dhar", "Pithampur", "Kukshi", "Manawar", "Badnawar", "Dhamnod", "Rajgarh", "Sardarpur", "Dharampuri"] },
  { state: "Madhya Pradesh", district: "Shajapur", tehsils: ["Shajapur", "Shujalpur", "Kalapipal", "Gulana", "Moman Badodiya", "Polay Kalan"], cities: ["Shajapur", "Shujalpur", "Kalapipal", "Akodiya", "Polay Kalan", "Maksi", "Mohan Badodiya", "Arniya Kalan"] },
  { state: "Madhya Pradesh", district: "Agar Malwa", tehsils: ["Agar", "Susner", "Nalkheda", "Badod"], cities: ["Agar", "Susner", "Nalkheda", "Soyat Kalan", "Badod"] },
  { state: "Madhya Pradesh", district: "Sehore", tehsils: ["Sehore", "Ashta", "Ichhawar", "Nasrullaganj", "Budhni", "Rehti", "Shyampur", "Jawar"], cities: ["Sehore", "Ashta", "Ichhawar", "Nasrullaganj", "Budhni", "Rehti", "Kothri", "Jawar"] },
  { state: "Madhya Pradesh", district: "Raisen", tehsils: ["Raisen", "Goharganj", "Begamganj", "Gairatganj", "Silwani", "Bareli", "Udaipura", "Badi"], cities: ["Raisen", "Mandideep", "Obedullaganj", "Bareli", "Begamganj", "Udaipura"] },
  { state: "Madhya Pradesh", district: "Vidisha", tehsils: ["Vidisha", "Basoda", "Sironj", "Kurwai", "Lateri", "Gyaraspur", "Shamshabad"], cities: ["Vidisha", "Ganj Basoda", "Sironj", "Kurwai", "Lateri"] },
  { state: "Madhya Pradesh", district: "Ratlam", tehsils: ["Ratlam", "Jaora", "Alot", "Sailana", "Bajna", "Piploda", "Tal", "Raoji"], cities: ["Ratlam", "Jaora", "Alot", "Sailana", "Tal", "Namli"] },
  { state: "Madhya Pradesh", district: "Mandsaur", tehsils: ["Mandsaur", "Malhargarh", "Garoth", "Sitamau", "Bhanpura", "Shamgarh", "Daloda", "Suwasra"], cities: ["Mandsaur", "Sitamau", "Garoth", "Shamgarh", "Bhanpura", "Piplia Mandi", "Suwasra"] },
  { state: "Madhya Pradesh", district: "Neemuch", tehsils: ["Neemuch", "Jawad", "Manasa", "Singoli", "Jiran"], cities: ["Neemuch", "Jawad", "Manasa", "Rampura", "Singoli"] },
  { state: "Madhya Pradesh", district: "Khargone", tehsils: ["Khargone", "Maheshwar", "Barwaha", "Kasrawad", "Bhikangaon", "Segaon", "Gogawan", "Jhiranya"], cities: ["Khargone", "Barwaha", "Sanawad", "Maheshwar", "Kasrawad", "Mandleshwar", "Bhikangaon"] },
  { state: "Madhya Pradesh", district: "Khandwa", tehsils: ["Khandwa", "Pandhana", "Punasa", "Harsud", "Khalwa"], cities: ["Khandwa", "Mundi", "Omkareshwar", "Pandhana", "Harsud"] },
  { state: "Madhya Pradesh", district: "Barwani", tehsils: ["Barwani", "Sendhwa", "Anjad", "Rajpur", "Pansemal", "Niwali", "Thikri", "Pati"], cities: ["Barwani", "Sendhwa", "Anjad", "Rajpur", "Thikri", "Khetia"] },
  { state: "Madhya Pradesh", district: "Burhanpur", tehsils: ["Burhanpur", "Nepanagar", "Khaknar"], cities: ["Burhanpur", "Nepanagar", "Shahpur"] },
  { state: "Madhya Pradesh", district: "Jhabua", tehsils: ["Jhabua", "Thandla", "Petlawad", "Meghnagar", "Ranapur", "Rama"], cities: ["Jhabua", "Thandla", "Petlawad", "Meghnagar", "Ranapur"] },
  { state: "Madhya Pradesh", district: "Alirajpur", tehsils: ["Alirajpur", "Jobat", "Bhabra", "Sondwa"], cities: ["Alirajpur", "Jobat", "Chandrashekhar Azad Nagar"] },
  { state: "Madhya Pradesh", district: "Rajgarh", tehsils: ["Rajgarh", "Biaora", "Narsinghgarh", "Sarangpur", "Khilchipur", "Jirapur", "Pachore"], cities: ["Biaora", "Rajgarh", "Narsinghgarh", "Sarangpur", "Pachore", "Khilchipur", "Jirapur"] },
  { state: "Madhya Pradesh", district: "Gwalior", tehsils: ["Gwalior", "Dabra", "Bhitarwar", "Chinor"], cities: ["Gwalior", "Dabra", "Bhitarwar"] },
  { state: "Madhya Pradesh", district: "Jabalpur", tehsils: ["Jabalpur", "Sihora", "Patan", "Panagar", "Shahpura", "Kundam"], cities: ["Jabalpur", "Sihora", "Patan", "Panagar"] },
  { state: "Madhya Pradesh", district: "Sagar", tehsils: ["Sagar", "Bina", "Khurai", "Rehli", "Banda", "Garhakota", "Deori"], cities: ["Sagar", "Bina", "Khurai", "Rehli", "Garhakota", "Makronia"] },
  { state: "Madhya Pradesh", district: "Betul", tehsils: ["Betul", "Multai", "Amla", "Bhainsdehi", "Shahpur"], cities: ["Betul", "Multai", "Amla", "Sarni"] },
  { state: "Madhya Pradesh", district: "Harda", tehsils: ["Harda", "Timarni", "Khirkiya"], cities: ["Harda", "Timarni", "Khirkiya"] },
  { state: "Madhya Pradesh", district: "Narmadapuram", tehsils: ["Narmadapuram", "Itarsi", "Pipariya", "Seoni Malwa", "Sohagpur", "Babai"], cities: ["Narmadapuram", "Itarsi", "Pipariya", "Seoni Malwa", "Pachmarhi"] },
  { state: "Madhya Pradesh", district: "Chhindwara", tehsils: ["Chhindwara", "Parasia", "Pandhurna", "Sausar", "Amarwara", "Junardeo"], cities: ["Chhindwara", "Parasia", "Pandhurna", "Sausar"] },
  { state: "Madhya Pradesh", district: "Guna", tehsils: ["Guna", "Raghogarh", "Chachoura", "Aron", "Kumbhraj"], cities: ["Guna", "Raghogarh", "Aron", "Binaganj"] },
  { state: "Maharashtra", district: "Pune", tehsils: ["Pune City", "Haveli", "Mulshi", "Maval", "Baramati", "Shirur"], cities: ["Pune", "Pimpri-Chinchwad", "Baramati", "Talegaon", "Chakan"] },
  { state: "Maharashtra", district: "Mumbai Suburban", tehsils: ["Andheri", "Borivali", "Kurla"], cities: ["Mumbai", "Andheri", "Borivali", "Thane"] },
  { state: "Rajasthan", district: "Kota", tehsils: ["Ladpura", "Ramganj Mandi", "Sangod", "Pipalda"], cities: ["Kota", "Ramganj Mandi", "Kaithoon"] },
  { state: "Gujarat", district: "Ahmedabad", tehsils: ["Ahmedabad City", "Daskroi", "Sanand", "Dholka", "Viramgam"], cities: ["Ahmedabad", "Sanand", "Dholka", "Bavla"] },
];

const LOCAL_PIN_SEED: Record<string, PinEntry> = {
  "452001": { state: "Madhya Pradesh", district: "Indore", tehsil: "Indore", cities: ["Indore"] },
  "452002": { state: "Madhya Pradesh", district: "Indore", tehsil: "Indore", cities: ["Indore"] },
  "452003": { state: "Madhya Pradesh", district: "Indore", tehsil: "Indore", cities: ["Indore"] },
  "452004": { state: "Madhya Pradesh", district: "Indore", tehsil: "Indore", cities: ["Indore"] },
  "452005": { state: "Madhya Pradesh", district: "Indore", tehsil: "Indore", cities: ["Indore"] },
  "452006": { state: "Madhya Pradesh", district: "Indore", tehsil: "Indore", cities: ["Indore"] },
  "452007": { state: "Madhya Pradesh", district: "Indore", tehsil: "Indore", cities: ["Indore"] },
  "452008": { state: "Madhya Pradesh", district: "Indore", tehsil: "Indore", cities: ["Indore"] },
  "452009": { state: "Madhya Pradesh", district: "Indore", tehsil: "Indore", cities: ["Indore"] },
  "452010": { state: "Madhya Pradesh", district: "Indore", tehsil: "Indore", cities: ["Indore"] },
  "452011": { state: "Madhya Pradesh", district: "Indore", tehsil: "Indore", cities: ["Indore"] },
  "452012": { state: "Madhya Pradesh", district: "Indore", tehsil: "Indore", cities: ["Indore"] },
  "452014": { state: "Madhya Pradesh", district: "Indore", tehsil: "Indore", cities: ["Indore"] },
  "452015": { state: "Madhya Pradesh", district: "Indore", tehsil: "Indore", cities: ["Indore"] },
  "452016": { state: "Madhya Pradesh", district: "Indore", tehsil: "Indore", cities: ["Indore"] },
  "452018": { state: "Madhya Pradesh", district: "Indore", tehsil: "Indore", cities: ["Indore"] },
  "452020": { state: "Madhya Pradesh", district: "Indore", tehsil: "Indore", cities: ["Indore"] },
  "453111": { state: "Madhya Pradesh", district: "Indore", tehsil: "Hatod", cities: ["Indore", "Hatod"] },
  "453112": { state: "Madhya Pradesh", district: "Indore", tehsil: "Indore", cities: ["Indore", "Gandhi Nagar"] },
  "453331": { state: "Madhya Pradesh", district: "Indore", tehsil: "Rau", cities: ["Rau", "Indore"] },
  "453441": { state: "Madhya Pradesh", district: "Indore", tehsil: "Dr. Ambedkar Nagar (Mhow)", cities: ["Mhow"] },
  "453551": { state: "Madhya Pradesh", district: "Indore", tehsil: "Sanwer", cities: ["Sanwer"] },
  "454001": { state: "Madhya Pradesh", district: "Dhar", tehsil: "Dhar", cities: ["Dhar"] },
  "454331": { state: "Madhya Pradesh", district: "Dhar", tehsil: "Kukshi", cities: ["Kukshi"] },
  "454446": { state: "Madhya Pradesh", district: "Dhar", tehsil: "Manawar", cities: ["Manawar"] },
  "454775": { state: "Madhya Pradesh", district: "Dhar", tehsil: "Pithampur", cities: ["Pithampur", "Dhar"] },
  "455001": { state: "Madhya Pradesh", district: "Dewas", tehsil: "Dewas", cities: ["Dewas"] },
  "456001": { state: "Madhya Pradesh", district: "Ujjain", tehsil: "Ujjain", cities: ["Ujjain"] },
  "456006": { state: "Madhya Pradesh", district: "Ujjain", tehsil: "Ujjain", cities: ["Ujjain"] },
  "456010": { state: "Madhya Pradesh", district: "Ujjain", tehsil: "Ujjain", cities: ["Ujjain"] },
  "462001": { state: "Madhya Pradesh", district: "Bhopal", tehsil: "Huzur", cities: ["Bhopal"] },
  "462010": { state: "Madhya Pradesh", district: "Bhopal", tehsil: "Huzur", cities: ["Bhopal"] },
  "462023": { state: "Madhya Pradesh", district: "Bhopal", tehsil: "Huzur", cities: ["Bhopal"] },
  "465001": { state: "Madhya Pradesh", district: "Shajapur", tehsil: "Shajapur", cities: ["Shajapur"] },
  "465333": { state: "Madhya Pradesh", district: "Shajapur", tehsil: "Shujalpur", cities: ["Shujalpur"] },
  "465337": { state: "Madhya Pradesh", district: "Shajapur", tehsil: "Kalapipal", cities: ["Kalapipal"] },
  "466001": { state: "Madhya Pradesh", district: "Sehore", tehsil: "Sehore", cities: ["Sehore"] },
  "411001": { state: "Maharashtra", district: "Pune", tehsil: "Pune City", cities: ["Pune"] },
};

const STATE_ALIASES: Record<string, string> = {
  mp: "Madhya Pradesh",
  "m.p": "Madhya Pradesh",
  "m.p.": "Madhya Pradesh",
  madhyapradesh: "Madhya Pradesh",
  "madhya pradesh": "Madhya Pradesh",
  "madhya oray": "Madhya Pradesh",
  "madhya prdesh": "Madhya Pradesh",
  maharastra: "Maharashtra",
  mh: "Maharashtra",
  rj: "Rajasthan",
  gj: "Gujarat",
  up: "Uttar Pradesh",
  cg: "Chhattisgarh",
};

const CITY_ALIASES: Record<string, string> = {
  indor: "Indore",
  "indore city": "Indore",
  "shujalpur city": "Shujalpur",
  "shujalpur mandi": "Shujalpur",
  "bhopal city": "Bhopal",
  "ujjain city": "Ujjain",
  "dewas city": "Dewas",
  "mhow": "Mhow",
};

const pinCache = new Map<string, PinEntry>();

function toTitleCase(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => (word.length <= 2 && word === word.toUpperCase() ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join(" ");
}

export function normalizeStateName(raw: string | null | undefined): string {
  const cleaned = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!cleaned) return "";
  const key = cleaned.toLowerCase();
  if (STATE_ALIASES[key]) return STATE_ALIASES[key];
  const exact = INDIAN_STATES.find((s) => s.toLowerCase() === key);
  return exact ?? toTitleCase(cleaned);
}

export function normalizeCityName(raw: string | null | undefined): string {
  const cleaned = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!cleaned) return "";
  const key = cleaned.toLowerCase();
  if (CITY_ALIASES[key]) return CITY_ALIASES[key];
  return toTitleCase(cleaned);
}

export function normalizeLocalityName(raw: string | null | undefined): string {
  const cleaned = (raw ?? "").trim().replace(/\s+/g, " ");
  return cleaned ? toTitleCase(cleaned) : "";
}

export function cityMatchVariants(city: string): string[] {
  const canonical = normalizeCityName(city);
  const raw = city.trim().replace(/\s+/g, " ");
  const variants = new Set<string>();
  for (const val of [canonical, raw]) {
    if (val) variants.add(val);
  }
  if (canonical) {
    variants.add(`${canonical} city`);
    variants.add(`${canonical} mandi`);
  }
  return [...variants];
}

export function buildSameCityRetailerWhere(city: string) {
  const canonical = normalizeCityName(city);
  const tokens = cityMatchVariants(city);
  const orClauses: any[] = [];
  for (const token of tokens) {
    orClauses.push({ deliveryCity: { equals: token, mode: "insensitive" } });
    orClauses.push({ shopAddress: { contains: token, mode: "insensitive" } });
    orClauses.push({ name: { contains: token, mode: "insensitive" } });
  }
  if (canonical && canonical.length >= 3) {
    orClauses.push({ tehsil: { equals: canonical, mode: "insensitive" } });
  }
  return { OR: orClauses };
}

export async function lookupPinCode(pin: string): Promise<(PinEntry & { pinCode: string; source: "local" | "india_post" }) | null> {
  const cleanPin = pin.trim();
  if (!/^\d{6}$/.test(cleanPin)) return null;

  if (LOCAL_PIN_SEED[cleanPin]) {
    return { pinCode: cleanPin, ...LOCAL_PIN_SEED[cleanPin], source: "local" };
  }
  if (pinCache.has(cleanPin)) {
    return { pinCode: cleanPin, ...pinCache.get(cleanPin)!, source: "india_post" };
  }

  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`, {
      signal: AbortSignal.timeout(3000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as any;
    const first = Array.isArray(payload) ? payload[0] : null;
    const postOffices = Array.isArray(first?.PostOffice) ? first.PostOffice : [];
    if (first?.Status !== "Success" || postOffices.length === 0) return null;

    const state = normalizeStateName(postOffices[0]?.State);
    const district = normalizeLocalityName(postOffices[0]?.District);
    const tehsilSet = new Set<string>();
    const citySet = new Set<string>();

    for (const po of postOffices) {
      const block = normalizeLocalityName(po?.Block);
      const taluk = normalizeLocalityName(po?.Taluk);
      const division = normalizeLocalityName(po?.Division);
      const name = normalizeLocalityName(po?.Name);
      if (taluk && taluk.toLowerCase() !== "na") tehsilSet.add(taluk);
      else if (block && block.toLowerCase() !== "na") tehsilSet.add(block);
      else if (division) tehsilSet.add(division);
      if (name) citySet.add(name);
    }
    if (district && tehsilSet.size === 0) tehsilSet.add(district);
    if (district) citySet.add(district);

    const entry: PinEntry = {
      state: state || "Madhya Pradesh",
      district,
      tehsil: [...tehsilSet][0] || district,
      cities: [...citySet],
    };
    if (pinCache.size > 2000) pinCache.clear();
    pinCache.set(cleanPin, entry);
    return { pinCode: cleanPin, ...entry, source: "india_post" };
  } catch {
    return null;
  }
}

export async function buildLocationDirectory(prisma?: any) {
  const states = new Set<string>(INDIAN_STATES);
  const districtsByState = new Map<string, Set<string>>();
  const tehsilsByDistrict = new Map<string, Set<string>>();
  const citiesByDistrict = new Map<string, Set<string>>();

  const addEntry = (stateRaw?: string | null, districtRaw?: string | null, tehsilRaw?: string | null, cityRaw?: string | null) => {
    const state = normalizeStateName(stateRaw);
    if (!state) return;
    states.add(state);
    if (!districtsByState.has(state)) districtsByState.set(state, new Set());
    const district = normalizeLocalityName(districtRaw);
    if (!district) return;
    districtsByState.get(state)!.add(district);

    if (tehsilRaw) {
      const tehsil = normalizeLocalityName(tehsilRaw);
      if (tehsil) {
        if (!tehsilsByDistrict.has(district)) tehsilsByDistrict.set(district, new Set());
        tehsilsByDistrict.get(district)!.add(tehsil);
      }
    }
    if (cityRaw) {
      const city = normalizeCityName(cityRaw);
      if (city) {
        if (!citiesByDistrict.has(district)) citiesByDistrict.set(district, new Set());
        citiesByDistrict.get(district)!.add(city);
      }
    }
  };

  for (const seed of MP_DISTRICTS) {
    for (const tehsil of seed.tehsils) addEntry(seed.state, seed.district, tehsil, null);
    for (const city of seed.cities) addEntry(seed.state, seed.district, null, city);
  }

  if (prisma?.cityRouting?.findMany) {
    try {
      const routings = await prisma.cityRouting.findMany({ where: { isActive: true }, select: { city: true, state: true } });
      for (const r of routings) {
        const st = normalizeStateName(r.state);
        const city = normalizeCityName(r.city);
        if (st && city) addEntry(st, city, city, city);
      }
    } catch {
      // Ignore optional DB seed merge errors in lightweight tests
    }
  }

  if (prisma?.retailerProposal?.findMany) {
    try {
      const proposals = await prisma.retailerProposal.findMany({
        where: { locationStandardized: true },
        select: { state: true, district: true, tehsil: true, deliveryCity: true },
        take: 300,
      });
      for (const p of proposals) {
        addEntry(p.state, p.district, p.tehsil, p.deliveryCity);
      }
    } catch {
      // Ignore if column doesn't exist yet
    }
  }

  const sortArr = (s?: Set<string>) => (s ? [...s].sort((a, b) => a.localeCompare(b)) : []);
  return {
    states: sortArr(states),
    districtsByState: Object.fromEntries([...districtsByState.entries()].map(([k, v]) => [k, sortArr(v)])),
    tehsilsByDistrict: Object.fromEntries([...tehsilsByDistrict.entries()].map(([k, v]) => [k, sortArr(v)])),
    citiesByDistrict: Object.fromEntries([...citiesByDistrict.entries()].map(([k, v]) => [k, sortArr(v)])),
  };
}

export function standardizeProposalLocation(input: {
  state: string;
  district: string;
  tehsil: string;
  deliveryCity: string;
  customLocationUsed?: boolean;
}) {
  const state = normalizeStateName(input.state);
  const district = normalizeLocalityName(input.district);
  const tehsil = normalizeLocalityName(input.tehsil);
  const deliveryCity = normalizeCityName(input.deliveryCity);

  const knownDistrict = MP_DISTRICTS.find(
    (d) => d.state.toLowerCase() === state.toLowerCase() && d.district.toLowerCase() === district.toLowerCase()
  );
  const knownCity = knownDistrict?.cities.some((c) => c.toLowerCase() === deliveryCity.toLowerCase()) ?? false;
  const knownTehsil = knownDistrict?.tehsils.some((t) => t.toLowerCase() === tehsil.toLowerCase()) ?? false;

  const isCustomOrUnknown = Boolean(input.customLocationUsed) || (Boolean(knownDistrict) && (!knownCity || !knownTehsil));
  return {
    state,
    district,
    tehsil,
    deliveryCity,
    locationStandardized: !isCustomOrUnknown,
    locationNeedsReview: isCustomOrUnknown,
  };
}
