// De paletten. Het model draagt per vlak alleen een vaknummer (baksteen_rood, dak_lei, ...) en een toon (in de
// zon of ervan af); welke kleur daarbij hoort, staat hier. Zo wisselt de tekening van inkleuring zonder dat
// het model opnieuw uit Blender hoeft.
//
// Per vak: [kleur in de zon, kleur in de schaduw]. Eén kleur: de schaduw wordt daar 11% donkerder en iets
// koeler van, zoals in de platen waar de eigenaar op wees (een schaduwgevel is daar maar net donkerder).

const helder = {
  naam: 'Helder',
  lucht: '#a8d6f0', inkt: '#14110f', papier: '#f6f2e7', wolk: '#ffffff', schaduwvlek: 0.14, lijn: 1.0, wolkvorm: 'stapel',
  vakken: {
    onbekend: '#d8cdb8', ondergrond: '#8fba58', straat: '#b08a7c', stoep: '#c9c3b4', erf: '#c2ab95', parkeervak: '#a9988f',
    grind: '#e3d3ab', tuinpad: '#d5c4a3', markering: '#f4f1e8', gazon: '#8fba58', border: '#6f9a4a', berm: '#86b052',
    haag: ['#4f8a45', '#3b6f3a'], bloem: '#d9668a', kei: ['#a9a59b', '#8d897f'],
    baksteen_rood: ['#c36a52', '#ad5b46'], baksteen_bruin: ['#b0624a', '#9b5440'], baksteen_geel: ['#d3a878', '#bd946a'],
    pleister: ['#eee6d4', '#d6cebd'], kalkwit: ['#f6f2e8', '#dcd7cc'], zwarthout: ['#3e4a44', '#313b37'],
    dak_lei: ['#5f6a72', '#4c565e'], dak_grijs: ['#6c625c', '#584f4a'], dak_oranje: ['#c56c44', '#ad5c3a'],
    dak_riet: ['#a5925f', '#8c7b50'], dak_antraciet: ['#4a4644', '#3a3736'], dak_grind: ['#b7ae9d', '#9f9788'],
    dak_terracotta: ['#b65c40', '#9e4f37'], dak_bruinrood: ['#684a40', '#573d35'], dak_koper: ['#6f9a86', '#5c8271'],
    ruit_donker: ['#4d626f', '#415461'], ruit_licht: ['#6f8c9a', '#5f7a88'], raamlicht: '#f1cf6a',
    kozijn_wit: ['#f7f3e9', '#ddd8cc'], kozijn_zwart: ['#2f3d37', '#26322d'], deur: ['#3b5249', '#30443c'],
    luik: ['#44624f', '#385242'], overkapping: ['#ddd5c2', '#c5bdab'], luifel: ['#e9e0c8', '#d0c8b2'], luifel_groen: ['#4f7a5a', '#41664b'],
    hout: ['#a77a52', '#8f6845'], zwart: '#26221f', geel: '#e8b62c', blauw: '#2f6db3', wit: '#fbf8ef', metaal: '#9aa0a2',
    meubel_groen: '#4f7a5a', autolak: '#8d2f33', autoraam: '#b9d3e0', autowiel: '#26221f',
    stam: ['#8a6f55', '#735c46'], blad_a: ['#6aa343', '#4c8236'], blad_b: ['#7bb04a', '#5a8f3b'], blad_c: ['#5c963d', '#427530'],
    figuur: '#d9a37a', rood: '#c6382e', glans: '#d6e8f0', bos: ['#4f8a45', '#3b6f3a'], porsche: ['#2f6db3', '#255a96'],
    zink: ['#8f989c', '#79828a'], paneel: ['#34475a', '#2a3a4a'], g_wit: ['#f3efe4', '#d9d5ca'], g_licht: ['#cfc9bb', '#b7b1a4'],
    g_grijs: ['#8c887d', '#76726a'], g_donker: ['#3a3633', '#2e2b29'], g_bruin: ['#9a7250', '#836044'], g_rood: ['#c6382e', '#a92f27'],
    g_groen: ['#4f7a5a', '#41664b'], g_blauw: ['#2f6db3', '#285c98'], g_geel: ['#e8b62c', '#c99c25'],
  },
};

// Naar de gedempte, warme inkleuring van de straatplaat van Van Dongen: alles onder één okergeel licht.
const warm = {
  naam: 'Warm',
  lucht: '#e2cf96', inkt: '#1a1512', papier: '#f3ead2', wolk: '#efe2b6', schaduwvlek: 0.16, lijn: 0.82, wolkvorm: 'band',
  vakken: {
    onbekend: '#cdbd98', ondergrond: '#9a9a5a', straat: '#b3915f', stoep: '#d9c898', erf: '#c7ae7c', parkeervak: '#a98b5f',
    grind: '#dcc88f', tuinpad: '#cfb983', markering: '#efe6c6', gazon: '#9a9a5a', border: '#7f8a4a', berm: '#93984f',
    haag: ['#6f8748', '#58703c'], bloem: '#c9705a', kei: ['#b3a98a', '#998f74'],
    baksteen_rood: ['#a9573c', '#944b34'], baksteen_bruin: ['#9a5a3e', '#864d35'], baksteen_geel: ['#c79a5e', '#b08650'],
    pleister: ['#e6d8ae', '#cfc19a'], kalkwit: ['#efe4c2', '#d6ccac'], zwarthout: ['#4a4a3a', '#3c3c2f'],
    dak_lei: ['#6c755f', '#596150'], dak_grijs: ['#7a6f58', '#665c49'], dak_oranje: ['#b9683a', '#a25a32'],
    dak_riet: ['#a08a52', '#8a7646'], dak_antraciet: ['#55503f', '#454133'], dak_grind: ['#b5a784', '#9d9072'],
    dak_terracotta: ['#a95a38', '#934d30'], dak_bruinrood: ['#6f4a36', '#5d3e2d'], dak_koper: ['#7d946a', '#6a7f5a'],
    ruit_donker: ['#5f6a55', '#4f5947'], ruit_licht: ['#a9ad88', '#929675'], raamlicht: '#efc95a',
    kozijn_wit: ['#f1e6c4', '#d8ceae'], kozijn_zwart: ['#35382b', '#2a2d22'], deur: ['#3f4f3a', '#33412f'],
    luik: ['#4f6044', '#415038'], overkapping: ['#d9cba0', '#c1b48d'], luifel: ['#e3d6aa', '#cbbf96'], luifel_groen: ['#5a7048', '#4a5d3b'],
    hout: ['#9a7446', '#84623b'], zwart: '#2a241c', geel: '#d9a92e', blauw: '#4f6f7a', wit: '#f3e9c9', metaal: '#9a977c',
    meubel_groen: '#5a7048', autolak: '#7a2c2c', autoraam: '#c3c39a', autowiel: '#2a241c',
    stam: ['#8a6c48', '#74593b'], blad_a: ['#7a9248', '#61783a'], blad_b: ['#889a4e', '#6d7f3f'], blad_c: ['#6c8742', '#566e35'],
    figuur: '#cf9f6f', rood: '#b23a2c', glans: '#d6d6b0', bos: ['#6a7f44', '#566a38'], porsche: ['#7a2c2c', '#652424'],
    zink: ['#8f8c72', '#79775f'], paneel: ['#4a4f45', '#3c4038'], g_wit: ['#efe4c2', '#d6ccac'], g_licht: ['#cdbd98', '#b5a684'],
    g_grijs: ['#8f8568', '#797057'], g_donker: ['#3a342a', '#2e2a22'], g_bruin: ['#8f6a40', '#795936'], g_rood: ['#b23a2c', '#983125'],
    g_groen: ['#5a7048', '#4a5d3b'], g_blauw: ['#4f6f7a', '#425d67'], g_geel: ['#d9a92e', '#bb9127'],
  },
};

// Naar de frisse inkleuring van Chaland: veel wit en grijs, de kleur zit in een paar vlakken.
const fris = {
  naam: 'Fris',
  lucht: '#9fc4e3', inkt: '#111111', papier: '#f7f5ee', wolk: '#ffffff', schaduwvlek: 0.13, lijn: 1.12, wolkvorm: 'band',
  vakken: {
    onbekend: '#e2ded3', ondergrond: '#b9c9a1', straat: '#cfcabe', stoep: '#e6e2d8', erf: '#d6d1c5', parkeervak: '#c4c0b5',
    grind: '#e6dfcc', tuinpad: '#ddd6c4', markering: '#fbfaf5', gazon: '#a9c58a', border: '#8fb074', berm: '#a2bf84',
    haag: ['#6f9a66', '#59815a'], bloem: '#d8543c', kei: ['#bdbab2', '#a3a099'],
    baksteen_rood: ['#d28c6f', '#b9785f'], baksteen_bruin: ['#c59a80', '#ad866f'], baksteen_geel: ['#e6cfa4', '#cdb790'],
    pleister: ['#f4f1e8', '#d5d2c9'], kalkwit: ['#fbfaf5', '#dcdad3'], zwarthout: ['#3a3f45', '#2e3237'],
    dak_lei: ['#7c8792', '#67727c'], dak_grijs: ['#8b8780', '#75716b'], dak_oranje: ['#dd7a3c', '#c26933'],
    dak_riet: ['#b9a773', '#a08f62'], dak_antraciet: ['#55595e', '#45484d'], dak_grind: ['#c9c5bb', '#b0ada4'],
    dak_terracotta: ['#cf6a44', '#b55b3a'], dak_bruinrood: ['#8a5a4a', '#754b3d'], dak_koper: ['#7fae9c', '#6a9484'],
    ruit_donker: ['#3c4f60', '#30404f'], ruit_licht: ['#a9c4d6', '#90abbd'], raamlicht: '#f3d15a',
    kozijn_wit: ['#fbfaf5', '#dcdad3'], kozijn_zwart: ['#22262b', '#1a1d21'], deur: ['#2c4a6a', '#243d58'],
    luik: ['#c8372d', '#a92e26'], overkapping: ['#e6e2d8', '#cdc9c0'], luifel: ['#f1ede2', '#d6d2c8'], luifel_groen: ['#3f7d5a', '#34684b'],
    hout: ['#b38a5a', '#9a764c'], zwart: '#161616', geel: '#f0b32a', blauw: '#2f6db3', wit: '#fbfaf5', metaal: '#a4a9ad',
    meubel_groen: '#3f7d5a', autolak: '#e09a22', autoraam: '#c6dbe8', autowiel: '#161616',
    stam: ['#8f7a66', '#786656'], blad_a: ['#6fa85a', '#57894a'], blad_b: ['#82b565', '#689552'], blad_c: ['#5f9a54', '#4a7c44'],
    figuur: '#e0b08a', rood: '#c8372d', glans: '#e4eef5', bos: ['#5f8f5a', '#4c7549'], porsche: ['#e09a22', '#c4861c'],
    zink: ['#a4a9ad', '#8c9196'], paneel: ['#2c3e55', '#233246'], g_wit: ['#fbfaf5', '#dcdad3'], g_licht: ['#dedbd2', '#c3c0b8'],
    g_grijs: ['#9a9790', '#83807a'], g_donker: ['#2a2c30', '#202226'], g_bruin: ['#a8825c', '#906f4e'], g_rood: ['#c8372d', '#a92e26'],
    g_groen: ['#3f7d5a', '#34684b'], g_blauw: ['#2f6db3', '#285c98'], g_geel: ['#f0b32a', '#cf9a24'],
  },
};

// Naar de tekening die Gemini van de parkeerplaats maakte (voorbeeld/gemini-parkeerplaats.jpg) en die de eigenaar
// "al veel beter" vond dan ons model. De kleuren zijn in dat plaatje gemeten. Het verschil met "Helder" is niet
// de tint maar de toon: een derde van het beeld is donker (bomen 0,38 helder, leien dak 0,26 tot 0,37, haag
// 0,30) tegen een lichte lucht en stoep, en het groen is olijf in plaats van fel.
const gedempt = {
  naam: 'Gedempt',
  lucht: '#a7cbde', inkt: '#0e0908', papier: '#f3ede2', wolk: '#f7f0e9', wolkgrijs: '#93a9b8', schaduwvlek: 0.14, lijn: 1.18, wolkvorm: 'gouache',
  vakken: {
    onbekend: '#c9bfae', ondergrond: '#7f9844', straat: '#995f59', stoep: '#b2a59a', erf: '#a8766a', parkeervak: '#8b5a56',
    grind: '#cdbf9f', tuinpad: '#bfb096', markering: '#ebe5d8', gazon: '#839d42', border: '#5f7a35', berm: '#7c963f',
    haag: ['#4d5a2c', '#3a4521'], bloem: '#b5546a', kei: ['#8a7c72', '#73645b'],
    baksteen_rood: ['#c07657', '#a5624a'], baksteen_bruin: ['#96604b', '#7e4e3e'], baksteen_geel: ['#cfa878', '#b7926a'],
    pleister: ['#e9e1d0', '#cfc8b8'], kalkwit: ['#f1ebdf', '#d6d0c5'], zwarthout: ['#3a4040', '#2b3030'],
    dak_lei: ['#4e555f', '#353a45'], dak_grijs: ['#7c6a5d', '#65564a'], dak_oranje: ['#b9683f', '#9d5735'],
    dak_riet: ['#9a8757', '#806f47'], dak_antraciet: ['#454b54', '#30343d'], dak_grind: ['#aaa193', '#928a7d'],
    dak_terracotta: ['#a8573c', '#8f4a33'], dak_bruinrood: ['#5d4840', '#473530'], dak_koper: ['#6a8a78', '#577364'],
    ruit_donker: ['#56666d', '#45535a'], ruit_licht: ['#798a91', '#66767c'], raamlicht: '#f1cf6a',
    kozijn_wit: ['#f3eee3', '#d8d3c8'], kozijn_zwart: ['#262b2b', '#1c2020'], deur: ['#34443f', '#293632'],
    luik: ['#3f5a45', '#314737'], overkapping: ['#d6cdb9', '#bdb4a2'], luifel: ['#e6dcc4', '#ccc3ad'], luifel_groen: ['#48684f', '#3a5540'],
    hout: ['#9a744e', '#836241'], zwart: '#1c1917', geel: '#d9a92e', blauw: '#2f5f9a', wit: '#f5f0e6', metaal: '#949488',
    meubel_groen: '#48684f', autolak: '#443849', autoraam: '#9fb3bd', autowiel: '#1c1917',
    stam: ['#6f5c49', '#5a493a'], blad_a: ['#8b934c', '#6c753a'], blad_b: ['#65824a', '#4d6539'], blad_c: ['#536c3e', '#3e532e'],
    figuur: '#d9a98a', rood: '#b23a30', glans: '#c4d4dc', bos: ['#556c42', '#425533'], porsche: ['#862c32', '#682127'],
    zink: ['#8b9197', '#74797f'], paneel: ['#34424f', '#293540'], g_wit: ['#ede7db', '#d3cdc2'], g_licht: ['#c5bdae', '#ada597'],
    g_grijs: ['#85807a', '#6f6b66'], g_donker: ['#33302d', '#272523'], g_bruin: ['#bd9766', '#a17f55'], g_rood: ['#a84236', '#8d372d'],
    g_groen: ['#445458', '#374548'], g_blauw: ['#3f5778', '#334863'], g_geel: ['#cfa23c', '#b08931'],
  },
};

// Naar de twee Kuifje / Hergé-platen (herfstregen & auto-achtervolging): vuuroranje/goudgele herfstbomen,
// koele blauwgrijze natte klinkers, heldere zandsteen-gevels, sprekende bordeaux-paarse lak en strakke inkt.
const kuifje = {
  naam: 'Kuifje',
  lucht: '#d5e4ee', inkt: '#100e0c', papier: '#f6f2e6', wolk: '#ffffff', schaduwvlek: 0.13, lijn: 1.22, wolkvorm: 'stapel',
  vakken: {
    onbekend: '#dfd5c0', ondergrond: '#8c9c4a', straat: '#92a1b5', stoep: '#dcd7c9', erf: '#c9bba3', parkeervak: '#8595aa',
    grind: '#e2d7bc', tuinpad: '#d8ceb6', markering: '#faf8f0', gazon: '#84a348', border: '#7a7038', berm: '#7f9a44',
    haag: ['#6b7b34', '#505e26'], bloem: '#d94836', kei: ['#a8a69e', '#88867f'],
    baksteen_rood: ['#c96045', '#ab4e36'], baksteen_bruin: ['#b26546', '#945238'], baksteen_geel: ['#e4bf7c', '#c7a262'],
    pleister: ['#f3e7cb', '#d8ccb0'], kalkwit: ['#faf6eb', '#dedad0'], zwarthout: ['#31393e', '#23292d'],
    dak_lei: ['#54687a', '#3d4d5c'], dak_grijs: ['#70757c', '#585d63'], dak_oranje: ['#d96d38', '#b8582a'],
    dak_riet: ['#b89b5a', '#998048'], dak_antraciet: ['#454c54', '#31373e'], dak_grind: ['#bfb9ab', '#a29c90'],
    dak_terracotta: ['#c95d3c', '#a84b2f'], dak_bruinrood: ['#784b3e', '#5e3a2f'], dak_koper: ['#6c9b8b', '#567f71'],
    ruit_donker: ['#486274', '#374c5c'], ruit_licht: ['#9ec2d8', '#80a4ba'], raamlicht: '#f8d868',
    kozijn_wit: ['#faf6eb', '#dedad0'], kozijn_zwart: ['#22272a', '#161a1d'], deur: ['#2f566c', '#234254'],
    luik: ['#c43b2c', '#9e2e22'], overkapping: ['#e8dfc8', '#cbc2ac'], luifel: ['#f2ead6', '#d6ceb9'], luifel_groen: ['#3d7a5e', '#2e6049'],
    hout: ['#b07f4c', '#92673b'], zwart: '#1a1715', geel: '#f0bc2e', blauw: '#3674b8', wit: '#fbf9f2', metaal: '#b4bcc2',
    meubel_groen: '#3d7a5e', autolak: '#2f8c7a', autoraam: '#c8e0ee', autowiel: '#181614',
    stam: ['#6f523a', '#543c2a'],
    blad_a: ['#eab634', '#c99120'],
    blad_b: ['#df6a26', '#b84c18'],
    blad_c: ['#c23b26', '#96291a'],
    figuur: '#e5b088', rood: '#d43628', glans: '#e6f2fa', bos: ['#9e7d34', '#7a5f24'], porsche: ['#7d2948', '#541830'],
    zink: ['#9ba4ab', '#808990'], paneel: ['#31475c', '#233547'], g_wit: ['#faf6eb', '#dedad0'], g_licht: ['#d8d2c3', '#bcb6a8'],
    g_grijs: ['#8e8c84', '#74726c'], g_donker: ['#2b2a29', '#1e1d1c'], g_bruin: ['#c48a4c', '#a36f3a'], g_rood: ['#d43628', '#b02a1f'],
    g_groen: ['#3d7a5e', '#2e6049'], g_blauw: ['#3674b8', '#295d96'], g_geel: ['#f0bc2e', '#cca024'],
  },
};

export const STIJLEN = { kuifje, gedempt, helder, warm, fris };

const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

// De kleuren van een stijl als rij getallen in de volgorde van de vakken uit model.json: per vak zon, schaduw.
export function paletRij(stijl, vakken) {
  const rij = new Float32Array(vakken.length * 6);
  vakken.forEach((naam, i) => {
    const k = stijl.vakken[naam] ?? stijl.vakken.onbekend;
    const zon = hex(Array.isArray(k) ? k[0] : k);
    const schaduw = Array.isArray(k) ? hex(k[1]) : [zon[0] * 0.88, zon[1] * 0.885, zon[2] * 0.905];
    rij.set(zon, i * 6);
    rij.set(schaduw, i * 6 + 3);
  });
  return rij;
}
