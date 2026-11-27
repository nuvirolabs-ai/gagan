const EXACT_PHRASE_HINDI: Record<string, string> = {
  "madhya pradesh": "मध्य प्रदेश",
  "madhyapradesh": "मध्य प्रदेश",
  "maharashtra": "महाराष्ट्र",
  "rajasthan": "राजस्थान",
  "gujarat": "गुजरात",
  "uttar pradesh": "उत्तर प्रदेश",
  "chhattisgarh": "छत्तीसगढ़",
  "indore": "इंदौर",
  "bhopal": "भोपाल",
  "dewas": "देवास",
  "ujjain": "उज्जैन",
  "dhar": "धार",
  "shajapur": "शाजापुर",
  "shujalpur": "शुजालपुर",
  "shujalpur city": "शुजालपुर शहर",
  "kalapipal": "कालापीपल",
  "akodiya": "अकोदिया",
  "sehor": "सीहोर",
  "sehore": "सीहोर",
  "pithampur": "पीथमपुर",
  "mhow": "महू",
  "sanwer": "सांवेर",
  "depalpur": "देपालपुर",
  "hatod": "हातोद",
  "rau": "राऊ",
  "manawar": "मनावर",
  "kukshi": "कुक्षी",
  "ratlam": "रतलाम",
  "khandwa": "खंडवा",
  "khargone": "खरगोन",
  "pune": "पुणे",
  "mumbai": "मुंबई",
  "regular": "नियमित",
  "direct": "सीधा",
  "direct customer": "सीधा ग्राहक",
  "direct coustomer": "सीधा ग्राहक",
  "gagan logistics": "गगन लॉजिस्टिक्स",
  "advance": "अग्रिम",
  "cash on delivery": "कैश ऑन डिलीवरी",
  "7 day": "7 दिन",
  "7 days": "7 दिन",
  "15 day": "15 दिन",
  "15 days": "15 दिन",
  "21 days": "21 दिन",
  "30 days": "30 दिन",
  "30 days credit": "30 दिन क्रेडिट",
  "45 days": "45 दिन",
  "kirana / general store": "किराना / जनरल स्टोर",
  "wholesaler": "थोक विक्रेता",
  "supermarket / mart": "सुपरमार्केट / मार्ट",
  "horeca (hotel / restaurant / catering)": "होटल / रेस्टोरेंट / कैटरिंग",
  "semi-wholesaler": "अर्ध-थोक विक्रेता",
  "distributor": "वितरक",
  "institution / bulk buyer": "संस्थागत / थोक खरीदार",
};

const TOKEN_TRANSLATIONS: Record<string, string> = {
  kirana: "किराना",
  store: "स्टोर",
  stores: "स्टोर्स",
  traders: "ट्रेडर्स",
  trader: "ट्रेडर",
  mart: "मार्ट",
  supermarket: "सुपरमार्केट",
  general: "जनरल",
  enterprises: "एंटरप्राइजेज",
  enterprise: "एंटरप्राइज",
  provision: "प्रोविजन",
  brothers: "ब्रदर्स",
  road: "रोड",
  marg: "मार्ग",
  nagar: "नगर",
  colony: "कॉलोनी",
  city: "शहर",
  bazar: "बाजार",
  bazaar: "बाजार",
  market: "मार्केट",
  chowk: "चौक",
  chauraha: "चौराहा",
  chouraha: "चौराहा",
  mandir: "मंदिर",
  near: "के पास",
  opp: "के सामने",
  opposite: "के सामने",
  front: "के सामने",
  behind: "के पीछे",
  station: "स्टेशन",
  tehsil: "तहसील",
  district: "जिला",
  pan: "पान",
  mrs: "श्रीमती",
  mr: "श्री",
  shri: "श्री",
  smt: "श्रीमती",
  logistics: "लॉजिस्टिक्स",
  transport: "ट्रांसपोर्ट",
  transporter: "ट्रांसपोर्टर",
  days: "दिन",
  day: "दिन",
  credit: "क्रेडिट",
  years: "वर्ष",
  year: "वर्ष",
  field: "फील्ड",
  sales: "सेल्स",
  self: "स्वयं",
  "self pickup": "स्वयं पिकअप",
  mg: "एमजी",
  ab: "एबी",
  tt: "टीटी",
  mp: "एमपी",
};

const CONSONANTS: Array<[string, string]> = [
  ["shh", "ष"],
  ["ksh", "क्ष"],
  ["gya", "ज्ञ"],
  ["sh", "श"],
  ["ch", "च"],
  ["chh", "छ"],
  ["th", "थ"],
  ["dh", "ध"],
  ["bh", "भ"],
  ["ph", "फ"],
  ["gh", "घ"],
  ["kh", "ख"],
  ["jh", "झ"],
  ["k", "क"],
  ["g", "ग"],
  ["c", "क"],
  ["j", "ज"],
  ["t", "त"],
  ["d", "द"],
  ["n", "न"],
  ["p", "प"],
  ["f", "फ"],
  ["b", "ब"],
  ["m", "म"],
  ["y", "य"],
  ["r", "र"],
  ["l", "ल"],
  ["v", "व"],
  ["w", "व"],
  ["s", "स"],
  ["h", "ह"],
  ["z", "ज़"],
  ["q", "क"],
  ["x", "क्स"],
];

const VOWELS: Array<[string, string, string]> = [
  ["aa", "आ", "ा"],
  ["ee", "ई", "ी"],
  ["oo", "ऊ", "ू"],
  ["ai", "ऐ", "ै"],
  ["au", "औ", "ौ"],
  ["ou", "औ", "ौ"],
  ["a", "अ", ""],
  ["i", "इ", "ि"],
  ["u", "उ", "ु"],
  ["e", "ए", "े"],
  ["o", "ओ", "ो"],
];

function transliterateWordFallback(word: string): string {
  const lower = word.toLowerCase();
  if (!lower) return "";
  if (TOKEN_TRANSLATIONS[lower]) return TOKEN_TRANSLATIONS[lower];
  if (/^\d+$/.test(lower)) return lower;

  let out = "";
  let i = 0;
  while (i < lower.length) {
    const rest = lower.slice(i);
    if (!/[a-z]/.test(rest[0])) {
      out += rest[0];
      i++;
      continue;
    }

    // Vowel at current position
    const vMatch = VOWELS.find(([pat]) => rest.startsWith(pat));
    if (vMatch) {
      if (out.length === 0) {
        out += vMatch[1];
      } else {
        out += vMatch[2] || "ा";
      }
      i += vMatch[0].length;
      continue;
    }

    const cMatch = CONSONANTS.find(([pat]) => rest.startsWith(pat));
    if (cMatch) {
      out += cMatch[1];
      i += cMatch[0].length;
      const after = lower.slice(i);
      const nextVowel = VOWELS.find(([pat]) => after.startsWith(pat));
      if (nextVowel) {
        out += nextVowel[2];
        i += nextVowel[0].length;
      }
      continue;
    }

    out += rest[0];
    i++;
  }
  return out;
}

export function deterministicEnglishToHindi(text: string | null | undefined): string {
  const clean = (text ?? "").trim();
  if (!clean) return "";
  if (/[\u0900-\u097F]/.test(clean)) return clean;

  const exact = EXACT_PHRASE_HINDI[clean.toLowerCase()];
  if (exact) return exact;

  return clean
    .split(/(\s+|[,./()-])/)
    .map((part) => {
      if (!part || /^[\s,./()-]+$/.test(part)) return part;
      const exactToken = TOKEN_TRANSLATIONS[part.toLowerCase()];
      if (exactToken) return exactToken;
      return transliterateWordFallback(part);
    })
    .join("");
}

const hiCache = new Map<string, string>();

async function remoteTransliterate(text: string): Promise<string | null> {
  try {
    const url = `https://inputtools.google.com/request?text=${encodeURIComponent(text)}&itc=hi-t-i0-und&num=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(2200) });
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    if (data?.[0] !== "SUCCESS") return null;
    const entries = data?.[1];
    if (!Array.isArray(entries)) return null;
    const result = entries
      .map((item: any) => (Array.isArray(item?.[1]) && item[1][0] ? String(item[1][0]) : String(item?.[0] ?? "")))
      .join(" ")
      .trim();
    return result && /[\u0900-\u097F]/.test(result) ? result : null;
  } catch {
    return null;
  }
}

async function remoteTranslate(text: string): Promise<string | null> {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=hi&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    const segments = Array.isArray(data?.[0]) ? data[0] : [];
    const translated = segments.map((seg: any) => (Array.isArray(seg) ? seg[0] : "")).join("").trim();
    return translated && /[\u0900-\u097F]/.test(translated) ? translated : null;
  } catch {
    return null;
  }
}

export async function translateTextToHindi(
  text: string | null | undefined,
  mode: "transliterate" | "translate" = "translate"
): Promise<string> {
  const clean = (text ?? "").trim();
  if (!clean) return "";
  if (/[\u0900-\u097F]/.test(clean)) return clean;

  const exact = EXACT_PHRASE_HINDI[clean.toLowerCase()];
  if (exact) return exact;

  const cacheKey = `${mode}:${clean.toLowerCase()}`;
  const cached = hiCache.get(cacheKey);
  if (cached) return cached;

  let resolved: string | null = null;
  if (process.env.NODE_ENV !== "test") {
    resolved =
      mode === "transliterate"
        ? (await remoteTransliterate(clean)) ?? (await remoteTranslate(clean))
        : (await remoteTranslate(clean)) ?? (await remoteTransliterate(clean));
  }
  const finalValue = resolved || deterministicEnglishToHindi(clean);
  if (hiCache.size > 1500) hiCache.clear();
  hiCache.set(cacheKey, finalValue);
  return finalValue;
}

export interface BilingualSourceInput {
  businessName?: string | null;
  groupName?: string | null;
  ownerName?: string | null;
  transporter?: string | null;
  broker?: string | null;
  shopAddress?: string | null;
  addressLine2?: string | null;
  beatName?: string | null;
  deliveryCity?: string | null;
  tehsil?: string | null;
  district?: string | null;
  state?: string | null;
  paymentTerms?: string | null;
  grade?: string | null;
  buyerCategory?: string | null;
  buyerSubCategory?: string | null;
  remark?: string | null;
  salesmanName?: string | null;
  // Optional manual Hindi overrides
  businessNameHi?: string | null;
  transporterHi?: string | null;
  shopAddressHi?: string | null;
  addressLine2Hi?: string | null;
  beatNameHi?: string | null;
  deliveryCityHi?: string | null;
  tehsilHi?: string | null;
  districtHi?: string | null;
  stateHi?: string | null;
}

export async function buildBilingualHindiFields(input: BilingualSourceInput) {
  const pick = async (override: string | null | undefined, english: string | null | undefined, mode: "transliterate" | "translate") => {
    const manual = override?.trim();
    if (manual) return manual;
    return translateTextToHindi(english, mode);
  };

  const [
    businessNameHi,
    transporterHi,
    shopAddressHi,
    addressLine2Hi,
    beatNameHi,
    deliveryCityHi,
    tehsilHi,
    districtHi,
    stateHi,
    groupNameHi,
    ownerNameHi,
    brokerHi,
    paymentTermsHi,
    buyerCategoryHi,
    buyerSubCategoryHi,
    remarkHi,
    salesmanNameHi,
  ] = await Promise.all([
    pick(input.businessNameHi, input.businessName, "transliterate"),
    pick(input.transporterHi, input.transporter, "transliterate"),
    pick(input.shopAddressHi, input.shopAddress, "translate"),
    pick(input.addressLine2Hi, input.addressLine2, "translate"),
    pick(input.beatNameHi, input.beatName, "transliterate"),
    pick(input.deliveryCityHi, input.deliveryCity, "transliterate"),
    pick(input.tehsilHi, input.tehsil, "transliterate"),
    pick(input.districtHi, input.district, "transliterate"),
    pick(input.stateHi, input.state, "translate"),
    translateTextToHindi(input.groupName, "translate"),
    translateTextToHindi(input.ownerName, "transliterate"),
    translateTextToHindi(input.broker, "transliterate"),
    translateTextToHindi(input.paymentTerms, "translate"),
    translateTextToHindi(input.buyerCategory, "translate"),
    translateTextToHindi(input.buyerSubCategory, "translate"),
    translateTextToHindi(input.remark, "translate"),
    translateTextToHindi(input.salesmanName, "transliterate"),
  ]);

  return {
    businessNameHi: businessNameHi || null,
    transporterHi: transporterHi || null,
    shopAddressHi: shopAddressHi || null,
    addressLine2Hi: addressLine2Hi || null,
    beatNameHi: beatNameHi || null,
    deliveryCityHi: deliveryCityHi || null,
    tehsilHi: tehsilHi || null,
    districtHi: districtHi || null,
    stateHi: stateHi || null,
    hindiSnapshot: {
      groupNameHi: groupNameHi || null,
      ownerNameHi: ownerNameHi || null,
      brokerHi: brokerHi || null,
      paymentTermsHi: paymentTermsHi || null,
      gradeHi: input.grade?.trim() || null,
      buyerCategoryHi: buyerCategoryHi || null,
      buyerSubCategoryHi: buyerSubCategoryHi || null,
      remarkHi: remarkHi || null,
      salesmanNameHi: salesmanNameHi || null,
    },
  };
}
