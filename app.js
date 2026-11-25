// PANAL FAMILIAR · configurador (muestra) · v1.0
// Sin servidor: los datos y fotos solo viven en memoria.
'use strict';

const MAX_DESC = 220;
// Medidas provisionales (mm)
const FLAT = 80, R = FLAT / Math.sqrt(3), PITCH = 85, VPITCH = PITCH * Math.sqrt(3) / 2;
const MAX_ANCHO_AVISO = 700;
const PX_W = Math.round(FLAT / 25.4 * 300), PX_H = Math.round(2 * R / 25.4 * 300);
const COLORES = ['#8a9a7b', '#c58b5c', '#5f7f8f', '#a8605a', '#d8c7a3', '#3f4448'];
const PASOS = ['Familia', 'Abuelos', 'Hijos', 'Distribución', 'Personas', 'Revisión'];

const S = {
  paso: 0, familia: '', abuelos: [true, true],
  hijos: [{ g: 'm', pareja: false, nietos: [] }],
  sep: 1, borde: 1, color: COLORES[0],
  personas: {}, orden: {}, sel: null, cara: 'front', giradas: new Set(), aprobado: false
};

const $ = s => document.querySelector(s);
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let uid = 0;
const nuevoNieto = () => ({ id: ++uid, g: 'm' });
S.hijos[0].id = ++uid;

/* ---------- Modelo ---------- */
function listaPersonas() {
  const l = [];
  const ab = ['Abuelo', 'Abuela'];
  S.abuelos.forEach((on, i) => on && l.push({ key: 'a' + i, rol: ab[i], gen: 0 }));
  S.hijos.forEach((h, i) => {
    const rol = h.g === 'm' ? 'Hijo' : 'Hija';
    l.push({ key: 'h' + h.id, rol, gen: 1, rama: i });
    if (h.pareja) l.push({ key: 'p' + h.id, rol: 'Pareja', gen: 1, rama: i });
    h.nietos.forEach(n => l.push({ key: 'n' + n.id, rol: n.g === 'm' ? 'Nieto' : 'Nieta', gen: 2, rama: i }));
  });
  return l;
}
const datos = key => S.personas[key] || (S.personas[key] = { nombre: '', desc: '', foto: null, z: 1, dx: 0, dy: 0 });

/* ---------- Distribución ---------- */
function distribucionAuto() {
  const pos = {};
  const anchos = S.hijos.map(h => Math.max(h.nietos.length, h.pareja ? 2 : 1));
  const nAb = S.abuelos.filter(Boolean).length;
  const usado = anchos.reduce((a, b) => a + b, 0) + S.sep * (anchos.length - 1);
  const N = Math.max(usado, nAb);
  let x = Math.floor((N - usado) / 2);
  S.hijos.forEach((h, i) => {
    const w = anchos[i], b = h.pareja ? 2 : 1;
    const xh = x + Math.floor((w - b) / 2);
    pos['h' + h.id] = xh;
    if (h.pareja) pos['p' + h.id] = xh + 1;
    const xn = x + Math.floor((w - h.nietos.length) / 2);
    h.nietos.forEach((n, j) => pos['n' + n.id] = xn + j);
    x += w + S.sep;
  });
  let xa = Math.floor((N - nAb) / 2);
  S.abuelos.forEach((on, i) => { if (on) pos['a' + i] = xa++; });
  return { pos, N };
}

function distribucion() {
  const auto = distribucionAuto();
  const pos = {};
  for (const k in auto.pos) pos[k] = k in S.orden ? S.orden[k] : auto.pos[k];
  return { pos, N: auto.N };
}

function celdas() {
  const { pos, N } = distribucion();
  const pers = listaPersonas();
  const m = S.borde;
  const gens = [0, 1, 2].filter(g => pers.some(p => p.gen === g));
  const largo = N + 2 * m;
  const filas = [];
  if (m) filas.push(null);
  gens.forEach((g, i) => { if (i) filas.push(null); filas.push(g); });
  if (m) filas.push(null);
  const out = [];
  filas.forEach((g, f) => {
    const esFoto = g !== null;
    const n = esFoto ? largo : Math.max(largo - 1, 1);
    const off = esFoto ? 0 : PITCH / 2;
    for (let c = 0; c < n; c++) {
      const p = esFoto ? pers.find(q => q.gen === g && pos[q.key] === c - m) : null;
      out.push({ x: c * PITCH + off + FLAT / 2, y: f * VPITCH + R, p, gen: g, slot: c - m });
    }
  });
  const ancho = Math.max(...out.map(c => c.x)) + FLAT / 2;
  const alto = (filas.length - 1) * VPITCH + 2 * R;
  return { celdas: out, ancho, alto, N };
}

function mover(key, dir) {
  const { pos, N } = distribucion();
  const pers = listaPersonas();
  const yo = pers.find(p => p.key === key);
  const destino = pos[key] + dir;
  if (destino < 0 || destino >= N) return;
  const otro = pers.find(p => p.gen === yo.gen && pos[p.key] === destino);
  if (otro) S.orden[otro.key] = pos[key];
  S.orden[key] = destino;
}

/* ---------- Dibujo ---------- */
const puntos = (r = R) => {
  const w = r * Math.sqrt(3) / 2;
  return `0,${-r} ${w},${-r / 2} ${w},${r / 2} 0,${r} ${-w},${r / 2} ${-w},${-r / 2}`;
};
const ctxM = document.createElement('canvas').getContext('2d');
function medir(t, fs, peso = 400) {
  ctxM.font = `${peso} 100px 'IBM Plex Sans', sans-serif`;
  return ctxM.measureText(t).width * fs / 100;
}
function partir(texto, fs, ancho) {
  const lineas = [];
  for (const parrafo of texto.split('\n')) {
    let l = '';
    for (let pal of parrafo.split(/\s+/).filter(Boolean)) {
      const t = l ? l + ' ' + pal : pal;
      if (medir(t, fs) <= ancho) { l = t; continue; }
      if (l) lineas.push(l);
      while (medir(pal, fs) > ancho) {
        let i = pal.length - 1;
        while (i > 1 && medir(pal.slice(0, i), fs) > ancho) i--;
        lineas.push(pal.slice(0, i)); pal = pal.slice(i);
      }
      l = pal;
    }
    lineas.push(l);
  }
  return lineas;
}
function ajustarDesc(texto) {
  for (let fs = 4.2; fs >= 3.19; fs -= 0.2) {
    const lineas = partir(texto, fs, 63);
    if (lineas.length * fs * 1.2 <= 36) return { fs, lineas, cabe: true };
  }
  return { fs: 3.2, lineas: partir(texto, 3.2, 63).slice(0, 9), cabe: false };
}

function carasSVG(p, cara, clip) {
  const d = datos(p.key);
  if (cara === 'back') {
    const nombre = d.nombre || 'Nombre';
    const fsN = Math.min(7, 7 * 58 / Math.max(medir(nombre, 7, 600), 1));
    const a = ajustarDesc(d.desc || '');
    return `<polygon points="${puntos()}" fill="#dcbb8c"/>
      <g fill="#3d2615" text-anchor="middle" font-family="IBM Plex Sans, sans-serif">
      <text y="-21" font-size="${fsN}" font-weight="600">${esc(nombre)}</text>
      <text y="-14" font-size="4" font-weight="500">${p.rol.toUpperCase()}</text>
      ${a.lineas.map((l, i) => `<text y="${-5 + i * a.fs * 1.2}" font-size="${a.fs}">${esc(l)}</text>`).join('')}</g>`;
  }
  if (d.foto) {
    const esc0 = Math.max(FLAT / d.foto.w, 2 * R / d.foto.h) * d.z;
    const w = d.foto.w * esc0, h = d.foto.h * esc0;
    return `<clipPath id="${clip}"><polygon points="${puntos()}"/></clipPath>
      <g clip-path="url(#${clip})"><image href="${d.foto.url}" x="${-w / 2 + d.dx}" y="${-h / 2 + d.dy}" width="${w}" height="${h}" preserveAspectRatio="none"/></g>`;
  }
  return `<polygon points="${puntos()}" fill="#f4f1ea" stroke="#b9ad98" stroke-width="1" stroke-dasharray="4 3"/>
    <g fill="#b9ad98"><circle cy="-12" r="11"/><path d="M-20 18a20 17 0 0 1 40 0z"/></g>
    <text y="29" text-anchor="middle" font-size="7" font-weight="600" fill="#6d6455" font-family="IBM Plex Sans, sans-serif">${esc((d.nombre || p.rol).slice(0, 14))}</text>`;
}

function panalSVG(modo) {
  const g = celdas();
  const items = g.celdas.map((c, i) => {
    const marco = `<polygon points="${puntos(PITCH / Math.sqrt(3))}" fill="#1b1b1b"/>`;
    if (!c.p) return `<g transform="translate(${c.x} ${c.y})">${marco}<polygon points="${puntos()}" fill="${S.color}"/></g>`;
    const cara = modo === 'sim' ? (S.giradas.has(c.p.key) ? 'back' : 'front') : 'front';
    const marca = modo === 'edit' && S.sel === c.p.key ? `<polygon points="${puntos(R - 1.5)}" fill="none" stroke="#ff9d00" stroke-width="4"/>` : '';
    return `<g transform="translate(${c.x} ${c.y})">${marco}<g class="hex flip" data-key="${c.p.key}">${carasSVG(c.p, cara, modo + 'c' + i)}${marca}</g></g>`;
  }).join('');
  const pad = 6;
  return `<svg viewBox="${-pad} ${-pad} ${g.ancho + 2 * pad} ${g.alto + 2 * pad}" style="min-width:${Math.min(g.ancho * .85, 620)}px">${items}</svg>`;
}

function infoMedidas() {
  const g = celdas();
  const fotos = g.celdas.filter(c => c.p).length;
  return `<div class="info">${g.celdas.length} hexágonos · ${fotos} con foto · ${g.celdas.length - fotos} de color<br>
    Panal aprox. ${(g.ancho / 10).toFixed(0)} × ${(g.alto / 10).toFixed(0)} cm (sin soporte)</div>
    ${g.ancho > MAX_ANCHO_AVISO ? '<div class="warn">Árbol muy ancho para un mueble.</div>' : ''}`;
}

/* ---------- Pantallas ---------- */
const seg = (act, val, ops) => `<div class="seg">${ops.map(([v, t]) => `<button data-act="${act}" data-v="${v}" class="${String(v) === String(val) ? 'sel' : ''}">${t}</button>`).join('')}</div>`;
const stepper = (act, n, min, max, i = '') => `<div class="step"><button data-act="${act}" data-v="-1" data-i="${i}" ${n <= min ? 'disabled' : ''}>−</button><b>${n}</b><button data-act="${act}" data-v="1" data-i="${i}" ${n >= max ? 'disabled' : ''}>+</button></div>`;

const vistas = [
  () => `<h2>¿De qué familia es el árbol?</h2><p class="sub">Servirá para identificar tu diseño.</p>
    <div class="card"><label>Nombre de la familia</label><input type="text" id="familia" maxlength="40" placeholder="Familia García" value="${esc(S.familia)}"></div>
    <button data-act="demo">Ver un ejemplo ya relleno</button>`,

  () => `<h2>¿Quiénes encabezan el árbol?</h2><p class="sub">Irán en la fila superior.</p>
    <div class="card">${seg('abuelos', S.abuelos.map(Number).join(''), [['11', 'Abuelo y abuela'], ['10', 'Solo abuelo'], ['01', 'Solo abuela']])}</div>`,

  () => `<h2>¿Cuántos hijos tuvieron?</h2><p class="sub">Para cada uno, indica sus propios hijos. Ordénalos de mayor a menor.</p>
    <div class="card row"><span>Número de hijos</span>${stepper('nhijos', S.hijos.length, 1, 6)}</div>
    ${S.hijos.map((h, i) => `<div class="card"><b>Descendiente ${i + 1}</b>
      <label>Es…</label>${seg('sexo' + i, h.g, [['m', 'Hijo'], ['f', 'Hija']])}
      <label>¿Quieres incluir a su pareja?</label>${seg('pareja' + i, h.pareja ? 1 : 0, [[0, 'No'], [1, 'Sí']])}
      <div class="row" style="margin-top:14px"><span>¿Cuántos hijos tiene?</span>${stepper('nnietos', h.nietos.length, 0, 6, i)}</div>
      ${h.nietos.map((n, j) => `<div class="row" style="margin-top:8px"><span class="sub" style="margin:0">Nieto/a ${j + 1}</span>${seg(`sn${i}_${j}`, n.g, [['m', 'Nieto'], ['f', 'Nieta']])}</div>`).join('')}
    </div>`).join('')}`,

  () => `<h2>Elige el aspecto del panal</h2><p class="sub">Toca una persona y muévela dentro de su generación.</p>
    <div class="card">
      <label style="margin-top:0">Separación entre familias</label>${seg('sep', S.sep, [[0, 'Juntas'], [1, 'Un hexágono de color']])}
      <label>Borde de color alrededor</label>${seg('borde', S.borde, [[0, 'Sin borde'], [1, 'Con borde']])}
      <label>Color</label><div class="seg">${COLORES.map(c => `<button class="sw ${c === S.color ? 'sel' : ''}" data-act="color" data-v="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join('')}</div>
    </div>
    <div class="stage">${panalSVG('edit')}</div>${infoMedidas()}
    <div class="seg"><button data-act="mover" data-v="-1" ${S.sel ? '' : 'disabled'}>◀ Mover</button><button data-act="mover" data-v="1" ${S.sel ? '' : 'disabled'}>Mover ▶</button><button data-act="auto">Distribución automática</button></div>`,

  () => {
    const pers = listaPersonas();
    if (!pers.some(p => p.key === S.sel)) S.sel = pers[0].key;
    const i = pers.findIndex(p => p.key === S.sel), p = pers[i], d = datos(p.key);
    return `<h2>Cuéntanos quién es cada uno</h2><p class="sub">Toca un hexágono. Los cambios se ven al momento.</p>
    <div class="stage">${panalSVG('edit')}</div>
    <div class="card" style="margin-top:12px" id="ficha"><div class="row"><b>${p.rol} · ${i + 1} de ${pers.length}</b><div class="seg"><button data-act="pers" data-v="-1" ${i ? '' : 'disabled'}>◀</button><button data-act="pers" data-v="1" ${i < pers.length - 1 ? '' : 'disabled'}>▶</button></div></div>
      <label>Nombre</label><input type="text" id="nombre" maxlength="30" value="${esc(d.nombre)}">
      <label>Descripción (cara trasera)</label><textarea id="desc" rows="4" maxlength="${MAX_DESC}" placeholder="Dónde nació, a qué se dedica, qué le gusta…">${esc(d.desc)}</textarea><div class="cnt" id="cnt"></div>
      <label>Foto</label><input type="file" id="file" accept="image/*">
      ${d.foto ? `<label>Zoom (arrastra la foto para encuadrar)</label><input type="range" id="zoom" min="1" max="3" step="0.01" value="${d.z}">` : ''}
    </div>
    <div class="edit"><div class="card prev"><label style="margin-top:0">Cara delantera</label><svg id="crop" viewBox="-42 -48 84 96"></svg><div id="avFoto"></div></div>
      <div class="card prev"><label style="margin-top:0">Cara trasera</label><svg id="back" viewBox="-42 -48 84 96"></svg><div id="avTexto"></div></div></div>`;
  },

  () => {
    const faltas = listaPersonas().flatMap(p => {
      const d = datos(p.key), f = [];
      if (!d.nombre.trim()) f.push('nombre');
      if (!d.foto) f.push('foto');
      if (!d.desc.trim()) f.push('descripción');
      else if (!ajustarDesc(d.desc).cabe) f.push('acortar el texto');
      if (f.length) return [`<li><a href="#" data-act="ir" data-v="${p.key}" style="color:var(--bad)">${esc(d.nombre || p.rol)}</a>: ${f.join(', ')}</li>`];
      return [];
    });
    return `<h2>${esc(S.familia || 'Tu árbol familiar')}</h2><p class="sub">Toca un hexágono para girarlo.</p>
    <div class="stage" id="sim">${panalSVG('sim')}</div>${infoMedidas()}
    <div class="seg" style="margin-bottom:12px"><button data-act="cara" data-v="front" class="${S.cara === 'front' ? 'sel' : ''}">Todas delante</button><button data-act="cara" data-v="back" class="${S.cara === 'back' ? 'sel' : ''}">Todas detrás</button></div>
    ${faltas.length ? `<div class="card"><b>Pendiente</b><ul>${faltas.join('')}</ul></div>` : '<div class="card ok">Todas las fichas están completas.</div>'}
    <div class="card"><label class="chk"><input type="checkbox" id="aprobar" ${S.aprobado ? 'checked' : ''} ${faltas.length ? 'disabled' : ''}>He revisado fotos, nombres y textos de ambas caras.</label>
    <button class="pri" id="enviar" data-act="enviar" style="margin-top:12px;width:100%" ${S.aprobado && !faltas.length ? '' : 'disabled'}>Aprobar diseño</button><div id="msg"></div></div>`;
  }
];

function render() {
  $('#bar').innerHTML = PASOS.map((_, i) => `<i class="${i <= S.paso ? 'on' : ''}"></i>`).join('');
  $('#app').innerHTML = vistas[S.paso]() + `<div class="nav">${S.paso ? '<button data-act="paso" data-v="-1">← Atrás</button>' : '<span></span>'}${S.paso < PASOS.length - 1 ? `<button class="pri" data-act="paso" data-v="1">${PASOS[S.paso + 1]} →</button>` : ''}</div>`;
  if (S.paso === 4) previas();
}

function previas() {
  const p = listaPersonas().find(q => q.key === S.sel), d = datos(p.key);
  $('#crop').innerHTML = carasSVG(p, 'front', 'cropclip');
  $('#back').innerHTML = carasSVG(p, 'back', 'x');
  $('#cnt').textContent = `${d.desc.length} / ${MAX_DESC}`;
  $('#avTexto').innerHTML = ajustarDesc(d.desc).cabe ? '' : '<div class="warn">El texto no cabe. Acórtalo.</div>';
  let av = '';
  if (d.foto) {
    const esc0 = Math.max(FLAT / d.foto.w, 2 * R / d.foto.h) * d.z;
    const w = FLAT / esc0, h = 2 * R / esc0;
    av = (w < PX_W * .98 || h < PX_H * .98)
      ? '<div class="warn">Poca resolución: puede verse borrosa. Reduce el zoom o usa otra foto.</div>'
      : '<div class="ok">Resolución suficiente.</div>';
  }
  $('#avFoto').innerHTML = av;
}
const refrescarPanal = () => { const s = $('.stage'), x = s.scrollLeft; s.innerHTML = panalSVG('edit'); s.scrollLeft = x; };
const limitar = d => {
  const e = Math.max(FLAT / d.foto.w, 2 * R / d.foto.h) * d.z;
  const mx = (d.foto.w * e - FLAT) / 2, my = (d.foto.h * e - 2 * R) / 2;
  d.dx = Math.max(-mx, Math.min(mx, d.dx)); d.dy = Math.max(-my, Math.min(my, d.dy));
};

function girar(keys, aDetras) {
  const els = keys.filter(k => S.giradas.has(k) !== aDetras)
    .map(k => $(`#sim [data-key="${k}"]`)).filter(Boolean);
  els.forEach(e => e.style.transform = 'scaleX(0)');
  keys.forEach(k => aDetras ? S.giradas.add(k) : S.giradas.delete(k));
  setTimeout(() => {
    const s = $('#sim'); if (!s) return;
    const x = s.scrollLeft;
    s.innerHTML = panalSVG('sim'); s.scrollLeft = x;
    const nuevos = els.map(e => $(`#sim [data-key="${e.dataset.key}"]`));
    nuevos.forEach(e => { e.style.transition = 'none'; e.style.transform = 'scaleX(0)'; });
    s.getBoundingClientRect();
    nuevos.forEach(e => { e.style.transition = ''; e.style.transform = ''; });
  }, 230);
}

function ejemplo() {
  S.familia = 'Familia García';
  S.abuelos = [true, true]; S.orden = {}; S.personas = {};
  const h = (g, ns) => ({ id: ++uid, g, pareja: false, nietos: ns.map(s => ({ id: ++uid, g: s })) });
  S.hijos = [h('m', ['m', 'f', 'm']), h('f', ['f', 'm'])];
  const nombres = ['Antonio', 'Carmen', 'Luis', 'Pablo', 'Lucía', 'Hugo', 'Marta', 'Sara', 'Daniel'];
  const fondos = ['#7d98a8', '#b58a82', '#8c9c78', '#b59a68', '#8f86a6'];
  listaPersonas().forEach((p, i) => {
    const c = document.createElement('canvas'); c.width = 1000; c.height = 1155;
    const x = c.getContext('2d');
    x.fillStyle = fondos[i % 5]; x.fillRect(0, 0, 1000, 1155);
    x.fillStyle = '#f0dcc6'; x.beginPath(); x.arc(500, 470, 190, 0, 7); x.fill();
    x.fillStyle = '#39434d'; x.beginPath(); x.ellipse(500, 1060, 370, 340, 0, Math.PI, 0); x.fill();
    Object.assign(datos(p.key), { nombre: nombres[i], desc: 'Texto de ejemplo: aquí se cuenta quién es, dónde nació, a qué se dedica y qué recuerdo quiere dejar a la familia.', foto: { url: c.toDataURL('image/jpeg', .8), w: 1000, h: 1155 } });
  });
  S.sel = null;
}

/* ---------- Eventos ---------- */
document.addEventListener('click', e => {
  const hex = e.target.closest('.stage .hex');
  if (hex) {
    const k = hex.dataset.key;
    if (S.paso === 5) return girar([k], !S.giradas.has(k));
    S.sel = k;
    const s = $('.stage'), x = s.scrollLeft; render(); $('.stage').scrollLeft = x;
    return;
  }
  const b = e.target.closest('[data-act]');
  if (!b) return;
  e.preventDefault();
  const a = b.dataset.act, v = b.dataset.v, i = +b.dataset.i;
  const estructura = () => { S.orden = {}; S.sel = null; S.aprobado = false; };
  let m;
  if (a === 'paso') { S.paso += +v; S.giradas.clear(); S.cara = 'front'; S.aprobado = false; render(); return scrollTo(0, 0); }
  if (a === 'demo') { ejemplo(); S.paso = 3; }
  else if (a === 'abuelos') { S.abuelos = [v[0] === '1', v[1] === '1']; estructura(); }
  else if (a === 'nhijos') { +v > 0 ? S.hijos.push({ id: ++uid, g: 'm', pareja: false, nietos: [] }) : S.hijos.pop(); estructura(); }
  else if (a === 'nnietos') { +v > 0 ? S.hijos[i].nietos.push(nuevoNieto()) : S.hijos[i].nietos.pop(); estructura(); }
  else if ((m = a.match(/^sexo(\d+)$/))) S.hijos[m[1]].g = v;
  else if ((m = a.match(/^pareja(\d+)$/))) { S.hijos[m[1]].pareja = v === '1'; estructura(); }
  else if ((m = a.match(/^sn(\d+)_(\d+)$/))) S.hijos[m[1]].nietos[m[2]].g = v;
  else if (a === 'sep') { S.sep = +v; S.orden = {}; }
  else if (a === 'borde') S.borde = +v;
  else if (a === 'color') S.color = v;
  else if (a === 'mover') mover(S.sel, +v);
  else if (a === 'auto') S.orden = {};
  else if (a === 'pers') { const l = listaPersonas(); S.sel = l[l.findIndex(p => p.key === S.sel) + +v].key; }
  else if (a === 'ir') { S.sel = v; S.paso = 4; }
  else if (a === 'cara') {
    S.cara = v;
    document.querySelectorAll('[data-act="cara"]').forEach(x => x.classList.toggle('sel', x.dataset.v === v));
    return girar(listaPersonas().map(p => p.key), v === 'back');
  }
  else if (a === 'enviar') { $('#msg').innerHTML = '<div class="ok">Diseño aprobado. En esta muestra no se envía nada.</div>'; return; }
  render();
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'familia') { S.familia = t.value; return; }
  if (t.id === 'aprobar') { S.aprobado = t.checked; $('#enviar').disabled = !t.checked; return; }
  if (!['nombre', 'desc', 'zoom'].includes(t.id)) return;
  const d = datos(S.sel);
  if (t.id === 'nombre') d.nombre = t.value;
  if (t.id === 'desc') d.desc = t.value;
  if (t.id === 'zoom') { d.z = +t.value; limitar(d); }
  previas(); refrescarPanal();
});

document.addEventListener('change', e => {
  if (e.target.id !== 'file' || !e.target.files[0]) return;
  const key = S.sel, url = URL.createObjectURL(e.target.files[0]), img = new Image();
  img.onload = () => { Object.assign(datos(key), { foto: { url, w: img.naturalWidth, h: img.naturalHeight }, z: 1, dx: 0, dy: 0 }); render(); };
  img.onerror = () => alert('No se puede abrir esa imagen. Prueba con JPG o PNG.');
  img.src = url;
});

let arrastre = null;
document.addEventListener('pointerdown', e => {
  const s = e.target.closest('#crop');
  if (!s || !datos(S.sel).foto) return;
  s.setPointerCapture(e.pointerId);
  arrastre = { x: e.clientX, y: e.clientY, k: 84 / s.getBoundingClientRect().width };
});
document.addEventListener('pointermove', e => {
  if (!arrastre) return;
  const d = datos(S.sel);
  d.dx += (e.clientX - arrastre.x) * arrastre.k; d.dy += (e.clientY - arrastre.y) * arrastre.k;
  arrastre.x = e.clientX; arrastre.y = e.clientY;
  limitar(d); previas();
});
['pointerup', 'pointercancel'].forEach(n => document.addEventListener(n, () => { if (arrastre) { arrastre = null; refrescarPanal(); } }));

window.addEventListener('beforeunload', e => { if (Object.values(S.personas).some(d => d.foto || d.nombre)) e.preventDefault(); });

render();
document.fonts && document.fonts.ready.then(render);
