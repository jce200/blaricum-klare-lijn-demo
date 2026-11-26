// Het Kuifje / Ligne Claire-verhaal bij het kantoor van Monastic:
//   1. De echte antraciete Monastic-intercom naast de achterdeur (44 × 15 cm, wit woordmerk uit woordmerk.svg,
//      warme gloeiende belring, echte 3D-drukknop, wandlantaarn erboven, strip-klankboogjes TRRRING! en het
//      gangraampje dat warm aanspringt zodra er wordt aangebeld).
//   2. De mysterieuze Hergé-bezoeker in olijfkaki trenchcoat met handgetekende inktplooien, schouderpas,
//      ceintuur, donkere haren & oren onder een gedeukte gleufhoed, warme pantalon, kastanjebruine leren
//      herenschoenen, aktetas én een handgetekende Hergé close-up striphand voor het aanbellen.
import * as THREE from 'three';

// Exacte muurpositie en normaal van de bakstenen pier tussen het gangraampje en de achterdeur (uit blender/intercom.py).
export const INTERCOM_POS = new THREE.Vector3(7.989, 1.52, -1.686);
export const INTERCOM_NORMAAL = new THREE.Vector3(0.837, 0, -0.547).normalize();
export const INTERCOM_YAW = Math.atan2(INTERCOM_NORMAAL.x, INTERCOM_NORMAAL.z);

// Schermruimte-inktomtrek met exact dezelfde constante penbreedte als het dorp en de Porsche (nooit opgeblazen close-up!).
function omtrekPxMat(uRes, uLijn, schaal = 0.92) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uRes: uRes || { value: new THREE.Vector2(1280, 720) },
      uLijn: uLijn || { value: 2.2 },
      uSchaal: { value: schaal },
    },
    vertexShader: `
      uniform vec2 uRes;
      uniform float uLijn;
      uniform float uSchaal;
      void main() {
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vec4 n = projectionMatrix * vec4(normalize(normalMatrix * normal), 0.0);
        vec2 r = n.xy * uRes;
        float l = max(length(r), 1e-5);
        float px = clamp(uLijn * uSchaal, 1.35, 3.6);
        p.xy += (r / l) * px * 2.0 / uRes * p.w;
        gl_Position = p;
      }`,
    fragmentShader: `
      void main() { gl_FragColor = vec4(0.016, 0.024, 0.032, 1.0); }`,
    side: THREE.BackSide,
  });
}

// Strakke tweetoons Hergé Ligne Claire-shader met optionele handgetekende zwarte inktlijnen (plooien, naden, veters).
function figuurMat(lichtHex, schaduwHex, uZon, uNacht, inktTex = null) {
  const cL = new THREE.Color(lichtHex);
  const cS = new THREE.Color(schaduwHex);
  return new THREE.ShaderMaterial({
    uniforms: {
      uLicht: { value: cL },
      uSchaduw: { value: cS },
      uZon,
      uNacht,
      uInktTex: { value: inktTex },
      uHeeftInkt: { value: inktTex ? 1.0 : 0.0 },
      uLampPos: { value: INTERCOM_POS.clone().add(new THREE.Vector3(0.18, 0.58, -0.12)) },
    },
    vertexShader: `
      varying vec3 vN;
      varying vec3 vP;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vP = wp.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform vec3 uLicht, uSchaduw, uZon, uLampPos;
      uniform float uNacht, uHeeftInkt;
      uniform sampler2D uInktTex;
      varying vec3 vN;
      varying vec3 vP;
      varying vec2 vUv;
      void main() {
        vec3 n = normalize(vN);
        // Helder afgesneden tweetoons klare lijn: 's nachts koel maanlicht + warm schijnsel nabij de wandlantaarn.
        vec3 richt = normalize(mix(uZon, vec3(0.55, 0.62, 0.56), uNacht));
        bool licht = dot(n, richt) > 0.04;
        vec3 k = licht ? uLicht : uSchaduw;
        // 's Nachts iets koeler maar helder en uitstekend leesbaar tegen de donkere Porsche en baksteenmuur.
        k *= mix(vec3(1.0), vec3(0.84, 0.87, 0.92), uNacht);
        // Subtiele warme lantaarngloed zodra de bezoeker onder de Monastic-wandlamp bij de deur staat.
        float dLamp = length(uLampPos - vP);
        if (uNacht > 0.05 && dLamp < 3.4 && dot(n, normalize(uLampPos - vP)) > 0.05) {
          float g = smoothstep(3.4, 1.2, dLamp) * 0.24 * uNacht;
          k = mix(k, vec3(0.95, 0.86, 0.54), g);
        }
        // Handgetekende Hergé-binnenlijnen (plooien, schouderpas, revers, zakken, veters, riemgesp).
        if (uHeeftInkt > 0.5) {
          vec4 tx = texture2D(uInktTex, vUv);
          k = mix(k, vec3(0.016, 0.024, 0.032), tx.a);
        }
        gl_FragColor = vec4(k, 1.0);
      }`,
    polygonOffset: true, polygonOffsetFactor: 1.2, polygonOffsetUnits: 1.5,
  });
}

function metInkt(geo, mat, inktMat) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, mat);
  const o = new THREE.Mesh(geo, inktMat);
  g.add(m, o);
  return g;
}

// ---- Handgetekende UV-inktlijnen op de trenchcoat (Hergé-plooien, schouderpas, rugsplit, knopen, zakkleppen).
function tekenJasInktTex() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 1024, 1024);
  g.strokeStyle = '#040608';
  g.lineCap = 'round';
  g.lineJoin = 'round';

  // UV-conventie van bouwJasGeo: u=0.0 en 1.0 = voorzijde (+Z), u=0.25 = links (+X), u=0.50 = rug (-Z), u=0.75 = rechts (-X).
  // v=0 (canvas y=1024) = onderste zoom, v=1 (canvas y=0) = schouder/hals.
  const Y = (v) => (1 - v) * 1024;
  const X = (u) => u * 1024;

  // 1. Rug-schouderpas (klassieke Hergé trenchcoat storm-flap op de rug, u = 0.28..0.72)
  g.lineWidth = 7.5;
  g.beginPath();
  g.moveTo(X(0.27), Y(0.75));
  g.quadraticCurveTo(X(0.39), Y(0.70), X(0.50), Y(0.66));
  g.quadraticCurveTo(X(0.61), Y(0.70), X(0.73), Y(0.75));
  g.stroke();

  // 2. Middelnaad op de rug van schouderpas naar ceintuur + klassieke rugsplit in de rok
  g.lineWidth = 6.0;
  g.beginPath();
  g.moveTo(X(0.50), Y(0.66));
  g.lineTo(X(0.50), Y(0.49));
  g.stroke();
  // Rugsplit onder de riem (licht openstaand V-tje zoals bij een echte gabardine regenjas!)
  g.lineWidth = 6.5;
  g.beginPath();
  g.moveTo(X(0.50), Y(0.43));
  g.lineTo(X(0.50), Y(0.18));
  g.lineTo(X(0.486), Y(0.0));
  g.moveTo(X(0.50), Y(0.18));
  g.lineTo(X(0.514), Y(0.0));
  g.stroke();

  // 3. Expressieve Hergé verticale stofplooien vanuit de ceintuur in de rok (rug & zijkanten)
  const plooien = [
    [0.34, 0.45, 0.31, 0.08, 6.2],
    [0.42, 0.46, 0.405, 0.05, 7.0],
    [0.58, 0.46, 0.598, 0.04, 7.0],
    [0.66, 0.45, 0.695, 0.09, 6.0],
    [0.21, 0.43, 0.19, 0.10, 5.5],
    [0.79, 0.43, 0.81, 0.10, 5.5],
    // Korte bovenplooien boven de ceintuur op de rug
    [0.44, 0.64, 0.455, 0.51, 5.0],
    [0.56, 0.64, 0.545, 0.51, 5.0],
  ];
  for (const [u0, v0, u1, v1, w] of plooien) {
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(X(u0), Y(v0));
    g.quadraticCurveTo(X((u0 + u1) * 0.5 + (u1 - u0) * 0.2), Y((v0 + v1) * 0.5), X(u1), Y(v1));
    g.stroke();
  }

  // 4. Schuin getekende zakkleppen op beide heupen (u ~ 0.16 en 0.84)
  g.lineWidth = 6.5;
  for (const [uc, dir] of [[0.15, 1], [0.85, -1]]) {
    g.beginPath();
    g.moveTo(X(uc - 0.055), Y(0.39 + 0.012 * dir));
    g.lineTo(X(uc + 0.055), Y(0.39 - 0.012 * dir));
    g.lineTo(X(uc + 0.052), Y(0.35 - 0.012 * dir));
    g.lineTo(X(uc - 0.052), Y(0.35 + 0.012 * dir));
    g.closePath();
    g.stroke();
  }

  // 5. Raglan schoudernaden aan voor- en achterkant
  g.lineWidth = 5.5;
  for (const uS of [0.22, 0.30, 0.70, 0.78]) {
    const uTop = uS < 0.5 ? uS + 0.04 : uS - 0.04;
    g.beginPath();
    g.moveTo(X(uS), Y(0.78));
    g.quadraticCurveTo(X((uS + uTop) * 0.5), Y(0.88), X(uTop), Y(0.96));
    g.stroke();
  }

  // 6. Voorzijde: dubbele rij knopen & sluitingslijn + revers (aan de randen u=0 en u=1)
  g.lineWidth = 7.0;
  g.beginPath();
  g.moveTo(X(0.025), Y(0.86));
  g.lineTo(X(0.025), Y(0.0));
  g.moveTo(X(0.975), Y(0.86));
  g.lineTo(X(0.975), Y(0.49));
  g.stroke();
  // Revers-lijnen
  g.lineWidth = 6.5;
  g.beginPath();
  g.moveTo(X(0.01), Y(0.92)); g.lineTo(X(0.09), Y(0.76)); g.lineTo(X(0.03), Y(0.68));
  g.moveTo(X(0.99), Y(0.92)); g.lineTo(X(0.91), Y(0.76)); g.lineTo(X(0.97), Y(0.68));
  g.stroke();
  // Trenchcoat-knopen
  g.fillStyle = '#040608';
  for (const vK of [0.70, 0.59, 0.42]) {
    for (const uK of [0.055, 0.945]) {
      g.beginPath(); g.arc(X(uK), Y(vK), 7.5, 0, Math.PI * 2); g.fill();
    }
  }

  // 7. Onderste zoomlijn
  g.lineWidth = 7.0;
  g.beginPath();
  g.moveTo(0, Y(0.012)); g.lineTo(1024, Y(0.012));
  g.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  return tex;
}

// Handgetekende mouwplooien (subtiele V-vouwen bij de elleboog) + enkel manchetbandje bij de pols.
function tekenMouwInktTex() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 512);
  g.strokeStyle = '#040608';
  g.lineCap = 'round';
  // Strak enkel manchetbandje vlak bij de pols (alleen onderaan de onderarm)
  g.lineWidth = 6.5;
  g.beginPath();
  g.moveTo(0, 448); g.lineTo(512, 448);
  g.stroke();
  // Twee korte, schuine Hergé-plooistreepjes alleen aan de binnenbocht van de elleboog
  g.lineWidth = 5.0;
  g.beginPath();
  g.moveTo(210, 232); g.quadraticCurveTo(256, 250, 302, 224);
  g.moveTo(222, 266); g.quadraticCurveTo(260, 278, 294, 258);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// Handgetekende pantalonplooien + omslag bij de enkels.
function tekenBroekInktTex() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 512);
  g.strokeStyle = '#040608';
  g.lineCap = 'round';
  // Strakke omslag (cuff) onderaan de broekspijp
  g.lineWidth = 7.5;
  g.beginPath();
  g.moveTo(0, 462); g.lineTo(512, 462);
  g.stroke();
  // Plooistreepjes op knie en enkel
  g.lineWidth = 5.5;
  g.beginPath();
  g.moveTo(110, 120); g.quadraticCurveTo(220, 140, 310, 118);
  g.moveTo(150, 390); g.quadraticCurveTo(250, 408, 355, 386);
  g.moveTo(256, 40); g.lineTo(256, 450); // vouwlijn van de nette pantalon
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// Handgetekende leren aktetas-lijnen (klep, twee riemen, stiksels).
function tekenTasInktTex() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 512);
  g.strokeStyle = '#040608';
  g.lineWidth = 8.0;
  g.lineCap = 'round';
  // Klep-naad
  g.beginPath();
  g.moveTo(24, 195); g.quadraticCurveTo(256, 220, 488, 195);
  g.stroke();
  // Twee verticale leren riemen
  g.lineWidth = 6.5;
  for (const x of [136, 376]) {
    g.strokeRect(x - 16, 20, 32, 410);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

// Sculpted organische Hergé-trenchcoat (vloeiende raglan-schouders, getailleerd middel, wapperende geplooide zoom).
function bouwJasGeo() {
  const segU = 36, segV = 24;
  // Profiel van zoom (v=0, y=0.44) tot hals (v=1, y=1.49): [y, rx, rz, zShift, plooiAmp]
  const ringen = [
    [0.44, 0.288, 0.250, -0.025, 0.020],
    [0.56, 0.268, 0.228, -0.018, 0.016],
    [0.70, 0.242, 0.200, -0.010, 0.012],
    [0.85, 0.206, 0.168, -0.004, 0.007],
    [1.00, 0.168, 0.138,  0.000, 0.003], // strakke taille bij de ceintuur
    [1.14, 0.194, 0.148,  0.002, 0.004],
    [1.28, 0.218, 0.152,  0.000, 0.003],
    [1.38, 0.228, 0.145, -0.002, 0.002], // zachte afgeronde schouders (geen Lego-hoeken!)
    [1.45, 0.168, 0.122, -0.004, 0.000], // raglan-aansluiting
    [1.49, 0.100, 0.095, -0.004, 0.000], // hals
  ];
  const sampleRing = (v) => {
    const f = v * (ringen.length - 1);
    const i = Math.min(ringen.length - 2, Math.floor(f));
    const t = f - i;
    const s = t * t * (3 - 2 * t);
    const a = ringen[i], b = ringen[i + 1];
    return [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * s,
      a[2] + (b[2] - a[2]) * s,
      a[3] + (b[3] - a[3]) * s,
      a[4] + (b[4] - a[4]) * s,
    ];
  };

  const pos = [], uvs = [], idx = [];
  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV;
    const [y, rx, rz, zShift, amp] = sampleRing(v);
    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU;
      const a = u * Math.PI * 2; // u=0 -> +Z (voor), u=0.25 -> +X (links), u=0.5 -> -Z (rug)
      // Zachte, asymmetrische Hergé-plooigolf in de jasrok
      const golf = 1.0 + amp * (Math.cos(a * 4.0 + 0.4) * 2.8 + Math.sin(a * 6.0 - 0.5) * 1.6);
      const x = Math.sin(a) * rx * golf;
      const z = Math.cos(a) * rz * golf + zShift;
      // Lichte golf in de onderrand zelf
      const yWave = v < 0.06 ? Math.sin(a * 3.0 + 0.6) * 0.014 * (1 - v / 0.06) : 0;
      pos.push(x, y + yWave, z);
      uvs.push(u, v);
    }
  }
  const stride = segU + 1;
  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * stride + iu;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      idx.push(a, b, d, a, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// Sculpted Hergé-gleufhoed (gedeukte bol + sierlijk gekromde rand zoals bij de detective in Kuifje!).
function bouwFedoraGeo() {
  // 1. Gedeukte hoedbol (center crease + voorste kneepjes)
  const bol = new THREE.CylinderGeometry(0.094, 0.114, 0.115, 28, 8, false);
  const bp = bol.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    let x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i);
    // Ovaal van voor naar achter
    z *= 1.16;
    x *= 0.94;
    // Bovenkant: klassieke midden-deuk (center crease) + iets lager achteraan
    if (y > 0.01) {
      const t = (y - 0.01) / 0.0475;
      const deuk = Math.exp(-(x * x) / 0.0026) * 0.024 * t;
      const schuin = -z * 0.08 * t;
      y -= deuk - schuin;
      // Voorste zij-kneepjes (pinch) in de kroon
      if (z > 0.015) {
        const pinch = Math.exp(-Math.pow(z - 0.065, 2) / 0.0022) * 0.14 * t;
        x *= (1.0 - pinch);
      }
    }
    bp.setXYZ(i, x, y, z);
  }
  bol.computeVertexNormals();

  // 2. Sierlijk golvende hoedrand (voor iets omlaag getrokken over de ogen, achter licht opgewipt!)
  const rand = new THREE.CylinderGeometry(0.195, 0.200, 0.012, 32, 1, false);
  const rp = rand.attributes.position;
  for (let i = 0; i < rp.count; i++) {
    let x = rp.getX(i), y = rp.getY(i), z = rp.getZ(i);
    z *= 1.15;
    x *= 0.98;
    const r = Math.hypot(x, z);
    if (r > 0.105) {
      const randT = (r - 0.105) / 0.11;
      // Voor (+Z) omlaag, achter (-Z) iets omhoog (klassieke film-noir/Kuifje-curve!)
      const buig = (-z * 0.18 + (z < 0 ? Math.abs(z) * 0.14 : 0)) * randT;
      y += buig;
    }
    rp.setXYZ(i, x, y, z);
  }
  rand.computeVertexNormals();
  return { bol, rand };
}

// Sculpted klassieke jaren-'50 leren herenschoen (gestroomlijnde neus, wreef, gestapelde hak, zoolrand & veters).
function bouwSchoenMesh(matSchoen, matZool, matSok, inktFijn) {
  const sg = new THREE.Group();

  // Stukje lichte sok net boven de schoenkraag (typisch Hergé-accent tussen donkere broek en kastanjebruine schoen!)
  const sok = metInkt(new THREE.CylinderGeometry(0.043, 0.041, 0.055, 16), matSok, inktFijn);
  sok.position.set(0, 0.092, -0.010);
  sg.add(sok);

  // Vloeiende leest van de herenschoen (gevormde doos/bol-combinatie met echte wreef en slanke neus)
  const leestGeo = new THREE.SphereGeometry(0.052, 20, 16);
  const lp = leestGeo.attributes.position;
  for (let i = 0; i < lp.count; i++) {
    let x = lp.getX(i), y = lp.getY(i), z = lp.getZ(i);
    // Lengte langs +Z (neus) en -Z (hiel)
    z = z > 0 ? z * 3.15 : z * 1.45;
    // Slanker naar de neus toe
    const neusT = Math.max(0, z / 0.16);
    x *= (0.88 - 0.22 * neusT);
    // Bovenkant: hogere wreef bij de enkel, platter bij de neus; onderkant vlak op de zool
    if (y < 0) y *= 0.22;
    else y *= (1.18 - 0.56 * neusT);
    lp.setXYZ(i, x, y, z);
  }
  leestGeo.computeVertexNormals();
  const leest = metInkt(leestGeo, matSchoen, inktFijn);
  leest.position.set(0, 0.028, 0.032);
  sg.add(leest);

  // Enkelkraag van de schoen
  const kraag = metInkt(new THREE.CylinderGeometry(0.045, 0.049, 0.044, 16), matSchoen, inktFijn);
  kraag.position.set(0, 0.058, -0.012);
  sg.add(kraag);

  // Strakke leren zool + aparte gestapelde hak
  const zoolGeo = new THREE.BoxGeometry(0.088, 0.013, 0.242);
  const zool = metInkt(zoolGeo, matZool, inktFijn);
  zool.position.set(0, 0.012, 0.052);
  const hak = metInkt(new THREE.BoxGeometry(0.084, 0.022, 0.072), matZool, inktFijn);
  hak.position.set(0, 0.011, -0.034);
  sg.add(zool, hak);

  // Fijne getekende veters + neusnaad bovenop de wreef (puur klare-lijn detail voor de lage Scene 3 close-up!)
  const veterMat = new THREE.MeshBasicMaterial({ color: 0x050709 });
  for (let i = 0; i < 3; i++) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.036 - i * 0.004, 0.004, 0.005), veterMat);
    v.position.set(0, 0.068 - i * 0.008, 0.038 + i * 0.018);
    v.rotation.x = 0.28;
    sg.add(v);
  }
  // Subtiele neusnaad (toe-cap boogje)
  const naad = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.0022, 6, 16, Math.PI), veterMat);
  naad.position.set(0, 0.022, 0.118);
  naad.rotation.x = -0.35;
  sg.add(naad);

  return sg;
}

// ---- Handgetekende Hergé Ligne Claire 2D-stripcel voor Scene 5 (aanbellen bij Monastic)!
// Exact in de stijl van de Kuifje-plaatjes: olijfkaki trenchcoat-mouw met manchetbandje & plooien,
// wit overhemdmanchet, en een anatomisch getekende striphand met gekromde vingers, duim en wijzende wijsvinger!
function tekenBelHandCel() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 1024, 1024);

  // Vingertop wijst exact naar (220, 310) zodat we de 3D-plane precies op de belknop kunnen uitlijnen!
  const inkt = '#050709';
  const jasL = '#96947c', jasS = '#706f5b';
  const hemdL = '#e6e1d0', hemdS = '#c3beae';
  const huidL = '#efc9a8', huidS = '#cfa07c';

  g.lineJoin = 'round';
  g.lineCap = 'round';

  // 1. Onderarm / trenchcoat-mouw (komt schuin van rechtsonder naar linksboven richting de bel!)
  g.beginPath();
  g.moveTo(990, 995);
  g.lineTo(548, 635);
  g.quadraticCurveTo(532, 616, 550, 588);
  g.lineTo(664, 466);
  g.quadraticCurveTo(690, 444, 718, 468);
  g.lineTo(1024, 730);
  g.lineTo(1024, 1024);
  g.closePath();
  g.fillStyle = jasL;
  g.fill();

  // Schaduwband aan de onderzijde van de mouw (vlakke tweetoons Hergé-schaduw)
  g.save();
  g.clip();
  g.fillStyle = jasS;
  g.beginPath();
  g.moveTo(520, 620);
  g.quadraticCurveTo(750, 740, 1024, 920);
  g.lineTo(1024, 1024);
  g.lineTo(500, 1024);
  g.closePath();
  g.fill();
  g.restore();

  // Strakke zwarte inktomtrek van de mouw
  g.strokeStyle = inkt;
  g.lineWidth = 10;
  g.beginPath();
  g.moveTo(1015, 990);
  g.lineTo(548, 635);
  g.quadraticCurveTo(532, 616, 550, 588);
  g.lineTo(664, 466);
  g.quadraticCurveTo(690, 444, 718, 468);
  g.lineTo(1018, 724);
  g.stroke();

  // Trenchcoat manchetbandje + messing knoop + 3 klassieke Hergé stofplooien
  g.fillStyle = jasS;
  g.beginPath();
  g.moveTo(604, 622);
  g.lineTo(698, 520);
  g.lineTo(732, 548);
  g.lineTo(638, 650);
  g.closePath();
  g.fill();
  g.lineWidth = 7.5;
  g.stroke();

  // Knoopje op het manchetbandje
  g.fillStyle = '#4e4b3c';
  g.beginPath(); g.arc(688, 560, 14, 0, Math.PI * 2); g.fill();
  g.lineWidth = 6; g.stroke();

  // Drie krachtige Hergé-plooistreepjes in de mouw
  g.lineWidth = 7.5;
  g.beginPath();
  g.moveTo(742, 612); g.quadraticCurveTo(796, 638, 845, 622);
  g.moveTo(718, 692); g.quadraticCurveTo(780, 710, 848, 704);
  g.moveTo(810, 774); g.quadraticCurveTo(868, 770, 916, 742);
  g.stroke();

  // 2. Wit overhemd-manchet dat net uit de trenchcoat-mouw steekt
  g.beginPath();
  g.moveTo(568, 598);
  g.lineTo(526, 562);
  g.quadraticCurveTo(516, 548, 530, 530);
  g.lineTo(618, 442);
  g.quadraticCurveTo(632, 430, 648, 444);
  g.lineTo(682, 476);
  g.closePath();
  g.fillStyle = hemdL;
  g.fill();
  g.save();
  g.clip();
  g.fillStyle = hemdS;
  g.fillRect(510, 535, 190, 90);
  g.restore();
  g.lineWidth = 9;
  g.stroke();

  // 3. De echte Hergé-striphand in zijaanzicht (wijsvinger gestrekt naar (220, 310), andere vingers gekromd, duim zichtbaar)
  // Achterste gekromde pink & ringvinger (iets in de schaduw)
  const tekenGekromdeVinger = (x, y, rx, ry, rot, kleur) => {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.fillStyle = kleur;
    g.beginPath();
    g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 8.5;
    g.strokeStyle = inkt;
    g.stroke();
    g.restore();
  };
  tekenGekromdeVinger(462, 514, 34, 21, -0.58, huidS); // pink
  tekenGekromdeVinger(432, 488, 38, 23, -0.55, huidS); // ringvinger
  tekenGekromdeVinger(398, 456, 44, 25, -0.52, huidL); // middelvinger

  // Hoofdvorm van de hand + gestrekte wijsvinger (top exact op (220, 310)!)
  g.beginPath();
  g.moveTo(552, 546);                                     // onderkant pols
  g.quadraticCurveTo(492, 526, 442, 482);                 // onderkant handpalm
  g.quadraticCurveTo(384, 430, 352, 396);                 // aanzet wijsvinger onder
  g.lineTo(240, 332);                                     // onderkant wijsvinger
  g.quadraticCurveTo(205, 312, 224, 286);                 // afgeronde vingertop (exact rond 220, 310!)
  g.quadraticCurveTo(244, 266, 276, 282);                 // bovenkant vingertop
  g.lineTo(418, 350);                                     // bovenkant wijsvinger naar knokkel
  g.quadraticCurveTo(476, 368, 536, 398);                 // handrug
  g.quadraticCurveTo(582, 422, 626, 460);                 // pols boven
  g.closePath();
  g.fillStyle = huidL;
  g.fill();

  // Strakke tweetoons schaduw onderlangs de wijsvinger & handpalm
  g.save();
  g.clip();
  g.fillStyle = huidS;
  g.beginPath();
  g.moveTo(210, 326);
  g.quadraticCurveTo(350, 384, 465, 468);
  g.lineTo(585, 550);
  g.lineTo(450, 570);
  g.lineTo(200, 360);
  g.closePath();
  g.fill();
  g.restore();

  // Zwarte omtreklijn om de hand + wijsvinger
  g.strokeStyle = inkt;
  g.lineWidth = 9.5;
  g.beginPath();
  g.moveTo(552, 546);
  g.quadraticCurveTo(492, 526, 442, 482);
  g.quadraticCurveTo(384, 430, 352, 396);
  g.lineTo(240, 332);
  g.quadraticCurveTo(205, 312, 224, 286);
  g.quadraticCurveTo(244, 266, 276, 282);
  g.lineTo(418, 350);
  g.quadraticCurveTo(476, 368, 536, 398);
  g.quadraticCurveTo(582, 422, 626, 460);
  g.stroke();

  // Duim rustend tegen de gekromde middelvinger (typische ontspannen Hergé-aanbelhouding)
  g.beginPath();
  g.moveTo(472, 456);
  g.quadraticCurveTo(412, 444, 376, 426);
  g.quadraticCurveTo(352, 412, 364, 392);
  g.quadraticCurveTo(378, 376, 416, 392);
  g.quadraticCurveTo(458, 408, 494, 426);
  g.fillStyle = huidL;
  g.fill();
  g.lineWidth = 8.5;
  g.stroke();

  // Fijne Hergé-detailstreepjes: vingernagel, vingerkootjes & knokkels
  g.lineWidth = 5.0;
  g.beginPath();
  // Nageltje op de wijsvinger
  g.moveTo(234, 284); g.quadraticCurveTo(254, 284, 262, 294);
  // Kootjes-streepjes op de wijsvinger
  g.moveTo(318, 304); g.quadraticCurveTo(312, 320, 304, 326);
  g.moveTo(378, 334); g.quadraticCurveTo(370, 354, 360, 362);
  // Knokkelboogje op de handrug
  g.moveTo(448, 378); g.quadraticCurveTo(466, 392, 480, 388);
  g.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// ---- 1. De echte Monastic-intercom + stijlvolle wandlantaarn erboven + hardstenen stoepdrempel bij de achterdeur.
export function bouwIntercom(gloedTex, uRes, uLijn) {
  const group = new THREE.Group();
  group.position.copy(INTERCOM_POS);
  group.rotation.y = INTERCOM_YAW;

  // Haarscherpe voorplaat-textuur (1024 × 350) met het echte witte Monastic-woordmerk uit woordmerk.svg.
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 350;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  const tekenPlaat = (logoImg) => {
    ctx.clearRect(0, 0, cv.width, cv.height);
    const r = 40;
    ctx.fillStyle = '#25282e';
    ctx.beginPath();
    ctx.roundRect(6, 6, cv.width - 12, cv.height - 12, r);
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#040608';
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.09)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(14, 14, cv.width - 28, cv.height - 28, r - 6);
    ctx.stroke();

    if (logoImg) {
      const lw = 640;
      const lh = lw * (135.95 / 1230.01);
      ctx.drawImage(logoImg, 68, (cv.height - lh) * 0.5, lw, lh);
    } else {
      ctx.fillStyle = '#f2f0ea';
      ctx.font = '600 84px Futura, "Century Gothic", sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText('MONASTIC', 68, cv.height * 0.52);
    }

    ctx.fillStyle = '#090b0e';
    ctx.beginPath(); ctx.arc(868, 76, 17, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4c6578';
    ctx.beginPath(); ctx.arc(863, 71, 5, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#14171c';
    ctx.beginPath(); ctx.arc(868, 198, 66, 0, Math.PI * 2); ctx.fill();
    tex.needsUpdate = true;
  };
  tekenPlaat(null);
  const img = new Image();
  img.onload = () => tekenPlaat(img);
  img.src = 'woordmerk.svg';

  const inkt = omtrekPxMat(uRes, uLijn, 0.85);
  const behuizing = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.15, 0.014),
    new THREE.MeshBasicMaterial({ color: 0x1d2025 }),
  );
  behuizing.position.set(0, 0, 0.007);
  const behuizingInkt = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.15, 0.014), inkt);
  behuizingInkt.position.copy(behuizing.position);
  group.add(behuizing, behuizingInkt);

  const voorvlak = new THREE.Mesh(
    new THREE.PlaneGeometry(0.44, 0.15),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
  );
  voorvlak.position.set(0, 0, 0.0155);
  group.add(voorvlak);

  // De fysieke bel: warme gloeiende ring + witte drukknop op lokaal x = +0.153, y = -0.010
  const belX = 0.153, belY = -0.010;
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd675 });
  const belRing = new THREE.Mesh(new THREE.TorusGeometry(0.0245, 0.0048, 12, 32), ringMat);
  belRing.position.set(belX, belY, 0.0185);
  group.add(belRing);

  const knopGeo = new THREE.CylinderGeometry(0.0175, 0.0185, 0.012, 24);
  knopGeo.rotateX(Math.PI / 2);
  const knopMat = new THREE.MeshBasicMaterial({ color: 0xebe8df });
  const knop = new THREE.Mesh(knopGeo, knopMat);
  const knopInkt = new THREE.Mesh(knopGeo, omtrekPxMat(uRes, uLijn, 0.65));
  const knopGroep = new THREE.Group();
  knopGroep.add(knop, knopInkt);
  knopGroep.position.set(belX, belY, 0.022);
  group.add(knopGroep);

  const belGloed = new THREE.Sprite(new THREE.SpriteMaterial({
    map: gloedTex, depthWrite: false, fog: false, transparent: true, opacity: 0.72,
  }));
  belGloed.position.set(belX, belY, 0.045);
  belGloed.scale.set(0.24, 0.24, 1);
  belGloed.renderOrder = 13;
  group.add(belGloed);

  // Klassieke Ligne Claire buitenlamp / wandlantaarn boven de intercom (y = +0.60 m -> 2.12 m hoogte):
  // geeft de warme wandgloed een echt, stijlvol architectonisch armatuur aan de bakstenen gevel!
  const lampGroep = new THREE.Group();
  lampGroep.position.set(0.0, 0.60, 0.0);
  const ijzerMat = new THREE.MeshBasicMaterial({ color: 0x161a20 });
  const glasLampMat = new THREE.MeshBasicMaterial({ color: 0xfbee70 });
  const voetPlaat = metInkt(new THREE.BoxGeometry(0.08, 0.14, 0.018), ijzerMat, inkt);
  voetPlaat.position.set(0, 0, 0.009);
  const armSteun = metInkt(new THREE.BoxGeometry(0.022, 0.022, 0.13), ijzerMat, inkt);
  armSteun.position.set(0, 0.04, 0.072);
  const kapBoven = metInkt(new THREE.ConeGeometry(0.105, 0.065, 4), ijzerMat, inkt);
  kapBoven.rotation.y = Math.PI / 4;
  kapBoven.position.set(0, 0.068, 0.13);
  const glasKast = metInkt(new THREE.BoxGeometry(0.11, 0.15, 0.11), glasLampMat, inkt);
  glasKast.position.set(0, -0.028, 0.13);
  const kapOnder = metInkt(new THREE.BoxGeometry(0.125, 0.02, 0.125), ijzerMat, inkt);
  kapOnder.position.set(0, -0.108, 0.13);
  lampGroep.add(voetPlaat, armSteun, kapBoven, glasKast, kapOnder);
  group.add(lampGroep);

  const wandGloed = new THREE.Sprite(new THREE.SpriteMaterial({
    map: gloedTex, depthWrite: false, fog: false, transparent: true, opacity: 0.48,
  }));
  wandGloed.position.set(0.0, 0.56, 0.18);
  wandGloed.scale.set(1.25, 1.25, 1);
  wandGloed.renderOrder = 12;
  group.add(wandGloed);

  // Hardstenen drempel & klassieke donkere deurmat bij de Monastic-achterdeur (u = +0.58, grond y = -1.432 lokaal)
  const drempelMat = new THREE.MeshBasicMaterial({ color: 0x353d44 });
  const matMat = new THREE.MeshBasicMaterial({ color: 0x2a2623 });
  const drempel = metInkt(new THREE.BoxGeometry(1.06, 0.055, 0.36), drempelMat, inkt);
  drempel.position.set(0.56, -1.415, 0.14);
  const deurmat = metInkt(new THREE.BoxGeometry(0.76, 0.018, 0.44), matMat, inkt);
  deurmat.position.set(0.56, -1.428, 0.48);
  group.add(drempel, deurmat);

  // Kuifje-klankboogjes ("TRRRING!") naast de belknop bij het aanbellen
  const klankCv = document.createElement('canvas');
  klankCv.width = 512; klankCv.height = 256;
  const kg = klankCv.getContext('2d');
  const boog = (rad, dik, kleur) => {
    kg.strokeStyle = kleur;
    kg.lineWidth = dik;
    kg.lineCap = 'round';
    kg.beginPath();
    kg.arc(100, 146, rad, -0.82, 0.58);
    kg.stroke();
  };
  for (const r of [46, 78, 110]) {
    boog(r, 11, '#040608');
    boog(r, 5.5, '#fbee70');
  }
  kg.save();
  kg.translate(212, 112);
  kg.rotate(-0.14);
  kg.font = 'italic 700 54px "Comic Sans MS", "Trebuchet MS", sans-serif';
  kg.lineWidth = 10;
  kg.lineJoin = 'round';
  kg.strokeStyle = '#040608';
  kg.strokeText('TRRRING!', 0, 0);
  kg.fillStyle = '#fff39c';
  kg.fillText('TRRRING!', 0, 0);
  kg.restore();

  const klankTex = new THREE.CanvasTexture(klankCv);
  klankTex.colorSpace = THREE.SRGBColorSpace;
  const belKlank = new THREE.Mesh(
    new THREE.PlaneGeometry(0.36, 0.18),
    new THREE.MeshBasicMaterial({ map: klankTex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  );
  belKlank.position.set(belX + 0.14, belY + 0.085, 0.048);
  belKlank.renderOrder = 14;
  belKlank.visible = false;
  group.add(belKlank);

  // Het kleine gangraampje links naast de intercom (springt warm goud aan na het aanbellen!)
  const raamMat = new THREE.MeshBasicMaterial({
    color: 0xf4de84, transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide,
  });
  const raamGloed = new THREE.Mesh(new THREE.PlaneGeometry(0.382, 0.732), raamMat);
  raamGloed.position.set(-0.538, -0.020, -0.084);
  raamGloed.renderOrder = 8;
  raamGloed.visible = false;
  group.add(raamGloed);

  const belWereld = new THREE.Vector3();

  return {
    group,
    belWereldPositie(uit = belWereld) {
      group.updateMatrixWorld(true);
      return uit.set(belX, belY, 0.028).applyMatrix4(group.matrixWorld);
    },
    zetStaat(brandt, belDruk = 0, belRingT = 0, raamAan = 0) {
      knopGroep.position.z = 0.022 - 0.006 * belDruk;
      const flits = Math.max(belDruk, belRingT);
      ringMat.color.setRGB(1.0, 0.84 + 0.14 * flits, 0.46 + 0.34 * flits);
      const gl = Math.max(brandt * 0.72, flits * 0.98);
      belGloed.visible = gl > 0.05;
      belGloed.material.opacity = gl;
      const sc = 0.24 + flits * 0.22;
      belGloed.scale.set(sc, sc, 1);

      glasLampMat.color.setRGB(0.84 + 0.15 * brandt, 0.88 + 0.06 * brandt, 0.90 - 0.44 * brandt);
      wandGloed.visible = brandt > 0.05;
      wandGloed.material.opacity = brandt * 0.48;

      belKlank.visible = belRingT > 0.02;
      if (belKlank.visible) {
        belKlank.material.opacity = Math.min(1, belRingT * 1.4);
        const pop = 0.72 + 0.32 * Math.sin(Math.min(1, belRingT * 1.8) * Math.PI * 0.6);
        belKlank.scale.setScalar(pop);
      }

      raamGloed.visible = raamAan > 0.02;
      raamMat.opacity = raamAan * 0.94;
    },
  };
}

// ---- 2. De authentieke Hergé / Kuifje-bezoeker (gevormde trenchcoat met inktplooien, haren & oren,
//         gedeukte gleufhoed, warme pantalon, kastanjebruine herenschoenen, aktetas + 2D-striphand in Scene 5).
export function bouwBezoeker(uZon, uNacht, uRes, uLijn) {
  const root = new THREE.Group();
  const lichaam = new THREE.Group();
  root.add(lichaam);

  const inktFijn = omtrekPxMat(uRes, uLijn, 0.78);
  const inktNormaal = omtrekPxMat(uRes, uLijn, 0.96);

  const jasTex = tekenJasInktTex();
  const mouwTex = tekenMouwInktTex();
  const broekTex = tekenBroekInktTex();
  const tasTex = tekenTasInktTex();

  // Authentiek Hergé-palet direct geïnspireerd op de Kuifje-detective:
  const matJas = figuurMat('#9c977c', '#76735d', uZon, uNacht, jasTex);     // olijfkaki trenchcoat met handgetekende plooien
  const matMouw = figuurMat('#9c977c', '#76735d', uZon, uNacht, mouwTex);   // mouwen met elleboogplooi & manchet
  const matKraag = figuurMat('#8d8970', '#686551', uZon, uNacht);           // opstaande kraag & ceintuur
  const matHemd = figuurMat('#e8e3d2', '#c4bfb0', uZon, uNacht);            // wit overhemdkraagje
  const matBroek = figuurMat('#5b4e49', '#3f3633', uZon, uNacht, broekTex); // warme grijsbruine pantalon (goed zichtbaar!)
  const matSok = figuurMat('#dad5c6', '#b5b0a2', uZon, uNacht);             // subtiel stukje lichte sok (Hergé-accent)
  const matSchoen = figuurMat('#874e31', '#5a321d', uZon, uNacht);          // kastanjebruine gepoetste derby-schoenen
  const matZool = figuurMat('#1a1614', '#0d0b0a', uZon, uNacht);            // hak & zoolrand
  const matHoed = figuurMat('#5c5149', '#3d3632', uZon, uNacht);            // klassieke bruin-antraciete gleufhoed
  const matLint = figuurMat('#171516', '#0b0a0b', uZon, uNacht);            // hoedlint
  const matHaar = figuurMat('#281e18', '#15100d', uZon, uNacht);            // donkerbruin geknipt haar
  const matHuid = figuurMat('#efc8a6', '#cda07c', uZon, uNacht);            // warm Hergé-gezicht / handen
  const matTas = figuurMat('#7d4928', '#522f19', uZon, uNacht, tasTex);     // cognacleren aktetas met riemen
  const matGesp = figuurMat('#d9bc6a', '#9e8544', uZon, uNacht);            // messing gesp

  // Gearticuleerd been (heup -> bovenbeen -> knie -> onderbeen met vouw & omslag -> kastanjebruine schoen)
  const bouwBeen = (xOff) => {
    const heup = new THREE.Group();
    heup.position.set(xOff, 0.88, 0);

    const boven = metInkt(new THREE.CylinderGeometry(0.078, 0.066, 0.44, 16), matBroek, inktNormaal);
    boven.position.y = -0.22;
    heup.add(boven);

    const knie = new THREE.Group();
    knie.position.set(0, -0.44, 0);
    heup.add(knie);

    const onder = metInkt(new THREE.CylinderGeometry(0.066, 0.056, 0.36, 16), matBroek, inktNormaal);
    onder.position.y = -0.175;
    knie.add(onder);

    // Nette broekomslag (cuff) net boven de schoen
    const omslag = metInkt(new THREE.CylinderGeometry(0.060, 0.062, 0.038, 16), matBroek, inktFijn);
    omslag.position.y = -0.345;
    knie.add(omslag);

    const voet = new THREE.Group();
    voet.position.set(0, -0.44, 0);
    voet.add(bouwSchoenMesh(matSchoen, matZool, matSok, inktFijn));
    knie.add(voet);

    return { heup, knie, voet };
  };

  const beenL = bouwBeen(0.105);
  const beenR = bouwBeen(-0.105);
  lichaam.add(beenL.heup, beenR.heup);

  // Vloeiende, geplooide Hergé-trenchcoat met handgetekende binnenlijnen (schouderpas, rugsplit, plooien, zakken)
  const jasMesh = metInkt(bouwJasGeo(), matJas, inktNormaal);
  lichaam.add(jasMesh);

  // Contactschaduw direct onder de schoenen
  const voetSchaduw = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 24),
    new THREE.MeshBasicMaterial({ color: 0x05070a, transparent: true, opacity: 0.45, depthWrite: false }),
  );
  voetSchaduw.rotation.x = -Math.PI / 2;
  voetSchaduw.position.y = 0.008;
  root.add(voetSchaduw);

  // Ceintuur + messing gesp + loshangend riemuiteinde aan de linkerheup (echt Kuifje-detail!)
  const riemGeo = new THREE.TorusGeometry(0.172, 0.017, 10, 28);
  riemGeo.rotateX(Math.PI / 2);
  riemGeo.scale(1.01, 1.0, 0.84);
  const riem = metInkt(riemGeo, matKraag, inktFijn);
  riem.position.y = 1.00;
  const riemSlip = metInkt(new THREE.BoxGeometry(0.032, 0.16, 0.012), matKraag, inktFijn);
  riemSlip.position.set(0.14, 0.92, -0.09);
  riemSlip.rotation.set(0.08, -0.5, 0.14);
  const riemGesp = metInkt(new THREE.BoxGeometry(0.044, 0.040, 0.016), matGesp, inktFijn);
  riemGesp.position.set(0.0, 1.00, 0.150);
  lichaam.add(riem, riemSlip, riemGesp);

  // Opstaande getailleerde detectivekraag + wit overhemdkraagje eronder
  const kraagGeo = new THREE.CylinderGeometry(0.114, 0.132, 0.105, 24, 1, false, -Math.PI * 0.76, Math.PI * 1.52);
  const kraag = metInkt(kraagGeo, matKraag, inktFijn);
  kraag.position.set(0, 1.515, -0.008);
  kraag.rotation.y = Math.PI;
  const hemdKraag = metInkt(new THREE.CylinderGeometry(0.072, 0.082, 0.065, 18), matHemd, inktFijn);
  hemdKraag.position.set(0, 1.515, 0.004);
  lichaam.add(kraag, hemdKraag);

  // Hoofd met nek, oren, echt donker haar aan achterhoofd & slapen + gedeukte Hergé-gleufhoed!
  const hoofdGroep = new THREE.Group();
  hoofdGroep.position.set(0, 1.605, 0.01);

  const nek = metInkt(new THREE.CylinderGeometry(0.056, 0.064, 0.085, 16), matHuid, inktFijn);
  nek.position.set(0, -0.068, -0.004);
  const hoofd = metInkt(new THREE.SphereGeometry(0.096, 20, 18), matHuid, inktNormaal);
  hoofd.scale.set(0.90, 1.08, 0.98);
  // Twee gevormde oren (essentieel voor een natuurlijk 3/4 achteraanzicht zoals in Kuifje!)
  const oorL = metInkt(new THREE.SphereGeometry(0.022, 12, 10), matHuid, inktFijn);
  oorL.scale.set(0.48, 1.18, 0.72);
  oorL.position.set(0.084, -0.006, -0.006);
  const oorR = oorL.clone();
  oorR.position.x = -0.084;
  // Subtiele neus voor zijaanzicht
  const neus = metInkt(new THREE.ConeGeometry(0.016, 0.036, 10), matHuid, inktFijn);
  neus.rotation.x = Math.PI * 0.46;
  neus.position.set(0, -0.004, 0.098);
  // Donker geknipt haar aan achterhoofd, nek & slapen (NOOIT meer een kaal perzik-ei!)
  const haarGeo = new THREE.SphereGeometry(0.098, 20, 16, Math.PI * 0.52, Math.PI * 1.96, 0.0, Math.PI * 0.68);
  const haar = metInkt(haarGeo, matHaar, inktFijn);
  haar.scale.set(0.93, 1.06, 1.01);
  haar.rotation.y = Math.PI * 0.5;
  haar.position.set(0, 0.008, -0.008);
  // Nekkapsel (strak afgesneden donkere haargrens achteraan)
  const nekHaar = metInkt(new THREE.CylinderGeometry(0.084, 0.066, 0.065, 18, 1, false, Math.PI * 0.55, Math.PI * 0.90), matHaar, inktFijn);
  nekHaar.position.set(0, -0.044, -0.018);
  hoofdGroep.add(nek, hoofd, oorL, oorR, neus, haar, nekHaar);

  // Gedeukte, golvende Hergé-gleufhoed (fedora)
  const hoedGroep = new THREE.Group();
  hoedGroep.position.set(0, 0.068, 0.004);
  hoedGroep.rotation.x = 0.08;
  hoedGroep.rotation.z = -0.03; // subtiel schuin op het hoofd (karakter!)
  const { bol: bolGeo, rand: randGeo } = bouwFedoraGeo();
  const randHoed = metInkt(randGeo, matHoed, inktFijn);
  const bolHoed = metInkt(bolGeo, matHoed, inktNormaal);
  bolHoed.position.y = 0.056;
  const lintGeo = new THREE.CylinderGeometry(0.107, 0.112, 0.024, 24);
  lintGeo.scale(0.94, 1.0, 1.15);
  const lintHoed = new THREE.Mesh(lintGeo, matLint);
  lintHoed.position.y = 0.020;
  hoedGroep.add(randHoed, bolHoed, lintHoed);
  hoofdGroep.add(hoedGroep);
  lichaam.add(hoofdGroep);

  // Natuurlijk gebogen armen (naadloos genestelde raglan-schouders, gebogen elleboog, mouwplooien & handen)
  const bouwArm = (kant) => {
    // kant: +1 = links (aktetas), -1 = rechts
    const schouder = new THREE.Group();
    schouder.position.set(kant * 0.205, 1.375, 0.0);

    // Afgeronde raglan-schouderkop (vloeit glad over uit de jas, nooit een hoekige buis!)
    const kop = metInkt(new THREE.SphereGeometry(0.064, 16, 14), matJas, inktNormaal);
    kop.scale.set(0.96, 1.05, 0.98);
    schouder.add(kop);

    const boven = metInkt(new THREE.CylinderGeometry(0.060, 0.052, 0.29, 16), matMouw, inktNormaal);
    boven.position.set(kant * 0.015, -0.14, 0);
    boven.rotation.z = kant * 0.08;
    schouder.add(boven);

    const elleboog = new THREE.Group();
    elleboog.position.set(kant * 0.028, -0.28, 0);
    schouder.add(elleboog);

    const knik = metInkt(new THREE.SphereGeometry(0.050, 14, 12), matMouw, inktFijn);
    elleboog.add(knik);

    const onder = metInkt(new THREE.CylinderGeometry(0.050, 0.043, 0.27, 16), matMouw, inktNormaal);
    onder.position.set(0, -0.135, 0);
    elleboog.add(onder);

    const handGroep = new THREE.Group();
    handGroep.position.set(0, -0.285, 0);
    const palm = metInkt(new THREE.SphereGeometry(0.036, 14, 12), matHuid, inktFijn);
    palm.scale.set(0.76, 1.15, 0.88);
    const vingers = metInkt(new THREE.CapsuleGeometry(0.018, 0.026, 6, 10), matHuid, inktFijn);
    vingers.position.set(0, -0.028, 0.010);
    const duim = metInkt(new THREE.CapsuleGeometry(0.010, 0.022, 6, 8), matHuid, inktFijn);
    duim.position.set(-kant * 0.024, -0.008, 0.020);
    duim.rotation.z = kant * 0.5;
    handGroep.add(palm, vingers, duim);
    elleboog.add(handGroep);

    return { schouder, elleboog, handGroep };
  };

  const armL = bouwArm(1);
  armL.elleboog.rotation.x = -0.22; // ontspannen natuurlijke buiging bij het dragen van de aktetas
  lichaam.add(armL.schouder);

  // Klassieke cognacleren Hergé-aktetas aan de linkerhand
  const tasGroep = new THREE.Group();
  tasGroep.position.set(0.025, -0.185, 0.025);
  const tasBody = metInkt(new THREE.BoxGeometry(0.095, 0.28, 0.40), matTas, inktNormaal);
  const tasGreep = metInkt(new THREE.TorusGeometry(0.048, 0.009, 8, 18, Math.PI), matTas, inktFijn);
  tasGreep.rotation.y = Math.PI / 2;
  tasGreep.position.set(0, 0.145, 0);
  const gesp = new THREE.Mesh(new THREE.BoxGeometry(0.102, 0.028, 0.044), matGesp);
  gesp.position.set(0, 0.035, 0);
  tasGroep.add(tasBody, tasGreep, gesp);
  armL.handGroep.add(tasGroep);

  const armR = bouwArm(-1);
  armR.elleboog.rotation.x = -0.28;
  lichaam.add(armR.schouder);

  // Scene 5: Handgetekende Hergé 2D-stripcel (olijfkaki mouw, wit manchet & anatomische striphand)
  // die recht voor de Monastic-intercom inschuift en met de wijsvinger exact op de belknop drukt!
  const belHandCelTex = tekenBelHandCel();
  const belHandMat = new THREE.MeshBasicMaterial({
    map: belHandCelTex,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const belHandGroep = new THREE.Group();
  const belCelMaat = 0.54; // 54 × 54 cm vlak in de 3D-ruimte (vingertop ligt op UV (220/1024, 1 - 310/1024))
  const belCel = new THREE.Mesh(new THREE.PlaneGeometry(belCelMaat, belCelMaat), belHandMat);
  // Verschuif het vlak zodat de getekende vingertop (u=0.215, v=0.697) EXACT op lokaal (0, 0, 0) ligt!
  belCel.position.set((0.5 - 0.215) * belCelMaat, (0.5 - 0.697) * belCelMaat, 0);
  belCel.renderOrder = 15;
  belHandGroep.add(belCel);
  belHandGroep.visible = false;

  root.visible = false;

  return {
    root,
    belHandGroep,
    zetZichtbaar(v) {
      root.visible = v;
    },
    zetStand(pos, yaw, stap = 0, uitstapT = 1, belReik = 0, belWereld = null) {
      root.position.copy(pos);
      root.rotation.y = yaw;

      // Subtiele nacht-tint voor de 2D close-up handcel zodat hij perfect blendt met de avondscène
      const nt = uNacht ? uNacht.value : 0;
      belHandMat.color.setRGB(1 - 0.14 * nt, 1 - 0.11 * nt, 1 - 0.06 * nt);

      if (uitstapT < 1) {
        // Scene 3: dynamisch uitstappen uit de open Porsche-deur!
        // Linkervoet plant eerst stevig op het grind, lichaam leunt licht voorover, rechtervoet zwaait bij.
        const s1 = Math.min(1, uitstapT / 0.48);
        const s2 = Math.max(0, Math.min(1, (uitstapT - 0.34) / 0.58));
        const e1 = s1 * s1 * (3 - 2 * s1);
        const e2 = s2 * s2 * (3 - 2 * s2);
        lichaam.position.y = -0.05 * (1 - e2);
        lichaam.rotation.x = 0.10 * (1 - e2) + 0.04; // actieve voorwaartse Hergé-houding!
        lichaam.rotation.z = -0.05 * (1 - e2);
        beenL.heup.rotation.x = -0.46 * (1 - e1) + 0.14;
        beenL.knie.rotation.x = 0.44 * (1 - e1) + 0.08;
        beenL.voet.rotation.x = -0.06 * (1 - e1);
        beenR.heup.rotation.x = -0.60 * (1 - e2) - 0.16;
        beenR.knie.rotation.x = 0.62 * (1 - e2) + 0.10;
        beenR.voet.rotation.x = 0.08 * (1 - e2);
        armL.schouder.rotation.x = 0.14;
        armL.elleboog.rotation.x = -0.22;
        armR.schouder.rotation.x = -0.18;
        armR.elleboog.rotation.x = -0.32;
        belHandGroep.visible = false;
        return;
      }

      // Krachtige, vloeiende Hergé-wandelpas (licht voorover geleund zoals de detective in Kuifje!)
      const s = Math.sin(stap);
      const c = Math.cos(stap);
      const wandelAmp = Math.max(0, 1 - belReik * 1.4);
      lichaam.position.y = Math.abs(s) * 0.026 * wandelAmp;
      lichaam.rotation.x = 0.055 * wandelAmp;
      lichaam.rotation.z = s * 0.022 * wandelAmp;

      beenL.heup.rotation.x = s * 0.36 * wandelAmp;
      beenL.knie.rotation.x = Math.max(0, -c) * 0.36 * wandelAmp;
      beenL.voet.rotation.x = -Math.max(0, -c) * 0.16 * wandelAmp;

      beenR.heup.rotation.x = -s * 0.36 * wandelAmp;
      beenR.knie.rotation.x = Math.max(0, c) * 0.36 * wandelAmp;
      beenR.voet.rotation.x = -Math.max(0, c) * 0.16 * wandelAmp;

      armL.schouder.rotation.x = -s * 0.18 * wandelAmp;
      armL.elleboog.rotation.x = -0.22 - Math.max(0, -s) * 0.10 * wandelAmp;
      armR.schouder.rotation.x = s * 0.26 * wandelAmp - belReik * 1.1;
      armR.elleboog.rotation.x = -0.28 - belReik * 0.38;

      // Scene 5: Handgetekende Hergé-striphand schuift vloeiend van rechtsonder op de gloeiende Monastic-bel af!
      if (belReik > 0.02 && belWereld) {
        belHandGroep.visible = true;
        const n = INTERCOM_NORMAAL;
        const rechts = new THREE.Vector3(n.z, 0, -n.x); // lokaal +X (scherm-rechts gezien vanaf de oprit)
        const op = new THREE.Vector3(0, 1, 0);
        // Schuif langs een natuurlijke diagonaal van rechtsonder naar het exacte midden van de belknop!
        const weg = 1.0 - belReik;
        belHandGroep.position.copy(belWereld)
          .addScaledVector(n, 0.036 + 0.035 * weg)
          .addScaledVector(rechts, 0.165 * weg)
          .addScaledVector(op, -0.115 * weg);
        belHandGroep.rotation.set(0, INTERCOM_YAW, -0.05 * weg);
      } else {
        belHandGroep.visible = false;
      }
    },
  };
}
