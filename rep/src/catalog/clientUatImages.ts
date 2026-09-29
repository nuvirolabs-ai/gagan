export const CLIENT_UAT_IMAGE_HOST = "https://gagan-client-uat-api.onrender.com";

export function normalizeClientUatImagePart(value: string | number) {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function clientUatImageKey(name: string, unitSize: string, unitsPerCase: number) {
  return `${normalizeClientUatImagePart(name)}|${normalizeClientUatImagePart(unitSize)}|${Number(unitsPerCase || 0)}`;
}

// Generated from the current Client UAT source rows joined to the historical
// manifest by source row, pack size, and case conversion. Only unambiguous
// historical matches are included; missing or ambiguous rows use the product fallback.
const CLIENT_UAT_IMAGE_MAP: Record<string, string> = {
  "GAGAN BASMATI RICE BROKEN|30 KG|1": "https://gagan-client-uat-api.onrender.com/catalog-images/real/02231e3b302d337360ec2267a0651f8b3592c8c5a2374ca06f1b8521c3d5f84b.jpg",
  "GAGAN BASMATI RICE CHOICE|30 KG|1": "https://gagan-client-uat-api.onrender.com/catalog-images/real/6986bb1ebc542536524718be661a0a6a2fce3362cd7d5de3494298f74ce1e820.jpg",
  "GAGAN BASMATI RICE CLASSIC|10 KG|4": "https://gagan-client-uat-api.onrender.com/catalog-images/real/f682c314a576296a64b08cfda50d2dfad0b4805e65432324652f4fb9289d58f1.jpg",
  "GAGAN BASMATI RICE CLASSIC|30 KG|1": "https://gagan-client-uat-api.onrender.com/catalog-images/real/a667124b440dc8dbda60a6e6a6b39902bdf280c0c1e08b1f2fbf02a365a38302.jpg",
  "GAGAN BASMATI RICE CLASSIC|5 KG|4": "https://gagan-client-uat-api.onrender.com/catalog-images/real/32f10132475d9334a9348831bdd6581692b2e8c6efe66f06aea4cfadcae95e72.jpg",
  "GAGAN BASMATI RICE EXCELLENT|10 KG|4": "https://gagan-client-uat-api.onrender.com/catalog-images/real/e6a5be6d1aeb00c9feb3e792984f4baed74fcc81f2683d4ec4717e85a5afa893.jpg",
  "GAGAN BASMATI RICE EXCELLENT|30 KG|1": "https://gagan-client-uat-api.onrender.com/catalog-images/real/f200ae837c0369ea38d9144aabf5f6f9509ea1a2c6ec5322e5dac940bc797b91.jpg",
  "GAGAN BASMATI RICE EXCELLENT|5 KG|4": "https://gagan-client-uat-api.onrender.com/catalog-images/real/fb415e8a10496c88d0cab5d1c2bccef15245eaa93fbbbacc9e2fcf78394e7696.jpg",
  "GAGAN BASMATI RICE PREMIUM|30 KG|1": "https://gagan-client-uat-api.onrender.com/catalog-images/real/ba454310e612a4b8b761e28f18afdbf087966e693b76b3f5a301723fbd2afb72.jpg",
  "GAGAN BASMATI RICE REGULAR|30 KG|1": "https://gagan-client-uat-api.onrender.com/catalog-images/real/9431426f81359e45af2a791956b83e82c1f7f05680e441bd484617fd5843707b.jpg",
  "GAGAN BASMATI RICE ROZANA|10 KG|4": "https://gagan-client-uat-api.onrender.com/catalog-images/real/5276199c619107ea86179da2e297fc290e29f1e6251cd7d3a44a4f9106884fb6.jpg",
  "GAGAN BASMATI RICE ROZANA|30 KG|1": "https://gagan-client-uat-api.onrender.com/catalog-images/real/9160161df7d963295aac224961a4dcfb685dc0cdedc0a39be2a63d15bca731f4.jpg",
  "GAGAN BASMATI RICE ROZANA|5 KG|4": "https://gagan-client-uat-api.onrender.com/catalog-images/real/66427feb81cd4a9cdb2c69f9e096344cf415547f576f6d2973929727bb6ae230.jpg",
  "GAGAN BASMATI RICE SELECT|10 KG|4": "https://gagan-client-uat-api.onrender.com/catalog-images/real/a8d791dc48e1de04e289e18a168b7573f75f01f9b59193d6d280af177fc09611.jpg",
  "GAGAN BASMATI RICE SELECT|30 KG|1": "https://gagan-client-uat-api.onrender.com/catalog-images/real/562de73d616384b084b22bc68f7bd0bcee03c9dd389b8aad78dce3d2cd7c3154.jpg",
  "GAGAN BASMATI RICE SELECT|5 KG|4": "https://gagan-client-uat-api.onrender.com/catalog-images/real/7fc553f8d04897225035690e6a955e3c17cc5d29f89e470b5ccc4cfec5503312.jpg",
  "GAGAN BASMATI RICE SUPER|30 KG|1": "https://gagan-client-uat-api.onrender.com/catalog-images/real/b333abec0be1339d3a5568003a29a5645ce1566e525233c8069583df7c717e77.jpg",
  "GAGAN BASMATI RICE SUPREME|10 KG|4": "https://gagan-client-uat-api.onrender.com/catalog-images/real/de3389cdcad81d7438de03f4fc7678d389a6ef581b940f602956edd31569390b.jpg",
  "GAGAN BASMATI RICE SUPREME|30 KG|1": "https://gagan-client-uat-api.onrender.com/catalog-images/real/5852d46bbfef7e77ecbf1adebdf1cdbbef47497c6e0d557f0dde71df56b6f2a1.jpg",
  "GAGAN BASMATI RICE SUPREME|5 KG|4": "https://gagan-client-uat-api.onrender.com/catalog-images/real/3d450edb9dd9c87ccbe85ce183366c594ea5b8af02782cab3b273d1854427b46.jpg",
  "GAGAN LITE CHANA|30 KG|1": "https://gagan-client-uat-api.onrender.com/catalog-images/real/5142dbc86fef7844410565e2de5fbd59bc90751c634c243a5e5d653781f62cb1.jpg",
  "GAGAN LITE MOONG|30 KG|1": "https://gagan-client-uat-api.onrender.com/catalog-images/real/4d7f7f212ee8e5630b0b5554e485d3d14c6d87a5676c447f95852f2c164b5c5f.jpg",
  "GAGAN LITE URAD|30 KG|1": "https://gagan-client-uat-api.onrender.com/catalog-images/real/e66d43225b783f94417cdbea41719e6561bac4bb04b8095ab7e98bea3d9a2f1d.jpg",
  "GAGAN TOOR DAL|1 KG|30": "https://gagan-client-uat-api.onrender.com/catalog-images/real/9c31a2091770a1c75ef53d180ed7426fcf79b7cca832973c888ae5915bb761a9.jpg",
  "GAGAN TOOR DAL|30 KG|1": "https://gagan-client-uat-api.onrender.com/catalog-images/real/6a41827096499accb29beb4d9dfe78daee0abeb9710099e6077089bf09607b97.jpg",
  "GAGAN TOOR DAL|5 KG|6": "https://gagan-client-uat-api.onrender.com/catalog-images/real/0e4bbca5e1e21210f914a589fccdc2d888c060985e1d2e2b2b67108b73504192.jpg",
  "LPP TOOR DAL|1 KG|30": "https://gagan-client-uat-api.onrender.com/catalog-images/real/915fbc612b0b708b9b729583ed176d0b1eda61b982ff3412adeef4a490b3b6a8.jpg",
  "LPP TOOR DAL|30 KG|1": "https://gagan-client-uat-api.onrender.com/catalog-images/real/47c6b982b6a1218c6ddb266333ce677950ff1bca15fb740fe6db107f610ab406.jpg",
  "NEEL GAGAN CHANA DAL|30 KG|1": "https://gagan-client-uat-api.onrender.com/catalog-images/real/f37c4388f7b9f9504465fb10fdb80cc0a5cda791edb4d0ac055e07d2da2d3f89.jpg",
  "NEEL GAGAN KABULI CHANA|30 KG|1": "https://gagan-client-uat-api.onrender.com/catalog-images/real/e286b520df0de2692f1d71691d5f13859d347fa920f87f3574df7c812c575a5d.jpg",
  "NEEL GAGAN LAL CHANA|30 KG|1": "https://gagan-client-uat-api.onrender.com/catalog-images/real/fd2a21905018938355fa25eb46c78fa771af2e92f0971c4e56189561cce7b24b.jpg",
  "NEEL GAGAN MASOOR DAL|30 KG|1": "https://gagan-client-uat-api.onrender.com/catalog-images/real/9116b615447e3932b3749ace2c4db8ac77ca6a98382546db989e64776891a15a.jpg",
  "NEEL GAGAN MASOOR WHOLE|30 KG|1": "https://gagan-client-uat-api.onrender.com/catalog-images/real/6010fa8e5743e2dd2fca1103434eb6674eb9bca5787b9ec7e0daf66013badfbd.jpg",
  "NEEL GAGAN MOTH|30 KG|1": "https://gagan-client-uat-api.onrender.com/catalog-images/real/e07b690239af24ab3366632ce47d47d69d0e761984a8ce9d0a9bae3abd9ef2db.jpg",
  "NEEL GAGAN MUNG DAL CHILKA|30 KG|1": "https://gagan-client-uat-api.onrender.com/catalog-images/real/e1c3acce4d0e4e4bcf313adf455a1a532f1e8d7cf2bceae025b7c562ca89a875.jpg",
  "NEEL GAGAN MUNG WHOLE|30 KG|1": "https://gagan-client-uat-api.onrender.com/catalog-images/real/7cffa46a3cec5bba30e45fd02cfc5a45a1c6f4fa7120bed1f3cce7303e315ce0.jpg",
  "NEEL GAGAN RAJMA CHITRA|30 KG|1": "https://gagan-client-uat-api.onrender.com/catalog-images/real/fc7b151e5e427e6bed2fa2c5b603c9aa6f6c4fc349848b83e2e043a531590b0d.jpg",
  "NEEL GAGAN RAJMA LAL|30 KG|1": "https://gagan-client-uat-api.onrender.com/catalog-images/real/807e8ceb38a85431cef557c7cc131cfb0e20b02ab0fd7ab54c1eea12634e1ac8.jpg",
  "NEEL GAGAN URAD MOGAR DAL|30 KG|1": "https://gagan-client-uat-api.onrender.com/catalog-images/real/0a8307b2c0031235850351e866cdec67d8089e3117b3e51861d1bae82e3ab669.jpg",
  "SEHMAT DAHIVADA MIX FLOUR|500 GM|60": "https://gagan-client-uat-api.onrender.com/catalog-images/real/24819208c37690e1f89f76027f035d250653522b00e9e0c0ae9cc6303abff43a.jpg",
  "SEHMAT DOSA MIX FLOUR|400 GM|75": "https://gagan-client-uat-api.onrender.com/catalog-images/real/6cc465117077ec7230914f7fd55945c42fb3852ac914ff47dbb421612c20e679.jpg",
  "SEHMAT G11 BASMATI RICE|30 KG|1": "https://gagan-client-uat-api.onrender.com/catalog-images/real/de19f250eb9d5c96ba3ae973e5c6f609f7be2901a388cf7ec4bd0ab14ef48a8f.jpg",
  "SEHMAT G21 BASMATI RICE|30 KG|1": "https://gagan-client-uat-api.onrender.com/catalog-images/real/6d206958c53ff8fb010afe096fe2b4b06552e965b3b221b15d8a70877a05534c.jpg",
  "SEHMAT G31 BASMATI RICE|30 KG|1": "https://gagan-client-uat-api.onrender.com/catalog-images/real/568b4bdca50e981478ef6151ecd95f88ac0d2d312c04687915603852dd305b26.jpg",
  "SEHMAT G41 BASMATI RICE|30 KG|1": "https://gagan-client-uat-api.onrender.com/catalog-images/real/b660ebaa5399a7c55f842630ce7ed878911a2aded6338f97d481f92df06a98ae.jpg",
  "SEHMAT G51 BASMATI RICE|30 KG|1": "https://gagan-client-uat-api.onrender.com/catalog-images/real/f429cca02881590b7b4c639f0136be955b6ff72f6e374ddc2e70bd76042361da.jpg",
  "SEHMAT G61 BASMATI RICE|30 KG|1": "https://gagan-client-uat-api.onrender.com/catalog-images/real/6813b24c7629a6e9c18ad9eba36654c9c0c9ac633af5e3a3ecf992bb69dcad29.jpg",
  "SEHMAT GOLD POHA|35 KG|1": "https://gagan-client-uat-api.onrender.com/catalog-images/real/f6860bdd651fdb8af3479af70abb9dc5002f190d864c1d234127126e02f80112.jpg",
  "SEHMAT GOLD POHA|500 GM|60": "https://gagan-client-uat-api.onrender.com/catalog-images/real/45eabfdce8b7cf4b20634fa0f25cf87131924822728fed0d0b6009ed62a9f7cc.jpg",
  "SEHMAT IDLI MIX FLOUR|400 GM|75": "https://gagan-client-uat-api.onrender.com/catalog-images/real/414f571010614e17a37e56f7b1e1369f081a33489c1bdf092e37da3b35b957e7.jpg",
  "SEHMAT KHAMAN MIX FLOUR|400 GM|75": "https://gagan-client-uat-api.onrender.com/catalog-images/real/8bad6ed3fc837ee549b59bd5f3a50787becb019a0c545d4c2824d94e10be1f24.jpg",
  "SEHMAT MUNGDAL BHAJIYA MIX|500 GM|60": "https://gagan-client-uat-api.onrender.com/catalog-images/real/a343893ab6ef05ca8f035487f501a27e118264796c7626e71166c49ed210e2e8.jpg",
  "SEHMAT POHA|500 GM|60": "https://gagan-client-uat-api.onrender.com/catalog-images/real/e5665b9329870f9a8717c348600a79a6c8cec024ee204d9ee00e2f1d6f64dbac.jpg",
  "SEHMAT SABUDANA|1 KG|30": "https://gagan-client-uat-api.onrender.com/catalog-images/real/194ea2534b58dfb4f2b19b9d5c3a525ba90d7ebff2f5a230fb5bd9cccf45ad97.jpg",
  "SEHMAT SABUDANA|30 KG|1": "https://gagan-client-uat-api.onrender.com/catalog-images/real/e31a28a29799bb1c161fe12f15b39e88a46de7c17badc144b223b8c2039c4934.jpg",
  "SEHMAT SABUDANA|500 GM|60": "https://gagan-client-uat-api.onrender.com/catalog-images/real/bdb0c714b53031a5713393da605846d8c5a2f1586d67428667c73839d0dc1cb1.jpg",
  "SEHMAT UTTAPAM MIX FLOUR|400 GM|75": "https://gagan-client-uat-api.onrender.com/catalog-images/real/6eb1709651c3c1e0ae35b7095c1744c04a13ebe400d477c5aed4b8d006935035.jpg",
};

export const CLIENT_UAT_IMAGE_AUDIT = {
  totalSkus: 87,
  uatMappedImages: 57,
  ambiguous: 11,
  missing: 19,
} as const;

export function clientUatImageFor(name: string, unitSize: string, unitsPerCase: number) {
  return CLIENT_UAT_IMAGE_MAP[clientUatImageKey(name, unitSize, unitsPerCase)] ?? null;
}
