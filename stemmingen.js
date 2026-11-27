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
  // Rijke Kuifje/Klare Lijn-nacht: diep petrol-middernachtblauw, stevig stripschaduw-contrast en warm goudgeel licht!
  nacht: {
    naam: 'Nacht', zon: [218, 36], licht: [1.0, 1.0, 1.0], schaduw: [0.56, 0.63, 0.76],
    lucht: { laag: '#1a364b', midden: '#132a3d', hoog: '#0c1d2c', band: [0.05, 0.18], wolk: 0.0 },
    nevel: { kleur: '#122738', van: 170, tot: 560, max: 0.30 }, brandt: true, wolken: true, nacht: true,
    lamplicht: '#f4de88', plassen: 0.0, regen: 0.0, klare: 1.0, bunker: 1.0,
  },
  // Dezelfde zuivere Klare Lijn bij daglicht: vlak lichtblauw, géén waas, heldere slagschaduw.
  dag: {
    naam: 'Dag', zon: [215, 42], licht: [1.0, 1.0, 1.0], schaduw: [0.80, 0.83, 0.88],
    lucht: { laag: '#c4e0f0', midden: '#9ec8e2', hoog: '#89bad9', band: [0.05, 0.20], wolk: 0.0 },
    nevel: { kleur: '#c4e0f0', van: 280, tot: 720, max: 0.06 }, brandt: false, wolken: true, nacht: false,
    plassen: 0.0, regen: 0.0, klare: 1.0, bunker: 0.0,
  },
};

// Vakken die licht geven als het brandt, exact naar de warme goudgloed uit de Blaricum-nachtplaat.
const BRANDT = { ruit_aan: '#dfd382', ruit_kantoor: '#c7bd78', lamp: '#fbee70', raamlicht: '#d8cb7a' };
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
