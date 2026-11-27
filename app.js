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
import { bouwIntercom, bouwBelHandCel, INTERCOM_POS, INTERCOM_NORMAAL } from './verhaal.js';

const vraag = new URLSearchParams(location.search);
const getal = (naam, anders) => (vraag.has(naam) ? Number(vraag.get(naam)) : anders);
const doek = document.getElementById('doek');
const melding = document.getElementById('melding');

// Standpunten in meters, y omhoog, het kantoor in de oorsprong (three.js: x oost, z zuid).
const STANDEN = {
  hoekpand: { oog: [-9, 15, 43], doel: [2, 4, 7], hoek: 34 },
  kruising: { oog: [-33.5, 1.7, 21.5], doel: [-8.5, 4.2, 11.5], hoek: 36 },
  wijzer: { oog: [-15.2, 4.3, 46.8], doel: [-10.8, 4.1, 11.9], hoek: 36 },
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
const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.12, 4000);
const stuur = new OrbitControls(camera, doek);
stuur.enableDamping = true;
stuur.dampingFactor = 0.08;
stuur.maxPolarAngle = Math.PI * 0.497;
stuur.minDistance = 0.45;
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

// Wat alle tekenprogramma's delen: zon, maanrichting, schaduwkaart, nevel, straatlantaarns, ganglicht en Porsche-koplampen.
const LICHT = {
  uZon: { value: new THREE.Vector3(0, 1, 0) }, uLichtMat: { value: new THREE.Matrix4() }, uSlagKaart: { value: null },
  uSlag: { value: SLAG ? 1 : 0 }, uNevel: { value: new THREE.Color() }, uNevelMaat: { value: new THREE.Vector3(150, 560, 0.5) },
  uBrandt: { value: 0 }, uPlassen: { value: 0 }, uKlare: { value: 1 }, uBunker: { value: 1 }, uRegen: { value: 0 }, uTijd: { value: 0 },
  uPlasKleur: { value: new THREE.Color(0.92, 0.58, 0.27) }, uInktKleur: { value: new THREE.Color(0.06, 0.04, 0.03) },
  uLamp: { value: Array.from({ length: 40 }, () => new THREE.Vector4()) }, uLampN: { value: 0 },
  uKopPos: { value: new THREE.Vector3(0, 0.64, 0) }, uKopDir: { value: new THREE.Vector3(0, 0, 1) }, uKopAan: { value: 0 },
  uLampKleur: { value: new THREE.Color(0.914, 0.835, 0.412) }, uNacht: { value: 0 },
  uMaanDir: { value: new THREE.Vector3(420, 260, -980).normalize() },
  uGangLicht: { value: 0 },
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

// Slagschaduw, nevel en nacht-lamplicht (alleen echte straatlantaarns, directe etalagegloed, wandlantaarn en koplampen vóór de Porsche).
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
  uniform vec4 uLamp[40];
  uniform int uLampN;
  uniform vec3 uKopPos;
  uniform vec3 uKopDir;
  uniform float uKopAan;
  uniform vec3 uLampKleur;
  uniform float uNacht;
  uniform vec3 uMaanDir;
  uniform float uGangLicht;
  bool klSlag(vec3 p, vec3 n, float weg) {
    if (uSlag < 0.5) return false;
    vec3 q = p + n * weg + 0.05 * vec3(klRuis(p * 0.8), 0.0, klRuis(p * 0.8 + 31.0));
    vec4 l = uLichtMat * vec4(q, 1.0);
    vec3 s = l.xyz / l.w * 0.5 + 0.5;
    if (s.x <= 0.0 || s.x >= 1.0 || s.y <= 0.0 || s.y >= 1.0 || s.z >= 1.0) return false;
    float t = 1.3 / ${SLAGMAAT}.0, som = 0.0;
    for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++)
      som += step(texture2D(uSlagKaart, s.xy + vec2(float(i), float(j)) * t).r + 0.00018, s.z);
    return som > 4.5;
  }
  vec3 klNevel(vec3 kleur, float afstand) {
    float vlek = uKlare > 0.5 ? 0.0 : (0.6 * klRuis(vec3(gl_FragCoord.xy * 0.055, 1.0)) + 0.7 * klRuis(vec3(gl_FragCoord.xy * 0.007, 7.0)));
    return mix(kleur, uNevel, uNevelMaat.z * smoothstep(uNevelMaat.x, uNevelMaat.y, afstand)) * (1.0 + 0.022 * vlek);
  }
  float klLamp(vec3 p, vec3 n) {
    if (uNacht < 0.05) return 0.0;
    float k = 0.0;
    float golf = 0.16 * klRuis(p * 0.7);
    // 1. Echte straatlantaarns, directe etalagegloed en de intieme wandlantaarn boven de Monastic-intercom.
    for (int i = 0; i < 40; i++) {
      if (i >= uLampN) break;
      vec3 v = uLamp[i].xyz - p;
      float rad = uLamp[i].w;
      if (abs(n.y) < 0.45) {
        // Op verticale gevels: zachte ronde warme lichtkring (geen harde platte balk, behoudt de rijke baksteenkleur!)
        vec3 vw = vec3(v.x, v.y - 0.12, v.z);
        float dw = length(vw) + golf * 0.6;
        if (dw < rad * 0.92 && dot(n, v) > 0.0) {
          k = max(k, dw < rad * 0.48 ? 0.34 : 0.17);
        }
      } else {
        // Op de grond (asfalt/grind/stoep): krachtige, heldere Ligne Claire-lichtcirkel onder elke lantaarn!
        float d = length(v) + golf;
        if (d < rad && v.y > 0.22 && dot(n, v) > 0.0) {
          k = max(k, d < rad * 0.58 ? 0.74 : 0.42);
        }
      }
    }
    // 2. Warm licht dat na het aanbellen uit het gangraampje van Monastic schuin over het donkere grind valt.
    if (uGangLicht > 0.05 && p.y < 0.35 && n.y > 0.65) {
      vec2 dg = p.xz - vec2(9.2, -1.25);
      float raamVal = step(-1.0, dg.x) * step(dg.x, 2.8) * step(-0.65, dg.y) * step(dg.y, 1.15);
      if (raamVal > 0.5) {
        float dr = length(dg * vec2(0.52, 0.90));
        k = max(k, (dr < 0.78 ? 0.68 : 0.38) * uGangLicht);
      }
    }
    // 3. Porsche-koplampbundels op het wegdek: strakke Ligne Claire-lichtbundels vóór de voorbumper.
    if (uKopAan > 0.05 && p.y < 0.34 && n.y > 0.65) {
      vec3 rel = p - uKopPos;
      float a = dot(rel, uKopDir);
      if (a > 0.55 && a < 15.8) {
        vec3 rechts = vec3(-uKopDir.z, 0.0, uKopDir.x);
        float lat = dot(rel, rechts);
        float wL = 0.22 + (a - 0.55) * 0.19;
        float dMin = min(abs(lat - 0.63), abs(lat + 0.65)) / wL;
        float neus = (a - 0.55) / 0.45;
        bool inNeus = neus >= 1.0 || (dMin * dMin + (1.0 - neus) * (1.0 - neus) < 1.0);
        float reik = a + 0.32 * golf;
        if (inNeus && dMin < 1.0 && reik < 15.2) {
          float bundel = (reik < 8.4 && dMin < 0.72) ? 0.74 : 0.44;
          k = max(k, bundel * uKopAan);
        }
      }
    }
    return k * uNacht;
  }`;

// ---- De vlakken: zuivere egale Hergé-kleurvlakken (zonder druk baksteenpatroon), sfeervolle erfschaduwen en maanreflecties!
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
    void main() {
      vec3 n = normalize(cross(dFdx(vP), dFdy(vP)));
      int s = int(vVak.x + 0.5);
      bool inSlag = uKlare > 0.5 ? false : klSlag(vP, n, 0.17);
      bool licht = dot(n, uZon) > 0.08 && !inSlag;
      vec3 k = palet[s * 2 + (licht ? 0 : 1)];
      float dist = length(cameraPosition - vP);

      bool isRuit = (s == ${id.ruit_donker} || s == ${id.ruit_licht} || s == ${id.ruit_aan} || s == ${id.ruit_kantoor});
      bool isBrandRuit = (s == ${id.ruit_kantoor} || s == ${id.ruit_aan} || s == ${id.raamlicht});
      bool isBaksteen = (s == ${id.baksteen_rood} || s == ${id.baksteen_bruin} || s == ${id.baksteen_geel});
      bool isDak = (s == ${id.dak_lei} || s == ${id.dak_grijs} || s == ${id.dak_antraciet} || s == ${id.dak_bruinrood} || s == ${id.dak_terracotta} || s == ${id.dak_oranje} || s == ${id.dak_riet});
      bool isGrind = (s == ${id.erf} || s == ${id.grind} || s == ${id.tuinpad});

      // 0a. Zuivere Hergé-gevels: rustig egaal kleurvlak + strakke donkere muurplint onderaan.
      //     Geen druk baksteenraster over het dorp — alleen in de close-up rond de Monastic-intercom 3 subtiele steenlijntjes!
      if (isBaksteen && abs(n.y) < 0.35 && dist < 44.0) {
        float fadeB = 1.0 - smoothstep(24.0, 42.0, dist);
        float fwY = max(fwidth(vP.y), 0.0025);
        float inPlint = 1.0 - smoothstep(0.38 - fwY, 0.38 + fwY, vP.y);
        float plintRand = (1.0 - smoothstep(0.0055 - fwY, 0.0055 + fwY, abs(vP.y - 0.38))) * fadeB;
        vec3 plintKleur = uBrandt > 0.5 ? vec3(0.15, 0.18, 0.22) : vec3(0.55, 0.54, 0.51);
        k = mix(k, plintKleur, inPlint * 0.85);
        k = mix(k, uInktKleur, plintRand * 0.90);

        // Alleen van héél dichtbij (Shot 4 bij de intercom): 3–4 rustige losse Hergé-stenen op de pier
        float bijBel = length(vP - vec3(7.989, 1.52, -1.686));
        if (dist < 3.4 && bijBel < 0.78 && vP.y > 0.42) {
          vec3 tang = normalize(vec3(-n.z, 0.0, n.x));
          float u = dot(vP, tang), v = vP.y;
          float bh = 0.072, bw = 0.23;
          float rij = floor(v / bh);
          float uOff = u + mod(rij, 2.0) * (bw * 0.5);
          float kol = floor(uOff / bw);
          vec2 f = vec2(fract(uOff / bw), fract(v / bh));
          float hSteen = klHash(vec3(kol, rij, 13.7));
          if (hSteen > 0.84) {
            float fwU = max(fwidth(uOff / bw), 0.008);
            float fwV = max(fwidth(v / bh), 0.015);
            float dikU = max(0.020, fwU * 1.15);
            float dikV = max(0.048, fwV * 1.15);
            float randU = max(1.0 - smoothstep(dikU - fwU, dikU + fwU, f.x), smoothstep(1.0 - dikU - fwU, 1.0 - dikU + fwU, f.x));
            float randV = max(1.0 - smoothstep(dikV - fwV, dikV + fwV, f.y), smoothstep(1.0 - dikV - fwV, 1.0 - dikV + fwV, f.y));
            float fadeClose = 1.0 - smoothstep(2.2, 3.3, dist);
            k *= mix(1.0, 0.92, fadeClose * 0.65);
            k = mix(k, uInktKleur, max(randU, randV) * fadeClose * 0.78);
          }
        }
      }

      // 0b. Sfeervolle, vlijmscherpe 2-toons Ligne Claire nachtschaduwen op het Monastic-erf & de oprit!
      if (uNacht > 0.5 && n.y > 0.80 && isGrind && vP.x > 6.5 && vP.x < 28.5 && vP.z > -9.5 && vP.z < 5.5) {
        // Strakke architectonische schaduwranden langs kantoorgevel, garagewand en straatheg (scherpe strip-overgang!)
        float muurSchaduw = 1.0 - smoothstep(10.8, 10.90, vP.x + vP.z * 0.22);
        float garageSchaduw = (1.0 - smoothstep(-2.35, -2.25, vP.z + (vP.x - 16.0) * 0.12)) * smoothstep(11.0, 11.12, vP.x);
        float hegSchaduw = smoothstep(0.65, 0.76, vP.z - (vP.x - 16.0) * 0.16) * (1.0 - smoothstep(23.1, 23.22, vP.x));
        float hoekDiep = clamp(max(max(muurSchaduw, garageSchaduw), hegSchaduw), 0.0, 1.0);
        // Diep nacht-indigo schaduwvlak zodat de warme wandlantaarn, het gangraampje en de koplampen schitteren!
        k = mix(k, k * vec3(0.54, 0.60, 0.72), hoekDiep * 0.88);
      }

      // 0c. Zeer spaarzame, fijne Hergé-grondstreepjes op grind/stoep dichtbij (96% strak egaal vlak!)
      if (isGrind && n.y > 0.85 && dist < 24.0) {
        float fadeG = 1.0 - smoothstep(10.0, 22.0, dist);
        vec2 gCel = floor(vP.xz * 1.9);
        vec2 gF = fract(vP.xz * 1.9);
        float hC = klHash(vec3(gCel, 9.4));
        if (hC > 0.87) {
          float ox = 0.25 + 0.50 * klHash(vec3(gCel, 1.7));
          float oz = 0.25 + 0.50 * klHash(vec3(gCel, 5.3));
          float fw = max(fwidth(gF.y), 0.008);
          float streep = (1.0 - smoothstep(0.015 - fw, 0.015 + fw, abs(gF.y - oz)))
                       * (1.0 - smoothstep(0.11 - fw, 0.11 + fw, abs(gF.x - ox)));
          k = mix(k, uInktKleur, streep * fadeG * 0.55);
        }
      } else if (s == ${id.stoep} && n.y > 0.85 && dist < 20.0) {
        float fadeS = 1.0 - smoothstep(9.0, 18.0, dist);
        vec2 tCel = floor(vP.xz * 1.65);
        vec2 tF = fract(vP.xz * 1.65);
        float hT = klHash(vec3(tCel, 14.2));
        if (hT > 0.82) {
          float fw = max(fwidth(tF.x), 0.008);
          float voeg = (1.0 - smoothstep(0.016 - fw, 0.016 + fw, tF.x)) * step(0.20, tF.y) * step(tF.y, 0.80);
          k = mix(k, uInktKleur, voeg * fadeS * 0.48);
        }
      }

      // 1. Maanlichtreflectie op daken & kantoor (koele zilverblauwe Ligne Claire-maanrand op hoge dakvlakken & nokken!)
      if (uNacht > 0.5 && isDak && n.y > 0.18) {
        float maanDot = dot(n, uMaanDir);
        float hoog = smoothstep(3.4, 8.6, vP.y);
        float directMaan = smoothstep(0.06, 0.12, maanDot);
        // Ook hoge schuine dakvlakken richting de hemel (zoals het grote hoekpanddak onder de maan!) vangen een koele maanglans
        float hemelMaan = smoothstep(6.2, 10.2, vP.y) * smoothstep(0.35, 0.65, n.y) * 0.55;
        float sterk = clamp(max(directMaan * (0.28 + 0.30 * hoog), hemelMaan), 0.0, 0.72);
        if (sterk > 0.01) {
          vec3 maanTint = vec3(0.36, 0.50, 0.64);
          k = mix(k, maanTint, sterk * uNacht);
          // Strakke zilveren maanreflectie-streep langs de hogere dakvlakken
          float glansBand = smoothstep(0.78, 0.84, fract(vP.y * 0.44)) * hoog * smoothstep(0.08, 0.20, max(maanDot, hemelMaan));
          k = mix(k, vec3(0.58, 0.73, 0.86), glansBand * 0.30 * uNacht);
        }
      }
      // Subtiele koele maanrand op de bovenzijde van bakstenen/gepleisterde gevels gericht op de maan
      if (uNacht > 0.5 && (isBaksteen || s == ${id.pleister} || s == ${id.kalkwit}) && abs(n.y) < 0.35) {
        float maanGevel = smoothstep(0.25, 0.32, dot(n, uMaanDir)) * smoothstep(2.4, 5.2, vP.y);
        k = mix(k, mix(k, vec3(0.40, 0.53, 0.66), 0.34), maanGevel * uNacht);
      }

      // 2. Ruiten: verlichte etalages gloeien warm goud; donkere ruiten vangen een koele zilveren maanreflectie!
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
          float boven = smoothstep(2.35, 2.48, vP.y);
          k = mix(k, vec3(0.50, 0.51, 0.41), boven * 0.46);
          k = mix(k, vec3(0.95, 0.91, 0.68), glans * 0.42);
        } else {
          // Maanreflectie in donkere ramen van het kantoor en het dorp!
          float maanRuit = smoothstep(-0.1, 0.35, dot(n, uMaanDir));
          vec3 maanSpiegel = mix(vec3(0.24, 0.38, 0.49), vec3(0.48, 0.64, 0.78), maanRuit);
          k = mix(k, maanSpiegel, glans * (0.45 + 0.25 * maanRuit));
        }
      }

      // 3. Lamplicht bij nacht: straatlantaarns, hoekpand-etalage, Monastic-wandlantaarn, ganglicht & Porsche-koplampen.
      if (!isBrandRuit) {
        float lp = klLamp(vP, n);
        if (lp > 0.001) {
          k = mix(k, uLampKleur, lp);
        }
      }

      // 4. Schemer: slanke, langgerekte handgetekende plassen met dunne inktrand en oranje luchtweerspiegeling.
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
  side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1.5, polygonOffsetUnits: 2,
});

// ---- Ronde vormen (kruinen, keien, de auto): zuivere tweetoons Hergé-vlakken + koele maanrand bij nacht!
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

      // Zuivere Hergé Ligne Claire auto-inkleuring + strakke zilverblauwe maanlichtrand langs het dak & de motorkap!
      if (s == ${id.porsche} || s == ${id.autolak}) {
        float bovenGlans = smoothstep(0.74, 0.77, n.y) * (1.0 - smoothstep(0.92, 0.95, n.y));
        vec3 hoogTint = uBunker > 0.5 ? vec3(0.28, 0.39, 0.50) : vec3(0.45, 0.62, 0.76);
        k = mix(k, hoogTint, bovenGlans * 0.62);
        if (uNacht > 0.5) {
          float maanRand = smoothstep(0.32, 0.38, dot(n, uMaanDir)) * smoothstep(0.30, 0.38, n.y);
          k = mix(k, vec3(0.44, 0.60, 0.74), maanRand * 0.42 * uNacht);
        }
      } else if (s == ${id.autoraam}) {
        float diag = (vP.x + vP.z) * 1.45 + vP.y * 2.15;
        float g = fract(diag * 0.62);
        float fw = max(fwidth(diag * 0.62), 0.012);
        float streep1 = smoothstep(0.18 - fw, 0.18 + fw, g) * (1.0 - smoothstep(0.27 - fw, 0.27 + fw, g));
        float streep2 = smoothstep(0.31 - fw, 0.31 + fw, g) * (1.0 - smoothstep(0.35 - fw, 0.35 + fw, g));
        float streep = clamp(streep1 + streep2, 0.0, 1.0);
        vec3 ruitGlans = uBunker > 0.5 ? vec3(0.50, 0.65, 0.76) : vec3(0.92, 0.96, 0.99);
        k = mix(k, ruitGlans, streep * 0.65);
      } else if (s == ${id.blad_a} || s == ${id.blad_b} || s == ${id.blad_c}) {
        // Koele maanlichtrand op de bovenkant van boomkruinen gericht naar de maan
        if (uNacht > 0.5 && n.y > 0.36 && dot(n, uMaanDir) > 0.28) {
          k = mix(k, vec3(0.26, 0.40, 0.35), 0.48 * uNacht);
        }
        // Spaarzame, fijne Hergé-bladboogjes in de kruinen
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
      } else if (s == ${id.lamp}) {
        k = uBrandt > 0.5 ? vec3(1.0, 0.95, 0.65) : vec3(0.86, 0.90, 0.93);
      }

      if (s != ${id.lamp}) {
        float lp = klLamp(vP, n);
        if (lp > 0.001) {
          float invloed = (s == ${id.porsche} || s == ${id.autowiel}) ? 0.16 : 0.75;
          k = mix(k, uLampKleur, invloed * lp);
        }
      }

      gl_FragColor = vec4(klNevel(k, length(cameraPosition - vP)), 1.0);
    }`,
  polygonOffset: true, polygonOffsetFactor: 1.5, polygonOffsetUnits: 2,
});

// ---- De omtrek van ronde vormen: in zuivere Klare Lijn 100% constante, gladde dikte zonder zwel-knobbels!
// Slot 'lamp' wordt overgeslagen zodat de BackSide-omtrek nooit als zwart vlak door lantaarn- of koplampglas heen steekt.
const rompRand = (lampSlot = -1) => new THREE.ShaderMaterial({
  uniforms: { inkt: { value: new THREE.Color() }, dikte: { value: 2 }, maat: { value: new THREE.Vector2(1, 1) }, zwel: { value: HAND.zwel },
    uNevel: LICHT.uNevel, uNevelMaat: LICHT.uNevelMaat, uKlare: LICHT.uKlare },
  vertexShader: `
    attribute vec2 vak;
    uniform float dikte;
    uniform float zwel;
    uniform float uKlare;
    uniform vec2 maat;
    varying float vAfstand;
    ${RUIS}
    void main() {
      if (int(vak.x + 0.5) == ${lampSlot}) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        vAfstand = 0.0;
        return;
      }
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
const lijnShader = (creaseLim = 0.58) => new THREE.ShaderMaterial({
  uniforms: {
    uInkt: { value: new THREE.Color() }, uRes: { value: new THREE.Vector2(1, 1) }, uLijn: { value: HAND.lijn },
    uBinnen: { value: HAND.binnen }, uBibber: { value: HAND.bibber }, uGolf: { value: HAND.golf }, uZwel: { value: HAND.zwel },
    uHapert: { value: new THREE.Vector3(...HAND.hapert) }, uPx: { value: 1 }, uNevel: LICHT.uNevel, uNevelMaat: LICHT.uNevelMaat,
    uKlare: LICHT.uKlare, uCrease: { value: creaseLim },
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
    uniform float uLijn, uBinnen, uBibber, uPx, uKlare, uCrease;
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
        // 2. Crease-hoek filter: verberg flauwe 3D-polygoonfacetten binnen vormen, behoud silhouetten & echte hoeken!
        if (!omtrek && dot(nA, nB) > uCrease) maat = 0.0;
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

// ---- De lucht: drie vlakke banden zoals in Claude's g-klare-lijn (maan en nachtwolken zijn aparte sprites).
const luchtShader = () => new THREE.ShaderMaterial({
  uniforms: {
    uLaag: { value: new THREE.Color() }, uMidden: { value: new THREE.Color() }, uHoog: { value: new THREE.Color() },
    uBand: { value: new THREE.Vector2(0.03, 0.1) }, uWolk: { value: 0 },
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
    uniform float uWolk;
    varying vec3 vR;
    ${RUIS}
    void main() {
      vec3 r = normalize(vR);
      float bult = abs(klRuis(vec3(r.x * 15.0, 0.3, r.z * 15.0))) + 0.6 * abs(klRuis(vec3(r.x * 34.0, 4.7, r.z * 34.0)));
      float grof = klRuis(vec3(r.x * 2.6, 9.1, r.z * 2.6));
      float h = r.y;
      float g1 = uBand.x + uWolk * (0.022 * grof - 0.014 * bult);
      float g2 = uBand.y + uWolk * (0.05 * grof - 0.034 * bult);
      gl_FragColor = vec4(h < g1 ? uLaag : (h < g2 ? uMidden : uHoog), 1.0);
    }`,
  side: THREE.BackSide, depthWrite: false, depthTest: true,
});

let palet, vakNamen, lijn, pLijnMat = null, rand, lucht, wolken = [], wolkBasis = [], lampen = [], lampKegels = [], lampKegelMat = null, maan = null, lampGlasMat = null, lampPitMat = null, slagMat, lijnMaat = 1;
let stijlNaam = 'bunker', lichtNaam = 'nacht';
const slagDoel = new THREE.WebGLRenderTarget(SLAGMAAT, SLAGMAAT, { depthTexture: new THREE.DepthTexture(SLAGMAAT, SLAGMAAT, THREE.UnsignedIntType) });
slagDoel.depthTexture.minFilter = slagDoel.depthTexture.magFilter = THREE.NearestFilter;
const slagCam = new THREE.OrthographicCamera(-100, 100, 100, -100, 100, 900);
const slagMidden = new THREE.Vector3(-10, 0, 10);
let slagVeld = 0;
const diepteMat = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
let slagMeshes = [];

function slagKaart() {
  if (LICHT.uKlare.value > 0.5) return;
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
  wijzer: ['De handwijzer', 'Bij de straatlantaarn met zicht op het hoekpand en de maan'],
  erf: ['Het erf · Kantoor', 'De Porsche op de oprit bij de Monastic-intercom'],
  straat: ['De straat', 'Terras bij Bistrot Chapeau en de kruising'],
  plein: ['Het plein', 'Langs de Albert Heijn en het dorpscentrum'],
  dorp: ['Het dorp', 'Vogelvlucht over het centrum van Blaricum'],
};

let standNaam = 'hoekpand';
let kleurReis = null;
let porsche = null;
let intercom = null;
let belHand = null;
let gangLichtAan = 0;
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
    nacht: sm.nacht ? 1 : 0,
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
  LICHT.uNacht.value = a.nacht + (b.nacht - a.nacht) * e;
  LICHT.uPlassen.value = a.plassen + (b.plassen - a.plassen) * e;
  LICHT.uKlare.value = a.klare + (b.klare - a.klare) * e;
  LICHT.uBunker.value = a.bunker + (b.bunker - a.bunker) * e;
  LICHT.uRegen.value = a.regen + (b.regen - a.regen) * e;
  LICHT.uPlasKleur.value.lerpColors(a.plasKleur, b.plasKleur, e);
  LICHT.uInktKleur.value.lerpColors(a.inkt, b.inkt, e);
  lijn.material.uniforms.uInkt.value.copy(LICHT.uInktKleur.value);
  if (pLijnMat) pLijnMat.uniforms.uInkt.value.copy(LICHT.uInktKleur.value);
  rand.uniforms.inkt.value.copy(LICHT.uInktKleur.value);
  if (lampGlasMat) {
    const br = LICHT.uBrandt.value;
    lampGlasMat.color.setRGB(0.82 + 0.18 * br, 0.90 + 0.04 * br, 0.94 - 0.34 * br);
    lampGlasMat.opacity = 0.24 + 0.14 * br;
  }
  if (lampPitMat) {
    const br = LICHT.uBrandt.value;
    lampPitMat.color.setRGB(0.85 + 0.15 * br, 0.88 + 0.08 * br, 0.90 - 0.22 * br);
  }
  if (lampKegelMat) lampKegelMat.uniforms.uAan.value = LICHT.uBrandt.value;
  LICHT.uGangLicht.value = gangLichtAan * LICHT.uBrandt.value;
  if (intercom && !intro) intercom.zetStaat(LICHT.uBrandt.value, 0, 0, gangLichtAan, -1);
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
  wolken.forEach((w, i) => { w.material.map = wolkBeeld(st, i % 3, !!sm.nacht); w.visible = sm.wolken; });
  for (const l of lampen) l.visible = sm.brandt;
  for (const k of lampKegels) k.visible = sm.brandt;
  if (maan) maan.visible = !!sm.nacht;
  if (sm.lamplicht) zet(LICHT.uLampKleur.value, sm.lamplicht);
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
      nacht: LICHT.uNacht.value,
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

// Eén heldere schakelaar voor deze ene Klare Lijn-stijl: Nacht of Dag.
function zetTijd(tijd, meteen = false) {
  if (tijd === 'dag') kleur('klareDag', 'dag', meteen);
  else kleur('bunker', 'nacht', meteen);
}

// Wolken als tekening, uit de hand: bij nacht exact Claude's lange, dunne nachtflarden met maanverlichte bovenrand.
const wolkCache = new Map();
function wolkBeeld(st, soort = 0, nacht = false) {
  if (st.wolkvorm !== 'gouache' && !nacht) soort = 0;
  const sleutel = st.naam + soort + (nacht ? 'nacht' : '');
  if (wolkCache.has(sleutel)) return wolkCache.get(sleutel);
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 420;
  const g = c.getContext('2d');
  let zaad = 7;
  const kans = () => (zaad = (zaad * 16807) % 2147483647) / 2147483647;
  if (nacht) {
    // Nachtwolken in echte Hergé-stijl: lange slanke flarden met een heldere zilver-crème maanlichtrand!
    zaad = 11 + soort * 97;
    const flard = (x0, x1, y, dik, kleur_) => {
      g.fillStyle = kleur_;
      g.beginPath();
      g.moveTo(x0, y);
      for (let i = 1; i <= 6; i++) g.quadraticCurveTo(x0 + (x1 - x0) * (i - 0.5) / 6, y - dik * (0.5 + kans() * 0.85), x0 + (x1 - x0) * i / 6, y - (i < 6 ? dik * 0.22 * kans() : 0));
      for (let i = 5; i >= 0; i--) g.quadraticCurveTo(x0 + (x1 - x0) * (i + 0.5) / 6, y + dik * (0.4 + kans() * 0.65), x0 + (x1 - x0) * i / 6, y + (i > 0 ? dik * 0.18 * kans() : 0));
      g.fill();
    };
    for (const [x0, x1, y, dik] of [[60, 900, 148, 28], [210, 990, 232, 22], [35, 650, 308, 17]]) {
      const s = (kans() - 0.5) * 55;
      // 1. Dunne heldere maanlicht-reflectierand langs de onder-/bovenzijde (zoals op de referentieplaat!)
      flard(x0 + s + 10, x1 + s - 8, y + 6, dik * 0.94, '#b8cde0');
      // 2. Zilverblauwe middenband (gevangen maanlicht)
      flard(x0 + s + 4, x1 + s - 4, y + 1, dik * 0.96, '#4c657d');
      // 3. Donkere middernacht-wolkkern zodat de maanrand er vlijmscherp uitspringt
      flard(x0 + s + 8, x1 + s - 12, y - 3, dik * 0.80, '#27384b');
    }
  } else if (st.wolkvorm === 'gouache') {
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

// De maansikkel met zachte zilverblauwe hof en aardeschijn (licht helder op boven het kantoor en de wolken).
function maanBeeld() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const hof = g.createRadialGradient(128, 128, 28, 128, 128, 126);
  hof.addColorStop(0, 'rgba(182, 208, 232, 0.44)');
  hof.addColorStop(0.5, 'rgba(140, 172, 206, 0.16)');
  hof.addColorStop(1, 'rgba(140, 172, 206, 0)');
  g.fillStyle = hof;
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#faf3ca';
  g.beginPath(); g.arc(128, 128, 38, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.arc(144, 120, 34, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = 'rgba(116, 144, 176, 0.28)';
  g.beginPath(); g.arc(144, 120, 34, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// De gloed om een brandende lantaarn en Porsche-koplamp: zachte warme hof zoals in Claude's g-klare-lijn.
function gloedBeeld() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const hof = g.createRadialGradient(128, 128, 10, 128, 128, 124);
  hof.addColorStop(0, 'rgba(255, 238, 160, 0.75)');
  hof.addColorStop(0.35, 'rgba(252, 226, 130, 0.32)');
  hof.addColorStop(1, 'rgba(252, 226, 130, 0)');
  g.fillStyle = hof;
  g.fillRect(0, 0, 256, 256);
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

// ---- Splits de Porsche 930 Turbo (koets + 4 exact gecentreerde, rechtgezette wielen) uit het dorp.
// De voorwielen stonden in het Blender-model +19° ingestuurd; (ax, az) heft die ingebakken hoek op zodat elk wiel
// kaarsrecht om zijn eigen as draait zonder te slingeren en pas tijdens het rijden vloeiend meestuurt!
const WIEL_ASSEN = [
  { naam: 'FL', x: 0.7446, y: 0.3250, z: 1.3231, ax: 0.9459, az: 0.3244, voor: true },
  { naam: 'FR', x: -0.7722, y: 0.3251, z: 1.2960, ax: 0.9456, az: 0.3255, voor: true },
  { naam: 'RL', x: 0.7734, y: 0.3251, z: -0.9629, ax: 1.0, az: 0.0, voor: false },
  { naam: 'RR', x: -0.7818, y: 0.3251, z: -0.9698, ax: 1.0, az: 0.0, voor: false },
];
const WIEL_STRAAL = 0.315;

function wielIndex(lx, ly, lz, maxR = 0.338, maxHalfW = 0.155) {
  if (Math.abs(lx) < 0.50 || ly > 0.67) return -1;
  for (let w = 0; w < 4; w++) {
    const a = WIEL_ASSEN[w];
    if ((a.x > 0) !== (lx > 0)) continue;
    const dx = lx - a.x, dy = ly - a.y, dz = lz - a.z;
    const wx = dx * a.ax + dz * a.az;
    const wz = -dx * a.az + dz * a.ax;
    if (Math.abs(wx) < maxHalfW && Math.hypot(dy, wz) < maxR) return w;
  }
  return -1;
}

function splitsPorsche(rPos, rNor, rVak, lPos, lN, lEig, witSlot, lampSlot, autowielSlot, metaalSlot) {
  const inBox = (x, y, z) => x > -27.32 && x < -24.35 && z > 19.55 && z < 24.05 && y > 0.02 && y < 1.38;
  const cx = -25.765, cz = 21.728, yOff = 0.02;
  const fx = -0.338, fz = 0.941;
  const rx = 0.941, rz = 0.338;

  const rTriCount = rPos.length / 9;
  const pTriTag = new Int8Array(rTriCount); // -2 = statisch dorp, -1 = koets, 0..3 = wiel FL/FR/RL/RR
  const tel = { stat: 0, koets: 0, wiel: [0, 0, 0, 0] };
  for (let t = 0; t < rTriCount; t++) {
    const i = t * 9;
    const mx = (rPos[i] + rPos[i + 3] + rPos[i + 6]) / 3;
    const my = (rPos[i + 1] + rPos[i + 4] + rPos[i + 7]) / 3;
    const mz = (rPos[i + 2] + rPos[i + 5] + rPos[i + 8]) / 3;
    if (!inBox(mx, my, mz)) { pTriTag[t] = -2; tel.stat++; continue; }
    const s = rVak[t * 6];
    let wi = -1;
    // Uitsluitend banden ('autowiel') en velgen ('metaal') horen bij de wielen: spatbordlak blijft 100% vast op de koets!
    if (s === autowielSlot || s === metaalSlot) {
      const dx = mx - cx, dz = mz - cz;
      wi = wielIndex(dx * rx + dz * rz, my - yOff, dx * fx + dz * fz, 0.342, 0.165);
    }
    pTriTag[t] = wi;
    if (wi >= 0) tel.wiel[wi]++; else tel.koets++;
  }

  const maakBuf = (n) => ({ rPos: new Float32Array(n * 9), rNor: new Int8Array(n * 9), rVak: new Uint8Array(n * 6), i: 0 });
  const statB = maakBuf(tel.stat);
  const koetsB = maakBuf(tel.koets);
  const wielB = WIEL_ASSEN.map((a, idx) => ({ ...maakBuf(tel.wiel[idx]), as: a }));

  for (let t = 0; t < rTriCount; t++) {
    const tag = pTriTag[t];
    if (tag === -2) {
      const si = statB.i++;
      statB.rPos.set(rPos.subarray(t * 9, t * 9 + 9), si * 9);
      statB.rNor.set(rNor.subarray(t * 9, t * 9 + 9), si * 9);
      statB.rVak.set(rVak.subarray(t * 6, t * 6 + 6), si * 6);
      continue;
    }
    const doel = tag >= 0 ? wielB[tag] : koetsB;
    const as = tag >= 0 ? WIEL_ASSEN[tag] : null;
    const ox = as ? as.x : 0, oy = as ? as.y : 0, oz = as ? as.z : 0;
    const ax = as ? as.ax : 1, az = as ? as.az : 0;
    const pi = doel.i++;
    let sumX = 0, sumY = 0, sumZ = 0;
    for (let k = 0; k < 3; k++) {
      const src = (t * 3 + k) * 3, dst = (pi * 3 + k) * 3;
      const dx = rPos[src] - cx, dz = rPos[src + 2] - cz;
      const lx = dx * rx + dz * rz;
      const ly = rPos[src + 1] - yOff;
      const lz = dx * fx + dz * fz;
      const px = lx - ox, py = ly - oy, pz = lz - oz;
      // Roteer voorwielen kaarsrecht rond de wielas (-19° opheffen) zodat elk wiel 100% rond zonder slag draait!
      doel.rPos[dst] = px * ax + pz * az;
      doel.rPos[dst + 1] = py;
      doel.rPos[dst + 2] = -px * az + pz * ax;
      sumX += lx; sumY += ly; sumZ += lz;
      const nx = rNor[src], ny = rNor[src + 1], nz = rNor[src + 2];
      const lnx = nx * rx + nz * rz, lnz = nx * fx + nz * fz;
      doel.rNor[dst] = Math.max(-127, Math.min(127, Math.round(lnx * ax + lnz * az)));
      doel.rNor[dst + 1] = ny;
      doel.rNor[dst + 2] = Math.max(-127, Math.min(127, Math.round(-lnx * az + lnz * ax)));
      const vs = (t * 3 + k) * 2, vd = (pi * 3 + k) * 2;
      doel.rVak[vd] = rVak[vs]; doel.rVak[vd + 1] = rVak[vs + 1];
    }
    // Echte 3D-koplampglazen van de Porsche 930 in slot 'lamp'
    if (tag < 0 && rVak[t * 6] === witSlot && (sumY / 3) > 0.50 && (sumZ / 3) > 1.75 && Math.abs(sumX / 3) > 0.45) {
      for (let k = 0; k < 3; k++) doel.rVak[(pi * 3 + k) * 2] = lampSlot;
    }
  }

  // Splits ook de vector-inktlijnen (strak binnen de ongedraaide wielcilinder zodat spatbordlijnen op de koets blijven!)
  const lCount = lPos.length / 6;
  const pLTag = new Int8Array(lCount); // -3 = weggooien (micro-clutter), -2 = dorp, -1 = koets, 0..3 = wiel
  const lTel = { stat: 0, koets: 0, wiel: [0, 0, 0, 0] };
  for (let i = 0; i < lCount; i++) {
    const o = i * 6;
    const x0 = lPos[o], y0 = lPos[o + 1], z0 = lPos[o + 2];
    const x1 = lPos[o + 3], y1 = lPos[o + 4], z1 = lPos[o + 5];
    const L = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
    if (!inBox(x0, y0, z0) || !inBox(x1, y1, z1) || L >= 1.6) {
      pLTag[i] = -2; lTel.stat++; continue;
    }
    const mx = (x0 + x1) * 0.5, my = (y0 + y1) * 0.5, mz = (z0 + z1) * 0.5;
    const dx = mx - cx, dz = mz - cz;
    const wi = wielIndex(dx * rx + dz * rz, my - yOff, dx * fx + dz * fz, 0.324, 0.140);
    if (wi < 0 && L < 0.052) { pLTag[i] = -3; continue; }
    pLTag[i] = wi;
    if (wi >= 0) lTel.wiel[wi]++; else lTel.koets++;
  }

  const maakLBuf = (n) => ({ lPos: new Float32Array(n * 6), lN: new Int8Array(n * 8), lEig: new Float32Array(n * 3), i: 0 });
  const statL = maakLBuf(lTel.stat);
  const koetsL = maakLBuf(lTel.koets);
  const wielL = WIEL_ASSEN.map((a, idx) => maakLBuf(lTel.wiel[idx]));

  for (let i = 0; i < lCount; i++) {
    const tag = pLTag[i];
    if (tag === -3) continue;
    if (tag === -2) {
      const sli = statL.i++;
      statL.lPos.set(lPos.subarray(i * 6, i * 6 + 6), sli * 6);
      statL.lN.set(lN.subarray(i * 8, i * 8 + 8), sli * 8);
      statL.lEig.set(lEig.subarray(i * 3, i * 3 + 3), sli * 3);
      continue;
    }
    const doel = tag >= 0 ? wielL[tag] : koetsL;
    const as = tag >= 0 ? WIEL_ASSEN[tag] : null;
    const ox = as ? as.x : 0, oy = as ? as.y : 0, oz = as ? as.z : 0;
    const ax = as ? as.ax : 1, az = as ? as.az : 0;
    const pli = doel.i++;
    for (let e = 0; e < 2; e++) {
      const src = i * 6 + e * 3, dst = pli * 6 + e * 3;
      const dx = lPos[src] - cx, dz = lPos[src + 2] - cz;
      const px = dx * rx + dz * rz - ox;
      const py = lPos[src + 1] - yOff - oy;
      const pz = dx * fx + dz * fz - oz;
      doel.lPos[dst] = px * ax + pz * az;
      doel.lPos[dst + 1] = py;
      doel.lPos[dst + 2] = -px * az + pz * ax;
      const ns = i * 8 + e * 4, nd = pli * 8 + e * 4;
      const nx = lN[ns], ny = lN[ns + 1], nz = lN[ns + 2];
      const lnx = nx * rx + nz * rz, lnz = nx * fx + nz * fz;
      doel.lN[nd] = Math.max(-127, Math.min(127, Math.round(lnx * ax + lnz * az)));
      doel.lN[nd + 1] = ny;
      doel.lN[nd + 2] = Math.max(-127, Math.min(127, Math.round(-lnx * az + lnz * ax)));
      doel.lN[nd + 3] = 0;
    }
    doel.lEig.set(lEig.subarray(i * 3, i * 3 + 3), pli * 3);
  }

  return {
    statisch: { rPos: statB.rPos, rNor: statB.rNor, rVak: statB.rVak, lPos: statL.lPos, lN: statL.lN, lEig: statL.lEig },
    porsche: {
      rPos: koetsB.rPos, rNor: koetsB.rNor, rVak: koetsB.rVak,
      lPos: koetsL.lPos, lN: koetsL.lN, lEig: koetsL.lEig,
      wielen: WIEL_ASSEN.map((as, idx) => ({
        as,
        rPos: wielB[idx].rPos, rNor: wielB[idx].rNor, rVak: wielB[idx].rVak,
        lPos: wielL[idx].lPos, lN: wielL[idx].lN, lEig: wielL[idx].lEig,
      })),
    },
  };
}

// De 7 statische low-poly voetgangers in het dorpsmodel (worden incl. kleding-slots g_* volledig weggefilterd).
const VOETGANGERS = [
  [1.87, 25.47], [-4.79, 20.51], [-26.24, -19.13], [-38.15, -4.86],
  [-19.34, -5.04], [-18.62, -5.62], [-29.76, 22.20],
];

// ---- Haal alle straatlantaarn-glazen (slot 'lamp') los én sla statische low-poly voetgangers (figuur + g_* kleding) over!
function splitsLantaarnGlas(vPos, vVak, rPos, rNor, rVak, lampSlot, figuurSlot, gMinSlot, gMaxSlot, lampenLijst) {
  const glas = [];
  const pit = [];

  const isPit = (mx, my, mz) => {
    for (let i = 0; i < lampenLijst.length; i++) {
      const [lx, ly, lz] = lampenLijst[i];
      if (Math.abs(my - ly) < 0.7 && Math.hypot(mx - lx, mz - lz) < 0.065) return true;
    }
    return false;
  };
  const isVoetgangerDeel = (s, mx, my, mz) => {
    if (s === figuurSlot) return true;
    if (s >= gMinSlot && s <= gMaxSlot && my > 0.01 && my < 2.0) {
      for (let v = 0; v < VOETGANGERS.length; v++) {
        if (Math.hypot(mx - VOETGANGERS[v][0], mz - VOETGANGERS[v][1]) < 1.22) return true;
      }
    }
    return false;
  };

  // 1. Vlak-driehoeken filteren (moderne straatlantaarns)
  const vTri = vPos.length / 9;
  let vHoud = 0;
  for (let t = 0; t < vTri; t++) if (vVak[t * 6] !== lampSlot) vHoud++;
  const nvPos = new Float32Array(vHoud * 9), nvVak = new Uint8Array(vHoud * 6);
  let vi = 0;
  for (let t = 0; t < vTri; t++) {
    const o = t * 9;
    if (vVak[t * 6] === lampSlot) {
      for (let k = 0; k < 9; k++) glas.push(vPos[o + k]);
    } else {
      nvPos.set(vPos.subarray(o, o + 9), vi * 9);
      nvVak.set(vVak.subarray(t * 6, t * 6 + 6), vi * 6);
      vi++;
    }
  }

  // 2. Romp-driehoeken filteren (lantaarns naar glas/pit, statische low-poly voetgangers volledig weg!)
  const rTri = rPos.length / 9;
  const rKeep = new Uint8Array(rTri);
  let rHoud = 0;
  for (let t = 0; t < rTri; t++) {
    const o = t * 9;
    const s = rVak[t * 6];
    if (s === lampSlot) continue;
    const mx = (rPos[o] + rPos[o + 3] + rPos[o + 6]) / 3;
    const my = (rPos[o + 1] + rPos[o + 4] + rPos[o + 7]) / 3;
    const mz = (rPos[o + 2] + rPos[o + 5] + rPos[o + 8]) / 3;
    if (isVoetgangerDeel(s, mx, my, mz)) continue;
    rKeep[t] = 1;
    rHoud++;
  }
  const nrPos = new Float32Array(rHoud * 9), nrNor = new Int8Array(rHoud * 9), nrVak = new Uint8Array(rHoud * 6);
  let ri = 0;
  for (let t = 0; t < rTri; t++) {
    const o = t * 9;
    const s = rVak[t * 6];
    if (s === lampSlot) {
      const mx = (rPos[o] + rPos[o + 3] + rPos[o + 6]) / 3;
      const my = (rPos[o + 1] + rPos[o + 4] + rPos[o + 7]) / 3;
      const mz = (rPos[o + 2] + rPos[o + 5] + rPos[o + 8]) / 3;
      const doel = isPit(mx, my, mz) ? pit : glas;
      for (let k = 0; k < 9; k++) doel.push(rPos[o + k]);
    } else if (rKeep[t]) {
      nrPos.set(rPos.subarray(o, o + 9), ri * 9);
      nrNor.set(rNor.subarray(o, o + 9), ri * 9);
      nrVak.set(rVak.subarray(t * 6, t * 6 + 6), ri * 6);
      ri++;
    }
  }

  return {
    vPos: nvPos, vVak: nvVak,
    rPos: nrPos, rNor: nrNor, rVak: nrVak,
    glasPos: new Float32Array(glas),
    pitPos: new Float32Array(pit),
  };
}

// ---- Verwijder storende horizontale Blender-bloknaden over de Monastic-achtergevel én lijnen van de 7 statische voetgangers.
function schoonAchtergevelLijnen(lPos, lN, lEig) {
  const n = lPos.length / 6;
  const houd = new Uint8Array(n);
  const snedeY = [0.75, 1.10, 1.40, 1.90, 2.00, 2.25, 2.80, 2.90];
  let aantal = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 6;
    const x0 = lPos[o], y0 = lPos[o + 1], z0 = lPos[o + 2];
    const x1 = lPos[o + 3], y1 = lPos[o + 4], z1 = lPos[o + 5];
    const mx = (x0 + x1) * 0.5, my = (y0 + y1) * 0.5, mz = (z0 + z1) * 0.5;
    let weg = false;
    // 1. Lijnen van de 7 verwijderde low-poly voetgangers (korte segmenten < 0.85 m binnen hun cilinder)
    if (my > 0.02 && my < 1.95 && Math.hypot(x1 - x0, y1 - y0, z1 - z0) < 0.85) {
      for (let v = 0; v < VOETGANGERS.length; v++) {
        if (Math.hypot(mx - VOETGANGERS[v][0], mz - VOETGANGERS[v][1]) < 1.22) { weg = true; break; }
      }
    }
    // 2. Horizontale Blender-bloknaden midden over de bakstenen achtergevel van Monastic
    if (!weg && lEig[i * 3 + 2] === 0 && Math.abs(y0 - y1) < 0.025) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      if (mx > 7.0 && mx < 12.8 && mz > -5.6 && mz < 3.6 && len > 1.55) {
        for (const sy of snedeY) {
          if (Math.abs(my - sy) < 0.03) { weg = true; break; }
        }
      }
      if (!weg && mx > 7.5 && mx < 8.4 && mz > -2.1 && mz < -1.3 && my > 1.32 && my < 1.46 && len > 0.3) {
        weg = true;
      }
    }
    if (!weg) { houd[i] = 1; aantal++; }
  }
  const nlPos = new Float32Array(aantal * 6), nlN = new Int8Array(aantal * 8), nlEig = new Float32Array(aantal * 3);
  let j = 0;
  for (let i = 0; i < n; i++) {
    if (!houd[i]) continue;
    nlPos.set(lPos.subarray(i * 6, i * 6 + 6), j * 6);
    nlN.set(lN.subarray(i * 8, i * 8 + 8), j * 8);
    nlEig.set(lEig.subarray(i * 3, i * 3 + 3), j * 3);
    j++;
  }
  return { lPos: nlPos, lN: nlN, lEig: nlEig };
}

// Hulpje om een instanced vector-lijnmesh te bouwen voor koets of wiel.
function bouwLijnMesh(lPos, lN, lEig, lijnMat) {
  const pg = new THREE.InstancedBufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 1, 0], 3));
  pg.setIndex([0, 1, 2, 2, 1, 3]);
  const einden = new THREE.InstancedInterleavedBuffer(lPos, 6, 1);
  pg.setAttribute('aStart', new THREE.InterleavedBufferAttribute(einden, 3, 0));
  pg.setAttribute('aEnd', new THREE.InterleavedBufferAttribute(einden, 3, 3));
  const normalen = new THREE.InstancedInterleavedBuffer(lN, 8, 1);
  pg.setAttribute('klNA', new THREE.InterleavedBufferAttribute(normalen, 3, 0, true));
  pg.setAttribute('klNB', new THREE.InterleavedBufferAttribute(normalen, 3, 4, true));
  const eigen = new THREE.InstancedInterleavedBuffer(lEig, 3, 1);
  pg.setAttribute('klDik', new THREE.InterleavedBufferAttribute(eigen, 1, 0));
  pg.setAttribute('klVer', new THREE.InterleavedBufferAttribute(eigen, 1, 1));
  pg.setAttribute('klStap', new THREE.InterleavedBufferAttribute(eigen, 1, 2));
  pg.instanceCount = lPos.length / 6;
  const mesh = new THREE.Mesh(pg, lijnMat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  return mesh;
}

// ---- Volumetrische 3D-lichtkegel door de nachtlucht (zachte Fresnel-rand zonder harde 3D-hoeken, zoals op de Kuifje-plaat!).
function maakLichtKegelMat(kleurHex = 0xf8e98c, basisSterkte = 0.26) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uKleur: { value: new THREE.Color(kleurHex) },
      uSterkte: { value: basisSterkte },
      uAan: { value: 0.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNorm;
      varying vec3 vView;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNorm = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uKleur;
      uniform float uSterkte;
      uniform float uAan;
      varying vec2 vUv;
      varying vec3 vNorm;
      varying vec3 vView;
      void main() {
        // vUv.y = 1 bij de lamp (smalle top), 0 aan het brede uiteinde
        float langs = pow(clamp(vUv.y, 0.0, 1.0), 1.45) * smoothstep(1.0, 0.90, vUv.y);
        float zachtRand = pow(abs(dot(normalize(vNorm), normalize(vView))), 1.35);
        float a = langs * zachtRand * uSterkte * uAan;
        if (a < 0.004) discard;
        gl_FragColor = vec4(uKleur, a);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// ---- De strakke Ligne Claire Porsche 930 Turbo met 4 rechtgezette, écht draaiende wielen,
//      volumetrische koplampkegels door de lucht, vloeiende inparkeerroute en Kuifje-bewegingsstrepen!
function bouwPorscheLeven(pData, rompMat, randMat, lijnMat, gloedTex) {
  const group = new THREE.Group();
  const chassis = new THREE.Group();
  group.add(chassis);

  // 1. Koetswerk (romp + omtrek + opgeschoonde Hergé-paneellijnen)
  const pRomp = driehoeken(pData.rPos, { normal: [pData.rNor, 3, true], vak: [pData.rVak, 2] });
  const pRandMesh = new THREE.Mesh(pRomp, randMat);
  const pRompMesh = new THREE.Mesh(pRomp, rompMat);
  pRandMesh.frustumCulled = pRompMesh.frustumCulled = false;
  chassis.add(pRandMesh, pRompMesh);
  if (pData.lPos.length) chassis.add(bouwLijnMesh(pData.lPos, pData.lN, pData.lEig, lijnMat));

  // 2. De 4 losse rechtgezette wielen (draaien zuiver rond hun exacte wielas; FL/FR sturen soepel mee!)
  const wielGroepen = pData.wielen.map((w) => {
    const stuurG = new THREE.Group();
    stuurG.position.set(w.as.x, w.as.y, w.as.z);
    const rolG = new THREE.Group();
    stuurG.add(rolG);
    const geo = driehoeken(w.rPos, { normal: [w.rNor, 3, true], vak: [w.rVak, 2] });
    const rm = new THREE.Mesh(geo, rompMat);
    const om = new THREE.Mesh(geo, randMat);
    rm.frustumCulled = om.frustumCulled = false;
    rolG.add(om, rm);
    if (w.lPos.length) rolG.add(bouwLijnMesh(w.lPos, w.lN, w.lEig, lijnMat));
    group.add(stuurG);
    return { stuurG, rolG, voor: w.as.voor };
  });

  // Ovale inkt-slagschaduw direct onder de Porsche.
  const schaduwGeo = new THREE.PlaneGeometry(2.15, 4.55);
  schaduwGeo.rotateX(-Math.PI / 2);
  const schaduwMat = new THREE.MeshBasicMaterial({ map: autoSchaduwBeeld(), transparent: true, depthWrite: false });
  const schaduw = new THREE.Mesh(schaduwGeo, schaduwMat);
  schaduw.position.set(0, 0.025, 0.12);
  schaduw.renderOrder = 2;
  group.add(schaduw);

  // Zachte warme lichthof direct op de 3D-koplampen + 3D volumetrische lichtkegels door de nachtlucht!
  const kopGloedSprites = [];
  const kopKegelMat = maakLichtKegelMat(0xf7ea92, 0.30);
  const kegelGeo = new THREE.CylinderGeometry(0.11, 1.08, 7.2, 18, 1, true);
  // Verplaats kegel zodat de smalle top (y = +L/2) precies op de lamp zit en hij naar +Z (iets omlaag) schijnt!
  kegelGeo.translate(0, -3.6, 0);
  kegelGeo.rotateX(-Math.PI / 2 + 0.095);
  const kopKegels = [];
  for (const lx of [-0.655, 0.623]) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: gloedTex, depthWrite: false, fog: false, transparent: true, opacity: 0.0 }));
    sp.position.set(lx, 0.642, 1.94);
    sp.scale.set(1.05, 1.05, 1);
    sp.renderOrder = 12;
    sp.visible = false;
    chassis.add(sp);
    kopGloedSprites.push(sp);

    const kg = new THREE.Mesh(kegelGeo, kopKegelMat);
    kg.position.set(lx, 0.642, 1.93);
    kg.renderOrder = 11;
    kg.visible = false;
    chassis.add(kg);
    kopKegels.push(kg);
  }
  const achterMat = new THREE.MeshBasicMaterial({ color: 0xc92c24, transparent: true, opacity: 0.0 });
  const achterBalk = new THREE.Mesh(new THREE.PlaneGeometry(1.04, 0.068), achterMat);
  achterBalk.position.set(0, 0.575, -1.90);
  achterBalk.rotation.y = Math.PI;
  achterBalk.renderOrder = 11;
  chassis.add(achterBalk);

  // 100% op de kaart geverifieerde route pal midden over het asfalt + vloeiende, volledig natuurlijke inrit op het erf!
  // Geen enkele plotse 90°-draai meer: de laatste 3 punten lopen kalm rechtuit het grind op naar de voordeur van Monastic.
  const route = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-44.0, 0.0, 50.0),   // Torenlaan midden op het asfalt
    new THREE.Vector3(-34.0, 0.0, 41.5),   // Torenlaan richting de kruising
    new THREE.Vector3(-24.5, 0.0, 31.5),   // De kruising langs handwijzer & straatlantaarn
    new THREE.Vector3(-15.5, 0.0, 28.5),   // Vrij over het brede kruispunt
    new THREE.Vector3(-6.0, 0.0, 27.5),    // Midden op de kruising
    new THREE.Vector3(2.5, 0.0, 22.0),     // Soepele bocht de Meentweg op
    new THREE.Vector3(11.0, 0.0, 14.8),    // Midden op het asfalt van de Meentweg
    new THREE.Vector3(19.0, 0.0, 9.0),     // Langs de Meentweg richting de inrit
    new THREE.Vector3(25.6, 0.0, 4.4),     // Voorbij de heg & lantaarn
    new THREE.Vector3(25.8, 0.02, 0.4),    // Ruime, geleidelijke bocht de Monastic-oprit in
    new THREE.Vector3(21.2, 0.085, -1.6),  // Recht over het grind het erf op
    new THREE.Vector3(17.4, 0.085, -1.60), // Rustig afremmend in rechte lijn naar het pand
    new THREE.Vector3(14.9, 0.085, -1.45), // Natuurlijke stilstand vóór Monastic met ruimte tot de deurmat!
  ]);
  const routeLengte = route.getLength();

  // Kuifje-bewegingsstrepen (4 vloeiende linten langs de werkelijke rijlijn achter de rijdende Porsche!).
  // Verschijnen subtiel bij vaart over de Torenlaan/kruising en verdwijnen 100% zodra de auto afremt voor de oprit!
  const streepGroep = new THREE.Group();
  const ST_SEG = 10;
  const streepSpecs = [
    { zij: -0.76, y: 0.24, breed: 0.055, lengte: 0.044, kleur: 0xdce1cf, maxOp: 0.42 }, // lichte luchtveeg linksonder
    { zij:  0.74, y: 0.20, breed: 0.050, lengte: 0.038, kleur: 0xdce1cf, maxOp: 0.38 }, // lichte luchtveeg rechtsonder
    { zij: -0.84, y: 0.56, breed: 0.028, lengte: 0.034, kleur: 0x070a0e, maxOp: 0.46 }, // fijne Kuifje inktstreep links
    { zij:  0.80, y: 0.62, breed: 0.026, lengte: 0.030, kleur: 0x070a0e, maxOp: 0.42 }, // fijne Kuifje inktstreep rechts
  ];
  const streepLijst = streepSpecs.map((sp) => {
    const pos = new Float32Array((ST_SEG + 1) * 2 * 3);
    const idx = [];
    for (let i = 0; i < ST_SEG; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({
      color: sp.kleur, transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 9;
    streepGroep.add(mesh);
    return { sp, pos, geo, mat, mesh };
  });

  const tmpPos = new THREE.Vector3(), tmpVoor = new THREE.Vector3(), tmpAchter = new THREE.Vector3();
  const tmpP1 = new THREE.Vector3(), tmpP2 = new THREE.Vector3();
  const d1 = new THREE.Vector3(), d2 = new THREE.Vector3();
  let motorLicht = 1.0, laatsteBrandt = 0;

  // Vloeiend snelheidsprofiel: vlot over de Torenlaan en Meentweg, dan kalm afremmend de oprit op.
  const voortgang = (t) => {
    const c = Math.max(0, Math.min(1, t));
    if (c < 0.72) {
      const k = c / 0.72;
      return 0.76 * (0.08 * k * k + 0.92 * k);
    }
    const k = (c - 0.72) / 0.28;
    return 0.76 + 0.24 * (1 - Math.pow(1 - k, 2.6));
  };

  const kopNeusWereld = new THREE.Vector3(), kopRichtWereld = new THREE.Vector3();
  const werkStrepBij = (uc, snelheid) => {
    // Alleen zichtbaar wanneer de Porsche flink doorrijdt (Torenlaan/kruising) en weg ruim vóór het inparkeren!
    const vaart = Math.max(0, Math.min(1, (snelheid - 0.52) / 0.48)) * (uc < 0.78 ? 1 : Math.max(0, 1 - (uc - 0.78) / 0.08));
    streepGroep.visible = vaart > 0.02 && group.visible;
    if (!streepGroep.visible) return;
    for (const st of streepLijst) {
      st.mat.opacity = st.sp.maxOp * vaart;
      const startU = Math.max(0.002, uc - 0.017); // direct achter de achterbumper (ca. 2,1 m)
      const lenU = st.sp.lengte * (0.55 + 0.45 * vaart);
      for (let i = 0; i <= ST_SEG; i++) {
        const f = i / ST_SEG;
        const ui = Math.max(0.0005, startU - f * lenU);
        const ui2 = Math.min(0.9999, ui + 0.004);
        route.getPointAt(ui, tmpP1);
        route.getPointAt(ui2, tmpP2);
        const tx = tmpP2.x - tmpP1.x, tz = tmpP2.z - tmpP1.z;
        const tl = Math.hypot(tx, tz) || 1;
        // Rechts-vector loodrecht op de rijrichting
        const rx = -tz / tl, rz = tx / tl;
        const tap = Math.sin(f * Math.PI) * (1 - f * 0.35);
        const hw = st.sp.breed * (0.25 + 0.75 * tap);
        const cx = tmpP1.x + rx * (st.sp.zij + f * 0.08 * Math.sign(st.sp.zij));
        const cz = tmpP1.z + rz * (st.sp.zij + f * 0.08 * Math.sign(st.sp.zij));
        const cy = tmpP1.y + st.sp.y + f * 0.04;
        const o = i * 6;
        st.pos[o] = cx - rx * hw; st.pos[o + 1] = cy; st.pos[o + 2] = cz - rz * hw;
        st.pos[o + 3] = cx + rx * hw; st.pos[o + 4] = cy; st.pos[o + 5] = cz + rz * hw;
      }
      st.geo.attributes.position.needsUpdate = true;
    }
  };

  const zetOp = (u, snelheid, bocht, remmen) => {
    const uc = Math.max(0.001, Math.min(0.9995, u));
    route.getPointAt(uc, tmpPos);
    route.getPointAt(Math.min(0.9999, uc + 0.0035), tmpVoor);
    group.position.copy(tmpPos);
    group.lookAt(tmpVoor);
    chassis.rotation.z = THREE.MathUtils.clamp(bocht * 0.60, -0.045, 0.045);
    chassis.rotation.x = THREE.MathUtils.clamp(remmen * 0.020 - snelheid * 0.005, -0.012, 0.024);

    // Draai alle 4 de rechtgezette wielen exact op basis van de afgelegde meters + soepele stuurhoek die bij stilstand naar 0 gaat!
    const rolHoek = (uc * routeLengte) / WIEL_STRAAL;
    const stuurFactor = Math.max(0, Math.min(1, snelheid / 0.22));
    const stuurHoek = THREE.MathUtils.clamp(-bocht * 1.65, -0.32, 0.32) * stuurFactor;
    for (const w of wielGroepen) {
      w.rolG.rotation.x = rolHoek;
      if (w.voor) w.stuurG.rotation.y = stuurHoek;
    }

    group.updateMatrixWorld(true);
    kopNeusWereld.set(0, 0.64, 2.24).applyMatrix4(group.matrixWorld);
    kopRichtWereld.set(0, 0, 1).transformDirection(group.matrixWorld).setY(0).normalize();
    LICHT.uKopPos.value.copy(kopNeusWereld);
    LICHT.uKopDir.value.copy(kopRichtWereld);
    werkStrepBij(uc, snelheid);
  };

  zetOp(1.0, 0, 0, 0);

  return {
    group, streepGroep, route,
    zetIntroStand(tNorm) {
      const u = voortgang(tNorm);
      const uPrev = voortgang(Math.max(0, tNorm - 0.015));
      const uNext = voortgang(Math.min(1, tNorm + 0.015));
      const snelheid = (uNext - uPrev) / 0.03;
      route.getPointAt(Math.max(0.001, u - 0.02), tmpAchter);
      route.getPointAt(u, tmpPos);
      route.getPointAt(Math.min(0.999, u + 0.02), tmpVoor);
      d1.subVectors(tmpPos, tmpAchter).normalize();
      d2.subVectors(tmpVoor, tmpPos).normalize();
      const bocht = (d1.x * d2.z - d1.z * d2.x) * Math.min(1.4, snelheid);
      const remmen = tNorm > 0.72 && tNorm < 0.99 ? Math.sin(((tNorm - 0.72) / 0.27) * Math.PI) : 0;
      zetOp(u, snelheid, bocht, remmen);
    },
    zetLicht(brandt, inktKleur) {
      laatsteBrandt = brandt;
      const eff = brandt * motorLicht;
      LICHT.uKopAan.value = eff;
      kopKegelMat.uniforms.uAan.value = eff;
      for (const sp of kopGloedSprites) {
        sp.visible = eff > 0.04;
        sp.material.opacity = eff * 0.92;
      }
      for (const kg of kopKegels) kg.visible = eff > 0.04;
      achterMat.opacity = eff * 0.92;
      schaduwMat.color.copy(inktKleur);
    },
    zetMotorLicht(factor) {
      motorLicht = Math.max(0, Math.min(1, factor));
      const eff = laatsteBrandt * motorLicht;
      LICHT.uKopAan.value = eff;
      kopKegelMat.uniforms.uAan.value = eff;
      for (const sp of kopGloedSprites) {
        sp.visible = eff > 0.04;
        sp.material.opacity = eff * 0.92;
      }
      for (const kg of kopKegels) kg.visible = eff > 0.04;
      achterMat.opacity = eff * 0.92;
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
  for (const lm of [lijn.material, pLijnMat]) {
    if (!lm) continue;
    const u = lm.uniforms;
    u.uRes.value.copy(px);
    u.uLijn.value = HAND.lijn * dpr * lijnMaat;
    u.uBibber.value = HAND.bibber * dpr;
    u.uGolf.value = HAND.golf * dpr;
  }
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

const kaderEl = document.querySelector('.kader');
const celLaagEl = document.getElementById('cel-laag');
const celDeurLaagEl = document.getElementById('cel-deur-laag');
const bijschriftEl = document.getElementById('strip-bijschrift');
const ballonEl = document.getElementById('strip-ballon');
const ballonSprekerEl = document.getElementById('ballon-spreker');
const ballonTekstEl = document.getElementById('ballon-tekst');
const keuzeEl = document.getElementById('verhaal-keuze');
const overslaanKnop = document.getElementById('overslaan-knop');

// Het interactieve Kuifje-verhaal "Het Geheim van de Meentweg" — drie dossiers gekoppeld aan het echte aanbod van Monastic.
const DOSSIERS = {
  website: {
    label: 'Dossier I',
    titel: 'De Nieuwe Website',
    sub: 'Eigen ontwerp, vaste prijs vanaf € 1.450',
    reactie: '“Geen standaard sjabloon, wel een vaste prijs. Precies wat deze zaak nodig heeft!”',
    maker: '“Goedenavond! Een eigen ontwerp voor een vaste prijs — kom verder, dan zetten we de eerste lijnen op papier.”',
    url: 'https://monastic.nl/websites/',
    urlLabel: 'Bekijk website-pakketten ↗',
  },
  wordpress: {
    label: 'Dossier II',
    titel: 'De WordPress-Zaak',
    sub: 'Check met herstel (€ 249) of overstappen',
    reactie: '“Drieëntwintig plugins en een kier in de achterdeur… hoog tijd dat de maker kijkt!”',
    maker: '“Aha, een WordPress-dossier! Geen zorgen: binnen vijf dagen heb je een helder rapport, of we stappen over.”',
    url: 'https://monastic.nl/wordpress/',
    urlLabel: 'Bekijk de WordPress-check ↗',
  },
  ai3d: {
    label: 'Dossier III',
    titel: 'AI & 3D-Maatwerk',
    sub: 'AI-kansenscan (€ 495) of interactieve 3D',
    reactie: '“Een heel dorp in de browser — als zij dát bouwen, kunnen ze onze zaak ook oplossen!”',
    maker: '“Spannend dossier! Of het nu een AI-kansenscan of 3D-maatwerk wordt — hier spreek je rechtstreeks met de maker.”',
    url: 'https://monastic.nl/websites/',
    urlLabel: 'Bekijk AI-scan & maatwerk ↗',
  },
};

let laatsteBallonSleutel = '';
let laatsteKeuzeSleutel = '';
let actieveKeuzeActies = [];

function toonBallon(sprekerCode, sprekerNaam, tekst) {
  if (!ballonEl) return;
  const sl = `${sprekerCode}|${tekst}`;
  if (!tekst) {
    ballonEl.hidden = true;
    laatsteBallonSleutel = '';
    return;
  }
  if (sl !== laatsteBallonSleutel) {
    laatsteBallonSleutel = sl;
    ballonEl.dataset.spreker = sprekerCode || '';
    if (ballonSprekerEl) ballonSprekerEl.textContent = sprekerNaam || '';
    if (ballonTekstEl) ballonTekstEl.textContent = tekst;
    // Herstart subtiele pop-animatie bij nieuwe spreker
    ballonEl.hidden = true;
    void ballonEl.offsetWidth;
  }
  ballonEl.hidden = isAfdruk && !window._toonUIInAfdruk;
}

function toonKeuzes(sleutel, items) {
  if (!keuzeEl) return;
  if (!items || !items.length) {
    keuzeEl.hidden = true;
    if (laatsteKeuzeSleutel) { keuzeEl.innerHTML = ''; laatsteKeuzeSleutel = ''; actieveKeuzeActies = []; }
    return;
  }
  if (sleutel !== laatsteKeuzeSleutel) {
    laatsteKeuzeSleutel = sleutel;
    actieveKeuzeActies = items.map((it) => it.actie);
    keuzeEl.innerHTML = '';
    items.forEach((it, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'keuze-kaart';
      btn.dataset.keuzeIdx = String(idx);
      btn.innerHTML = `<span class="keuze-label">${it.label}</span><strong>${it.titel}</strong><span>${it.sub}</span>`;
      btn.addEventListener('click', () => it.actie());
      keuzeEl.appendChild(btn);
    });
  }
  keuzeEl.hidden = isAfdruk && !window._toonUIInAfdruk;
}

function zetRegieUI(inRegie, celStand = 'uit', bijschrift = '') {
  stuur.enabled = !inRegie;
  if (kaderEl) kaderEl.classList.toggle('in-regie', inRegie);
  if (celLaagEl) celLaagEl.hidden = celStand !== 'porsche';
  if (celDeurLaagEl) celDeurLaagEl.hidden = celStand !== 'deur';
  if (bijschriftEl) {
    bijschriftEl.hidden = !bijschrift || (isAfdruk && !window._toonUIInAfdruk);
    if (bijschrift) bijschriftEl.textContent = bijschrift;
  }
  if (overslaanKnop) overslaanKnop.hidden = !inRegie || (isAfdruk && !window._toonUIInAfdruk);
}

function stopIntro(autoParkeren = false) {
  const wasActief = !!intro;
  intro = null;
  zetRegieUI(false, 'uit', '');
  toonBallon('', '', '');
  toonKeuzes('', null);
  const knop = document.getElementById('intro-knop');
  if (knop) { knop.setAttribute('aria-pressed', 'false'); knop.textContent = 'Intro'; }
  if (porsche) {
    porsche.group.visible = true;
    porsche.streepGroep.visible = false;
    if (autoParkeren) {
      porsche.zetIntroStand(1.0);
      porsche.zetMotorLicht(0);
    }
  }
  if (belHand) belHand.zetReik(0, null);
  LICHT.uGangLicht.value = gangLichtAan * LICHT.uBrandt.value;
  if (intercom) intercom.zetStaat(LICHT.uBrandt.value, 0, 0, gangLichtAan, -1);
  if (wasActief) werkCartoucheBij();
}

// ---- Kuifje / Ligne Claire 5-Scènes Interactief Verhaal ("Het Geheim van de Meentweg") -> naadloos vrij 3D rondkijken:
//   1 (0.00–0.26) Torenlaan & kruising: de leiblauwe Porsche 930 met draaiende wielen, koplampkegels & bewegingsstrepen.
//   2 (0.26–0.51) In de Porsche (2D duo-cel vóór live 3D Meentweg) + KEUZE 1 (3 Monastic-dossiers) + reactie bestuurder!
//   3 (0.51–0.70) Het donkere erf op: natuurlijke inrit zonder rare 90°-draai, warme wandlantaarn & koplampen uit.
//   4 (0.70–0.91) De schaduw & aanbellen: zwarte hoed-schaduw op de baksteenmuur + 2D Kuifje-hand op MONASTIC -> TRRRING!
//   5 (deur)      De achterdeur opent (2D Maker-cel) met antwoord op jouw dossier + KEUZE 2 (vrij 3D / ander dossier / site).
//   6 (0.91–1.00) Vrij 3D: camera zwaait vloeiend uit over het maanverlichte erf met geparkeerde Porsche & brandend gangraampje.
const hoekVoorScherm = (h) => (camera.aspect < 1 ? Math.min(62, h + 15) : h);
const smooth01 = (x) => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); };
const MUUR_RECHTS = new THREE.Vector3(INTERCOM_NORMAAL.z, 0, -INTERCOM_NORMAAL.x);
const tmpBelPos = new THREE.Vector3();
const tmpUitOog = new THREE.Vector3();
const tmpUitDoel = new THREE.Vector3();

function pasIntroFrameToe(tNorm, celOverride = null) {
  const c = Math.max(0, Math.min(1, tNorm));

  // 1. Porsche rijdt over c = 0.00..0.68 pal over het asfalt en vloeiend het grind op.
  const pT = Math.min(1, c / 0.68);
  const inAutoCel = celOverride ? celOverride === 'porsche' : (c >= 0.26 && c < 0.51);
  if (porsche) {
    porsche.group.visible = !inAutoCel;
    porsche.zetIntroStand(pT);
    const lichtAan = c < 0.665 ? 1.0 : Math.max(0, 1 - (c - 0.665) / 0.03);
    porsche.zetMotorLicht(lichtAan);
  }

  // 2. Intercom, film-noir muurschaduw & 2D Kuifje-aanbelcel (Shot 4)
  let belDruk = 0, belRingT = 0, raamAan = 0, schaduwT = -1, reik = 0;
  if (intercom && belHand) {
    const belWereld = intercom.belWereldPositie(tmpBelPos);
    if (c >= 0.70 && c < 0.91) {
      schaduwT = Math.max(0, Math.min(1, (c - 0.70) / 0.19));
      if (c >= 0.785 && c < 0.835) reik = smooth01((c - 0.785) / 0.05);
      else if (c >= 0.835 && c < 0.865) reik = 1.0;
      else if (c >= 0.865 && c < 0.905) reik = 1.0 - smooth01((c - 0.865) / 0.04);
      belDruk = (c >= 0.835 && c < 0.865) ? smooth01(Math.sin(((c - 0.835) / 0.03) * Math.PI)) : 0;
      belRingT = c >= 0.84 ? Math.min(1, (c - 0.84) / 0.04) : 0;
      raamAan = c >= 0.855 ? smooth01((c - 0.855) / 0.035) : 0;
    } else if (c >= 0.91) {
      raamAan = 1.0;
      gangLichtAan = 1.0;
    }
    LICHT.uGangLicht.value = Math.max(raamAan, gangLichtAan) * LICHT.uBrandt.value;
    belHand.zetReik(reik, belWereld);
    intercom.zetStaat(LICHT.uBrandt.value, belDruk, belRingT, raamAan, schaduwT);
  }

  // 3. Camera-regie per scène
  let bijschrift = '';
  if (c < 0.26) {
    // Shot 1: Aankomst over de Torenlaan langs de straatlantaarn, handwijzer & verlichte etalage
    const k = smooth01(c / 0.26);
    camera.position.set(-18.5 + 3.8 * k, 4.1 - 0.65 * k, 48.0 - 7.5 * k);
    stuur.target.set(-28.0 + 17.5 * k, 1.5 + 0.35 * k, 35.5 - 8.5 * k);
    if (porsche) {
      const pPos = porsche.positie(new THREE.Vector3());
      pPos.y += 0.85;
      stuur.target.lerp(pPos, 0.50 + 0.25 * Math.sin(k * Math.PI));
    }
    camera.fov = hoekVoorScherm(36);
    if (c < 0.24) bijschrift = 'Blaricum, laat op de avond. Een onopgeloste zaak…';
  } else if (c < 0.51) {
    // Shot 2: In de Porsche (2D duo-voorgrondcel) — live 3D camera glijdt langs Meentweg & verlicht hoekpand!
    const k = (c - 0.26) / 0.25;
    const camX = -7.0 + 27.5 * k;
    const camZ = 27.2 - 19.2 * k;
    camera.position.set(camX, 1.65, camZ);
    stuur.target.set(camX - 11.5, 2.75, camZ - 16.0);
    camera.fov = hoekVoorScherm(42);
  } else if (c < 0.70) {
    // Shot 3: Sfeervol het donkere Monastic-erf oprijden (volledig vloeiende bocht, nul plotse draai!)
    const k = smooth01((c - 0.51) / 0.19);
    camera.position.set(22.2 - 3.6 * k, 2.55 - 0.40 * k, 0.9 + 1.4 * k);
    stuur.target.set(17.4 - 3.6 * k, 1.35 - 0.25 * k, -1.6 + 0.35 * k);
    camera.fov = hoekVoorScherm(40 - 2 * k);
    if (c < 0.67) bijschrift = 'Meentweg 1-a · Het donkere erf van Monastic.';
  } else if (c < 0.91) {
    // Shot 4: Close-up op de bakstenen pier, wandlantaarn, zwarte film-noir slagschaduw & 2D Kuifje-hand op MONASTIC!
    const k = smooth01((c - 0.70) / 0.21);
    const afstand = 1.22 - 0.28 * k;
    camera.position.copy(INTERCOM_POS)
      .addScaledVector(INTERCOM_NORMAAL, afstand)
      .addScaledVector(MUUR_RECHTS, 0.06 - 0.05 * k)
      .add(new THREE.Vector3(0, 0.04 - 0.045 * k, 0));
    stuur.target.copy(INTERCOM_POS)
      .addScaledVector(MUUR_RECHTS, 0.05 - 0.04 * k)
      .add(new THREE.Vector3(0, 0.02 - 0.025 * k, 0));
    camera.fov = hoekVoorScherm(34 - 2 * k);
  } else {
    // Outro (0.91–1.00): camera zwaait vloeiend uit over het maanverlichte erf & geparkeerde Porsche -> vrij 3D!
    const k = smooth01((c - 0.91) / 0.09);
    tmpUitOog.copy(INTERCOM_POS)
      .addScaledVector(INTERCOM_NORMAAL, 0.94)
      .addScaledVector(MUUR_RECHTS, 0.01)
      .add(new THREE.Vector3(0, -0.005, 0));
    tmpUitDoel.copy(INTERCOM_POS)
      .addScaledVector(MUUR_RECHTS, 0.01)
      .add(new THREE.Vector3(0, -0.005, 0));
    camera.position.lerpVectors(tmpUitOog, new THREE.Vector3(21.8, 2.65, 3.1), k);
    stuur.target.lerpVectors(tmpUitDoel, new THREE.Vector3(11.2, 2.1, -0.8), k);
    camera.fov = hoekVoorScherm(32 + 7 * k);
  }

  const celStand = celOverride || (inAutoCel ? 'porsche' : 'uit');
  zetRegieUI(!!intro, celStand, bijschrift);
  camera.updateProjectionMatrix();
  const kop = celStand === 'deur' ? ['Monastic · De Achterdeur', 'De maker opent de deur in het warme studiolicht'] :
              c < 0.26 ? ['De Torenlaan · Nacht', 'Een leiblauwe Porsche 930 draait Blaricum in'] :
              c < 0.51 ? ['Meentweg · In de Porsche', 'Kies het dossier voor jullie bezoek aan Monastic'] :
              c < 0.70 ? ['Het erf · Monastic', 'De Porsche stuurt het donkere grind op en dooft het licht'] :
              c < 0.84 ? ['Monastic · Achterdeur', 'Een bekende schaduw glijdt langs de muur'] :
              c < 0.91 ? ['Monastic · Blaricum', 'Trrring… binnen springt het ganglicht aan'] :
                         ['Het erf · Kantoor', 'Sleep om vrij door Blaricum te kijken'];
  werkCartoucheBij(kop[0], kop[1]);
}

function kiesDossier(sleutel) {
  if (!intro) return;
  intro.dossier = DOSSIERS[sleutel] ? sleutel : 'website';
  intro.fase = 'reactie';
  intro.t0 = performance.now();
  toonKeuzes('', null);
}

function stapNaarKeuze1() {
  if (!intro) return;
  intro.fase = 'keuze1';
  intro.t0 = performance.now();
  toonKeuzes('', null);
}

function stapNaarOutro() {
  if (!intro) return;
  gangLichtAan = 1.0;
  LICHT.uGangLicht.value = LICHT.uBrandt.value;
  intro.fase = 'outro';
  intro.t0 = performance.now();
  toonBallon('', '', '');
  toonKeuzes('', null);
}

function werkInteractiefVerhaalBij(nu) {
  if (!intro) return;
  const elapsed = nu - intro.t0;
  const dos = DOSSIERS[intro.dossier] || DOSSIERS.website;

  if (intro.fase === 'torenlaan') {
    const f = Math.min(1, elapsed / 4500);
    toonBallon('', '', '');
    toonKeuzes('', null);
    pasIntroFrameToe(f * 0.258);
    if (f >= 1) { intro.fase = 'keuze1'; intro.t0 = nu; }
  } else if (intro.fase === 'keuze1') {
    // Live 3D Blaricum blijft rustig voorbijglijden langs de ramen terwijl de bezoeker een dossier kiest!
    const lus = 0.265 + ((elapsed * 0.000018) % 0.14);
    pasIntroFrameToe(lus, 'porsche');
    toonBallon('bijrijder', 'De Compagnon', '“We zijn bijna bij Monastic op de Meentweg! Welk dossier leggen we vanavond op tafel?”');
    toonKeuzes('keuze1', Object.entries(DOSSIERS).map(([sl, d]) => ({
      label: d.label, titel: d.titel, sub: d.sub, actie: () => kiesDossier(sl),
    })));
  } else if (intro.fase === 'reactie') {
    const f = Math.min(1, elapsed / 2600);
    pasIntroFrameToe(0.38 + f * 0.125, 'porsche');
    toonBallon('bestuurder', 'De Bezoeker', dos.reactie);
    toonKeuzes('', null);
    if (f >= 1) { intro.fase = 'oprit'; intro.t0 = nu; }
  } else if (intro.fase === 'oprit') {
    const f = Math.min(1, elapsed / 3800);
    toonBallon('', '', '');
    toonKeuzes('', null);
    pasIntroFrameToe(0.51 + f * 0.188);
    if (f >= 1) { intro.fase = 'aanbellen'; intro.t0 = nu; }
  } else if (intro.fase === 'aanbellen') {
    const f = Math.min(1, elapsed / 3600);
    toonBallon('', '', '');
    toonKeuzes('', null);
    pasIntroFrameToe(0.70 + f * 0.208);
    if (f >= 1) {
      gangLichtAan = 1.0;
      LICHT.uGangLicht.value = LICHT.uBrandt.value;
      intro.fase = 'deur';
      intro.t0 = nu;
    }
  } else if (intro.fase === 'deur') {
    pasIntroFrameToe(0.91, 'deur');
    toonBallon('maker', 'Monastic · De Maker', dos.maker);
    toonKeuzes(`deur-${intro.dossier}`, [
      { label: 'Vrij 3D', titel: 'Verken Blaricum in 3D →', sub: 'Sleep & zoom zelf over het maanverlichte erf', actie: () => stapNaarOutro() },
      { label: 'Opnieuw', titel: 'Ander dossier kiezen', sub: 'Terug in de Porsche voor een andere verhaallijn', actie: () => stapNaarKeuze1() },
      { label: dos.label, titel: dos.urlLabel, sub: 'Opent het echte aanbod in een nieuw tabblad', actie: () => { window.open(dos.url, '_blank', 'noopener'); stapNaarOutro(); } },
    ]);
  } else if (intro.fase === 'outro') {
    const f = Math.min(1, elapsed / 1800);
    toonBallon('', '', '');
    toonKeuzes('', null);
    pasIntroFrameToe(0.91 + f * 0.09, 'uit');
    if (f >= 1) {
      intro = null;
      gangLichtAan = 1.0;
      LICHT.uGangLicht.value = LICHT.uBrandt.value;
      standNaam = 'erf';
      zetRegieUI(false, 'uit', '');
      if (porsche) { porsche.group.visible = true; porsche.streepGroep.visible = false; porsche.zetMotorLicht(0); }
      if (belHand) belHand.zetReik(0, null);
      if (intercom) intercom.zetStaat(LICHT.uBrandt.value, 0, 0, gangLichtAan, -1);
      const knop = document.getElementById('intro-knop');
      if (knop) { knop.setAttribute('aria-pressed', 'false'); knop.textContent = 'Intro'; }
      for (const k of document.querySelectorAll('[data-stand]')) k.setAttribute('aria-pressed', String(k.dataset.stand === 'erf'));
      werkCartoucheBij('Het erf · Monastic', 'Sleep om vrij door Blaricum te kijken');
    }
  }
}

function startIntro() {
  if (intro) { stopIntro(true); return; }
  stopRondleiding();
  reis = null;
  gangLichtAan = 0;
  LICHT.uGangLicht.value = 0;
  if (porsche) {
    porsche.group.visible = true;
    porsche.zetMotorLicht(1);
  }
  intro = { fase: 'torenlaan', t0: performance.now(), dossier: 'website' };
  zetRegieUI(true, 'uit', 'Blaricum, laat op de avond. Een onopgeloste zaak…');
  toonBallon('', '', '');
  toonKeuzes('', null);
  const knop = document.getElementById('intro-knop');
  if (knop) { knop.setAttribute('aria-pressed', 'true'); knop.textContent = 'Stop intro'; }
  for (const k of document.querySelectorAll('[data-stand]')) k.setAttribute('aria-pressed', 'false');
}

function slaIntroOver() {
  if (!intro) return;
  gangLichtAan = 1.0;
  LICHT.uGangLicht.value = LICHT.uBrandt.value;
  stopIntro(true);
  naar('erf', false);
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
  STANDEN.plein = { oog: [-34.8, 3.85, 3.6], doel: [-24.2, 1.55, -7.8], hoek: 38 };
  STANDEN.erf = { oog: [21.8, 2.65, 3.1], doel: [11.2, 2.1, -0.8], hoek: 39 };

  const model = await (await fetch('model/model.json')).json();
  vakNamen = model.slots;
  const id = Object.fromEntries(vakNamen.map((naam, i) => [naam, i]));
  const [vPos, vVak, rPosRaw, rNorRaw, rVakRaw, lPosRaw, lNRaw, lEigRaw] = await Promise.all([
    laad('vlak-pos.bin', Float32Array), laad('vlak-slot.bin', Uint8Array), laad('romp-pos.bin', Float32Array),
    laad('romp-normaal.bin', Int8Array), laad('romp-slot.bin', Uint8Array), laad('lijn-pos.bin', Float32Array),
    laad('lijn-n.bin', Int8Array), laad('lijn-eig.bin', Float32Array),
  ]);

  // Splits de Porsche 930 Turbo (koets + 4 rechtgezette wielen van uitsluitend autowiel/metaal) los van het dorp.
  const gesplitst = splitsPorsche(rPosRaw, rNorRaw, rVakRaw, lPosRaw, lNRaw, lEigRaw, id.wit, id.lamp, id.autowiel, id.metaal);
  // Verwijder zowel de 7 statische low-poly voetgangers als storende horizontale Blender-bloknaden op de achtergevel.
  const { lPos, lN, lEig } = schoonAchtergevelLijnen(gesplitst.statisch.lPos, gesplitst.statisch.lN, gesplitst.statisch.lEig);

  // Haal straatlantaarn-glazen (slot 'lamp') los én filter statische low-poly voetgangers (figuur + g_* kleding) volledig weg!
  const lantaarnSplit = splitsLantaarnGlas(
    vPos, vVak,
    gesplitst.statisch.rPos, gesplitst.statisch.rNor, gesplitst.statisch.rVak,
    id.lamp, id.figuur, id.g_wit, id.g_geel, model.lampen || [],
  );
  const { rPos, rNor, rVak } = lantaarnSplit;

  lucht = luchtShader();
  const koepel = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), lucht);
  koepel.frustumCulled = false;
  koepel.renderOrder = -10;
  scene.add(koepel);

  const mat = vlakShader(vakNamen.length, id);
  palet = mat.uniforms.palet.value;
  const vlakMesh = new THREE.Mesh(driehoeken(lantaarnSplit.vPos, { vak: [lantaarnSplit.vVak, 2] }), mat);
  vlakMesh.frustumCulled = false;
  scene.add(vlakMesh);

  const romp = driehoeken(rPos, { normal: [rNor, 3, true], vak: [rVak, 2] });
  rand = rompRand(id.lamp);
  const rompMat = rompShader(vakNamen.length, palet, id);
  const randMesh = new THREE.Mesh(romp, rand);
  const rompMesh = new THREE.Mesh(romp, rompMat);
  randMesh.frustumCulled = rompMesh.frustumCulled = false;
  scene.add(randMesh, rompMesh);

  // Transparant lantaarnglas + gloeiend pitje binnenin (dubbelzijdig, zonder zwarte BackSide-omtrek!).
  lampPitMat = new THREE.MeshBasicMaterial({ color: 0xfff5b0, side: THREE.DoubleSide });
  if (lantaarnSplit.pitPos.length) {
    const pitMesh = new THREE.Mesh(driehoeken(lantaarnSplit.pitPos), lampPitMat);
    pitMesh.frustumCulled = false;
    pitMesh.renderOrder = 9;
    scene.add(pitMesh);
  }
  lampGlasMat = new THREE.MeshBasicMaterial({
    color: 0xffe98a, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide,
  });
  if (lantaarnSplit.glasPos.length) {
    const glasMesh = new THREE.Mesh(driehoeken(lantaarnSplit.glasPos), lampGlasMat);
    glasMesh.frustumCulled = false;
    glasMesh.renderOrder = 11;
    scene.add(glasMesh);
  }

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
  const lMat = lijnShader(0.58);
  lijn = new THREE.Mesh(g, lMat);
  lijn.frustumCulled = false;
  lijn.renderOrder = 10;
  scene.add(lijn);

  // Repareer Bistrot Chapeau: voeg ontbrekende noord- en westgevel, kruisdak en schoorsteen toe!
  const chapeau = bouwChapeauHerstel(mat, lMat, id);
  scene.add(chapeau.vlakMesh, chapeau.lijnMesh);
  slagMeshes = [vlakMesh, rompMesh, chapeau.vlakMesh];

  const gloed = gloedBeeld();

  // De strakke Ligne Claire Porsche 930 Turbo + Kuifje-bewegingsstrepen in wereldruimte
  pLijnMat = lijnShader(0.68);
  porsche = bouwPorscheLeven(gesplitst.porsche, rompMat, rand, pLijnMat, gloed);
  scene.add(porsche.group, porsche.streepGroep);

  // De echte Monastic-intercom + wandlantaarn + film-noir muurschaduw én de 2D Kuifje-aanbelcel (hand-cel.webp)!
  intercom = bouwIntercom(gloed, lMat.uniforms.uRes, lMat.uniforms.uLijn);
  scene.add(intercom.group);
  belHand = bouwBelHandCel(LICHT.uNacht);
  scene.add(belHand.groep);

  // Nachtwolken met heldere maanlichtreflecties langs de randen (11 vaste platen hoog rondom het dorp)
  const plekken = [[-520, 190, -640, 300], [260, 250, -820, 380], [760, 170, -300, 260], [-820, 230, 180, 340], [520, 210, 640, 300], [-240, 260, 860, 360],
    [-60, 360, -900, 460], [560, 130, -720, 300], [980, 330, -640, 420], [-900, 150, -420, 320], [100, 150, 900, 300]];
  for (const [x, y, z, b] of plekken) {
    const w = new THREE.Sprite(new THREE.SpriteMaterial({ map: wolkBeeld(STIJLEN.klareDag, 0, true), depthWrite: false, fog: false }));
    w.position.set(x, y, z);
    w.scale.set(b, b * 420 / 1024, 1);
    wolken.push(w);
    wolkBasis.push([x, y, z]);
    scene.add(w);
  }

  // Echte straatlantaarns + Monastic wandlantaarn boven de intercom + directe gloed vlak voor de verlichte hoekpand-etalage.
  const etalageGloed = [
    [-9.17, 0.9, 12.7, 3.5], [-10.0, 0.9, 11.43, 3.5], [-7.29, 0.9, 15.58, 3.5], [-6.46, 0.9, 16.85, 3.5],
    [-4.69, 0.9, 19.55, 3.5], [-5.52, 0.9, 18.28, 3.5], [-12.95, 0.9, 3.63, 3.5], [-11.54, 0.9, 5.78, 3.5],
    [-9.07, 0.9, 9.56, 3.5], [-10.01, 0.9, 8.13, 3.5],
  ];
  const wandLantaarn = [[8.25, 2.08, -1.62, 1.95]];
  const kringen = [...(model.lampen || []).map((q) => [...q, 5.9]), ...wandLantaarn, ...etalageGloed].slice(0, 40);
  kringen.forEach((q, i) => LICHT.uLamp.value[i].set(q[0], q[1], q[2], q[3]));
  LICHT.uLampN.value = kringen.length;

  // Volumetrische zachte lichtkegels onder elke straatlantaarn (zoals op de referentieplaat!)
  lampKegelMat = maakLichtKegelMat(0xf7ea92, 0.16);
  const straalGeo = new THREE.CylinderGeometry(0.18, 2.15, 3.6, 16, 1, true);
  straalGeo.translate(0, -1.8, 0);
  for (const [x, y, z] of model.lampen || []) {
    const ly = y < 3.7 ? y - 0.18 : y;
    const l = new THREE.Sprite(new THREE.SpriteMaterial({ map: gloed, depthWrite: false, fog: false }));
    l.position.set(x, ly, z);
    l.scale.set(2.3, 2.3, 1);
    l.renderOrder = 12;
    lampen.push(l);
    scene.add(l);

    const keg = new THREE.Mesh(straalGeo, lampKegelMat);
    keg.position.set(x, ly - 0.08, z);
    keg.scale.set(1, Math.min(1.15, Math.max(0.75, ly / 3.6)), 1);
    keg.renderOrder = 10;
    keg.visible = false;
    lampKegels.push(keg);
    scene.add(keg);
  }

  // De maansikkel met zilverblauwe hof exact uitgelijnd op LICHT.uMaanDir (reflecties op wolken & kantoor!)
  maan = new THREE.Sprite(new THREE.SpriteMaterial({ map: maanBeeld(), depthWrite: false, fog: false }));
  maan.position.set(420, 260, -980);
  maan.scale.set(175, 175, 1);
  maan.visible = false;
  scene.add(maan);

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
  if (overslaanKnop) overslaanKnop.addEventListener('click', slaIntroOver);
  const rondKnop = document.getElementById('rondleiding');
  if (rondKnop) rondKnop.addEventListener('click', startRondleiding);
  stuur.addEventListener('start', () => { reis = null; stopRondleiding(); });

  // Sneltoetsen: 1-3 kiezen een dossier tijdens de keuzemomenten, anders 1-7 voor standpunten, I voor verhaal, Esc overslaan.
  const standLijst = ['hoekpand', 'kruising', 'wijzer', 'erf', 'straat', 'plein', 'dorp'];
  window.addEventListener('keydown', (ev) => {
    if (ev.target && /INPUT|TEXTAREA/.test(ev.target.tagName)) return;
    if (ev.key === 'Escape' && intro) { slaIntroOver(); return; }
    if (intro && (intro.fase === 'keuze1' || intro.fase === 'deur') && ev.key >= '1' && ev.key <= '3') {
      const fn = actieveKeuzeActies[Number(ev.key) - 1];
      if (fn) { ev.preventDefault(); fn(); return; }
    }
    if (ev.key >= '1' && ev.key <= '7') naar(standLijst[Number(ev.key) - 1]);
    else if (ev.key.toLowerCase() === 'i') startIntro();
    else if (ev.code === 'Space') { ev.preventDefault(); startRondleiding(); }
  });

  // Speel het korte interactieve Kuifje-verhaal direct af bij openen (tenzij een vaste stand of ?afdruk is gevraagd).
  if (!isAfdruk && !vraag.has('stand') && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    startIntro();
  } else if (vraag.has('intro')) {
    pasIntroFrameToe(Number(vraag.get('intro')));
  }

  melding.hidden = true;
  const renderNu = () => {
    if (SLAG) slagKaart();
    stuur.update();
    const uPxVal = camera.projectionMatrix.elements[5] * lijn.material.uniforms.uRes.value.y * 0.5;
    lijn.material.uniforms.uPx.value = uPxVal;
    if (pLijnMat) pLijnMat.uniforms.uPx.value = uPxVal;
    renderer.render(scene, camera);
  };
  window.toon = (stand, stijl, licht) => {
    naar(stand, true);
    kleur(stijl, licht, true);
    if (porsche) { porsche.group.visible = true; porsche.streepGroep.visible = false; porsche.zetIntroStand(1.0); porsche.zetMotorLicht(0); }
    if (belHand) belHand.zetReik(0, null);
    if (intercom) intercom.zetStaat(LICHT.uBrandt.value, 0, 0, gangLichtAan, -1);
    if (vogels) vogels.update(0);
    renderNu();
  };
  window.toonIntro = (tNorm, stijl, licht) => {
    stopIntro(false); stopRondleiding();
    kleur(stijl, licht, true);
    pasIntroFrameToe(tNorm);
    renderNu();
  };
  window.toonVerhaalStap = (stap, dossier = 'website', stijl = 'bunker', licht = 'nacht') => {
    stopIntro(false); stopRondleiding();
    kleur(stijl, licht, true);
    window._toonUIInAfdruk = true;
    intro = { fase: stap, t0: performance.now() - 1200, dossier };
    werkInteractiefVerhaalBij(performance.now());
    renderNu();
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
      if (vogels && vogels.group.visible) vogels.update(sec);
    }
    if (intro) {
      werkInteractiefVerhaalBij(nu);
    } else {
      if (rondleiding) {
        const u = ((nu - rondleiding.t0) % rondleiding.duur) / rondleiding.duur;
        rondleiding.ogen.getPointAt(u, camera.position);
        rondleiding.doelen.getPointAt(u, stuur.target);
        camera.fov = 36 + Math.sin(u * Math.PI * 2) * 3;
        camera.updateProjectionMatrix();
        const fase = u < 0.22 ? ['Het hoekpand', 'Hoek Meentweg en Huizerweg'] :
                     u < 0.46 ? ['De kruising', 'Langs Bistrot Chapeau en de bomen'] :
                     u < 0.68 ? ['Albert Heijn', 'Het dorpsplein van Blaricum'] :
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
    if (SLAG && !reis && !intro && beelden % 20 === 0) {
      const wil = Math.min(280, Math.max(55, camera.position.distanceTo(stuur.target) * 1.25));
      if (Math.abs(wil - slagVeld) > 0.3 * slagVeld || slagMidden.distanceTo(new THREE.Vector3(stuur.target.x, 0, stuur.target.z)) > 0.35 * slagVeld) slagKaart();
    }
    const uPxVal = camera.projectionMatrix.elements[5] * lijn.material.uniforms.uRes.value.y * 0.5;
    lijn.material.uniforms.uPx.value = uPxVal;
    if (pLijnMat) pLijnMat.uniforms.uPx.value = uPxVal;
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
