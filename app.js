// Het getekende dorp in de browser. Alles wat vorm of kleur heeft komt uit Blender (model/, gemaakt door
// model/klare_lijn_model.py): vlakken met een paletvak, inktlijnen als lijnstukken met de normalen van hun twee
// vlakken, patronen met hun afstand, ronde vormen met hun normalen. Deze code tekent alleen:
//   - de vlakken egaal in de kleur van hun vak, in één van twee tonen: in het licht of in de schaduw. Schaduw
//     is wat van de zon af staat of waar iets anders voor de zon staat (slagschaduw, als vlakke vorm);
//   - het licht zelf (stemmingen.js): de kleur van licht en schaduw, de lucht in banden, de verte die wegzakt;
//   - elk lijnstuk als een penseelstreek: dik waar de rand op dit moment een omtrek is, dun waar hij binnenwerk
//     is, nooit kaarsrecht, wisselend van dikte, en textuur hapert af en toe (zie "De lijnen" hieronder);
//   - patronen (klinkers, tegels, pannen) alleen waar hun rijen op het scherm ver genoeg uit elkaar liggen;
//   - de omtrek van ronde vormen: dezelfde romp nog eens, zwart, een paar pixels groter, erachter;
//   - de camera, de standpunten en de wissel van inkleuring en licht.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STIJLEN } from './stijlen.js';
import { STEMMINGEN, paletRij, zonRichting, hex } from './stemmingen.js';

const vraag = new URLSearchParams(location.search);
const getal = (naam, anders) => (vraag.has(naam) ? Number(vraag.get(naam)) : anders);
const doek = document.getElementById('doek');
const melding = document.getElementById('melding');

// Standpunten in meters, y omhoog, het kantoor in de oorsprong (three.js: x oost, z zuid).
const STANDEN = {
  hoekpand: { oog: [-9, 15, 43], doel: [2, 4, 7], hoek: 34 },
  kruising: { oog: [-33.5, 1.7, 21.5], doel: [-8.5, 4.2, 11.5], hoek: 36 },
  erf: { oog: [31, 2.4, 1], doel: [8, 4.2, 3], hoek: 40 },
  straat: { oog: [-36.5, 1.9, 24.5], doel: [-21, 1.0, 14.8], hoek: 40 },
  plein: { oog: [-28.5, 1.65, 17], doel: [-12, 3.6, -6], hoek: 44 },
  dorp: { oog: [-70, 62, 110], doel: [-5, 0, 5], hoek: 30 },
};
// De hand van de tekenaar, in pixels. Alles is met de adresbalk bij te stellen (?bibber=0 is de liniaal).
const HAND = {
  lijn: getal('lijn', 2.7),        // dikte van de omtreklijn
  binnen: getal('binnen', 0.6),    // binnenwerk als deel daarvan
  bibber: getal('bibber', 0.85),   // hoe ver een lijn van recht afwijkt
  golf: getal('golf', 74),         // over hoeveel pixels een bochtje loopt
  zwel: getal('zwel', 0.5),        // hoeveel de dikte langs de streep wisselt (0 = overal even dik)
  // Welk deel van een streep wegvalt. Binnenwerk van een voorwerp is bij Van Dongen heel; alleen wat textuur is
  // (voegen, pannen, planken) hapert.
  hapert: [getal('hapertomtrek', 0.0), getal('hapert', 0.03), getal('hapertpatroon', 0.38)],
};
const isMobiel = matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 768;
const SLAG = vraag.get('slag') !== 'uit';      // slagschaduw; ?slag=uit laat alleen de eigen schaduw over
const SLAGMAAT = isMobiel ? 2048 : 4096;       // compacter op telefoon voor geheugen en vloeiende fps

const renderer = new THREE.WebGLRenderer({ canvas: doek, antialias: !isMobiel, powerPreference: 'high-performance', preserveDrawingBuffer: vraag.has('afdruk') });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobiel ? 1.5 : 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.4, 4000);
const stuur = new OrbitControls(camera, doek);
stuur.enableDamping = true;
stuur.dampingFactor = 0.08;
stuur.maxPolarAngle = Math.PI * 0.497;
stuur.minDistance = 3;
stuur.maxDistance = 600;
// Een eigen standpunt uit de adresbalk, om een plek te zoeken: ?oog=x,y,z&doel=x,y,z&hoek=40&stand=eigen
if (vraag.has('oog')) {
  STANDEN.eigen = { oog: vraag.get('oog').split(',').map(Number), doel: (vraag.get('doel') || '0,3,0').split(',').map(Number), hoek: getal('hoek', 40) };
  stuur.maxPolarAngle = Math.PI;
}

// Een kleur zoals hij op het scherm moet staan. three.js rekent '#a8d6f0' anders om naar lineair licht, maar de
// tekenprogramma's hier schrijven hun kleur rechtstreeks naar het scherm (de eerste lucht was te donker en te
// fel: oranje werd rood).
const zet = (kleur, h) => kleur.setRGB(...hex(h), THREE.LinearSRGBColorSpace);

const laad = async (naam, Soort) => {
  const r = await fetch('model/' + naam);
  if (!r.ok) throw new Error(naam + ' niet gevonden');
  return new Soort(await r.arrayBuffer());
};

// Wat alle tekenprogramma's delen: de zon, de schaduwkaart, de nevel en de Bunker Hill detective-avondsfeer.
const LICHT = {
  uZon: { value: new THREE.Vector3(0, 1, 0) }, uLichtMat: { value: new THREE.Matrix4() }, uSlagKaart: { value: null },
  uSlag: { value: SLAG ? 1 : 0 }, uNevel: { value: new THREE.Color() }, uNevelMaat: { value: new THREE.Vector3(150, 560, 0.5) },
  uBrandt: { value: 0 }, uPlassen: { value: 0 }, uKlare: { value: 1 }, uBunker: { value: 1 }, uRegen: { value: 0 }, uTijd: { value: 0 },
  uPlasKleur: { value: new THREE.Color(0.92, 0.58, 0.27) }, uInktKleur: { value: new THREE.Color(0.06, 0.04, 0.03) },
};

// Ruis die vastzit aan de wereld: dezelfde plek geeft altijd dezelfde waarde, dus een bochtje blijft staan
// waar het staat als de camera beweegt. Tussen -1 en 1.
const RUIS = `
  float klHash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float klRuis(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(klHash(i), klHash(i + vec3(1, 0, 0)), f.x), mix(klHash(i + vec3(0, 1, 0)), klHash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(klHash(i + vec3(0, 0, 1)), klHash(i + vec3(1, 0, 1)), f.x), mix(klHash(i + vec3(0, 1, 1)), klHash(i + vec3(1, 1, 1)), f.x), f.y), f.z) * 2.0 - 1.0;
  }`;

// Slagschaduw: staat er, vanaf dit punt naar de zon gekeken, iets in de weg? De kaart is één keer per stemming
// vanuit de zon getekend. Negen metingen om het punt, en de meerderheid beslist: dat geeft een ronde, harde
// rand. De plek waar gemeten wordt verschuift een paar centimeter met de ruis: de rand van een schaduw is uit
// de hand getrokken, net als een lijn.
const SLAGCODE = `
  uniform sampler2D uSlagKaart;
  uniform mat4 uLichtMat;
  uniform vec3 uZon;
  uniform float uSlag;
  uniform vec3 uNevel;
  uniform vec3 uNevelMaat;
  uniform float uBrandt;
  uniform float uPlassen;
  uniform float uKlare;
  uniform float uBunker;
  uniform vec3 uPlasKleur;
  uniform vec3 uInktKleur;
  bool klSlag(vec3 p, vec3 n, float weg) {
    if (uSlag < 0.5) return false;
    vec3 q = p + n * weg + 0.05 * vec3(klRuis(p * 0.8), 0.0, klRuis(p * 0.8 + 31.0));
    vec4 l = uLichtMat * vec4(q, 1.0);
    vec3 s = l.xyz / l.w * 0.5 + 0.5;
    if (s.x <= 0.0 || s.x >= 1.0 || s.y <= 0.0 || s.y >= 1.0 || s.z >= 1.0) return false;
    // Negen metingen over ruim drie pixels van de kaart: met vier was de rand op een kruin een trapje.
    float t = 1.3 / ${SLAGMAAT}.0, som = 0.0;
    for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++)
      som += step(texture2D(uSlagKaart, s.xy + vec2(float(i), float(j)) * t).r + 0.00018, s.z);
    return som > 4.5;
  }
  vec3 klNevel(vec3 kleur, float afstand) {
    // Zuivere Klare Lijn: spiegelgladde egale kleurvlakken (aplats) zonder papierruis in zowel Dag als Nacht.
    float vlek = uKlare > 0.5 ? 0.0 : (0.6 * klRuis(vec3(gl_FragCoord.xy * 0.055, 1.0)) + 0.7 * klRuis(vec3(gl_FragCoord.xy * 0.007, 7.0)));
    return mix(kleur, uNevel, uNevelMaat.z * smoothstep(uNevelMaat.x, uNevelMaat.y, afstand)) * (1.0 + 0.022 * vlek);
  }`;

// ---- De vlakken: egale klare-lijn-tonen plus in "Mystery in Bunker Hill" messcherp begrensde gele
// straatlantaarnkringen op straat en onderste gevels, zonder vlekkerige ruis of zware schaduwbanden.
const vlakShader = (vakken, id) => new THREE.ShaderMaterial({
  uniforms: { palet: { value: new Float32Array(vakken * 6) }, ...LICHT },
  vertexShader: `
    attribute vec2 vak;
    varying vec2 vVak;
    varying vec3 vP;
    void main() {
      vVak = vak;
      vP = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform vec3 palet[${vakken * 2}];
    varying vec2 vVak;
    varying vec3 vP;
    ${RUIS}
    ${SLAGCODE}
    // Strak begrensde lichtband voor een verlichte etalage (geen wazige overgang).
    float gevelGloed(vec2 p, vec2 a, vec2 b, float diep, float ruis) {
      vec2 ab = b - a;
      float L = length(ab);
      vec2 t = ab / L;
      vec2 uit = vec2(-t.y, t.x);
      vec2 rel = p - a;
      float langs = dot(rel, t);
      float weg = dot(rel, uit);
      if (langs < -0.5 || langs > L + 0.5 || weg < -0.25 || weg > diep + 0.6) return 0.0;
      float zij = smoothstep(-0.10, 0.10, langs) * (1.0 - smoothstep(L - 0.10, L + 0.10, langs));
      float grens = diep + 0.14 * ruis;
      float fw = max(fwidth(weg), 0.015);
      float buiten = 1.0 - smoothstep(grens - fw, grens + fw, weg);
      float binnen = smoothstep(-0.2, 0.04, weg);
      return zij * binnen * buiten;
    }
    // Vlijmscherp uitgeknipte Bunker Hill straatlantaarn-lichtcirkel op straat/stoep (zuivere 1-px rand).
    float lampCirkel(vec2 p, vec2 c, float r) {
      float d = length(p - c);
      float fw = max(fwidth(d), 0.015);
      return 1.0 - smoothstep(r - fw, r + fw, d);
    }
    void main() {
      vec3 n = normalize(cross(dFdx(vP), dFdy(vP)));
      int s = int(vVak.x + 0.5);
      bool inSlag = uKlare > 0.5 ? false : klSlag(vP, n, 0.17);
      bool licht = dot(n, uZon) > 0.08 && !inSlag;
      vec3 k = palet[s * 2 + (licht ? 0 : 1)];

      bool isRuit = (s == ${id.ruit_donker} || s == ${id.ruit_licht} || s == ${id.ruit_aan} || s == ${id.ruit_kantoor});
      bool isBrandRuit = (s == ${id.ruit_kantoor} || s == ${id.ruit_aan} || s == ${id.raamlicht});
      bool isGrond = (s == ${id.straat} || s == ${id.stoep} || s == ${id.erf} || s == ${id.parkeervak} || s == ${id.gazon} || s == ${id.berm});
      bool isGevel = (s == ${id.pleister} || s == ${id.kalkwit} || s == ${id.baksteen_rood} || s == ${id.baksteen_bruin}
                   || s == ${id.baksteen_geel} || s == ${id.kozijn_wit} || s == ${id.overkapping} || s == ${id.luifel}
                   || s == ${id.hout} || s == ${id.g_wit} || s == ${id.g_licht} || s == ${id.g_grijs});

      // 1. Ruiten: in Bunker Hill gloeien verlichte ramen in egaal roomgeel (#f4eb9e); donkere ruiten vangen één koele glansstreep.
      if (isRuit && abs(n.y) < 0.85) {
        float diag = (vP.x * 0.62 - vP.z * 0.58) + vP.y * 1.15;
        float g = fract(diag * 0.36);
        float fw = max(fwidth(diag * 0.36), 0.008);
        float band1 = smoothstep(0.14 - fw, 0.14 + fw, g) * (1.0 - smoothstep(0.26 - fw, 0.26 + fw, g));
        float band2 = smoothstep(0.30 - fw, 0.30 + fw, g) * (1.0 - smoothstep(0.345 - fw, 0.345 + fw, g));
        float glans = clamp(band1 + band2, 0.0, 1.0);
        if (uBrandt < 0.5) {
          vec3 hemelGlans = mix(k, vec3(0.88, 0.93, 0.96), 0.42);
          k = mix(k, hemelGlans, glans);
          if (s == ${id.ruit_kantoor}) {
            float boven = smoothstep(2.72, 2.78, vP.y);
            k = mix(k, k * 0.78, boven);
          }
        } else if (isBrandRuit) {
          if (uBunker > 0.5) {
            // Zuiver vlak roomgeel raam met één strakke lichte spiegeling (geen modderige ruis erin).
            k = mix(k, vec3(0.99, 0.97, 0.84), glans * 0.30);
          } else {
            float hoog = smoothstep(2.45, 2.55, vP.y);
            float onder = 1.0 - smoothstep(1.05, 1.16, vP.y);
            float ritme = step(0.15, klRuis(vec3(vP.x * 0.9, 0.4, vP.z * 0.9)));
            k = mix(k, vec3(0.92, 0.66, 0.30), hoog * 0.34);
            k = mix(k, vec3(0.84, 0.56, 0.24), onder * (0.18 + 0.14 * ritme));
            k = mix(k, vec3(1.0, 0.96, 0.82), glans * 0.28);
          }
        } else if (uBunker > 0.5) {
          k = mix(k, vec3(0.38, 0.55, 0.60), glans * 0.42);
        }
      }

      // 2. MYSTERY IN BUNKER HILL: vlijmscherpe roomgele straatlantaarnkringen & etalagebundels (zonder zware slagschaduw dwars door het plein).
      if (uBunker > 0.5) {
        if (isGrond && abs(n.y) > 0.7) {
          // Etalage-lichtvlakken uit het Monastic-hoekpand en Bistrot Chapeau (kaarsrecht afgesneden).
          float e1 = gevelGloed(vP.xz, vec2(-12.1, 4.8), vec2(-5.2, 18.4), 3.4, 0.0);
          float e2 = gevelGloed(vP.xz, vec2(-5.1, 18.4), vec2(6.7, 11.1), 3.2, 0.0);
          float eChO = gevelGloed(vP.xz, vec2(-31.58, 17.5), vec2(-31.58, 10.9), 3.0, 0.0);
          float eChZ = gevelGloed(vP.xz, vec2(-41.0, 17.6), vec2(-31.6, 17.6), 2.8, 0.0);
          float eHoek = lampCirkel(vP.xz, vec2(-5.2, 18.4), 3.8);

          // Messcherpe, perfect ronde Bunker Hill straatlantaarn-lichtcirkels.
          float c1 = lampCirkel(vP.xz, vec2(8.9, 11.2), 5.4);
          float c2 = lampCirkel(vP.xz, vec2(-12.77, 36.01), 5.6);
          float c3 = lampCirkel(vP.xz, vec2(-32.06, 31.29), 5.6);
          float c4 = lampCirkel(vP.xz, vec2(-23.6, 23.4), 5.0);
          float c5 = lampCirkel(vP.xz, vec2(-26.4, 12.2), 4.6);
          float c6 = lampCirkel(vP.xz, vec2(-25.6, -6.8), 5.0);
          float c7 = lampCirkel(vP.xz, vec2(-40.14, -10.16), 5.6);
          float c8 = lampCirkel(vP.xz, vec2(22.95, 1.05), 5.4);

          float kring = max(max(max(c1, c2), max(c3, c4)), max(max(c5, c6), max(c7, c8)));
          float etalage = max(max(e1, e2), max(max(eChO, eChZ), eHoek));
          float verlicht = max(kring, etalage);

          bool isGroen = (s == ${id.gazon} || s == ${id.berm});
          vec3 lampKleur = isGroen ? vec3(0.50, 0.56, 0.37) : vec3(0.80, 0.77, 0.55); // zuiver Bunker Hill #ccc48c
          k = mix(k, lampKleur, verlicht * 0.96);

          // Paar kleine, strak getekende Bunker Hill-plasjes met een dun zwart inktrandje.
          if (s == ${id.straat} || s == ${id.parkeervak}) {
            float pf = klRuis(vec3(vP.x * 0.32 + 4.1, 1.3, vP.z * 0.55 - 2.4))
                     + 0.38 * klRuis(vec3(vP.x * 0.70 + 8.0, 2.2, vP.z * 0.85));
            float fwP = max(fwidth(pf), 0.01);
            float inPlas = smoothstep(0.89 - fwP, 0.89 + fwP, pf);
            float randPlas = smoothstep(0.85 - fwP, 0.85 + fwP, pf) * (1.0 - inPlas);
            k = mix(k, vec3(0.36, 0.53, 0.57), inPlas);
            k = mix(k, uInktKleur, randPlas);
          }
        } else if (isGevel && abs(n.y) < 0.55) {
          // Strakke, kaarsrechte schuine lichtgrens op het onderste deel van gevels naast straatlantaarns (zoals bij Hotel Contral).
          float dMin = min(
            min(length(vP.xz - vec2(8.9, 11.2)), length(vP.xz - vec2(-5.2, 18.4))),
            min(min(length(vP.xz - vec2(-32.06, 31.29)), length(vP.xz - vec2(-26.4, 12.2))),
                min(length(vP.xz - vec2(-25.6, -6.8)), length(vP.xz - vec2(-12.77, 36.01))))
          );
          float grensY = 4.6 - dMin * 0.38;
          float fwY = max(fwidth(vP.y - grensY), 0.015);
          float muurLicht = (1.0 - smoothstep(grensY - fwY, grensY + fwY, vP.y)) * step(dMin, 11.0);
          vec3 okerGevel = vec3(0.62, 0.60, 0.42); // helder, egaal Bunker Hill verlicht gevel-oker
          k = mix(k, okerGevel, muurLicht * 0.88);
        }
      } else if (uBrandt > 0.5 && isGrond && abs(n.y) > 0.7) {
        // Oorspronkelijke Schemer-sfeer (AIVD Werf)
        float wRuis = klRuis(vec3(vP.x * 0.55, 1.0, vP.z * 0.55));
        float b1 = gevelGloed(vP.xz, vec2(-12.1, 4.8), vec2(-5.2, 18.4), 2.55, wRuis);
        float u1 = gevelGloed(vP.xz, vec2(-12.3, 4.6), vec2(-5.0, 18.6), 5.15, wRuis);
        float b2 = gevelGloed(vP.xz, vec2(-5.1, 18.4), vec2(6.7, 11.1), 2.35, wRuis);
        float u2 = gevelGloed(vP.xz, vec2(-5.3, 18.6), vec2(6.9, 10.9), 4.65, wRuis);
        float dHoek = length(vP.xz - vec2(-5.2, 18.4)) + 0.24 * wRuis;
        float fwH = max(fwidth(dHoek), 0.05);
        float hoekB = 1.0 - smoothstep(2.55 - fwH, 2.55 + fwH, dHoek);
        float hoekU = 1.0 - smoothstep(4.95 - fwH, 4.95 + fwH, dHoek);
        float binnenLicht = max(max(b1, b2), hoekB);
        float buitenLicht = max(max(u1, u2), hoekU);
        float dL1 = length(vP.xz - vec2(8.9, 11.2)) + 0.22 * wRuis;
        float dL2 = length(vP.xz - vec2(-12.77, 36.01)) + 0.22 * wRuis;
        float dL3 = length(vP.xz - vec2(-32.06, 31.29)) + 0.22 * wRuis;
        float minL = min(dL1, min(dL2, dL3));
        float fwL = max(fwidth(minL), 0.06);
        float lamp = 1.0 - smoothstep(3.1 - fwL, 3.1 + fwL, minL);
        vec3 warmBuiten = (s == ${id.gazon} || s == ${id.berm}) ? vec3(0.49, 0.50, 0.24) : vec3(0.76, 0.59, 0.34);
        vec3 warmBinnen = (s == ${id.gazon} || s == ${id.berm}) ? vec3(0.68, 0.64, 0.28) : vec3(0.95, 0.78, 0.44);
        k = mix(k, warmBuiten, clamp(buitenLicht * 0.52 + lamp * 0.42, 0.0, 0.65));
        k = mix(k, warmBinnen, binnenLicht * 0.68);
      }

      // 3. Schemer: slanke, langgerekte handgetekende plassen met dunne inktrand en oranje luchtweerspiegeling.
      if (uPlassen > 0.5 && (s == ${id.straat} || s == ${id.parkeervak}) && abs(n.y) > 0.85) {
        float pf = klRuis(vec3(vP.x * 0.17 + 3.4, 1.3, vP.z * 0.38 - 1.2))
                 + 0.40 * klRuis(vec3(vP.x * 0.36 + 9.0, 2.7, vP.z * 0.52));
        float fw = max(fwidth(pf), 0.01);
        float inPlas = smoothstep(0.69 - fw, 0.69 + fw, pf);
        float randPlas = smoothstep(0.645 - fw, 0.645 + fw, pf) * (1.0 - inPlas);
        float rimpel = smoothstep(0.45, 0.55, sin(vP.z * 9.0 + klRuis(vec3(vP.x * 0.9, 0.0, vP.z * 0.9)) * 2.5));
        vec3 spiegel = mix(uPlasKleur * 0.86, vec3(0.98, 0.84, 0.55), rimpel * 0.38);
        k = mix(k, spiegel, inPlas * 0.84);
        k = mix(k, uInktKleur, randPlas * 0.86);
      }

      gl_FragColor = vec4(klNevel(k, length(cameraPosition - vP)), 1.0);
    }`,
  // Beide kanten: een gespiegeld onderdeel in het model heeft zijn vlakken andersom. De vlakken liggen een
  // fractie achter hun eigen lijnen, anders knippert de lijn.
  side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1.5, polygonOffsetUnits: 2,
});

// ---- Ronde vormen (kruinen, keien, de auto, mensen): dezelfde twee tonen, plus in Bunker Hill gitzwarte
// hoogglans-auto's met vlijmscherpe crème-witte randlichten zoals de klassiekers op de cover!
const rompShader = (vakken, palet, id) => new THREE.ShaderMaterial({
  uniforms: { palet: { value: palet }, ...LICHT },
  vertexShader: `
    attribute vec2 vak;
    varying vec2 vVak;
    varying vec3 vN;
    varying vec3 vP;
    void main() {
      vVak = vak;
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vN = normalize(mat3(modelMatrix) * normal);
      vP = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
  fragmentShader: `
    uniform vec3 palet[${vakken * 2}];
    varying vec2 vVak;
    varying vec3 vN;
    varying vec3 vP;
    ${RUIS}
    ${SLAGCODE}
    void main() {
      vec3 n = normalize(vN);
      int s = int(vVak.x + 0.5);
      float rand = uKlare > 0.5 ? 0.12 : (-0.12 + 0.16 * klRuis(vP * 1.7));
      bool licht = uKlare > 0.5
        ? (vVak.y > 0.5 && dot(n, uZon) > rand)
        : (vVak.y > 0.5 && dot(n, uZon) > rand && !klSlag(vP, n, 0.32));
      vec3 k = palet[s * 2 + (licht ? 0 : 1)];

      // Strakke klare-lijn glans op de gelakte Porsche en auto's: in zowel Dag als Nacht 92% strakke lak met dunne witte randlijn!
      if (s == ${id.porsche} || s == ${id.autolak}) {
        vec3 kijk = normalize(cameraPosition - vP);
        vec3 halfV = normalize(normalize(uZon + vec3(0.0, 0.72, 0.0)) + kijk);
        float sp = pow(max(dot(n, halfV), 0.0), 46.0);
        float fw = max(fwidth(sp), 0.015);
        float glans = smoothstep(0.76 - fw, 0.76 + fw, sp);
        if (uKlare > 0.5) {
          float fwN = max(fwidth(n.y), 0.012);
          float randStreep = smoothstep(0.84 - fwN, 0.84 + fwN, n.y) * (1.0 - smoothstep(0.89 - fwN, 0.89 + fwN, n.y));
          float streep = clamp(glans + randStreep * 0.75, 0.0, 1.0);
          k = mix(k, uBunker > 0.5 ? vec3(0.95, 0.93, 0.82) : vec3(0.98, 0.98, 0.96), streep * 0.95);
        } else {
          k = mix(k, vec3(0.98, 0.95, 0.89), glans * 0.72);
        }
      } else if (s == ${id.autoraam}) {
        float diag = (vP.x + vP.z) * 1.4 + vP.y * 2.2;
        float g = fract(diag * 0.65);
        float fw = max(fwidth(diag * 0.65), 0.012);
        float streep = smoothstep(0.20 - fw, 0.20 + fw, g) * (1.0 - smoothstep(0.30 - fw, 0.30 + fw, g));
        vec3 ruitGlans = uBunker > 0.5 ? vec3(0.85, 0.87, 0.79) : vec3(0.96, 0.98, 1.0);
        k = mix(k, ruitGlans, streep * 0.65);
      } else if (s == ${id.blad_a} || s == ${id.blad_b} || s == ${id.blad_c}) {
        // Spaarzame, fijne Hergé-bladboogjes in de kruinen (geen drukke ruis).
        float dist = length(cameraPosition - vP);
        if (licht && n.y > 0.14 && dist < 58.0) {
          vec3 cel = floor(vP * 0.85);
          vec3 f = fract(vP * 0.85) - 0.5;
          float h = klHash(cel + vec3(3.7, 1.1, 8.3));
          float drempel = uKlare > 0.5 ? 0.80 : 0.66;
          if (h > drempel) {
            float r = length(vec2(f.x, f.y + 0.12));
            float fw = max(fwidth(r), 0.012);
            float boog = (1.0 - smoothstep(0.014 - fw, 0.014 + fw, abs(r - 0.24)))
                       * smoothstep(-0.04, 0.06, f.y + 0.12)
                       * (1.0 - smoothstep(0.18, 0.24, abs(f.z)));
            float dichtbij = 1.0 - smoothstep(38.0, 58.0, dist);
            k = mix(k, uInktKleur, boog * dichtbij * 0.72);
          }
        }
      }

      gl_FragColor = vec4(klNevel(k, length(cameraPosition - vP)), 1.0);
    }`,
  polygonOffset: true, polygonOffsetFactor: 1.5, polygonOffsetUnits: 2,
});

// ---- De omtrek van ronde vormen: in zuivere Klare Lijn 100% constante, gladde dikte zonder zwel-knobbels!
const rompRand = () => new THREE.ShaderMaterial({
  uniforms: { inkt: { value: new THREE.Color() }, dikte: { value: 2 }, maat: { value: new THREE.Vector2(1, 1) }, zwel: { value: HAND.zwel },
    uNevel: LICHT.uNevel, uNevelMaat: LICHT.uNevelMaat, uKlare: LICHT.uKlare },
  vertexShader: `
    uniform float dikte;
    uniform float zwel;
    uniform float uKlare;
    uniform vec2 maat;
    varying float vAfstand;
    ${RUIS}
    void main() {
      vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      vec4 n = projectionMatrix * vec4(normalize(normalMatrix * normal), 0.0);
      vec2 r = n.xy * maat;                       // richting op het scherm, in pixels
      float l = max(length(r), 1e-5);
      float d = uKlare > 0.5
        ? dikte * 0.95
        : dikte * (1.0 + zwel * 0.75 * klRuis(position * (0.55 + 6.0 / max(p.w, 1.0))));
      p.xy += (r / l) * d * 2.0 / maat * p.w;
      vAfstand = p.w;
      gl_Position = p;
    }`,
  fragmentShader: `
    uniform vec3 inkt, uNevel, uNevelMaat;
    varying float vAfstand;
    void main() { gl_FragColor = vec4(mix(inkt, uNevel, 0.8 * uNevelMaat.z * smoothstep(uNevelMaat.x, uNevelMaat.y, vAfstand)), 1.0); }`,
  side: THREE.BackSide,
});

// ---- De lijnen. Zuivere Ligne Claire in zowel Dag als Nacht: constante, ononderbroken, kaarsrechte Rotring-lijn,
// alle patroon-arcering (klStap > 0) uit én flauwe 3D-polygoonfacetten weggefilterd op crease-hoek!
const lijnShader = () => new THREE.ShaderMaterial({
  uniforms: {
    uInkt: { value: new THREE.Color() }, uRes: { value: new THREE.Vector2(1, 1) }, uLijn: { value: HAND.lijn },
    uBinnen: { value: HAND.binnen }, uBibber: { value: HAND.bibber }, uGolf: { value: HAND.golf }, uZwel: { value: HAND.zwel },
    uHapert: { value: new THREE.Vector3(...HAND.hapert) }, uPx: { value: 1 }, uNevel: LICHT.uNevel, uNevelMaat: LICHT.uNevelMaat,
    uKlare: LICHT.uKlare,
  },
  vertexShader: `
    attribute vec3 aStart;
    attribute vec3 aEnd;
    attribute vec3 klNA;
    attribute vec3 klNB;
    attribute float klDik;
    attribute float klVer;
    attribute float klStap;
    uniform vec2 uRes;
    uniform float uLijn, uBinnen, uBibber, uPx, uKlare;
    varying vec3 vWereldW;      // plek in de wereld, gedeeld door w (zie onder)
    varying float vInvW;
    varying float vDwars;       // pixels uit het midden van de rechte lijn
    varying float vLangs;       // pixels vanaf het begin
    varying float vLengte;
    varying float vHalve;       // halve dikte in pixels
    varying float vSoort;       // 0 omtrek, 1 binnenwerk, 2 patroon
    varying float vOver;        // hoeveel pixels de streep voorbij zijn eindpunt doorschiet
    void main() {
      vec3 ws = (modelMatrix * vec4(aStart, 1.0)).xyz;
      vec3 we = (modelMatrix * vec4(aEnd, 1.0)).xyz;
      mat3 nm = mat3(modelMatrix);
      vec3 nA = normalize(nm * klNA);
      vec3 nB = normalize(nm * klNB);
      vec4 vs = viewMatrix * vec4(ws, 1.0), ve = viewMatrix * vec4(we, 1.0);
      float nz = -0.45;
      vec3 kijk = cameraPosition - 0.5 * (ws + we);
      float afstand = length(kijk);
      bool omtrek = dot(nA, kijk) * dot(nB, kijk) <= 0.0;
      float binnenFactor = uKlare > 0.5 ? 0.78 : uBinnen;
      float maat = klDik * (omtrek ? 1.0 : binnenFactor) * clamp(sqrt(30.0 / max(afstand, 0.01)), 0.68, 1.0);
      if (klVer > 0.0) maat *= 1.0 - smoothstep(0.6 * klVer, klVer, afstand);
      if (uKlare > 0.5) {
        // 1. Alle patroon-arcering (klinkers, dakpannen, steenvoegen) uit voor zuivere egale kleurvlakken!
        if (klStap > 0.0) maat = 0.0;
        // 2. Crease-hoek filter (~125°): verberg flauwe 3D-polygoonfacetten binnen vormen, behoud silhouetten & echte hoeken!
        if (!omtrek && dot(nA, nB) > 0.58) maat = 0.0;
      } else if (klStap > 0.0) {
        maat *= smoothstep(2.6, 5.2, klStap * abs(dot(nA, kijk)) / (afstand * afstand) * uPx);
      }
      if ((vs.z > nz && ve.z > nz) || maat < 0.02) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
      // Een eind achter de camera: afsnijden op het dichtbijvlak, anders slaat de deling door w om.
      if (vs.z > nz) { float t = (nz - vs.z) / (ve.z - vs.z); vs = mix(vs, ve, t); ws = mix(ws, we, t); }
      else if (ve.z > nz) { float t = (nz - ve.z) / (vs.z - ve.z); ve = mix(ve, vs, t); we = mix(we, ws, t); }
      vec4 cs = projectionMatrix * vs, ce = projectionMatrix * ve;
      vec2 ns = cs.xy / cs.w, ne = ce.xy / ce.w;
      vec2 r = (ne - ns) * uRes * 0.5;
      float len = length(r);
      vec2 d = len > 1e-4 ? r / len : vec2(1.0, 0.0);
      vec2 dwars = vec2(-d.y, d.x);
      float halve = 0.5 * uLijn * maat;
      float bib = uKlare > 0.5 ? 0.0 : uBibber;
      float ruim = max(halve, 0.55) * 1.5 + bib * 2.2 + 1.5;
      float uit = max(halve, 0.55) + bib + 1.5;
      bool eind = position.y > 0.5;
      vec4 c = eind ? ce : cs;
      vec2 plek = (eind ? ne : ns) + (dwars * position.x * ruim + d * (eind ? uit : -uit)) * 2.0 / uRes;
      gl_Position = vec4(plek, c.z / c.w, 1.0);
      vDwars = position.x * ruim;
      vLangs = eind ? len + uit : -uit;
      vLengte = len;
      vHalve = halve;
      vSoort = omtrek ? 0.0 : (klStap > 0.0 ? 2.0 : 1.0);
      vOver = uKlare > 0.5 ? 0.0 : (0.3 + 1.6 * fract(sin(dot(aStart, vec3(12.9898, 78.233, 37.719))) * 43758.5453) * smoothstep(2.0, 10.0, len));
      vInvW = 1.0 / c.w;
      vWereldW = (eind ? we : ws) * vInvW;
    }`,
  fragmentShader: `
    uniform vec3 uInkt, uHapert, uNevel, uNevelMaat;
    uniform float uBibber, uGolf, uZwel, uPx, uKlare;
    varying vec3 vWereldW;
    varying float vInvW, vDwars, vLangs, vLengte, vHalve, vSoort, vOver;
    ${RUIS}
    float trapRuis(vec3 p, float golf, float pxPerMeter, float schuif) {
      float trap = log2(max(golf / pxPerMeter, 1e-4) / 0.04);
      float t0 = floor(trap);
      float s = 0.04 * exp2(t0);
      return mix(klRuis(p / s + schuif), klRuis(p / (2.0 * s) + schuif), trap - t0);
    }
    void main() {
      float midden = 0.0;
      float halve = vHalve;
      if (uKlare < 0.5) {
        vec3 p = vWereldW / vInvW;
        float ppm = uPx * vInvW;
        float kort = trapRuis(p, uGolf, ppm, 0.0);
        float lang = trapRuis(p, uGolf * 3.1, ppm, 17.0);
        float gat = trapRuis(p, uGolf * 5.5, ppm, 41.0);
        float rust = smoothstep(1.5, 9.0, vLengte);
        midden = uBibber * rust * (0.7 * kort + 1.25 * lang * abs(lang));
        halve = vHalve * (1.0 + uZwel * rust * (0.85 * lang + 0.3 * kort));
        float weg = vSoort < 0.5 ? uHapert.x : (vSoort < 1.5 ? uHapert.y : uHapert.z);
        halve *= smoothstep(weg * 1.3 - 0.65, weg * 1.3 - 0.45, gat);
      }
      // Constante, vloeiende anti-aliased Klare Lijn: nooit onderbroken, nooit gekarteld.
      float dunDek = smoothstep(0.05, 0.45, halve);
      float tekenHalve = max(halve, 0.48);
      float binnen = min(vLangs + vOver, vLengte + vOver - vLangs);
      float a = dunDek * (1.0 - smoothstep(tekenHalve - 0.48, tekenHalve + 0.48, abs(vDwars - midden))) * smoothstep(-0.55, 0.55, binnen);
      if (a < 0.03) discard;
      gl_FragColor = vec4(mix(uInkt, uNevel, 0.8 * uNevelMaat.z * smoothstep(uNevelMaat.x, uNevelMaat.y, 1.0 / vInvW)), a);
    }`,
  transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
});

// ---- De lucht: drie gouache-banden met ronde, bollende wolkenbogen (geen scherpe zaagtanden)
// en in de schemer een subtiele schuine AIVD-Werf-regenbui.
const luchtShader = () => new THREE.ShaderMaterial({
  uniforms: {
    uLaag: { value: new THREE.Color() }, uMidden: { value: new THREE.Color() }, uHoog: { value: new THREE.Color() },
    uBand: { value: new THREE.Vector2(0.03, 0.1) }, uWolk: { value: 0 },
    uRegen: LICHT.uRegen, uTijd: LICHT.uTijd,
  },
  vertexShader: `
    varying vec3 vR;
    void main() {
      vR = position;
      vec4 p = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0);
      gl_Position = p.xyww;                      // altijd op het verste vlak
    }`,
  fragmentShader: `
    uniform vec3 uLaag, uMidden, uHoog;
    uniform vec2 uBand;
    uniform float uWolk, uRegen, uTijd;
    varying vec3 vR;
    ${RUIS}
    void main() {
      vec3 r = normalize(vR);
      float az = atan(r.z, r.x);
      // Bollende wolkenbogen: compacte ronde toppen met rustige hoogte onder een diepe petrol-bovenlucht.
      float boog1 = sqrt(max(0.0, 1.0 - pow(abs(sin(az * 11.5 + 0.4 + 0.35 * sin(az * 4.0))), 1.6)));
      float boog2 = sqrt(max(0.0, 1.0 - pow(abs(sin(az * 24.0 - 1.1 + 0.45 * cos(az * 6.0))), 1.7)));
      float deining = 0.5 + 0.5 * klRuis(vec3(cos(az) * 2.8, 2.1, sin(az) * 2.8));
      float bol = 0.58 * boog1 + 0.42 * boog2;
      float h = r.y;
      float g1 = uBand.x + uWolk * (0.012 * deining + 0.011 * bol);
      float g2 = uBand.y + uWolk * (0.024 * deining + 0.028 * bol);
      float fw = max(fwidth(h), 0.0015);
      vec3 k = mix(uLaag, uMidden, smoothstep(g1 - fw, g1 + fw, h));
      k = mix(k, uHoog, smoothstep(g2 - fw, g2 + fw, h));

      // Subtiele tweede hoge wolkenband in de schemerlucht (petrol-lichter) voor diepte.
      if (uWolk > 0.7) {
        float g3 = g2 + 0.075 + 0.018 * boog2;
        float g4 = g3 + 0.024 + 0.014 * boog1;
        float strook = smoothstep(g3 - fw, g3 + fw, h) * (1.0 - smoothstep(g4 - fw, g4 + fw, h));
        k = mix(k, mix(uHoog, uMidden, 0.20), strook * 0.50);
      }

      // Fijne schuine Van Dongen-regenstreepjes in de schemerlucht.
      if (uRegen > 0.5 && h > 0.01) {
        vec2 sc = gl_FragCoord.xy;
        vec2 schuin = vec2(sc.x + sc.y * 0.24, sc.y - sc.x * 0.24 + uTijd * 220.0);
        float kolom = floor(schuin.x / 26.0);
        float celX = fract(schuin.x / 26.0);
        float h1 = klHash(vec3(kolom, 3.1, 7.7));
        float yLijn = fract((schuin.y + h1 * 180.0) / 145.0);
        float isStreep = step(0.45, h1) * smoothstep(0.0, 0.04, abs(celX - 0.5) < 0.028 ? 1.0 : 0.0)
                       * smoothstep(0.10, 0.14, yLijn) * (1.0 - smoothstep(0.38, 0.42, yLijn));
        k = mix(k, vec3(0.84, 0.87, 0.82), isStreep * 0.22);
      }

      gl_FragColor = vec4(k, 1.0);
    }`,
  side: THREE.BackSide, depthWrite: false, depthTest: true,
});

let palet, vakNamen, lijn, rand, lucht, wolken = [], wolkBasis = [], lampen = [], bladeren = null, bladData = [], slagMat, lijnMaat = 1;
let stijlNaam = 'bunker', lichtNaam = 'nacht';
const slagDoel = new THREE.WebGLRenderTarget(SLAGMAAT, SLAGMAAT, { depthTexture: new THREE.DepthTexture(SLAGMAAT, SLAGMAAT, THREE.UnsignedIntType) });
slagDoel.depthTexture.minFilter = slagDoel.depthTexture.magFilter = THREE.NearestFilter;
const slagCam = new THREE.OrthographicCamera(-100, 100, 100, -100, 100, 900);
const slagMidden = new THREE.Vector3(-10, 0, 10);
let slagVeld = 0;
const diepteMat = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
let slagMeshes = [];

function slagKaart() {
  const z = LICHT.uZon.value;
  slagVeld = Math.min(280, Math.max(55, camera.position.distanceTo(stuur.target) * 1.25));
  slagMidden.copy(stuur.target).setY(0);
  slagCam.left = slagCam.bottom = -slagVeld;
  slagCam.right = slagCam.top = slagVeld;
  slagCam.updateProjectionMatrix();
  slagCam.position.copy(slagMidden).addScaledVector(z, 500);
  slagCam.up.set(0, 1, 0);
  slagCam.lookAt(slagMidden);
  slagCam.updateMatrixWorld();
  LICHT.uLichtMat.value.multiplyMatrices(slagCam.projectionMatrix, slagCam.matrixWorldInverse);
  const zichtbaar = scene.children.map((k) => k.visible);
  scene.children.forEach((k) => { k.visible = slagMeshes.includes(k); });
  scene.overrideMaterial = diepteMat;
  renderer.setRenderTarget(slagDoel);
  renderer.clear();
  renderer.render(scene, slagCam);
  renderer.setRenderTarget(null);
  scene.overrideMaterial = null;
  scene.children.forEach((k, i) => { k.visible = zichtbaar[i]; });
  LICHT.uSlagKaart.value = slagDoel.depthTexture;
}

const STAND_INFO = {
  hoekpand: ['Het hoekpand', 'Hoek Meentweg en Huizerweg, Blaricum'],
  kruising: ['De kruising', 'Zicht op het hoekpand en Bistrot Chapeau'],
  erf: ['Het erf', 'Achterzijde en hagen langs de Huizerweg'],
  straat: ['De straat', 'Terras bij Bistrot Chapeau en de kruising'],
  plein: ['Albert Heijn', 'De klassieke Porsche 930 in het parkeervak'],
  dorp: ['Het dorp', 'Vogelvlucht over het centrum van Blaricum'],
};

let standNaam = 'hoekpand';
let kleurReis = null;
let porsche = null;
let vogels = null;
let rondleiding = null;
let intro = null;
const isAfdruk = vraag.has('afdruk');

function werkCartoucheBij(titelOverride, subOverride) {
  const box = document.getElementById('cartouche');
  if (!box) return;
  if (isAfdruk) { box.hidden = true; return; }
  const info = STAND_INFO[standNaam] || ['Blaricum', 'Hoek Meentweg en Huizerweg'];
  const sm = STEMMINGEN[lichtNaam];
  const tEl = document.getElementById('cartouche-titel');
  const sEl = document.getElementById('cartouche-sub');
  if (tEl) tEl.textContent = titelOverride || `${info[0]} · ${sm.naam}`;
  if (sEl) sEl.textContent = subOverride || info[1];
}

function kleurDoelStaat(st, sm) {
  const hoog = sm.lucht.hoog || st.lucht;
  const laag = sm.lucht.laag || '#' + hex(st.lucht).map((v) => Math.round((v + (1 - v) * 0.4) * 255).toString(16).padStart(2, '0')).join('');
  const midden = sm.lucht.midden || hoog;
  const c = (h) => { const k = new THREE.Color(); zet(k, h); return k; };
  return {
    palet: paletRij(st, vakNamen, sm),
    hoog: c(hoog), midden: c(midden), laag: c(laag),
    hoogHex: hoog,
    band: new THREE.Vector2(...sm.lucht.band),
    wolk: sm.lucht.wolk,
    nevel: c(sm.nevel.kleur || laag),
    nevelMaat: new THREE.Vector3(sm.nevel.van, sm.nevel.tot, sm.nevel.max),
    brandt: sm.brandt ? 1 : 0,
    plassen: sm.plassen || 0,
    klare: sm.klare || 0,
    bunker: sm.bunker || 0,
    regen: sm.regen || 0,
    plasKleur: c(midden),
    inkt: c(st.inkt),
    inktHex: st.inkt,
    papier: st.papier,
    lijnMaat: st.lijn || 1,
    wolkenZichtbaar: sm.wolken,
    brandtAan: sm.brandt,
    zon: new THREE.Vector3(...zonRichting(sm)),
    st, sm,
  };
}

function pasKleurToe(a, b, t) {
  const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  for (let i = 0; i < palet.length; i++) palet[i] = a.palet[i] + (b.palet[i] - a.palet[i]) * e;
  lucht.uniforms.uHoog.value.lerpColors(a.hoog, b.hoog, e);
  lucht.uniforms.uMidden.value.lerpColors(a.midden, b.midden, e);
  lucht.uniforms.uLaag.value.lerpColors(a.laag, b.laag, e);
  lucht.uniforms.uBand.value.lerpVectors(a.band, b.band, e);
  lucht.uniforms.uWolk.value = a.wolk + (b.wolk - a.wolk) * e;
  LICHT.uNevel.value.lerpColors(a.nevel, b.nevel, e);
  LICHT.uNevelMaat.value.lerpVectors(a.nevelMaat, b.nevelMaat, e);
  LICHT.uBrandt.value = a.brandt + (b.brandt - a.brandt) * e;
  LICHT.uPlassen.value = a.plassen + (b.plassen - a.plassen) * e;
  LICHT.uKlare.value = a.klare + (b.klare - a.klare) * e;
  LICHT.uBunker.value = a.bunker + (b.bunker - a.bunker) * e;
  LICHT.uRegen.value = a.regen + (b.regen - a.regen) * e;
  LICHT.uPlasKleur.value.lerpColors(a.plasKleur, b.plasKleur, e);
  LICHT.uInktKleur.value.lerpColors(a.inkt, b.inkt, e);
  lijn.material.uniforms.uInkt.value.copy(LICHT.uInktKleur.value);
  rand.uniforms.inkt.value.copy(LICHT.uInktKleur.value);
  if (porsche) porsche.zetLicht(LICHT.uBrandt.value, LICHT.uInktKleur.value, lichtNaam);
}

let huidigeKleurStaat = null;
function kleur(naam, licht, meteen = false) {
  stijlNaam = STIJLEN[naam] ? naam : stijlNaam;
  lichtNaam = STEMMINGEN[licht] ? licht : lichtNaam;
  const st = STIJLEN[stijlNaam], sm = STEMMINGEN[lichtNaam];
  const doel = kleurDoelStaat(st, sm);
  document.querySelector('.kader').style.background = doel.hoogHex;
  slagMat.color.set(st.inkt);
  lijnMaat = doel.lijnMaat;
  for (const w of wolken) { w.material.map = wolkBeeld(st); w.visible = sm.wolken; }
  for (const l of lampen) l.visible = sm.brandt && !sm.bunker;
  if (vogels) vogels.group.visible = !sm.brandt;
  const anders = LICHT.uZon.value.distanceTo(doel.zon) > 1e-4 || !LICHT.uSlagKaart.value;
  LICHT.uZon.value.copy(doel.zon);
  if (anders && SLAG) slagKaart();
  maat();
  document.documentElement.style.setProperty('--papier', st.papier);
  document.documentElement.style.setProperty('--inkt', st.inkt);
  for (const k of document.querySelectorAll('[data-tijd]')) k.setAttribute('aria-pressed', String(k.dataset.tijd === lichtNaam));
  werkCartoucheBij();

  if (meteen || !huidigeKleurStaat || isAfdruk || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    pasKleurToe(doel, doel, 1);
    huidigeKleurStaat = doel;
    kleurReis = null;
  } else {
    // Momentopname van huidige toestand zodat snelle wissels nooit verspringen.
    const van = {
      palet: new Float32Array(palet),
      hoog: lucht.uniforms.uHoog.value.clone(),
      midden: lucht.uniforms.uMidden.value.clone(),
      laag: lucht.uniforms.uLaag.value.clone(),
      band: lucht.uniforms.uBand.value.clone(),
      wolk: lucht.uniforms.uWolk.value,
      nevel: LICHT.uNevel.value.clone(),
      nevelMaat: LICHT.uNevelMaat.value.clone(),
      brandt: LICHT.uBrandt.value,
      plassen: LICHT.uPlassen.value,
      klare: LICHT.uKlare.value,
      bunker: LICHT.uBunker.value,
      regen: LICHT.uRegen.value,
      plasKleur: LICHT.uPlasKleur.value.clone(),
      inkt: LICHT.uInktKleur.value.clone(),
    };
    kleurReis = { t0: performance.now(), duur: 750, van, naar: doel };
    huidigeKleurStaat = doel;
  }
}

// Eén heldere schakelaar voor deze ene Klare Lijn-stijl: Nacht (Bunker Hill) of Dag.
function zetTijd(tijd, meteen = false) {
  if (tijd === 'dag') kleur('klareDag', 'dag', meteen);
  else kleur('bunker', 'nacht', meteen);
}

// Wolken als tekening, uit de hand: "gouache" zonder naden, "stapel" met inktlijn, "band" als platte streek.
const wolkCache = new Map();
function wolkBeeld(st) {
  const sleutel = st.naam;
  if (wolkCache.has(sleutel)) return wolkCache.get(sleutel);
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 420;
  const g = c.getContext('2d');
  let zaad = 7;
  const kans = () => (zaad = (zaad * 16807) % 2147483647) / 2147483647;
  if (st.wolkvorm === 'gouache') {
    const bollen = [[155, 250, 72], [265, 212, 98], [405, 185, 124], [565, 202, 112], [705, 232, 92], [825, 252, 72], [912, 266, 52]]
      .map(([x, y, r]) => [x + (kans() - 0.5) * 20, y + (kans() - 0.5) * 14, r * (0.92 + kans() * 0.16), 0.64 + kans() * 0.12]);
    g.fillStyle = st.wolk;
    g.beginPath();
    for (const [x, y, r, plat] of bollen) { g.moveTo(x + r, y); g.ellipse(x, y, r, r * plat, 0, 0, Math.PI * 2); }
    g.rect(145, 240, 765, 58);
    g.fill();
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = st.wolkgrijs || '#9aa9b6';
    g.beginPath();
    g.moveTo(0, 420);
    g.lineTo(0, 260);
    for (let x = 0; x <= 1024; x += 96) g.quadraticCurveTo(x + 48, 244 + kans() * 20, x + 96, 256 + kans() * 14);
    g.lineTo(1024, 420);
    g.closePath();
    g.fill();
    g.globalCompositeOperation = 'source-over';
  } else if (st.wolkvorm === 'band') {
    g.fillStyle = st.wolk;
    for (const [y, x0, x1, dik] of [[150, 40, 980, 46], [235, 190, 860, 34], [300, 20, 620, 22]]) {
      g.beginPath();
      g.moveTo(x0, y);
      g.bezierCurveTo(x0 + (x1 - x0) * 0.25, y - dik * (0.8 + kans() * 0.5), x0 + (x1 - x0) * 0.7, y - dik * (0.6 + kans() * 0.5), x1, y + (kans() - 0.5) * 8);
      g.bezierCurveTo(x0 + (x1 - x0) * 0.7, y + dik * (0.5 + kans() * 0.5), x0 + (x1 - x0) * 0.3, y + dik * (0.7 + kans() * 0.5), x0, y);
      g.fill();
    }
  } else {
    const bollen = [[170, 300, 90], [300, 250, 120], [460, 205, 150], [640, 235, 135], [800, 285, 100], [900, 310, 70]]
      .map(([x, y, r]) => [x + (kans() - 0.5) * 16, y + (kans() - 0.5) * 12, r * (0.94 + kans() * 0.12), 0.92 + kans() * 0.16]);
    const teken = (extra, vul) => {
      g.fillStyle = vul;
      g.beginPath();
      for (const [x, y, r, plat] of bollen) { g.moveTo(x + r + extra, y); g.ellipse(x, y, r + extra, (r + extra) * plat, 0, 0, Math.PI * 2); }
      g.fill();
    };
    g.save();
    g.beginPath(); g.rect(0, 0, 1024, 340); g.clip();
    teken(9, st.inkt);
    teken(0, st.wolk);
    g.restore();
    g.fillStyle = st.inkt;
    g.beginPath();
    g.moveTo(92, 336); g.quadraticCurveTo(500, 328, 940, 337); g.lineTo(938, 345); g.quadraticCurveTo(500, 339, 96, 346);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  wolkCache.set(sleutel, t);
  return t;
}

// De gloed om een brandende lantaarn: een vlakke roomgele schijf, exact in de kleur van de Bunker Hill-lantaarns.
function gloedBeeld() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(235, 226, 162, 0.30)';
  g.beginPath(); g.arc(128, 128, 120, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(248, 242, 198, 0.68)';
  g.beginPath(); g.arc(128, 128, 56, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Een handgetekend dwarrelend blaadje met zwarte inktlijn in gedempt avond-olijfgroen (blijft binnen het Bunker Hill-palet).
function bladBeeld() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.translate(32, 32);
  g.rotate(-0.35);
  g.fillStyle = '#5c6d52';
  g.strokeStyle = '#07090a';
  g.lineWidth = 4.5;
  g.beginPath();
  g.moveTo(-22, 0);
  g.quadraticCurveTo(0, -16, 22, 0);
  g.quadraticCurveTo(0, 16, -22, 0);
  g.closePath();
  g.fill();
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Handgetekend Klare Lijn-uitlaatwolkje (koel avondgrijs met dunne zwarte inktlijn).
function rookBeeld() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const bollen = [[44, 68, 22], [64, 54, 27], [84, 66, 21], [62, 74, 24]];
  g.fillStyle = '#07090a';
  g.beginPath();
  for (const [x, y, r] of bollen) { g.moveTo(x + r + 3.5, y); g.arc(x, y, r + 3.5, 0, Math.PI * 2); }
  g.fill();
  g.fillStyle = '#cfd7d3';
  g.beginPath();
  for (const [x, y, r] of bollen) { g.moveTo(x + r, y); g.arc(x, y, r, 0, Math.PI * 2); }
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Pikzwarte noir-slagschaduw direct onder de rijdende Porsche 930 (zoals de harde zwarte schaduw onder de auto's in Bunker Hill).
function autoSchaduwBeeld() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(6, 8, 9, 0.94)';
  g.beginPath();
  g.roundRect(10, 10, 108, 236, 42);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---- Herstel van Bistrot Chapeau: het oorspronkelijke model verloor achter- en zijgevel + kruisdak.
// We bouwen precies aansluitend op de bestaande oostgevel (x=-31,56) en zuidgevel (z=17,64) de noord- en
// westgevel, de twee bovenramen, het volledige donkere kruisdak met dakpannenlijnen en de schoorsteen —
// met dezelfde vlakShader en lijnShader als de rest van Blaricum.
function bouwChapeauHerstel(vlakMat, lijnMat, id) {
  const vPos = [], vVak = [];
  const lPos = [], lN = [], lEig = [];

  const driehoek = (a, b, c, slot) => {
    vPos.push(...a, ...b, ...c);
    vVak.push(slot, 1, slot, 1, slot, 1);
  };
  const vierhoek = (a, b, c, d, slot) => { driehoek(a, b, c, slot); driehoek(a, c, d, slot); };
  const voegLijn = (a, b, nA, nB, dik = 1.0, ver = 0, stap = 0) => {
    lPos.push(...a, ...b);
    const enc = (v) => [Math.round(v[0] * 127), Math.round(v[1] * 127), Math.round(v[2] * 127), 0];
    lN.push(...enc(nA), ...enc(nB));
    lEig.push(dik, ver, stap);
  };
  const norm = (a, b, c) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const L = Math.hypot(nx, ny, nz) || 1;
    return [nx / L, ny / L, nz / L];
  };

  // Exacte maten van de bestaande oost- en zuidgevel van Bistrot Chapeau:
  const xW = -41.40, xO = -31.58, zN = 10.72, zZ = 17.60;
  const y0 = 0.08, yG = 4.12, yNok = 9.18, zNok = 14.15, xNok = -37.28;
  const brick = id.baksteen_rood >= 0 ? id.baksteen_rood : 15;
  const dak = id.dak_lei >= 0 ? id.dak_lei : 21;
  const ruit = id.ruit_aan >= 0 ? id.ruit_aan : id.ruit_donker;
  const kozijn = id.kozijn_wit >= 0 ? id.kozijn_wit : 33;
  const zwart = id.zwart >= 0 ? id.zwart : 41;

  // 1. Noordgevel (baksteen) + bovenste topgevel dicht bij de nok.
  vierhoek([xW, y0, zN], [xO, y0, zN], [xO, yG + 0.06, zN], [xW, yG + 0.06, zN], brick);
  voegLijn([xW, y0, zN], [xW, yG, zN], [-1, 0, 0], [0, 0, -1], 1.0);
  voegLijn([xO, y0, zN], [xO, yG, zN], [1, 0, 0], [0, 0, -1], 1.0);

  // 2. Westgevel (baksteen) inclusief puntgevel tot aan de oost-westnok + twee nette bovenramen.
  vierhoek([xW, y0, zZ], [xW, y0, zN], [xW, yG + 0.06, zN], [xW, yG + 0.06, zZ], brick);
  driehoek([xW, yG, zZ], [xW, yG, zN], [xW, yNok, zNok], brick);
  voegLijn([xW, y0, zZ], [xW, yG, zZ], [-1, 0, 0], [0, 0, 1], 1.0);
  for (const rz of [12.55, 15.65]) {
    const rw = 0.56, ry0 = 4.65, ry1 = 6.05;
    vierhoek([xW - 0.04, ry0 - 0.07, rz + rw + 0.07], [xW - 0.04, ry0 - 0.07, rz - rw - 0.07],
      [xW - 0.04, ry1 + 0.07, rz - rw - 0.07], [xW - 0.04, ry1 + 0.07, rz + rw + 0.07], kozijn);
    vierhoek([xW - 0.06, ry0, rz + rw], [xW - 0.06, ry0, rz - rw],
      [xW - 0.06, ry1, rz - rw], [xW - 0.06, ry1, rz + rw], ruit);
    const wn = [-1, 0, 0];
    voegLijn([xW - 0.07, ry0, rz - rw], [xW - 0.07, ry1, rz - rw], wn, [0, 0, -1], 0.7);
    voegLijn([xW - 0.07, ry0, rz + rw], [xW - 0.07, ry1, rz + rw], wn, [0, 0, 1], 0.7);
    voegLijn([xW - 0.07, ry0, rz - rw], [xW - 0.07, ry0, rz + rw], wn, [0, -1, 0], 0.7);
    voegLijn([xW - 0.07, ry1, rz - rw], [xW - 0.07, ry1, rz + rw], wn, [0, 1, 0], 0.7);
  }

  // 3. Hoofdkap (oost-west zadeldak met 18 cm overstek) + zuidelijke dwarskap met exacte kilkepers!
  const xWl = xW - 0.18, xOl = xO + 0.18, zNl = zN - 0.22, zZl = zZ + 0.20, yGl = yG - 0.06;
  const rW = [xWl, yNok + 0.05, zNok], rO = [xOl, yNok + 0.05, zNok];
  const rK = [xNok, yNok + 0.05, zNok], rZ = [xNok, yNok + 0.08, zZl];
  const gNW = [xWl, yGl, zNl], gNO = [xOl, yGl, zNl];
  const gZW = [xWl, yGl, zZl], gZO = [xOl, yGl, zZl];
  const gKV = [-33.05, yGl, zZl]; // aansluiting van de zuid-dwarskap op de goot

  // Noordelijk dakvlak (één doorlopend schild van west naar oost).
  vierhoek(gNW, gNO, rO, rW, dak);
  const nNoord = norm(gNW, gNO, rO);
  // Zuidelijk hoofddak (oostelijk deel naast de dwarskap, sluit strak aan op de kilkeper rK -> gKV).
  vierhoek(gKV, gZO, rO, rK, dak);
  const nZuid = norm(gKV, gZO, rO);
  // Zuidelijke dwarskap: oostvlak (rZ -> rK -> gKV) en westvlak (rZ -> gZW -> rK), plus resthoekje west (rW -> rK -> gZW).
  driehoek(rZ, rK, gKV, dak);
  driehoek(rZ, gZW, rK, dak);
  driehoek(rW, gZW, rK, dak);
  const nDwO = norm(rZ, rK, gKV);
  const nDwW = norm(rZ, gZW, rK);

  // Hoofdlijnen van de kap (nokken, windveren, goten, kilkepers).
  voegLijn(rW, rO, nNoord, nZuid, 1.15);
  voegLijn(rK, rZ, nDwO, nDwW, 1.15);
  voegLijn(rK, gKV, nZuid, nDwO, 1.0);
  voegLijn(rK, gZW, nZuid, nDwW, 0.95);
  voegLijn(gNW, gNO, nNoord, [0, 0, -1], 1.05);
  voegLijn(gKV, gZO, nZuid, [0, 0, 1], 1.05);
  voegLijn(gNW, rW, nNoord, [-1, 0, 0], 1.1);
  voegLijn(gZW, rW, nZuid, [-1, 0, 0], 1.1);
  voegLijn(gNO, rO, nNoord, [1, 0, 0], 1.1);
  voegLijn(gZO, rO, nZuid, [1, 0, 0], 1.1);
  voegLijn(gZW, rZ, nDwW, [0, 0, 1], 1.1);
  voegLijn(gKV, rZ, nDwO, [0, 0, 1], 1.1);

  // Horizontale dakpan-rijen (klStap = 0.45 zodat ze op afstand rustig wegvallen, net als het echte model).
  const lerp3 = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  for (let i = 1; i <= 11; i++) {
    const t = i / 12;
    voegLijn(lerp3(gNW, rW, t), lerp3(gNO, rO, t), nNoord, nNoord, 0.65, 95, 0.44);
    voegLijn(lerp3(gKV, rK, t), lerp3(gZO, rO, t), nZuid, nZuid, 0.65, 95, 0.44);
    voegLijn(lerp3(gKV, rZ, t), lerp3(gKV, rK, t), nDwO, nDwO, 0.62, 95, 0.44);
    voegLijn(lerp3(gZW, rZ, t), lerp3(gZW, rK, t), nDwW, nDwW, 0.62, 95, 0.44);
  }

  // 4. Bakstenen schoorsteen op de hoofdnok.
  const sx0 = -35.65, sx1 = -34.85, sz0 = 13.80, sz1 = 14.50, sy0 = 8.40, sy1 = 10.25;
  vierhoek([sx0, sy0, sz0], [sx1, sy0, sz0], [sx1, sy1, sz0], [sx0, sy1, sz0], brick);
  vierhoek([sx1, sy0, sz1], [sx0, sy0, sz1], [sx0, sy1, sz1], [sx1, sy1, sz1], brick);
  vierhoek([sx0, sy0, sz1], [sx0, sy0, sz0], [sx0, sy1, sz0], [sx0, sy1, sz1], brick);
  vierhoek([sx1, sy0, sz0], [sx1, sy0, sz1], [sx1, sy1, sz1], [sx1, sy1, sz0], brick);
  vierhoek([sx0 - 0.05, sy1, sz0 - 0.05], [sx1 + 0.05, sy1, sz0 - 0.05], [sx1 + 0.05, sy1, sz1 + 0.05], [sx0 - 0.05, sy1, sz1 + 0.05], zwart);
  voegLijn([sx0, sy0, sz0], [sx0, sy1, sz0], [-1, 0, 0], [0, 0, -1], 0.95);
  voegLijn([sx1, sy0, sz0], [sx1, sy1, sz0], [1, 0, 0], [0, 0, -1], 0.95);
  voegLijn([sx0, sy0, sz1], [sx0, sy1, sz1], [-1, 0, 0], [0, 0, 1], 0.95);
  voegLijn([sx1, sy0, sz1], [sx1, sy1, sz1], [1, 0, 0], [0, 0, 1], 0.95);
  voegLijn([sx0, sy1, sz0], [sx1, sy1, sz0], [0, 1, 0], [0, 0, -1], 0.95);
  voegLijn([sx0, sy1, sz1], [sx1, sy1, sz1], [0, 1, 0], [0, 0, 1], 0.95);
  voegLijn([sx0, sy1, sz0], [sx0, sy1, sz1], [0, 1, 0], [-1, 0, 0], 0.95);
  voegLijn([sx1, sy1, sz0], [sx1, sy1, sz1], [0, 1, 0], [1, 0, 0], 0.95);

  const vlakGeo = driehoeken(new Float32Array(vPos), { vak: [new Uint8Array(vVak), 2] });
  const vlakMesh = new THREE.Mesh(vlakGeo, vlakMat);
  vlakMesh.frustumCulled = false;

  const lg = new THREE.InstancedBufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 1, 0], 3));
  lg.setIndex([0, 1, 2, 2, 1, 3]);
  const einden = new THREE.InstancedInterleavedBuffer(new Float32Array(lPos), 6, 1);
  lg.setAttribute('aStart', new THREE.InterleavedBufferAttribute(einden, 3, 0));
  lg.setAttribute('aEnd', new THREE.InterleavedBufferAttribute(einden, 3, 3));
  const normalen = new THREE.InstancedInterleavedBuffer(new Int8Array(lN), 8, 1);
  lg.setAttribute('klNA', new THREE.InterleavedBufferAttribute(normalen, 3, 0, true));
  lg.setAttribute('klNB', new THREE.InterleavedBufferAttribute(normalen, 3, 4, true));
  const eigen = new THREE.InstancedInterleavedBuffer(new Float32Array(lEig), 3, 1);
  lg.setAttribute('klDik', new THREE.InterleavedBufferAttribute(eigen, 1, 0));
  lg.setAttribute('klVer', new THREE.InterleavedBufferAttribute(eigen, 1, 1));
  lg.setAttribute('klStap', new THREE.InterleavedBufferAttribute(eigen, 1, 2));
  lg.instanceCount = lPos.length / 6;
  const lijnMesh = new THREE.Mesh(lg, lijnMat);
  lijnMesh.frustumCulled = false;
  lijnMesh.renderOrder = 10;

  return { vlakMesh, lijnMesh };
}

// ---- Splits de echte 59k-vertex Blender Porsche 930 Turbo (plus zijn 13.959 vector-inktlijnen) uit de
// statische dorpsbuffers en draai hem naar een schone lokale basis (neus langs +Z, wielen op y=0).
function splitsPorsche(rPos, rNor, rVak, lPos, lN, lEig) {
  // Strikte doos om de Porsche 930 (maxY carrosserie = 1,29 m): zo blijft elke straat- of paallijn bij het dorp.
  const inBox = (x, y, z) => x > -27.32 && x < -24.35 && z > 19.55 && z < 24.05 && y > 0.02 && y < 1.38;
  // Exact gemeten hart en voorwaartse as (+Z = neus, +X = rechts, rechtshandig).
  const cx = -25.765, cz = 21.728, yOff = 0.02;
  const fx = -0.338, fz = 0.941;
  const rx = 0.941, rz = 0.338;

  const rTriCount = rPos.length / 9;
  let pTri = 0;
  const isP = new Uint8Array(rTriCount);
  for (let t = 0; t < rTriCount; t++) {
    const i = t * 9;
    const mx = (rPos[i] + rPos[i + 3] + rPos[i + 6]) / 3;
    const my = (rPos[i + 1] + rPos[i + 4] + rPos[i + 7]) / 3;
    const mz = (rPos[i + 2] + rPos[i + 5] + rPos[i + 8]) / 3;
    if (inBox(mx, my, mz)) { isP[t] = 1; pTri++; }
  }
  const sTri = rTriCount - pTri;
  const srPos = new Float32Array(sTri * 9), srNor = new Int8Array(sTri * 9), srVak = new Uint8Array(sTri * 6);
  const prPos = new Float32Array(pTri * 9), prNor = new Int8Array(pTri * 9), prVak = new Uint8Array(pTri * 6);
  let si = 0, pi = 0;
  for (let t = 0; t < rTriCount; t++) {
    if (isP[t]) {
      for (let k = 0; k < 3; k++) {
        const src = (t * 3 + k) * 3, dst = (pi * 3 + k) * 3;
        const dx = rPos[src] - cx, dz = rPos[src + 2] - cz;
        prPos[dst] = dx * rx + dz * rz;
        prPos[dst + 1] = rPos[src + 1] - yOff;
        prPos[dst + 2] = dx * fx + dz * fz;
        const nx = rNor[src], ny = rNor[src + 1], nz = rNor[src + 2];
        prNor[dst] = Math.max(-127, Math.min(127, Math.round(nx * rx + nz * rz)));
        prNor[dst + 1] = ny;
        prNor[dst + 2] = Math.max(-127, Math.min(127, Math.round(nx * fx + nz * fz)));
        const vs = (t * 3 + k) * 2, vd = (pi * 3 + k) * 2;
        prVak[vd] = rVak[vs]; prVak[vd + 1] = rVak[vs + 1];
      }
      pi++;
    } else {
      srPos.set(rPos.subarray(t * 9, t * 9 + 9), si * 9);
      srNor.set(rNor.subarray(t * 9, t * 9 + 9), si * 9);
      srVak.set(rVak.subarray(t * 6, t * 6 + 6), si * 6);
      si++;
    }
  }

  // Splits ook alle echte vector-inktlijnen van de Porsche mee: BEIDE eindpunten in de doos én lengte < 1,6 m!
  const lCount = lPos.length / 6;
  let pL = 0;
  const isPL = new Uint8Array(lCount);
  for (let i = 0; i < lCount; i++) {
    const o = i * 6;
    const x0 = lPos[o], y0 = lPos[o + 1], z0 = lPos[o + 2];
    const x1 = lPos[o + 3], y1 = lPos[o + 4], z1 = lPos[o + 5];
    if (inBox(x0, y0, z0) && inBox(x1, y1, z1) && Math.hypot(x1 - x0, y1 - y0, z1 - z0) < 1.6) {
      isPL[i] = 1; pL++;
    }
  }
  const sL = lCount - pL;
  const slPos = new Float32Array(sL * 6), slN = new Int8Array(sL * 8), slEig = new Float32Array(sL * 3);
  const plPos = new Float32Array(pL * 6), plN = new Int8Array(pL * 8), plEig = new Float32Array(pL * 3);
  let sli = 0, pli = 0;
  for (let i = 0; i < lCount; i++) {
    if (isPL[i]) {
      for (let e = 0; e < 2; e++) {
        const src = i * 6 + e * 3, dst = pli * 6 + e * 3;
        const dx = lPos[src] - cx, dz = lPos[src + 2] - cz;
        plPos[dst] = dx * rx + dz * rz;
        plPos[dst + 1] = lPos[src + 1] - yOff;
        plPos[dst + 2] = dx * fx + dz * fz;
        const ns = i * 8 + e * 4, nd = pli * 8 + e * 4;
        const nx = lN[ns], ny = lN[ns + 1], nz = lN[ns + 2];
        plN[nd] = Math.max(-127, Math.min(127, Math.round(nx * rx + nz * rz)));
        plN[nd + 1] = ny;
        plN[nd + 2] = Math.max(-127, Math.min(127, Math.round(nx * fx + nz * fz)));
        plN[nd + 3] = 0;
      }
      plEig.set(lEig.subarray(i * 3, i * 3 + 3), pli * 3);
      pli++;
    } else {
      slPos.set(lPos.subarray(i * 6, i * 6 + 6), sli * 6);
      slN.set(lN.subarray(i * 8, i * 8 + 8), sli * 8);
      slEig.set(lEig.subarray(i * 3, i * 3 + 3), sli * 3);
      sli++;
    }
  }
  return {
    statisch: { rPos: srPos, rNor: srNor, rVak: srVak, lPos: slPos, lN: slN, lEig: slEig },
    porsche: { rPos: prPos, rNor: prNor, rVak: prVak, lPos: plPos, lN: plN, lEig: plEig },
  };
}

// ---- De echte rijdende Porsche 930 Turbo: scheurt door de bocht bij de kruising met subtiele Kuifje-uitlaatrook,
// opvliegende herfstblaadjes en gouden koplampkegels, en parkeert strak in een vak voor de Albert Heijn.
function bouwPorscheLeven(pData, rompMat, randMat, lijnMat) {
  const group = new THREE.Group();
  const chassis = new THREE.Group(); // apart zodat de koets licht kan overhellen in de bocht en duiken bij remmen
  group.add(chassis);

  const pRomp = driehoeken(pData.rPos, { normal: [pData.rNor, 3, true], vak: [pData.rVak, 2] });
  const pRandMesh = new THREE.Mesh(pRomp, randMat);
  const pRompMesh = new THREE.Mesh(pRomp, rompMat);
  pRandMesh.frustumCulled = pRompMesh.frustumCulled = false;
  chassis.add(pRandMesh, pRompMesh);

  const pg = new THREE.InstancedBufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 1, 0], 3));
  pg.setIndex([0, 1, 2, 2, 1, 3]);
  const einden = new THREE.InstancedInterleavedBuffer(pData.lPos, 6, 1);
  pg.setAttribute('aStart', new THREE.InterleavedBufferAttribute(einden, 3, 0));
  pg.setAttribute('aEnd', new THREE.InterleavedBufferAttribute(einden, 3, 3));
  const normalen = new THREE.InstancedInterleavedBuffer(pData.lN, 8, 1);
  pg.setAttribute('klNA', new THREE.InterleavedBufferAttribute(normalen, 3, 0, true));
  pg.setAttribute('klNB', new THREE.InterleavedBufferAttribute(normalen, 3, 4, true));
  const eigen = new THREE.InstancedInterleavedBuffer(pData.lEig, 3, 1);
  pg.setAttribute('klDik', new THREE.InterleavedBufferAttribute(eigen, 1, 0));
  pg.setAttribute('klVer', new THREE.InterleavedBufferAttribute(eigen, 1, 1));
  pg.setAttribute('klStap', new THREE.InterleavedBufferAttribute(eigen, 1, 2));
  pg.instanceCount = pData.lPos.length / 6;
  const pLijnMesh = new THREE.Mesh(pg, lijnMat);
  pLijnMesh.frustumCulled = false;
  pLijnMesh.renderOrder = 10;
  chassis.add(pLijnMesh);

  // Ovale inkt-slagschaduw direct onder de Porsche.
  const schaduwGeo = new THREE.PlaneGeometry(2.15, 4.55);
  schaduwGeo.rotateX(-Math.PI / 2);
  const schaduwMat = new THREE.MeshBasicMaterial({ map: autoSchaduwBeeld(), transparent: true, depthWrite: false });
  const schaduw = new THREE.Mesh(schaduwGeo, schaduwMat);
  schaduw.position.set(0, 0.025, 0.12);
  schaduw.renderOrder = 2;
  group.add(schaduw);

  // Ronde 930-koplampen met strakke zwarte inktomlijning (zoals de auto's op de Bunker Hill-cover) + 930 Turbo achterlichtbalk.
  const kopMat = new THREE.MeshBasicMaterial({ color: 0xf7f2c6, transparent: true, opacity: 0.0 });
  const kopRandMat = new THREE.MeshBasicMaterial({ color: 0x080a0b, transparent: true, opacity: 0.0 });
  const kopGeo = new THREE.CircleGeometry(0.132, 20);
  const kopRandGeo = new THREE.CircleGeometry(0.158, 20);
  for (const lx of [-0.65, 0.63]) {
    const kr = new THREE.Mesh(kopRandGeo, kopRandMat);
    kr.position.set(lx, 0.66, 1.972);
    kr.renderOrder = 10;
    const kl = new THREE.Mesh(kopGeo, kopMat);
    kl.position.set(lx, 0.66, 1.985);
    kl.renderOrder = 11;
    chassis.add(kr, kl);
  }
  const achterMat = new THREE.MeshBasicMaterial({ color: 0xc92c24, transparent: true, opacity: 0.0 });
  const achterBalk = new THREE.Mesh(new THREE.PlaneGeometry(1.16, 0.085), achterMat);
  achterBalk.position.set(0, 0.57, -1.94);
  achterBalk.rotation.y = Math.PI;
  achterBalk.renderOrder = 11;
  chassis.add(achterBalk);

  // Dubbele strakke klare-lijn roomgele koplampkegels over het donkere wegdek.
  const kegelGeo = new THREE.BufferGeometry();
  kegelGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.66, 0.05, 1.95,  -0.44, 0.05, 1.95,  -0.25, 0.05, 12.2,
    -0.66, 0.05, 1.95,  -0.25, 0.05, 12.2,  -2.85, 0.05, 12.2,
     0.44, 0.05, 1.95,   0.66, 0.05, 1.95,   2.85, 0.05, 12.2,
     0.44, 0.05, 1.95,   2.85, 0.05, 12.2,   0.25, 0.05, 12.2,
  ], 3));
  const kegelMat = new THREE.MeshBasicMaterial({
    color: 0xded796, transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -3,
  });
  const kegel = new THREE.Mesh(kegelGeo, kegelMat);
  kegel.renderOrder = 3;
  group.add(kegel);

  // Subtiele Kuifje-uitlaatrook (18 herbruikbare getekende wolkjes uit de linker einddemper).
  const rookTex = rookBeeld();
  const rookGroep = new THREE.Group();
  const rookPool = [];
  for (let i = 0; i < 18; i++) {
    const m = new THREE.SpriteMaterial({ map: rookTex, transparent: true, opacity: 0, depthWrite: false });
    const sp = new THREE.Sprite(m);
    sp.visible = false;
    sp.renderOrder = 12;
    rookGroep.add(sp);
    rookPool.push({ sp, mat: m, leeftijd: 99, duur: 1.0, vx: 0, vy: 0, vz: 0, s0: 0.22, s1: 0.85 });
  }
  scene.add(rookGroep);
  let rookIdx = 0, rookTimer = 0;

  // Spoor van opvliegende herfstblaadjes achter de Porsche-spoiler tijdens het scheuren door de bocht!
  const spoorGeo = new THREE.PlaneGeometry(0.23, 0.23);
  const spoorMat = new THREE.MeshBasicMaterial({ map: bladBeeld(), transparent: true, alphaTest: 0.2, side: THREE.DoubleSide });
  const AANTAL_SPOOR = 48;
  const spoorMesh = new THREE.InstancedMesh(spoorGeo, spoorMat, AANTAL_SPOOR);
  spoorMesh.frustumCulled = false;
  spoorMesh.renderOrder = 11;
  scene.add(spoorMesh);
  const spoorPool = [];
  let sZaad = 1337;
  const sKans = () => (sZaad = (sZaad * 16807) % 2147483647) / 2147483647;
  const spoorDummy = new THREE.Object3D();
  for (let i = 0; i < AANTAL_SPOOR; i++) {
    spoorPool.push({
      actief: false, leeftijd: 99, duur: 2.2,
      x: 0, y: -10, z: 0, vx: 0, vy: 0, vz: 0,
      rx: sKans() * 6, ry: sKans() * 6, rz: sKans() * 6,
      wrx: (sKans() - 0.5) * 8, wry: (sKans() - 0.5) * 7, wrz: (sKans() - 0.5) * 9,
      schaal: 0.85 + sKans() * 0.6,
    });
    spoorDummy.position.set(0, -50, 0);
    spoorDummy.updateMatrix();
    spoorMesh.setMatrixAt(i, spoorDummy.matrix);
  }
  spoorMesh.instanceMatrix.needsUpdate = true;
  let spoorIdx = 0, spoorTimer = 0;

  // Route van de Porsche 930: van Huizerweg vlot door de bocht bij de kruising langs Chapeau, recht naar
  // de Albert Heijn en soepel vooruit ingeparkeerd in zaagtand-parkeervak #2 ((-25.45, -8.10), richting (+0.275, -0.961)).
  const route = new THREE.CatmullRomCurve3([
    new THREE.Vector3(12.5, 0, 15.2),
    new THREE.Vector3(4.0, 0, 20.0),
    new THREE.Vector3(-6.5, 0, 25.0),
    new THREE.Vector3(-17.5, 0, 27.6),
    new THREE.Vector3(-23.6, 0, 25.2),   // de krappe bocht op de kruising!
    new THREE.Vector3(-25.6, 0, 19.5),
    new THREE.Vector3(-25.8, 0, 12.0),   // langs het herstelde Bistrot Chapeau
    new THREE.Vector3(-26.9, 0, 4.2),
    new THREE.Vector3(-28.2, 0, -1.5),
    new THREE.Vector3(-27.8, 0, -4.6),
    new THREE.Vector3(-26.25, 0, -6.0),  // indraaien naar AH-parkeervak #2
    new THREE.Vector3(-25.75, 0, -7.05),
    new THREE.Vector3(-25.45, 0, -8.10), // geparkeerd pal voor de Albert Heijn!
  ]);

  const tmpPos = new THREE.Vector3(), tmpVoor = new THREE.Vector3(), tmpAchter = new THREE.Vector3();
  const uitlaatWereld = new THREE.Vector3(), kontWereld = new THREE.Vector3();
  const d1 = new THREE.Vector3(), d2 = new THREE.Vector3();
  let huidigeU = 1.0, huidigeSnelheid = 0, laatsteSec = 0;

  // Niet-lineair snelheidsprofiel: vlot door de bocht, dan strak afremmen in het AH-parkeervak.
  const voortgang = (t) => {
    const c = Math.max(0, Math.min(1, t));
    if (c < 0.72) {
      const k = c / 0.72;
      return 0.82 * (0.18 * k * k + 0.82 * k);
    }
    const k = (c - 0.72) / 0.28;
    const rem = 1 - Math.pow(1 - k, 3);
    return 0.82 + 0.18 * rem;
  };

  const zetOp = (u, snelheid, bocht, remmen) => {
    const uc = Math.max(0.001, Math.min(0.9999, u));
    route.getPointAt(uc, tmpPos);
    route.getPointAt(Math.min(0.9999, uc + 0.004), tmpVoor);
    if (uc > 0.995) {
      tmpVoor.set(tmpPos.x + 0.275, 0, tmpPos.z - 0.961);
    }
    group.position.copy(tmpPos);
    group.lookAt(tmpVoor);
    chassis.rotation.z = THREE.MathUtils.clamp(bocht * 0.95, -0.075, 0.075);
    chassis.rotation.x = THREE.MathUtils.clamp(remmen * 0.028 - snelheid * 0.008, -0.018, 0.032);
    group.updateMatrixWorld(true);
    huidigeU = uc;
    huidigeSnelheid = snelheid;
  };

  const spuitRook = (sterkte) => {
    const r = rookPool[rookIdx];
    rookIdx = (rookIdx + 1) % rookPool.length;
    uitlaatWereld.set(-0.52, 0.25, -2.02).applyMatrix4(group.matrixWorld);
    const achterRicht = new THREE.Vector3(0, 0, -1).transformDirection(group.matrixWorld);
    r.sp.position.copy(uitlaatWereld);
    r.sp.visible = true;
    r.leeftijd = 0;
    r.duur = 0.75 + Math.random() * 0.45;
    r.vx = achterRicht.x * (1.2 + sterkte * 2.2) + (Math.random() - 0.5) * 0.45;
    r.vy = 0.55 + Math.random() * 0.45;
    r.vz = achterRicht.z * (1.2 + sterkte * 2.2) + (Math.random() - 0.5) * 0.45;
    r.s0 = 0.20 + sterkte * 0.14;
    r.s1 = 0.62 + sterkte * 0.48;
    r.mat.opacity = 1.0;
  };

  const spuitBlad = (sterkte) => {
    const b = spoorPool[spoorIdx];
    spoorIdx = (spoorIdx + 1) % spoorPool.length;
    kontWereld.set((Math.random() - 0.5) * 1.65, 0.14 + Math.random() * 0.28, -1.6 - Math.random() * 0.9).applyMatrix4(group.matrixWorld);
    const achterRicht = new THREE.Vector3(0, 0, -1).transformDirection(group.matrixWorld);
    b.actief = true;
    b.leeftijd = 0;
    b.duur = 1.9 + Math.random() * 1.1;
    b.x = kontWereld.x; b.y = kontWereld.y; b.z = kontWereld.z;
    b.vx = achterRicht.x * (1.8 + sterkte * 3.5) + (Math.random() - 0.5) * 2.5;
    b.vy = 1.7 + sterkte * 2.2 + Math.random() * 1.1;
    b.vz = achterRicht.z * (1.8 + sterkte * 3.5) + (Math.random() - 0.5) * 2.5;
  };

  const werkDeeltjesBij = (dt) => {
    for (const r of rookPool) {
      if (r.leeftijd >= r.duur) continue;
      r.leeftijd += dt;
      const p = r.leeftijd / r.duur;
      if (p >= 1) { r.sp.visible = false; continue; }
      r.sp.position.x += r.vx * dt * (1 - p * 0.6);
      r.sp.position.y += r.vy * dt;
      r.sp.position.z += r.vz * dt * (1 - p * 0.6);
      const groei = r.s0 + (r.s1 - r.s0) * Math.sqrt(Math.min(1, p * 1.6));
      const krimp = p > 0.68 ? Math.max(0.02, 1 - (p - 0.68) / 0.32) : 1.0;
      const s = groei * krimp;
      r.sp.scale.set(s, s, 1);
      r.mat.opacity = 1.0;
    }
    let vies = false;
    for (let i = 0; i < AANTAL_SPOOR; i++) {
      const b = spoorPool[i];
      if (!b.actief) continue;
      vies = true;
      b.leeftijd += dt;
      if (b.leeftijd >= b.duur) {
        b.actief = false;
        spoorDummy.position.set(0, -50, 0);
        spoorDummy.updateMatrix();
        spoorMesh.setMatrixAt(i, spoorDummy.matrix);
        continue;
      }
      b.vy -= 3.2 * dt;
      b.vx *= Math.max(0, 1 - 1.3 * dt);
      b.vz *= Math.max(0, 1 - 1.3 * dt);
      b.x += (b.vx + Math.sin(b.leeftijd * 5.0 + i) * 0.5) * dt;
      b.y = Math.max(0.05, b.y + b.vy * dt);
      b.z += (b.vz + Math.cos(b.leeftijd * 4.5 + i) * 0.5) * dt;
      if (b.y <= 0.06) { b.vx *= 0.6; b.vz *= 0.6; b.vy = 0; }
      const fade = b.leeftijd > b.duur * 0.75 ? 1 - (b.leeftijd - b.duur * 0.75) / (b.duur * 0.25) : 1;
      spoorDummy.position.set(b.x, b.y, b.z);
      spoorDummy.rotation.set(b.rx + b.leeftijd * b.wrx, b.ry + b.leeftijd * b.wry, b.rz + b.leeftijd * b.wrz);
      spoorDummy.scale.setScalar(b.schaal * Math.max(0.01, fade));
      spoorDummy.updateMatrix();
      spoorMesh.setMatrixAt(i, spoorDummy.matrix);
    }
    if (vies) spoorMesh.instanceMatrix.needsUpdate = true;
  };

  zetOp(1.0, 0, 0, 0);

  return {
    group, route,
    resetDeeltjes() {
      for (const r of rookPool) { r.leeftijd = 99; r.sp.visible = false; }
      for (let i = 0; i < AANTAL_SPOOR; i++) {
        spoorPool[i].actief = false;
        spoorDummy.position.set(0, -50, 0);
        spoorDummy.updateMatrix();
        spoorMesh.setMatrixAt(i, spoorDummy.matrix);
      }
      spoorMesh.instanceMatrix.needsUpdate = true;
      rookTimer = 0; spoorTimer = 0;
    },
    zetIntroStand(tNorm, sec) {
      const u = voortgang(tNorm);
      const uPrev = voortgang(Math.max(0, tNorm - 0.015));
      const uNext = voortgang(Math.min(1, tNorm + 0.015));
      const snelheid = (uNext - uPrev) / 0.03;
      route.getPointAt(Math.max(0.001, u - 0.02), tmpAchter);
      route.getPointAt(u, tmpPos);
      route.getPointAt(Math.min(0.999, u + 0.02), tmpVoor);
      d1.subVectors(tmpPos, tmpAchter).normalize();
      d2.subVectors(tmpVoor, tmpPos).normalize();
      const bocht = (d1.x * d2.z - d1.z * d2.x) * Math.min(1.5, snelheid);
      const remmen = tNorm > 0.72 && tNorm < 0.99 ? Math.sin(((tNorm - 0.72) / 0.27) * Math.PI) : 0;
      zetOp(u, snelheid, bocht, remmen);

      const dt = Math.min(0.08, Math.max(0.001, sec - laatsteSec));
      laatsteSec = sec;
      if (isAfdruk && tNorm > 0.15 && tNorm < 0.92) {
        this.resetDeeltjes();
        for (let k = 0; k < 4; k++) {
          const pk = Math.max(0.02, u - 0.017 * (k + 1));
          route.getPointAt(pk, tmpPos);
          const r = rookPool[k];
          r.sp.position.set(tmpPos.x, 0.36 + k * 0.19, tmpPos.z);
          r.sp.scale.setScalar(0.32 + k * 0.11);
          r.mat.opacity = 1.0;
          r.sp.visible = true;
        }
        for (let k = 0; k < 28; k++) {
          const pk = Math.max(0.01, u - 0.007 * (k + 1));
          route.getPointAt(pk, tmpPos);
          spoorDummy.position.set(tmpPos.x + Math.sin(k * 2.3) * 1.3, 0.35 + (k % 5) * 0.34, tmpPos.z + Math.cos(k * 1.9) * 1.3);
          spoorDummy.rotation.set(k * 0.8, k * 1.1, k * 0.5);
          spoorDummy.scale.setScalar(1.1);
          spoorDummy.updateMatrix();
          spoorMesh.setMatrixAt(k, spoorDummy.matrix);
        }
        spoorMesh.instanceMatrix.needsUpdate = true;
        return;
      }
      if (tNorm < 0.96 && snelheid > 0.06) {
        rookTimer += dt;
        if (rookTimer > 0.11) { rookTimer = 0; spuitRook(Math.min(1, snelheid)); }
        spoorTimer += dt;
        const bladInterval = (u > 0.18 && u < 0.84) ? 0.04 : 0.11;
        if (spoorTimer > bladInterval) { spoorTimer = 0; spuitBlad(Math.min(1, snelheid)); }
      }
      werkDeeltjesBij(dt);
    },
    updateRust(sec) {
      const dt = Math.min(0.08, Math.max(0.001, sec - laatsteSec));
      laatsteSec = sec;
      if (huidigeU >= 0.99 && huidigeSnelheid === 0) {
        werkDeeltjesBij(dt);
      }
    },
    zetLicht(brandt, inktKleur, lichtNaamNu) {
      const isNacht = lichtNaamNu === 'nacht' || lichtNaamNu === 'bunker';
      const sterkte = brandt;
      kegelMat.opacity = isNacht ? sterkte * 0.56 : sterkte * 0.44;
      kegel.visible = sterkte > 0.04;
      kopMat.opacity = sterkte * 0.96;
      kopRandMat.opacity = sterkte;
      achterMat.opacity = sterkte * 0.92;
      schaduwMat.color.copy(inktKleur);
    },
    positie(uit) { return uit.copy(group.position); },
  };
}

// ---- Zes kleine handgetekende gierzwaluwen hoog boven de nok van het hoekpand.
function bouwVogels() {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x181512, side: THREE.DoubleSide });
  const vleugelGeo = new THREE.BufferGeometry();
  vleugelGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0.08,   0.42, 0.05, -0.06,   0.18, 0, -0.14,
  ], 3));
  const items = [];
  for (let i = 0; i < 6; i++) {
    const v = new THREE.Group();
    const l = new THREE.Mesh(vleugelGeo, mat);
    const r = new THREE.Mesh(vleugelGeo, mat);
    r.scale.x = -1;
    v.add(l, r);
    v.scale.setScalar(0.85 + (i % 3) * 0.16);
    group.add(v);
    items.push({ v, l, r, fase: i * 1.05, rX: 24 + (i % 3) * 4, rZ: 18 + (i % 2) * 5, y: 19.5 + i * 1.1 });
  }
  return {
    group,
    update(sec) {
      for (const it of items) {
        const a = sec * 0.24 + it.fase;
        const x = -2 + Math.cos(a) * it.rX;
        const z = 7 + Math.sin(a) * it.rZ;
        const y = it.y + Math.sin(a * 2.0) * 1.4;
        it.v.position.set(x, y, z);
        it.v.rotation.y = Math.atan2(-Math.sin(a) * it.rX, Math.cos(a) * it.rZ);
        const slag = Math.sin(sec * 7.5 + it.fase * 3.0) * 0.42;
        it.l.rotation.z = slag;
        it.r.rotation.z = -slag;
      }
    },
  };
}

function maat() {
  const b = doek.clientWidth, h = doek.clientHeight;
  if (!b || !h || !rand) return;
  renderer.setSize(b, h, false);
  camera.aspect = b / h;
  camera.updateProjectionMatrix();
  const px = renderer.getDrawingBufferSize(new THREE.Vector2());
  const dpr = renderer.getPixelRatio();
  const u = lijn.material.uniforms;
  u.uRes.value.copy(px);
  u.uLijn.value = HAND.lijn * dpr * lijnMaat;
  u.uBibber.value = HAND.bibber * dpr;
  u.uGolf.value = HAND.golf * dpr;
  rand.uniforms.maat.value.copy(px);
  rand.uniforms.dikte.value = HAND.lijn * 0.72 * dpr * lijnMaat;
}

function stopRondleiding() {
  if (!rondleiding) return;
  rondleiding = null;
  const knop = document.getElementById('rondleiding');
  if (knop) { knop.setAttribute('aria-pressed', 'false'); knop.textContent = 'Rondleiding'; }
  werkCartoucheBij();
}

function stopIntro(autoParkeren = false) {
  if (!intro) return;
  intro = null;
  const knop = document.getElementById('intro-knop');
  if (knop) { knop.setAttribute('aria-pressed', 'false'); knop.textContent = 'Intro'; }
  if (autoParkeren && porsche) porsche.zetIntroStand(1.0, performance.now() * 0.001);
  werkCartoucheBij();
}

// ---- Kuifje / Tintin intro-scène in twee strak getimede fases:
// Fase 1 (0..0.34): snelle duikvlucht van hoog boven Blaricum omlaag tot op straatniveau (y=1,75 m).
// Fase 2 (0.34..1.0): op straatniveau precies de bocht pakken met de Porsche 930 Turbo (rook + opvliegende blaadjes),
// meebewegen langs het herstelde Bistrot Chapeau en strak inparkeren pal voor de Albert Heijn.
const DUIK_OGEN = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-4, 42, 52),
  new THREE.Vector3(-16, 17, 38),
  new THREE.Vector3(-25.5, 4.2, 31.5),
  new THREE.Vector3(-29.2, 1.70, 26.8),
]);
const DUIK_DOELEN = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-14, 3.0, 12),
  new THREE.Vector3(-18, 2.2, 18),
  new THREE.Vector3(-22, 1.3, 22),
  new THREE.Vector3(-23.2, 1.0, 23.0),
]);
const STRAAT_OGEN = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-29.2, 1.70, 26.8), // laag op de open kruising
  new THREE.Vector3(-29.6, 1.55, 20.5), // laag bij de bocht, 2,9 m ten zuiden van Chapeau (z=17,60)
  new THREE.Vector3(-29.4, 1.85, 12.2), // open straat, 2,18 m ten oosten van Chapeau's oostgevel (x=-31,58)
  new THREE.Vector3(-30.6, 2.55, 4.4),  // 6,3 m ten noorden van Chapeau (z=10,72), vrij zicht naar AH
  new THREE.Vector3(-34.8, 3.85, 3.6),  // eindkader op de geparkeerde Porsche voor de AH
]);
const STRAAT_DOELEN = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-23.2, 1.0, 23.0),
  new THREE.Vector3(-24.8, 0.95, 17.5),
  new THREE.Vector3(-25.8, 1.0, 9.2),
  new THREE.Vector3(-26.2, 1.2, -4.5),
  new THREE.Vector3(-24.2, 1.55, -7.8),
]);

const hoekVoorScherm = (h) => (camera.aspect < 1 ? Math.min(62, h + 15) : h);

function pasIntroFrameToe(tNorm, sec) {
  const c = Math.max(0, Math.min(1, tNorm));
  const pT = Math.max(0, Math.min(1, (c - 0.16) / 0.78));
  if (porsche) porsche.zetIntroStand(pT, sec);

  if (c < 0.34) {
    const k = c / 0.34;
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    DUIK_OGEN.getPointAt(e, camera.position);
    DUIK_DOELEN.getPointAt(e, stuur.target);
    camera.fov = hoekVoorScherm(38 + 3 * e);
  } else {
    const k = (c - 0.34) / 0.66;
    STRAAT_OGEN.getPointAt(k, camera.position);
    STRAAT_DOELEN.getPointAt(k, stuur.target);
    if (porsche && k < 0.88) {
      const volg = Math.sin((k / 0.88) * Math.PI);
      const pPos = porsche.positie(new THREE.Vector3());
      pPos.y += 0.85;
      stuur.target.lerp(pPos, volg * 0.78);
    }
    camera.fov = hoekVoorScherm(41 - 3 * k);
  }
  camera.updateProjectionMatrix();
  const kop = c < 0.32 ? ['Blaricum vanuit de lucht', 'Duikvlucht naar het dorpscentrum'] :
              c < 0.72 ? ['De kruising · Porsche 930', 'Door de bocht langs Bistrot Chapeau'] :
                         ['Albert Heijn · Inparkeren', 'De klassieker parkeert voor de deur'];
  werkCartoucheBij(kop[0], kop[1]);
}

function startIntro() {
  if (intro) { stopIntro(false); return; }
  stopRondleiding();
  reis = null;
  if (porsche) porsche.resetDeeltjes();
  intro = { t0: performance.now(), duur: 11800 };
  const knop = document.getElementById('intro-knop');
  if (knop) { knop.setAttribute('aria-pressed', 'true'); knop.textContent = 'Stop intro'; }
  for (const k of document.querySelectorAll('[data-stand]')) k.setAttribute('aria-pressed', 'false');
}

function startRondleiding() {
  if (rondleiding) { stopRondleiding(); return; }
  stopIntro(true);
  reis = null;
  const ogen = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-9, 15, 43),
    new THREE.Vector3(-28, 5.2, 30),
    new THREE.Vector3(-29.5, 1.9, 21.5),
    new THREE.Vector3(-29.2, 2.3, 12.2),
    new THREE.Vector3(-34.8, 3.85, 3.6),
    new THREE.Vector3(-10, 6.0, 34),
    new THREE.Vector3(24, 3.8, 16),
    new THREE.Vector3(31, 2.5, 1.2),
    new THREE.Vector3(16, 13, 28),
  ], true);
  const doelen = new THREE.CatmullRomCurve3([
    new THREE.Vector3(2, 4, 7),
    new THREE.Vector3(-5, 4.2, 10),
    new THREE.Vector3(-8.5, 4.2, 11.5),
    new THREE.Vector3(-22.0, 2.5, 5.0),
    new THREE.Vector3(-24.2, 1.55, -7.8),
    new THREE.Vector3(-4, 4.0, 12),
    new THREE.Vector3(4, 3.8, 8),
    new THREE.Vector3(8, 4.2, 3),
    new THREE.Vector3(2, 4.2, 7),
  ], true);
  rondleiding = { t0: performance.now(), duur: 38000, ogen, doelen };
  const knop = document.getElementById('rondleiding');
  if (knop) { knop.setAttribute('aria-pressed', 'true'); knop.textContent = 'Stop rondleiding'; }
  for (const k of document.querySelectorAll('[data-stand]')) k.setAttribute('aria-pressed', 'false');
}

// Van het ene standpunt naar het andere: oog en doel schuiven samen, een goede seconde.
let reis = null;
function naar(naam, meteen) {
  const s = STANDEN[naam];
  if (!s) return;
  stopRondleiding();
  stopIntro(true);
  standNaam = naam;
  for (const k of document.querySelectorAll('[data-stand]')) k.setAttribute('aria-pressed', String(k.dataset.stand === naam));
  werkCartoucheBij();
  const doel = { oog: new THREE.Vector3(...s.oog), doel: new THREE.Vector3(...s.doel), hoek: hoekVoorScherm(s.hoek) };
  if (meteen || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    camera.position.copy(doel.oog); stuur.target.copy(doel.doel); camera.fov = doel.hoek; camera.updateProjectionMatrix();
    reis = null;
    return;
  }
  reis = { t0: performance.now(), duur: 1300, van: { oog: camera.position.clone(), doel: stuur.target.clone(), hoek: camera.fov }, naar: doel };
}

function driehoeken(pos, extra = {}) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  for (const [naam, [rij, n, norm]] of Object.entries(extra)) g.setAttribute(naam, new THREE.BufferAttribute(rij, n, norm));
  return g;
}

async function begin() {
  // Update 'plein' standpunt zodat hij exact aansluit op het eindkader van de intro bij de Albert Heijn.
  STANDEN.plein = { oog: [-34.8, 3.85, 3.6], doel: [-24.2, 1.55, -7.8], hoek: 38 };

  const model = await (await fetch('model/model.json')).json();
  vakNamen = model.slots;
  const id = Object.fromEntries(vakNamen.map((naam, i) => [naam, i]));
  const [vPos, vVak, rPosRaw, rNorRaw, rVakRaw, lPosRaw, lNRaw, lEigRaw] = await Promise.all([
    laad('vlak-pos.bin', Float32Array), laad('vlak-slot.bin', Uint8Array), laad('romp-pos.bin', Float32Array),
    laad('romp-normaal.bin', Int8Array), laad('romp-slot.bin', Uint8Array), laad('lijn-pos.bin', Float32Array),
    laad('lijn-n.bin', Int8Array), laad('lijn-eig.bin', Float32Array),
  ]);

  // Splits de echte Porsche 930 Turbo los van het statische dorp zodat hij echt kan rijden en parkeren!
  const gesplitst = splitsPorsche(rPosRaw, rNorRaw, rVakRaw, lPosRaw, lNRaw, lEigRaw);
  const { rPos, rNor, rVak, lPos, lN, lEig } = gesplitst.statisch;

  lucht = luchtShader();
  const koepel = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), lucht);
  koepel.frustumCulled = false;
  koepel.renderOrder = -10;
  scene.add(koepel);

  const mat = vlakShader(vakNamen.length, id);
  palet = mat.uniforms.palet.value;
  const vlakMesh = new THREE.Mesh(driehoeken(vPos, { vak: [vVak, 2] }), mat);
  vlakMesh.frustumCulled = false;
  scene.add(vlakMesh);

  const romp = driehoeken(rPos, { normal: [rNor, 3, true], vak: [rVak, 2] });
  rand = rompRand();
  const rompMat = rompShader(vakNamen.length, palet, id);
  const randMesh = new THREE.Mesh(romp, rand);
  const rompMesh = new THREE.Mesh(romp, rompMat);
  randMesh.frustumCulled = rompMesh.frustumCulled = false;
  scene.add(randMesh, rompMesh);

  // SlagMat blijft beschikbaar voor kleursynchronisatie (de schaduw verhuist nu mee onder de Porsche zelf).
  slagMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

  // Eén rechthoek, zo vaak getekend als er lijnstukken zijn.
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 1, 0], 3));
  g.setIndex([0, 1, 2, 2, 1, 3]);
  const einden = new THREE.InstancedInterleavedBuffer(lPos, 6, 1);
  g.setAttribute('aStart', new THREE.InterleavedBufferAttribute(einden, 3, 0));
  g.setAttribute('aEnd', new THREE.InterleavedBufferAttribute(einden, 3, 3));
  const normalen = new THREE.InstancedInterleavedBuffer(lN, 8, 1);
  g.setAttribute('klNA', new THREE.InterleavedBufferAttribute(normalen, 3, 0, true));
  g.setAttribute('klNB', new THREE.InterleavedBufferAttribute(normalen, 3, 4, true));
  const eigen = new THREE.InstancedInterleavedBuffer(lEig, 3, 1);
  g.setAttribute('klDik', new THREE.InterleavedBufferAttribute(eigen, 1, 0));
  g.setAttribute('klVer', new THREE.InterleavedBufferAttribute(eigen, 1, 1));
  g.setAttribute('klStap', new THREE.InterleavedBufferAttribute(eigen, 1, 2));
  g.instanceCount = lPos.length / 6;
  const lMat = lijnShader();
  lijn = new THREE.Mesh(g, lMat);
  lijn.frustumCulled = false;
  lijn.renderOrder = 10;
  scene.add(lijn);

  // Repareer Bistrot Chapeau: voeg ontbrekende noord- en westgevel, kruisdak en schoorsteen toe!
  const chapeau = bouwChapeauHerstel(mat, lMat, id);
  scene.add(chapeau.vlakMesh, chapeau.lijnMesh);
  slagMeshes = [vlakMesh, rompMesh, chapeau.vlakMesh];

  // De echte geëxtraheerde Porsche 930 Turbo (met koplampen, uitlaatrook en opvliegende blaadjes)!
  porsche = bouwPorscheLeven(gesplitst.porsche, rompMat, rand, lMat);
  scene.add(porsche.group);

  // Wolken: platen die naar de camera kijken, ver weg en hoog. Schuiven live heel rustig mee.
  const plekken = [[-520, 210, -640, 320], [260, 255, -820, 380], [760, 185, -300, 270], [-820, 235, 180, 340], [520, 215, 640, 300], [-240, 265, 860, 360]];
  for (const [x, y, z, b] of plekken) {
    const w = new THREE.Sprite(new THREE.SpriteMaterial({ map: wolkBeeld(STIJLEN.helder), depthWrite: false, fog: false }));
    w.position.set(x, y, z);
    w.scale.set(b, b * 420 / 1024, 1);
    wolken.push(w);
    wolkBasis.push([x, y, z]);
    scene.add(w);
  }
  const gloed = gloedBeeld();
  for (const [x, y, z] of model.lampen || []) {
    const l = new THREE.Sprite(new THREE.SpriteMaterial({ map: gloed, depthWrite: false, fog: false }));
    l.position.set(x, y, z);
    l.scale.set(1.35, 1.35, 1);
    l.renderOrder = 12;
    lampen.push(l);
    scene.add(l);
  }

  // Enkele dwarrelende herfstblaadjes bij de bomen op de kruising (1 instanced draw call).
  const bladGeo = new THREE.PlaneGeometry(0.18, 0.18);
  const bladMat = new THREE.MeshBasicMaterial({ map: bladBeeld(), transparent: true, alphaTest: 0.2, side: THREE.DoubleSide });
  const AANTAL_BLAD = 24;
  bladeren = new THREE.InstancedMesh(bladGeo, bladMat, AANTAL_BLAD);
  bladeren.frustumCulled = false;
  bladeren.renderOrder = 11;
  let bZaad = 42;
  const bKans = () => (bZaad = (bZaad * 16807) % 2147483647) / 2147483647;
  const bDummy = new THREE.Object3D();
  for (let i = 0; i < AANTAL_BLAD; i++) {
    const d = {
      x: -24 + bKans() * 28,
      y0: 1.4 + bKans() * 4.8,
      z: 6 + bKans() * 20,
      fase: bKans() * Math.PI * 2,
      snel: 0.45 + bKans() * 0.45,
      zwaai: 0.7 + bKans() * 1.1,
      schaal: 0.75 + bKans() * 0.55,
    };
    bladData.push(d);
    bDummy.position.set(d.x, d.y0, d.z);
    bDummy.rotation.set(d.fase, d.fase * 0.7, d.fase * 1.3);
    bDummy.scale.setScalar(d.schaal);
    bDummy.updateMatrix();
    bladeren.setMatrixAt(i, bDummy.matrix);
  }
  bladeren.instanceMatrix.needsUpdate = true;
  scene.add(bladeren);

  vogels = bouwVogels();
  vogels.update(0);
  scene.add(vogels.group);

  naar(vraag.get('stand') || 'hoekpand', true);
  zetTijd(vraag.get('tijd') || 'nacht', true);
  maat();
  new ResizeObserver(maat).observe(doek);
  for (const k of document.querySelectorAll('[data-stand]')) k.addEventListener('click', () => naar(k.dataset.stand));
  for (const k of document.querySelectorAll('[data-tijd]')) k.addEventListener('click', () => zetTijd(k.dataset.tijd));
  const introKnop = document.getElementById('intro-knop');
  if (introKnop) introKnop.addEventListener('click', startIntro);
  const rondKnop = document.getElementById('rondleiding');
  if (rondKnop) rondKnop.addEventListener('click', startRondleiding);
  stuur.addEventListener('start', () => { reis = null; stopRondleiding(); stopIntro(false); });

  // Sneltoetsen: 1-6 voor standpunten, I voor de Porsche-intro, spatie voor rondleiding.
  const standLijst = ['hoekpand', 'kruising', 'erf', 'straat', 'plein', 'dorp'];
  window.addEventListener('keydown', (ev) => {
    if (ev.target && /INPUT|TEXTAREA/.test(ev.target.tagName)) return;
    if (ev.key >= '1' && ev.key <= '6') naar(standLijst[Number(ev.key) - 1]);
    else if (ev.key.toLowerCase() === 'i') startIntro();
    else if (ev.code === 'Space') { ev.preventDefault(); startRondleiding(); }
  });

  // Speel de Kuifje-intro direct automatisch af bij het openen (tenzij een vaste stand of ?afdruk is gevraagd).
  if (!isAfdruk && !vraag.has('stand') && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    startIntro();
  } else if (vraag.has('intro')) {
    pasIntroFrameToe(Number(vraag.get('intro')), 0);
  }

  melding.hidden = true;
  window.toon = (stand, stijl, licht) => {
    naar(stand, true);
    kleur(stijl, licht, true);
    if (porsche) porsche.zetIntroStand(1.0, 0);
    if (vogels) vogels.update(0);
    if (SLAG) slagKaart();
    stuur.update();
    lijn.material.uniforms.uPx.value = camera.projectionMatrix.elements[5] * lijn.material.uniforms.uRes.value.y * 0.5;
    renderer.render(scene, camera);
  };
  window.toonIntro = (tNorm, stijl, licht) => {
    stopIntro(false); stopRondleiding();
    kleur(stijl, licht, true);
    pasIntroFrameToe(tNorm, 0);
    if (SLAG) slagKaart();
    stuur.update();
    lijn.material.uniforms.uPx.value = camera.projectionMatrix.elements[5] * lijn.material.uniforms.uRes.value.y * 0.5;
    renderer.render(scene, camera);
  };

  let beelden = 0, vorige = performance.now(), traagste = 0;
  renderer.setAnimationLoop((nu) => {
    const sec = isAfdruk ? 0 : nu * 0.001;
    LICHT.uTijd.value = sec;
    if (kleurReis) {
      const t = Math.min(1, (nu - kleurReis.t0) / kleurReis.duur);
      pasKleurToe(kleurReis.van, kleurReis.naar, t);
      if (t >= 1) kleurReis = null;
    }
    if (!isAfdruk && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (let i = 0; i < wolken.length; i++) {
        wolken[i].position.x = wolkBasis[i][0] + Math.sin(sec * 0.012 + i) * 38;
      }
      for (let i = 0; i < AANTAL_BLAD; i++) {
        const d = bladData[i];
        const val = (d.y0 - sec * d.snel * 0.45) % 5.4;
        const y = val < 0.35 ? val + 5.4 : val;
        bDummy.position.set(d.x + Math.sin(sec * d.snel + d.fase) * d.zwaai, y, d.z + Math.cos(sec * d.snel * 0.8 + d.fase) * d.zwaai * 0.6);
        bDummy.rotation.set(sec * 1.4 + d.fase, sec * 0.9 + d.fase, Math.sin(sec * 1.8 + d.fase) * 0.9);
        bDummy.scale.setScalar(d.schaal);
        bDummy.updateMatrix();
        bladeren.setMatrixAt(i, bDummy.matrix);
      }
      bladeren.instanceMatrix.needsUpdate = true;
      if (vogels && vogels.group.visible) vogels.update(sec);
    }
    if (intro) {
      const t = Math.min(1, (nu - intro.t0) / intro.duur);
      pasIntroFrameToe(t, sec);
      if (t >= 1) {
        standNaam = 'plein';
        stopIntro(false);
        for (const k of document.querySelectorAll('[data-stand]')) k.setAttribute('aria-pressed', String(k.dataset.stand === 'plein'));
      }
    } else {
      if (porsche && !isAfdruk) porsche.updateRust(sec);
      if (rondleiding) {
        const u = ((nu - rondleiding.t0) % rondleiding.duur) / rondleiding.duur;
        rondleiding.ogen.getPointAt(u, camera.position);
        rondleiding.doelen.getPointAt(u, stuur.target);
        camera.fov = 36 + Math.sin(u * Math.PI * 2) * 3;
        camera.updateProjectionMatrix();
        const fase = u < 0.22 ? ['Het hoekpand', 'Hoek Meentweg en Huizerweg'] :
                     u < 0.46 ? ['De kruising', 'Langs Bistrot Chapeau en de bomen'] :
                     u < 0.68 ? ['Albert Heijn', 'De geparkeerde Porsche 930 Turbo'] :
                                ['Het erf & Huizerweg', 'Terug richting het hoekpand'];
        werkCartoucheBij(`Rondleiding · ${fase[0]}`, fase[1]);
      } else if (reis) {
        const t = Math.min(1, (nu - reis.t0) / reis.duur);
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        camera.position.lerpVectors(reis.van.oog, reis.naar.oog, e);
        stuur.target.lerpVectors(reis.van.doel, reis.naar.doel, e);
        camera.fov = reis.van.hoek + (reis.naar.hoek - reis.van.hoek) * e;
        camera.updateProjectionMatrix();
        if (t >= 1) reis = null;
      }
    }
    stuur.update();
    // Kijkt de camera ergens anders, of van veel dichterbij of verder? Dan de schaduwkaart opnieuw.
    if (SLAG && !reis && !intro && beelden % 20 === 0) {
      const wil = Math.min(280, Math.max(55, camera.position.distanceTo(stuur.target) * 1.25));
      if (Math.abs(wil - slagVeld) > 0.3 * slagVeld || slagMidden.distanceTo(new THREE.Vector3(stuur.target.x, 0, stuur.target.z)) > 0.35 * slagVeld) slagKaart();
    }
    // Pixels per meter op een meter afstand: daarmee rekent de lijn golflengtes en rijafstanden om naar het scherm.
    lijn.material.uniforms.uPx.value = camera.projectionMatrix.elements[5] * lijn.material.uniforms.uRes.value.y * 0.5;
    renderer.render(scene, camera);
    beelden++;
    if (beelden > 3 && beelden <= 13) traagste = Math.max(traagste, nu - vorige);
    vorige = nu;
    if (beelden === 14) {
      window.klaar = { driehoeken: model.driehoeken, romp: model.romp, lijnen: model.lijnen, patroon: model.patroon,
        tekenrondes: renderer.info.render.calls, traagste_beeld_ms: Math.round(traagste) };
    }
  });
}

begin().catch((fout) => { melding.textContent = 'Het dorp kon niet geladen worden: ' + fout.message; console.error(fout); });
