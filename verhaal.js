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

      raamGloed.visible = raamAan > 0.02;
      raamMat.opacity = raamAan * 0.94;
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
