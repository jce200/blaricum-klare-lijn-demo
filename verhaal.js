// Het Kuifje-verhaal bij het kantoor van Monastic:
//   1. De echte antraciete Monastic-intercom naast de achterdeur (44 × 15 cm, wit woordmerk uit woordmerk.svg,
//      warme gloeiende belring, echte 3D-drukknop, strip-klankboogjes bij het aanbellen en het gangraampje dat aangaat).
//   2. De mysterieuze Ligne Claire-bezoeker in zandkleurige trenchcoat, gleufhoed, donkere pantalon,
//      gepoetste leren schoenen en aktetas — vloeiend gemodelleerd met constante zwarte inktomlijning.
import * as THREE from 'three';

// Exacte muurpositie en normaal van de bakstenen pier tussen het gangraampje en de achterdeur (uit blender/intercom.py).
export const INTERCOM_POS = new THREE.Vector3(7.989, 1.52, -1.686);
export const INTERCOM_NORMAAL = new THREE.Vector3(0.837, 0, -0.547).normalize();
export const INTERCOM_YAW = Math.atan2(INTERCOM_NORMAAL.x, INTERCOM_NORMAAL.z);

// Strakke tweetoons Ligne Claire-shader voor de bezoeker (vlakke kleur in licht/schaduw, nul ruis).
function figuurMat(lichtHex, schaduwHex, uZon, uNacht) {
  const cL = new THREE.Color(lichtHex);
  const cS = new THREE.Color(schaduwHex);
  return new THREE.ShaderMaterial({
    uniforms: {
      uLicht: { value: cL },
      uSchaduw: { value: cS },
      uZon: uZon,
      uNacht: uNacht,
    },
    vertexShader: `
      varying vec3 vN;
      void main() {
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uLicht, uSchaduw, uZon;
      uniform float uNacht;
      varying vec3 vN;
      void main() {
        vec3 n = normalize(vN);
        // Subtiele lichte kant richting de straatlantaarn/maan, strak afgesneden zoals in klare lijn.
        vec3 richt = normalize(mix(uZon, vec3(0.65, 0.55, 0.52), uNacht));
        bool licht = dot(n, richt) > 0.08;
        vec3 k = licht ? uLicht : uSchaduw;
        // 's Nachts iets koeler/donkerder maar altijd helder leesbaar tegen het erf.
        k *= mix(vec3(1.0), vec3(0.76, 0.78, 0.84), uNacht);
        gl_FragColor = vec4(k, 1.0);
      }`,
    polygonOffset: true, polygonOffsetFactor: 1.2, polygonOffsetUnits: 1.5,
  });
}

// Constante zwarte BackSide-inktomtrek (exact passend bij de rest van het dorp).
function omtrekMat(dikte = 0.0065) {
  return new THREE.ShaderMaterial({
    uniforms: { uDikte: { value: dikte } },
    vertexShader: `
      uniform float uDikte;
      void main() {
        vec3 p = position + normalize(normal) * uDikte;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      void main() { gl_FragColor = vec4(0.016, 0.024, 0.032, 1.0); }`,
    side: THREE.BackSide,
  });
}

function metInkt(geo, mat, inktMat) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, mat);
  const o = new THREE.Mesh(geo, inktMat);
  g.add(m, o);
  return g;
}

// ---- 1. De echte Monastic-intercom naast de achterdeur (44 × 15 cm, antraciet, wit woordmerk, warme belring).
export function bouwIntercom(gloedTex) {
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
    // Afgeronde antraciete plaat met strakke zwarte inktomlijning
    const r = 40;
    ctx.fillStyle = '#25282e';
    ctx.beginPath();
    ctx.roundRect(6, 6, cv.width - 12, cv.height - 12, r);
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#040608';
    ctx.stroke();

    // Subtiele bovenrand-highlight (klare lijn randje)
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(14, 14, cv.width - 28, cv.height - 28, r - 6);
    ctx.stroke();

    // Het echte witte Monastic-woordmerk links op de plaat (28 cm van 44 cm = ~64% breedte)
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

    // Subtiel camera-oogje rechtsboven de belknop
    ctx.fillStyle = '#090b0e';
    ctx.beginPath();
    ctx.arc(868, 76, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4c6578';
    ctx.beginPath();
    ctx.arc(863, 71, 5, 0, Math.PI * 2);
    ctx.fill();

    // Donkere uitsparing achter de 3D-belring rechts
    ctx.fillStyle = '#14171c';
    ctx.beginPath();
    ctx.arc(868, 198, 66, 0, Math.PI * 2);
    ctx.fill();
    tex.needsUpdate = true;
  };
  tekenPlaat(null);
  const img = new Image();
  img.onload = () => tekenPlaat(img);
  img.src = 'woordmerk.svg';

  // Fysieke 3D-behuizing van de intercom (44 × 15 × 1,4 cm) + zwarte inktomlijning
  const inkt = omtrekMat(0.0045);
  const behuizing = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.15, 0.014),
    new THREE.MeshBasicMaterial({ color: 0x1d2025 }),
  );
  behuizing.position.set(0, 0, 0.007);
  const behuizingInkt = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.15, 0.014), inkt);
  behuizingInkt.position.copy(behuizing.position);
  group.add(behuizing, behuizingInkt);

  // Voorvlak met woordmerk
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
  const knopInkt = new THREE.Mesh(knopGeo, omtrekMat(0.0022));
  const knopGroep = new THREE.Group();
  knopGroep.add(knop, knopInkt);
  knopGroep.position.set(belX, belY, 0.022);
  group.add(knopGroep);

  // Zachte warme lichthof om de belknop (flitst helderder bij indrukken!)
  const belGloed = new THREE.Sprite(new THREE.SpriteMaterial({
    map: gloedTex, depthWrite: false, fog: false, transparent: true, opacity: 0.72,
  }));
  belGloed.position.set(belX, belY, 0.045);
  belGloed.scale.set(0.24, 0.24, 1);
  belGloed.renderOrder = 13;
  group.add(belGloed);

  // Subtiel wandlamp-gloedje hoog boven de intercom zodat het antraciete plaatje 's nachts warm oplicht
  const wandGloed = new THREE.Sprite(new THREE.SpriteMaterial({
    map: gloedTex, depthWrite: false, fog: false, transparent: true, opacity: 0.42,
  }));
  wandGloed.position.set(0.0, 0.36, 0.14);
  wandGloed.scale.set(1.35, 1.35, 1);
  wandGloed.renderOrder = 12;
  group.add(wandGloed);

  // Stijlvolle Kuifje / Klare Lijn-klankboogjes ("TRRRING!") naast de belknop bij het aanbellen
  const klankCv = document.createElement('canvas');
  klankCv.width = 512; klankCv.height = 256;
  const kg = klankCv.getContext('2d');
  // Drie strakke getekende geluidsboogjes aan de rechterzijde van de bel
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
  // Strak strip-klankje in klassieke schuine Kuifje-belettering
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

  // Het kleine gangraampje links naast de intercom (exact gemeten: u = -0.538, y = 1.500 -> lokaal -0.020, dn = -0.084).
  // Springt warm goud aan zodra er wordt aangebeld ("iemand komt naar de deur")!
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
      // Knop zakt 6 mm naar binnen bij indrukken
      knopGroep.position.z = 0.022 - 0.006 * belDruk;
      // Warme ring licht feller op tijdens en direct na het indrukken
      const flits = Math.max(belDruk, belRingT);
      ringMat.color.setRGB(1.0, 0.84 + 0.14 * flits, 0.46 + 0.34 * flits);
      const gl = Math.max(brandt * 0.72, flits * 0.98);
      belGloed.visible = gl > 0.05;
      belGloed.material.opacity = gl;
      const sc = 0.24 + flits * 0.22;
      belGloed.scale.set(sc, sc, 1);

      wandGloed.visible = brandt > 0.05;
      wandGloed.material.opacity = brandt * 0.38;

      // Strip-klankboogjes "TRRRING!" veren strak open
      belKlank.visible = belRingT > 0.02;
      if (belKlank.visible) {
        belKlank.material.opacity = Math.min(1, belRingT * 1.4);
        const pop = 0.72 + 0.32 * Math.sin(Math.min(1, belRingT * 1.8) * Math.PI * 0.6);
        belKlank.scale.setScalar(pop);
      }

      // Gangraampje links naast de intercom springt warm aan
      raamGloed.visible = raamAan > 0.02;
      raamMat.opacity = raamAan * 0.94;
    },
  };
}

// ---- 2. De mysterieuze Kuifje-bezoeker in trenchcoat, gleufhoed, pantalon, gepoetste schoenen en aktetas.
export function bouwBezoeker(uZon, uNacht) {
  const root = new THREE.Group();
  const lichaam = new THREE.Group();
  root.add(lichaam);

  const inktFijn = omtrekMat(0.0045);
  const inktNormaal = omtrekMat(0.0072);

  // Zuivere Hergé-paletkleuren voor de detective-bezoeker
  const matJas = figuurMat('#cbb586', '#9a855b', uZon, uNacht);      // klassieke zandkleurige trenchcoat
  const matKraag = figuurMat('#b8a173', '#85714c', uZon, uNacht);    // opstaande kraag & ceintuur
  const matBroek = figuurMat('#303640', '#1f232b', uZon, uNacht);    // donkere leigrijze pantalon
  const matSchoen = figuurMat('#46291a', '#26140c', uZon, uNacht);   // gepoetste donkerbruine leren schoenen
  const matZool = figuurMat('#171412', '#0b0a09', uZon, uNacht);     // schoenzool & hak
  const matHoed = figuurMat('#2a2f38', '#181b21', uZon, uNacht);     // antraciete gleufhoed (fedora)
  const matLint = figuurMat('#15171c', '#0b0c0f', uZon, uNacht);     // hoedlint
  const matHuid = figuurMat('#ebd1b4', '#c9a682', uZon, uNacht);     // gezicht / hand
  const matTas = figuurMat('#5c3a23', '#3b2415', uZon, uNacht);      // leren aktetas
  const matGesp = figuurMat('#d6b96c', '#9c8346', uZon, uNacht);     // messing gesp

  // Strakke, herkenbare leren herenschoen (zool, hak, wreef en spitse ronde neus) — mooi voor de lage deur-close-up!
  const bouwSchoen = () => {
    const sg = new THREE.Group();
    // Voetlichaam (naar +Z gericht)
    const boven = metInkt(new THREE.CapsuleGeometry(0.044, 0.145, 8, 16), matSchoen, inktFijn);
    boven.rotation.x = Math.PI / 2;
    boven.scale.set(0.96, 1.0, 0.74);
    boven.position.set(0, 0.046, 0.062);
    sg.add(boven);
    // Enkelkraag
    const enkel = metInkt(new THREE.CylinderGeometry(0.041, 0.045, 0.06, 14), matSchoen, inktFijn);
    enkel.position.set(0, 0.072, -0.008);
    sg.add(enkel);
    // Strakke zool + hak
    const zool = metInkt(new THREE.BoxGeometry(0.088, 0.016, 0.255), matZool, inktFijn);
    zool.position.set(0, 0.011, 0.056);
    const hak = metInkt(new THREE.BoxGeometry(0.084, 0.022, 0.075), matZool, inktFijn);
    hak.position.set(0, 0.011, -0.032);
    sg.add(zool, hak);
    return sg;
  };

  // Gearticuleerd been (heup -> bovenbeen -> knie -> onderbeen -> schoen)
  const bouwBeen = (xOff) => {
    const heup = new THREE.Group();
    heup.position.set(xOff, 0.88, 0);

    const boven = metInkt(new THREE.CylinderGeometry(0.078, 0.066, 0.44, 14), matBroek, inktNormaal);
    boven.position.y = -0.22;
    heup.add(boven);

    const knie = new THREE.Group();
    knie.position.set(0, -0.44, 0);
    heup.add(knie);

    const onder = metInkt(new THREE.CylinderGeometry(0.064, 0.052, 0.40, 14), matBroek, inktNormaal);
    onder.position.y = -0.19;
    knie.add(onder);

    const voet = new THREE.Group();
    voet.position.set(0, -0.44, 0);
    voet.add(bouwSchoen());
    knie.add(voet);

    return { heup, knie, voet };
  };

  const beenL = bouwBeen(0.105);
  const beenR = bouwBeen(-0.105);
  lichaam.add(beenL.heup, beenR.heup);

  // Vloeiende lange Kuifje-trenchcoat (LatheGeometry van kuiten tot schouders, ruim genoeg voor een vloeiende pas).
  const jasPunten = [
    new THREE.Vector2(0.295, 0.46), // ruime jaszoom halverwege de kuiten (geen benen die erdoorheen prikken!)
    new THREE.Vector2(0.272, 0.65),
    new THREE.Vector2(0.222, 0.86),
    new THREE.Vector2(0.178, 1.02), // taille bij de ceintuur
    new THREE.Vector2(0.210, 1.24),
    new THREE.Vector2(0.232, 1.42), // brede schouders
    new THREE.Vector2(0.112, 1.48), // hals
  ];
  const jasGeo = new THREE.LatheGeometry(jasPunten, 24);
  jasGeo.scale(1.04, 1.0, 0.90);
  const jasMesh = metInkt(jasGeo, matJas, inktNormaal);
  lichaam.add(jasMesh);

  // Subtiele donkere contactschaduw direct onder de schoenen zodat de figuur stevig op het grind staat.
  const voetSchaduw = new THREE.Mesh(
    new THREE.CircleGeometry(0.32, 20),
    new THREE.MeshBasicMaterial({ color: 0x05070a, transparent: true, opacity: 0.48, depthWrite: false }),
  );
  voetSchaduw.rotation.x = -Math.PI / 2;
  voetSchaduw.position.y = 0.008;
  root.add(voetSchaduw);

  // Ceintuur om het middel
  const riemGeo = new THREE.TorusGeometry(0.184, 0.018, 10, 24);
  riemGeo.rotateX(Math.PI / 2);
  riemGeo.scale(1.04, 1.0, 0.90);
  const riem = metInkt(riemGeo, matKraag, inktFijn);
  riem.position.y = 1.02;
  lichaam.add(riem);

  // Opstaande mysterieuze detective-kraag om de nek
  const kraagGeo = new THREE.CylinderGeometry(0.125, 0.145, 0.13, 20, 1, false, -Math.PI * 0.78, Math.PI * 1.56);
  const kraag = metInkt(kraagGeo, matKraag, inktFijn);
  kraag.position.set(0, 1.51, -0.01);
  kraag.rotation.y = Math.PI;
  lichaam.add(kraag);

  // Hoofd + donkere klassieke gleufhoed (fedora)
  const hoofdGroep = new THREE.Group();
  hoofdGroep.position.set(0, 1.59, 0.01);
  const hoofd = metInkt(new THREE.SphereGeometry(0.102, 18, 16), matHuid, inktNormaal);
  hoofd.scale.set(0.92, 1.08, 0.98);
  hoofdGroep.add(hoofd);

  const hoedGroep = new THREE.Group();
  hoedGroep.position.set(0, 0.075, 0.005);
  hoedGroep.rotation.x = 0.09; // hoed iets naar voren in de ogen getrokken (film noir!)
  const randGeo = new THREE.CylinderGeometry(0.195, 0.205, 0.014, 24);
  randGeo.scale(0.95, 1.0, 1.12);
  const bolGeo = new THREE.CylinderGeometry(0.098, 0.115, 0.11, 20);
  bolGeo.scale(0.92, 1.0, 1.08);
  const lintGeo = new THREE.CylinderGeometry(0.114, 0.117, 0.025, 20);
  lintGeo.scale(0.93, 1.0, 1.09);
  const randHoed = metInkt(randGeo, matHoed, inktFijn);
  const bolHoed = metInkt(bolGeo, matHoed, inktNormaal);
  bolHoed.position.y = 0.056;
  const lintHoed = new THREE.Mesh(lintGeo, matLint);
  lintHoed.position.y = 0.022;
  hoedGroep.add(randHoed, bolHoed, lintHoed);
  hoofdGroep.add(hoedGroep);
  lichaam.add(hoofdGroep);

  // Linkerarm (+X) met klassieke bruine leren aktetas
  const armL = new THREE.Group();
  armL.position.set(0.245, 1.38, 0.01);
  const mouwL = metInkt(new THREE.CylinderGeometry(0.058, 0.048, 0.56, 14), matJas, inktNormaal);
  mouwL.position.y = -0.28;
  const handL = metInkt(new THREE.SphereGeometry(0.040, 12, 12), matHuid, inktFijn);
  handL.position.y = -0.57;
  armL.add(mouwL, handL);

  const tasGroep = new THREE.Group();
  tasGroep.position.set(0.03, -0.73, 0.02);
  const tasBody = metInkt(new THREE.BoxGeometry(0.095, 0.28, 0.39), matTas, inktNormaal);
  const tasGreep = metInkt(new THREE.TorusGeometry(0.048, 0.009, 8, 16, Math.PI), matTas, inktFijn);
  tasGreep.rotation.y = Math.PI / 2;
  tasGreep.position.set(0, 0.145, 0);
  const gesp = new THREE.Mesh(new THREE.BoxGeometry(0.102, 0.028, 0.045), matGesp);
  gesp.position.set(0, 0.04, 0);
  tasGroep.add(tasBody, tasGreep, gesp);
  armL.add(tasGroep);
  lichaam.add(armL);

  // Rechterarm (-X): scharnierend bij schouder én elleboog
  const armR = new THREE.Group();
  armR.position.set(-0.245, 1.38, 0.01);
  const bovenArmR = metInkt(new THREE.CylinderGeometry(0.058, 0.050, 0.30, 14), matJas, inktNormaal);
  bovenArmR.position.y = -0.15;
  armR.add(bovenArmR);

  const elleboogR = new THREE.Group();
  elleboogR.position.set(0, -0.30, 0);
  armR.add(elleboogR);

  const onderArmR = metInkt(new THREE.CylinderGeometry(0.050, 0.044, 0.28, 14), matJas, inktNormaal);
  onderArmR.position.y = -0.14;
  elleboogR.add(onderArmR);

  const handRGroep = new THREE.Group();
  handRGroep.position.set(0, -0.29, 0);
  const palm = metInkt(new THREE.SphereGeometry(0.036, 12, 12), matHuid, inktFijn);
  palm.scale.set(0.85, 1.15, 0.72);
  const vinger = metInkt(new THREE.CapsuleGeometry(0.010, 0.058, 6, 10), matHuid, inktFijn);
  vinger.position.set(0, -0.055, 0.012);
  handRGroep.add(palm, vinger);
  elleboogR.add(handRGroep);
  lichaam.add(armR);

  // Strakke Kuifje close-up hand in zijaanzicht (komt schuin van rechtsonder op de belknop af zodat
  // de hele hand, duim, wijsvinger en mouwboord scherp in profiel staan en MONASTIC 100% vrij blijft!).
  const belHandGroep = new THREE.Group();
  const bhMouw = metInkt(new THREE.CylinderGeometry(0.036, 0.046, 0.34, 16), matJas, inktFijn);
  bhMouw.rotation.x = Math.PI / 2;
  bhMouw.position.set(0, 0, 0.25);
  const bhManchet = metInkt(new THREE.CylinderGeometry(0.035, 0.037, 0.028, 16), matKraag, inktFijn);
  bhManchet.rotation.x = Math.PI / 2;
  bhManchet.position.set(0, 0, 0.088);
  const bhPalm = metInkt(new THREE.SphereGeometry(0.030, 14, 14), matHuid, inktFijn);
  bhPalm.scale.set(0.75, 0.92, 1.20);
  bhPalm.position.set(0, -0.004, 0.046);
  // Gebogen vingers onder de wijsvinger (voor een echt herkenbare striphand in zijaanzicht!)
  const bhVuist = metInkt(new THREE.SphereGeometry(0.024, 12, 12), matHuid, inktFijn);
  bhVuist.scale.set(0.88, 1.05, 0.90);
  bhVuist.position.set(0, -0.018, 0.024);
  const bhDuim = metInkt(new THREE.CapsuleGeometry(0.009, 0.030, 6, 10), matHuid, inktFijn);
  bhDuim.position.set(-0.016, 0.016, 0.032);
  bhDuim.rotation.x = Math.PI / 3;
  const bhVinger = metInkt(new THREE.CapsuleGeometry(0.009, 0.056, 6, 12), matHuid, inktFijn);
  bhVinger.rotation.x = Math.PI / 2;
  bhVinger.position.set(0.0, 0.004, -0.012); // vingertop op lokaal z = -0.044
  belHandGroep.add(bhMouw, bhManchet, bhPalm, bhVuist, bhDuim, bhVinger);
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

      if (uitstapT < 1) {
        // Scene 3: uitstappen! Eerst de linkervoet stevig op het grind, dan volgt de rechtervoet uit de auto.
        const s1 = Math.min(1, uitstapT / 0.48);
        const s2 = Math.max(0, Math.min(1, (uitstapT - 0.36) / 0.56));
        const e1 = s1 * s1 * (3 - 2 * s1);
        const e2 = s2 * s2 * (3 - 2 * s2);
        lichaam.position.y = -0.06 * (1 - e2);
        beenL.heup.rotation.x = -0.45 * (1 - e1) + 0.06;
        beenL.knie.rotation.x = 0.48 * (1 - e1);
        beenL.voet.rotation.x = -0.04 * (1 - e1);
        beenR.heup.rotation.x = -0.62 * (1 - e2) - 0.06;
        beenR.knie.rotation.x = 0.66 * (1 - e2);
        beenR.voet.rotation.x = 0.06 * (1 - e2);
        armL.rotation.x = 0.12;
        armR.rotation.x = -0.10;
        elleboogR.rotation.x = -0.15;
        belHandGroep.visible = false;
        return;
      }

      // Normale wandelpas (netjes binnen de jaszoom, geen prikkende knieën!)
      const s = Math.sin(stap);
      const c = Math.cos(stap);
      const wandelAmp = Math.max(0, 1 - belReik * 1.4);
      lichaam.position.y = Math.abs(s) * 0.024 * wandelAmp;
      lichaam.rotation.z = s * 0.018 * wandelAmp;

      beenL.heup.rotation.x = s * 0.34 * wandelAmp;
      beenL.knie.rotation.x = Math.max(0, -c) * 0.32 * wandelAmp;
      beenL.voet.rotation.x = -Math.max(0, -c) * 0.14 * wandelAmp;

      beenR.heup.rotation.x = -s * 0.34 * wandelAmp;
      beenR.knie.rotation.x = Math.max(0, c) * 0.32 * wandelAmp;
      beenR.voet.rotation.x = -Math.max(0, c) * 0.14 * wandelAmp;

      armL.rotation.x = -s * 0.20 * wandelAmp;
      armR.rotation.x = s * 0.24 * wandelAmp - belReik * 1.15;
      elleboogR.rotation.x = -0.18 - belReik * 0.42;

      // Scene 5 close-up hand in strak Kuifje-zijaanzicht vanaf rechtsonder (+62° opzij!) zodat MONASTIC vrij blijft!
      if (belReik > 0.02 && belWereld) {
        belHandGroep.visible = true;
        const n = INTERCOM_NORMAAL;
        const rechts = new THREE.Vector3(-n.z, 0, n.x);
        const op = new THREE.Vector3(0, 1, 0);
        // Aanvliegrichting van rechtsonder-voor (schuin langs de muur zodat we de hele vinger + hand in profiel zien!)
        const aanVlieg = new THREE.Vector3()
          .addScaledVector(n, 0.56)
          .addScaledVector(rechts, 0.72)
          .addScaledVector(op, -0.40)
          .normalize();
        const afstand = 0.24 - 0.200 * belReik; // bij belReik=1 raakt vingertop (lokaal z=-0.044) exact de belknop!
        belHandGroep.position.copy(belWereld).addScaledVector(aanVlieg, afstand);
        belHandGroep.lookAt(belWereld);
        belHandGroep.rotateY(Math.PI);
      } else {
        belHandGroep.visible = false;
      }
    },
  };
}
