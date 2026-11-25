// Het licht. Een inkleuring (stijlen.js) zegt welke kleur een vlak heeft; een stemming zegt onder welk licht
// het staat. De platen waar de eigenaar op wees hebben elk één tijdstip: alles valt onder één kleur licht, de
// schaduw heeft een eigen kleur (geen grijs), de verte zakt weg in de lucht, en 's avonds brandt er licht.
//
//   zon       [kompasrichting, hoogte] in graden: waar het licht vandaan komt (bepaalt de slagschaduw)
//   licht     waarmee de kleur van een vlak in het licht wordt vermenigvuldigd
//   schaduw   waarmee de kleur van een vlak in de schaduw wordt vermenigvuldigd
//   lucht     drie vlakke banden: laag (aan de horizon), midden, hoog; `band` is waar ze in elkaar overgaan
//             (sinus van de hoogte), `wolk` hoe grillig die grens is
//   nevel     de kleur waarin de verte wegzakt, vanaf en tot welke afstand in meters, en hoeveel
//   brandt    of ramen en lantaarns licht geven

export const STEMMINGEN = {
  herfst: {
    naam: 'Herfst', zon: [224, 34], licht: [1.02, 1.0, 0.96], schaduw: [0.76, 0.80, 0.89],
    lucht: { laag: '#edf2f4', midden: '#dce6ec', hoog: '#c7d8e4', band: [0.05, 0.16], wolk: 0.45 },
    nevel: { kleur: '#dce6ec', van: 120, tot: 480, max: 0.52 }, brandt: false, wolken: true, plassen: 0.0, nat: 1.0, regen: 1.0,
  },
  middag: {
    naam: 'Middag', zon: [215, 42], licht: [1, 1, 1], schaduw: [0.78, 0.80, 0.88],
    lucht: { laag: null, midden: null, hoog: null, band: [0.03, 0.08], wolk: 0.0 },
    nevel: { kleur: null, van: 150, tot: 560, max: 0.5 }, brandt: false, wolken: true, plassen: 0.0, nat: 0.0, regen: 0.0,
  },
  // Een lage zon uit het westen: lange schaduwen over de straat, warm licht, de schaduw paarsblauw.
  avond: {
    naam: 'Avond', zon: [258, 15], licht: [1.07, 0.97, 0.80], schaduw: [0.64, 0.61, 0.75],
    lucht: { laag: '#f8e2a6', midden: '#f0cfa2', hoog: '#b4cdd6', band: [0.04, 0.125], wolk: 0.65 },
    nevel: { kleur: '#f1deb0', van: 90, tot: 430, max: 0.58 }, brandt: false, wolken: false, plassen: 0.0, nat: 0.0, regen: 0.0,
  },
  // De zon is bijna onder (AIVD Werf-sfeer): petrol-blauwgroen, gloeiende abrikoosband, warm licht op de stoep & plassen!
  schemer: {
    naam: 'Schemer', zon: [286, 5], licht: [1.02, 0.74, 0.48], schaduw: [0.34, 0.48, 0.51],
    lucht: { laag: '#f6b765', midden: '#ec9545', hoog: '#2e5958', band: [0.03, 0.115], wolk: 1.0 },
    nevel: { kleur: '#3b6765', van: 75, tot: 390, max: 0.58 }, brandt: true, wolken: false, plassen: 1.0, nat: 0.0, regen: 1.0,
  },
};

// Vakken die licht geven als het brandt, met de kleur van dat licht; overdag zijn het gewone ruiten.
const BRANDT = { ruit_aan: '#f7d56e', ruit_kantoor: '#f9de86', lamp: '#fcecae', raamlicht: '#f7d56e' };
const OVERDAG = { ruit_aan: 'ruit_donker', ruit_kantoor: 'ruit_licht', lamp: 'kalkwit' };
// De schaduwkleuren in stijlen.js zijn gekozen bij dit middaglicht; een stemming schuift ze daarvandaan.
const MIDDAG = [0.88, 0.885, 0.905];

export const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

// De kleuren als rij getallen in de volgorde van de vakken uit model.json: per vak in het licht, in de schaduw.
export function paletRij(stijl, vakken, stemming) {
  const rij = new Float32Array(vakken.length * 6);
  vakken.forEach((naam, i) => {
    if (stemming.brandt && BRANDT[naam]) {
      const k = hex(BRANDT[naam]);
      rij.set(k, i * 6);
      rij.set(k, i * 6 + 3);
      return;
    }
    const k = stijl.vakken[OVERDAG[naam] || naam] ?? stijl.vakken.onbekend;
    const zon = hex(Array.isArray(k) ? k[0] : k);
    const schaduw = Array.isArray(k) ? hex(k[1]) : zon.map((v, c) => v * MIDDAG[c]);
    rij.set(zon.map((v, c) => Math.min(1, v * stemming.licht[c])), i * 6);
    rij.set(schaduw.map((v, c) => Math.min(1, v * stemming.schaduw[c] / MIDDAG[c])), i * 6 + 3);
  });
  return rij;
}

// Waar de zon staat, als richting in de assen van three.js (y omhoog, z naar het zuiden).
export function zonRichting(stemming) {
  const az = stemming.zon[0] * Math.PI / 180, el = stemming.zon[1] * Math.PI / 180;
  return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
}
