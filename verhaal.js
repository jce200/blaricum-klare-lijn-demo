// Het Kuifje / Ligne Claire-verhaal bij het kantoor van Monastic (zonder 3D-poppetjes!):
//   1. De echte antraciete Monastic-intercom naast de achterdeur (44 × 15 cm, wit woordmerk uit woordmerk.svg,
//      warme gloeiende belring, echte 3D-drukknop, wandlantaarn erboven, hardstenen drempel/deurmat,
//      strip-klankboogjes TRRRING! en het gangraampje dat warm aanspringt zodra er wordt aangebeld).
//   2. De scherpe zwarte Hergé film-noir slagschaduw (hoed + opstaande trenchcoatkraag) die in Shot 4
//      geruisloos langs de bakstenen muur voorbij het wandlampje glijdt.
//   3. De handgetekende 2D Kuifje-aanbelcel (cels/hand-cel.webp, exact dezelfde jas & handschoen als
//      de bestuurder in cels/porsche-cel.webp!) die van rechtsonder precies op de belknop drukt.
import * as THREE from 'three';

// Exacte muurpositie en normaal van de bakstenen pier tussen het gangraampje en de achterdeur (uit blender/intercom.py).
export const INTERCOM_POS = new THREE.Vector3(7.989, 1.52, -1.686);
export const INTERCOM_NORMAAL = new THREE.Vector3(0.837, 0, -0.547).normalize();
export const INTERCOM_YAW = Math.atan2(INTERCOM_NORMAAL.x, INTERCOM_NORMAAL.z);

// Schermruimte-inktomtrek met exact dezelfde constante penbreedte als het dorp en de Porsche.
function omtrekPxMat(uRes, uLijn, schaal = 0.85) {
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

function metInkt(geo, mat, inktMat) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mat), new THREE.Mesh(geo, inktMat));
  return g;
}

// Klassieke Hergé film-noir slagschaduw op de bakstenen muur (gleufhoed in profiel + opstaande kraag + schouders).
function tekenMuurSchaduwTex() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 768;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 768);
  g.fillStyle = '#070a0f';

  // Strak gesloten Kuifje-silhouet kijkend naar links (-X, richting de intercom):
  g.beginPath();
  // Gedeukte gleufhoed (fedora in zijaanzicht)
  g.moveTo(155, 198);
  g.quadraticCurveTo(188, 178, 226, 172); // voorrand hoed
  g.lineTo(240, 118);                      // voorkant bol
  g.quadraticCurveTo(275, 102, 318, 112); // kroon met deukje
  g.quadraticCurveTo(352, 118, 372, 168); // achterkant bol
  g.quadraticCurveTo(408, 172, 424, 184); // opgewipte achterrand
  g.quadraticCurveTo(390, 206, 356, 208); // onderkant achterrand
  // Achterhoofd & nek
  g.quadraticCurveTo(364, 248, 346, 286);
  // Opstaande trenchcoatkraag & schouderlijn achter
  g.lineTo(392, 308);
  g.quadraticCurveTo(448, 360, 466, 485);
  g.lineTo(482, 768);
  // Onderkant afgesneden onder beeld
  g.lineTo(138, 768);
  g.lineTo(158, 520);
  // Voorzijde trenchcoat, borst & revers
  g.quadraticCurveTo(164, 385, 206, 332);
  g.lineTo(176, 304);                      // opstaande kraag voor
  g.lineTo(212, 278);                      // kin/kaaklijn
  g.quadraticCurveTo(192, 266, 196, 250); // onderlip / kin
  g.lineTo(182, 236);                      // neuspunt (echt Kuifje-profiel!)
  g.lineTo(202, 212);                      // voorhoofd onder hoedrand
  g.closePath();
  g.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ---- 1. De echte Monastic-intercom + stijlvolle wandlantaarn erboven + film-noir muurschaduw + gangraampje.
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

  // Klassieke Ligne Claire buitenlamp / wandlantaarn boven de intercom (y = +0.60 m -> 2.12 m hoogte)
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

  // Hardstenen drempel & klassieke donkere deurmat bij de Monastic-achterdeur
  const drempelMat = new THREE.MeshBasicMaterial({ color: 0x353d44 });
  const matMat = new THREE.MeshBasicMaterial({ color: 0x2a2623 });
  const drempel = metInkt(new THREE.BoxGeometry(1.06, 0.055, 0.36), drempelMat, inkt);
  drempel.position.set(0.56, -1.415, 0.14);
  const deurmat = metInkt(new THREE.BoxGeometry(0.76, 0.018, 0.44), matMat, inkt);
  deurmat.position.set(0.56, -1.428, 0.48);
  group.add(drempel, deurmat);

  // Film-noir slagschaduw op de bakstenen muur (glijdt in Shot 4 van rechts langs de intercom voorbij!)
  const schaduwMat = new THREE.MeshBasicMaterial({
    map: tekenMuurSchaduwTex(),
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const muurSchaduw = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 1.28), schaduwMat);
  muurSchaduw.position.set(0.55, -0.08, 0.004);
  muurSchaduw.renderOrder = 11;
  muurSchaduw.visible = false;
  group.add(muurSchaduw);

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
    zetStaat(brandt, belDruk = 0, belRingT = 0, raamAan = 0, schaduwT = -1) {
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

      // Film-noir slagschaduw schuift in Shot 4 van rechts langs de muur voorbij en blijft subtiel naast de bel staan
      if (schaduwT >= 0 && schaduwT <= 1) {
        muurSchaduw.visible = true;
        const fadeIn = Math.min(1, schaduwT / 0.18);
        const fadeOut = schaduwT > 0.82 ? Math.max(0, 1 - (schaduwT - 0.82) / 0.18) : 1;
        schaduwMat.opacity = (0.58 + 0.14 * brandt) * fadeIn * fadeOut;
        const schuif = Math.min(1, schaduwT / 0.55);
        const e = schuif * schuif * (3 - 2 * schuif);
        muurSchaduw.position.set(0.68 - 0.52 * e, -0.10 + Math.sin(e * Math.PI * 3) * 0.014, 0.004);
      } else {
        muurSchaduw.visible = false;
      }

      belKlank.visible = belRingT > 0.02;
      if (belKlank.visible) {
        belKlank.material.opacity = Math.min(1, belRingT * 1.4);
        const pop = 0.72 + 0.32 * Math.sin(Math.min(1, belRingT * 1.8) * Math.PI * 0.6);
        belKlank.scale.setScalar(pop);
      }

      const rEff = raamAan * brandt;
      raamGloed.visible = rEff > 0.02;
      raamMat.opacity = rEff * 0.94;
    },
  };
}

// ---- 2. De echte 2D Kuifje-aanbelcel (cels/hand-cel.webp, exact passend bij de bestuurder in cels/porsche-cel.webp!)
export function bouwBelHandCel(uNacht) {
  const groep = new THREE.Group();
  const tex = new THREE.TextureLoader().load('cels/hand-cel.webp');
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // Afmeting 16:9 vlak (72 × 40,2 cm zodat de mouw netjes doorloopt tot buiten het scherm); vingertop op UV (0.2364, 0.7410)!
  const b = 0.72, h = b * (614 / 1100);
  const vlak = new THREE.Mesh(new THREE.PlaneGeometry(b, h), mat);
  vlak.position.set((0.5 - 0.2364) * b, (0.5 - 0.7410) * h, 0);
  vlak.renderOrder = 15;
  groep.add(vlak);
  groep.visible = false;

  return {
    groep,
    zetReik(belReik, belWereld) {
      if (belReik > 0.02 && belWereld) {
        groep.visible = true;
        const nt = uNacht ? uNacht.value : 0;
        mat.color.setRGB(1 - 0.12 * nt, 1 - 0.10 * nt, 1 - 0.05 * nt);
        const n = INTERCOM_NORMAAL;
        const rechts = new THREE.Vector3(n.z, 0, -n.x); // scherm-rechts gezien vanaf de oprit
        const op = new THREE.Vector3(0, 1, 0);
        const weg = 1.0 - belReik;
        groep.position.copy(belWereld)
          .addScaledVector(n, 0.036 + 0.035 * weg)
          .addScaledVector(rechts, 0.22 * weg)
          .addScaledVector(op, -0.14 * weg);
        groep.rotation.set(0, INTERCOM_YAW, -0.05 * weg);
      } else {
        groep.visible = false;
      }
    },
  };
}

// ---- 3. Authentieke Blaricumsche Boekhandel-borden (warme oranje/oker bovenlichtpanelen met witte letters, exact als op de echte foto!)
export function bouwBoekhandelBorden() {
  const groep = new THREE.Group();
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 192;
  const g = c.getContext('2d');
  // Warm oranje-oker bovenlichtpaneel + strakke zwarte inktomranding
  g.fillStyle = '#c97128';
  g.fillRect(0, 0, 1024, 192);
  g.strokeStyle = '#070a0d';
  g.lineWidth = 14;
  g.strokeRect(7, 7, 1010, 178);
  g.fillStyle = '#fbf5e8';
  g.font = '700 56px "Futura PT", "Century Gothic", "Trebuchet MS", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('BLARICUMSCHE BOEKHANDEL', 512, 100);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.FrontSide });

  // Exact gemeten afwisselende winkelraam-vakken (y = 2.61..3.14 m) op Meentweg-gevel en Torenlaan-gevel!
  const borden = [
    // Meentweg-gevel (n = +0.55, +0.84 -> vak 2 en vak 4, exact als op de foto!)
    { cx: -1.76, cz: 16.12, nx: 0.548, nz: 0.836, b: 2.68 },
    { cx: 3.16, cz: 12.90, nx: 0.548, nz: 0.836, b: 2.68 },
    // Torenlaan-gevel (n = -0.84, +0.55 -> boven de entree en etalage)
    { cx: -7.39, cz: 15.44, nx: -0.836, nz: 0.548, b: 2.24 },
    { cx: -10.10, cz: 11.30, nx: -0.836, nz: 0.548, b: 2.24 },
  ];
  for (const bd of borden) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(bd.b, 0.53), mat);
    m.position.set(bd.cx + bd.nx * 0.048, 2.88, bd.cz + bd.nz * 0.048);
    m.rotation.y = Math.atan2(bd.nx, bd.nz);
    m.renderOrder = 6;
    groep.add(m);
  }

  return {
    groep,
    zetNacht(nacht) {
      // Overdag fris oranje-oker, 's avonds warm ingetogen terracotta (via setHex/lerp in sRGB-gecorrigeerde ruimte!)
      const cDag = new THREE.Color(0xffffff);
      const cNacht = new THREE.Color(0xc8a484);
      mat.color.copy(cDag).lerp(cNacht, nacht);
    },
  };
}

// ---- 4. Handgetekende Ligne Claire erfaankleding bij het kantoor (uit de 4-luik collage: buxusstruikjes, brievenbus, fiets & kliko!)
export function bouwErfDetails() {
  const groep = new THREE.Group();
  const inkt = new THREE.LineBasicMaterial({ color: 0x05070a });
  const maakDoos = (w, h, d, mat) => metInkt(new THREE.BoxGeometry(w, h, d), mat, inkt);

  const groen1Mat = new THREE.MeshBasicMaterial({ color: 0x263f2d });
  const groen2Mat = new THREE.MeshBasicMaterial({ color: 0x1d3223 });
  const klikoMat = new THREE.MeshBasicMaterial({ color: 0x2a333c });
  const klikoDekselMat = new THREE.MeshBasicMaterial({ color: 0x181e24 });
  const busMat = new THREE.MeshBasicMaterial({ color: 0x2e3740 });
  const fietsMat = new THREE.MeshBasicMaterial({ color: 0x11161c });
  const velgMat = new THREE.MeshBasicMaterial({ color: 0x6f7c88 });

  // 1. Lage donkergroene buxusstruikjes langs de bakstenen plint bij het erf (zoals in paneel 3 van de collage!)
  const struikPlekken = [
    [9.25, 0.23, -2.55, 0.32, 0.24],
    [9.58, 0.19, -2.95, 0.26, 0.20],
    [10.85, 0.21, 2.25, 0.34, 0.23],
    [11.20, 0.18, 2.72, 0.26, 0.20],
  ];
  for (let i = 0; i < struikPlekken.length; i++) {
    const [sx, sy, sz, sr, sh] = struikPlekken[i];
    const g = new THREE.Group();
    const s1 = metInkt(new THREE.DodecahedronGeometry(sr, 0), i % 2 === 0 ? groen1Mat : groen2Mat, inkt);
    s1.scale.set(1.15, sh / sr, 1.05);
    g.add(s1);
    const s2 = metInkt(new THREE.DodecahedronGeometry(sr * 0.72, 0), groen2Mat, inkt);
    s2.position.set(sr * 0.55, -0.04, sr * 0.25);
    s2.scale.set(1.1, (sh / sr) * 0.9, 1.0);
    g.add(s2);
    g.position.set(sx, sy, sz);
    groep.add(g);
  }

  // 3. Klassieke donkergrijze brievenbus op paaltje links van de achterdeur (paneel 3 van de collage!)
  const busG = new THREE.Group();
  const paal = maakDoos(0.06, 1.05, 0.06, klikoDekselMat);
  paal.position.set(0, 0.525, 0);
  const kast = maakDoos(0.28, 0.38, 0.18, busMat);
  kast.position.set(0, 1.12, 0);
  const klep = maakDoos(0.30, 0.04, 0.20, klikoDekselMat);
  klep.position.set(0, 1.32, 0);
  busG.add(paal, kast, klep);
  busG.position.set(9.18, 0.085, 1.98);
  busG.rotation.y = INTERCOM_YAW;
  groep.add(busG);

  // 4. Nederlandse antraciet kliko netjes weggestopt tegen de linker bakstenen zijgevel (nooit midden op de oprit!)
  const klikoG = new THREE.Group();
  const bak = maakDoos(0.54, 0.92, 0.62, klikoMat);
  bak.position.set(0, 0.52, 0);
  const deksel = maakDoos(0.58, 0.08, 0.66, klikoDekselMat);
  deksel.position.set(0, 1.01, 0);
  const greep = maakDoos(0.52, 0.04, 0.06, fietsMat);
  greep.position.set(0, 1.02, -0.35);
  for (const wx of [-0.26, 0.26]) {
    const w = metInkt(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 12), fietsMat, inkt);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.09, -0.25);
    klikoG.add(w);
  }
  klikoG.add(bak, deksel, greep);
  klikoG.position.set(12.25, 0.085, 4.92);
  klikoG.rotation.y = INTERCOM_YAW;
  groep.add(klikoG);

  // 5. Klassieke zwarte Nederlandse stadsfiets schuin tegen de rechter garagewand (paneel 1 van de collage!)
  const fietsG = new THREE.Group();
  for (const wz of [-0.52, 0.52]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.028, 8, 20), fietsMat);
    band.rotation.y = Math.PI / 2;
    band.position.set(0, 0.34, wz);
    const velg = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.014, 6, 18), velgMat);
    velg.rotation.y = Math.PI / 2;
    velg.position.set(0, 0.34, wz);
    fietsG.add(band, velg);
  }
  const buis = (a, b, r = 0.017) => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const len = va.distanceTo(vb);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), fietsMat);
    m.position.copy(va).add(vb).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    return m;
  };
  fietsG.add(
    buis([0, 0.34, -0.52], [0, 0.72, -0.14]), // achtervork boven
    buis([0, 0.34, -0.52], [0, 0.32, -0.06]), // achtervork onder
    buis([0, 0.32, -0.06], [0, 0.78, -0.16]), // zitbuis
    buis([0, 0.32, -0.06], [0, 0.72, 0.36]),  // onderbuis
    buis([0, 0.72, -0.14], [0, 0.76, 0.36]),  // bovenbuis
    buis([0, 0.34, 0.52], [0, 0.94, 0.33]),   // voorvork & stuurpen
    buis([-0.24, 0.94, 0.28], [0.24, 0.94, 0.28], 0.015), // stuur
  );
  const zadel = maakDoos(0.11, 0.045, 0.22, fietsMat);
  zadel.position.set(0, 0.82, -0.18);
  fietsG.add(zadel);
  fietsG.position.set(14.55, 0.085, -3.55);
  fietsG.rotation.set(0, 1.42, -0.11); // schuin leunend tegen de bakstenen garagewand
  groep.add(fietsG);

  const g1Dag = new THREE.Color(0x3a5a40), g1Nacht = new THREE.Color(0x1b2e22);
  const g2Dag = new THREE.Color(0x2d4832), g2Nacht = new THREE.Color(0x14231a);
  const klDag = new THREE.Color(0x454e56), klNacht = new THREE.Color(0x242c34);

  return {
    groep,
    zetNacht(nacht) {
      groen1Mat.color.copy(g1Dag).lerp(g1Nacht, nacht);
      groen2Mat.color.copy(g2Dag).lerp(g2Nacht, nacht);
      klikoMat.color.copy(klDag).lerp(klNacht, nacht);
    },
  };
}

// ---- 5. Anonieme film-noir schim die in Shot 1 over de Blaricumse klinkers bij Bistrot Chapeau loopt (4-frame limited cel, geen gezicht!)
function tekenLoopSchimFrame(fase) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 512);
  // 4 discrete loopfases (stride) met klassieke trenchcoat & gedeukte gleufhoed in zijprofiel naar rechts
  const pas = [
    { b1: -34, b2: 30, arm: 18, bob: 0, jas: -14 },
    { b1: -10, b2: 8,  arm: 6,  bob: -6, jas: -6 },
    { b1: 30,  b2: -32, arm: -16, bob: 0, jas: -16 },
    { b1: 8,   b2: -8,  arm: -5, bob: -6, jas: -8 },
  ][fase % 4];
  const y0 = 24 + pas.bob;

  g.fillStyle = '#070b10';
  g.strokeStyle = '#020406';
  g.lineWidth = 4;
  g.lineJoin = 'round';

  // Achterste been + schoen
  g.beginPath();
  g.moveTo(118, y0 + 305);
  g.lineTo(116 + pas.b2 * 0.65, y0 + 392);
  g.lineTo(118 + pas.b2, y0 + 462);
  g.lineTo(148 + pas.b2, y0 + 468);
  g.lineTo(148 + pas.b2, y0 + 476);
  g.lineTo(106 + pas.b2, y0 + 476);
  g.lineTo(98 + pas.b2 * 0.55, y0 + 390);
  g.lineTo(96, y0 + 305);
  g.closePath();
  g.fill();

  // Voorste been + schoen
  g.beginPath();
  g.moveTo(132, y0 + 305);
  g.lineTo(136 + pas.b1 * 0.65, y0 + 392);
  g.lineTo(132 + pas.b1, y0 + 462);
  g.lineTo(164 + pas.b1, y0 + 468);
  g.lineTo(164 + pas.b1, y0 + 476);
  g.lineTo(118 + pas.b1, y0 + 476);
  g.lineTo(116 + pas.b1 * 0.55, y0 + 390);
  g.lineTo(112, y0 + 305);
  g.closePath();
  g.fill();

  // Lange, licht wapperende trenchcoat + schouders + opstaande kraag + gleufhoed (kijkend naar rechts)
  g.beginPath();
  // Gleufhoed
  g.moveTo(92, y0 + 72);
  g.quadraticCurveTo(106, y0 + 62, 118, y0 + 60);
  g.lineTo(124, y0 + 34);
  g.quadraticCurveTo(144, y0 + 26, 162, y0 + 36);
  g.lineTo(168, y0 + 58);
  g.quadraticCurveTo(192, y0 + 60, 202, y0 + 70); // voorrand hoed
  g.quadraticCurveTo(182, y0 + 78, 166, y0 + 78);
  // Gezichtloos profiel (alleen donkere schim onder hoedrand)
  g.lineTo(164, y0 + 104);
  g.lineTo(154, y0 + 114);
  // Opstaande trenchcoatkraag voor + borst
  g.lineTo(170, y0 + 124);
  g.quadraticCurveTo(176, y0 + 178, 166, y0 + 245);
  g.lineTo(176 + pas.b1 * 0.35, y0 + 348); // voorpand jas
  g.lineTo(82 + pas.jas, y0 + 356);        // wapperende achterkant jas
  g.quadraticCurveTo(84, y0 + 245, 92, y0 + 150);
  g.lineTo(108, y0 + 122);
  g.lineTo(112, y0 + 104);
  g.quadraticCurveTo(104, y0 + 88, 108, y0 + 76);
  g.closePath();
  g.fill();

  // Zwaaiende mouw/arm met aktekoffer-silhouet (geeft direct "mysterieuze gast" gevoel!)
  const hx = 132 + pas.arm, hy = y0 + 258;
  g.beginPath();
  g.moveTo(124, y0 + 154);
  g.lineTo(hx + 10, hy);
  g.lineTo(hx - 10, hy + 4);
  g.lineTo(108, y0 + 160);
  g.closePath();
  g.fill();
  // Subtiele slanke aktetas aan de hand
  g.fillRect(hx - 18, hy + 2, 42, 30);

  // Zeer subtiele petrol-blauw maanlicht-rand langs rug & hoedkroon (bindt de schim 100% in het 3D-nachtpalet!)
  g.strokeStyle = 'rgba(104, 146, 174, 0.42)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(124, y0 + 35);
  g.quadraticCurveTo(144, y0 + 28, 162, y0 + 37);
  g.moveTo(92, y0 + 152);
  g.quadraticCurveTo(84, y0 + 245, 83 + pas.jas, y0 + 354);
  g.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function bouwDorpSchim() {
  const groep = new THREE.Group();
  const frames = [0, 1, 2, 3].map(tekenLoopSchimFrame);
  const mat = new THREE.MeshBasicMaterial({
    map: frames[0],
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const figuur = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.88), mat);
  figuur.position.y = 0.94;
  figuur.renderOrder = 11;
  groep.add(figuur);

  // Lange, scherpe film-noir slagschaduw op de klinkers onder de schim
  const schCv = document.createElement('canvas');
  schCv.width = 128; schCv.height = 128;
  const sg = schCv.getContext('2d');
  sg.fillStyle = 'rgba(6, 10, 15, 0.72)';
  sg.beginPath();
  sg.ellipse(64, 64, 52, 20, -0.25, 0, Math.PI * 2);
  sg.fill();
  const schTex = new THREE.CanvasTexture(schCv);
  const schaduw = new THREE.Mesh(
    new THREE.PlaneGeometry(2.3, 1.15),
    new THREE.MeshBasicMaterial({ map: schTex, transparent: true, depthWrite: false }),
  );
  schaduw.rotation.x = -Math.PI / 2;
  schaduw.position.set(0.45, 0.04, 0.35);
  schaduw.renderOrder = 5;
  groep.add(schaduw);

  const start = new THREE.Vector3(-13.8, 0.03, 27.8);
  const eind = new THREE.Vector3(-2.6, 0.03, 18.8);
  // Richt de schim dwars op het balkonshot (-28, 6.2, 38.6) zodat hij breed in zijprofiel over de klinkers loopt!
  figuur.rotation.y = -0.62;
  groep.visible = false;

  return {
    groep,
    zetVoortgang(t, zichtbaar = true) {
      if (!zichtbaar || t < 0 || t > 1) {
        groep.visible = false;
        return;
      }
      groep.visible = true;
      groep.position.lerpVectors(start, eind, t);
      const idx = Math.floor(t * 16) % 4;
      if (mat.map !== frames[idx]) {
        mat.map = frames[idx];
        mat.needsUpdate = true;
      }
    },
  };
}

// ---- 6. Anonieme schim rechtstreeks achter het echte 3D-halraam van Monastic + slagschaduw op de gouden lichtwig!
//         Levensechte menselijke schaal (schouders & profiel vullen het smalle halraam), 100% dezelfde 3D-stijl!
export function bouwHalSchim() {
  const groep = new THREE.Group();
  groep.position.copy(INTERCOM_POS);
  groep.rotation.y = INTERCOM_YAW;

  // Levensecht profiel-silhouet (schouders + kraag + hoofd in lichte draai richting de voordeur) op ware schaal in 38x70 cm raam!
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 512);
  g.fillStyle = '#0c121a';
  g.beginPath();
  // Rechter/achter-schouder loopt realistisch tot buiten het raamkozijn
  g.moveTo(-10, 512);
  g.lineTo(-10, 318);
  g.quadraticCurveTo(22, 266, 74, 248);    // linkerschouder / jas
  g.lineTo(82, 224);                        // opstaande kraag achter
  g.quadraticCurveTo(72, 182, 78, 140);     // achterhoofd
  g.quadraticCurveTo(88, 86, 134, 84);      // kruin
  g.quadraticCurveTo(176, 86, 184, 132);    // voorhoofd (licht naar rechts / deur gedraaid)
  g.lineTo(192, 152);                       // neuslijn (subtiel, geen gezichtsdetails)
  g.lineTo(183, 166);
  g.lineTo(185, 192);                       // kaak/kin
  g.lineTo(164, 208);                       // hals
  g.lineTo(176, 226);                       // kraag voor
  g.quadraticCurveTo(226, 252, 256, 304);   // rechterschouder richting deur
  g.lineTo(266, 512);
  g.closePath();
  g.fill();

  const schimTex = new THREE.CanvasTexture(c);
  schimTex.colorSpace = THREE.SRGBColorSpace;
  const schimMat = new THREE.MeshBasicMaterial({
    map: schimTex,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  // Geplaatst pal in het smalle oplichtende halraampje (zodat hij haarscherp achter het glas aftekent!)
  const raamSchim = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.70), schimMat);
  raamSchim.position.set(-0.538, -0.02, -0.072);
  raamSchim.renderOrder = 9;
  groep.add(raamSchim);

  // Lange, scherpe film-noir silhouet-schaduw op de 45° visgraatklinkers in de gouden lichtwig!
  const vloerCv = document.createElement('canvas');
  vloerCv.width = 256; vloerCv.height = 512;
  const vg = vloerCv.getContext('2d');
  vg.clearRect(0, 0, 256, 512);
  vg.fillStyle = 'rgba(8, 12, 18, 0.72)';
  vg.beginPath();
  vg.moveTo(86, 0);
  vg.lineTo(170, 0);
  vg.lineTo(194, 260);
  vg.quadraticCurveTo(180, 340, 152, 368);
  vg.arc(128, 415, 36, -0.4, Math.PI + 0.4);
  vg.quadraticCurveTo(76, 340, 62, 260);
  vg.closePath();
  vg.fill();
  const vloerTex = new THREE.CanvasTexture(vloerCv);
  const vloerMat = new THREE.MeshBasicMaterial({
    map: vloerTex,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });
  const vloerSchaduw = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.95), vloerMat);
  vloerSchaduw.rotation.x = -Math.PI / 2;
  vloerSchaduw.position.set(0.32, -1.41, 1.25);
  vloerSchaduw.renderOrder = 6;
  groep.add(vloerSchaduw);

  groep.visible = false;

  return {
    groep,
    zetStaat(sterkte) {
      const s = Math.max(0, Math.min(1, sterkte));
      groep.visible = s > 0.02;
      schimMat.opacity = s * 0.90;
      vloerMat.opacity = s * 0.74;
      raamSchim.position.x = -0.538 + (1 - s) * 0.08;
    },
  };
}

