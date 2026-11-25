// PANAL FAMILIAR · configurador (muestra) · v1.2
// Sin servidor: los datos y fotos solo viven en memoria.
'use strict';

const MAX_DESC = 180;
// Medidas provisionales (mm)
const FLAT = 80, R = FLAT / Math.sqrt(3), PITCH = 85, VPITCH = PITCH * Math.sqrt(3) / 2;
const MAX_ANCHO_AVISO = 700;
const PX_W = Math.round(FLAT / 25.4 * 300), PX_H = Math.round(2 * R / 25.4 * 300);
const COLORES = ['#8a9a7b', '#c58b5c', '#5f7f8f', '#a8605a', '#d8c7a3', '#3f4448'];
const ORO = '#c9a227';
const PALETA = [['#d62828', 'Rojo'], ['#1d5fd1', 'Azul'], ['#1b8a3a', 'Verde'], ['#7b2cbf', 'Morado'], ['#e0458c', 'Rosa'], ['#00a6a6', 'Turquesa'], ['#7a4a21', 'Marrón']];
const MAX_LADO = 2000;
const PASOS = ['Familia', 'Abuelos', 'Hijos', 'Distribución', 'Personas', 'Revisión'];

const S = {
  paso: 0, familia: '', abuelos: [true, true],
  hijos: [{ g: 'm', pareja: false, nietos: [] }],
  sep: 1, borde: 1, marco: 3, guia: true, color: COLORES[0],
  personas: {}, orden: {}, sel: null, cara: 'front', giradas: new Set(), aprobado: false
};

const $ = s => document.querySelector(s);
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let uid = 0;
const nuevoNieto = () => ({ id: ++uid, g: 'm' });
S.hijos[0].id = ++uid;
S.hijos[0].color = PALETA[0][0];
const colorLibre = () => (PALETA.find(([c]) => !S.hijos.some(h => h.color === c)) || PALETA[0])[0];
const colorDe = p => p.gen === 0 ? ORO : S.hijos[p.rama].color;

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
const datos = key => S.personas[key] || (S.personas[key] = { nombre: '', desc: '', foto: null });

/* ---------- Distribución ---------- */
function distribucionAuto() {
  const pos = {};
  const anchos = S.hijos.map(h => Math.max(h.nietos.length, h.pareja ? 2 : 1));
  const nAb = S.abuelos.filter(Boolean).length;
  const usado = anchos.reduce((a, b) => a + b, 0) + S.sep * (anchos.length - 1);
  const hayNietos = S.hijos.some(h => h.nietos.length);
  // N: posiciones de la fila de nietos. Abuelos e hijos tienen una más si hay nietos.
  const N = Math.max(usado, hayNietos ? nAb - 1 : nAb);
  const Na = N + (hayNietos ? 1 : 0);
  let x = Math.floor((N - usado) / 2);
  S.hijos.forEach((h, i) => {
    const w = anchos[i], b = h.pareja ? 2 : 1;
    const xh = x + Math.floor((w - b + (hayNietos ? 1 : 0)) / 2);
    pos['h' + h.id] = xh;
    if (h.pareja) pos['p' + h.id] = xh + 1;
    const xn = x + Math.floor((w - h.nietos.length) / 2);
    h.nietos.forEach((n, j) => pos['n' + n.id] = xn + j);
    x += w + S.sep;
  });
  let xa = Math.floor((Na - nAb) / 2);
  S.abuelos.forEach((on, i) => { if (on) pos['a' + i] = xa++; });
  return { pos, N, Na };
}

function distribucion() {
  const auto = distribucionAuto();
  const pos = {};
  for (const k in auto.pos) pos[k] = k in S.orden ? S.orden[k] : auto.pos[k];
  return { pos, N: auto.N, Na: auto.Na };
}

function celdas() {
  const { pos, N, Na } = distribucion();
  const pers = listaPersonas();
  const m = S.borde;
  const gens = [0, 1, 2].filter(g => pers.some(p => p.gen === g));
  const largo = Na + 2 * m;
  const filas = [];
  if (m) filas.push(null);
  gens.forEach(g => { if (g === 1) filas.push(null); filas.push(g); });
  if (m) filas.push(null);
  const primera = filas.indexOf(0);
  const out = [];
  filas.forEach((g, f) => {
    // Filas alternas: completas, o con una pieza menos y desplazadas medio hexágono
    const desplazada = Math.abs(f - primera) % 2 === 1;
    const n = desplazada ? Math.max(largo - 1, 1) : largo;
    const off = desplazada ? PITCH / 2 : 0;
    for (let c = 0; c < n; c++) {
      const p = g !== null ? pers.find(q => q.gen === g && pos[q.key] === c - m) : null;
      out.push({ x: c * PITCH + off + FLAT / 2, y: f * VPITCH + R, p, gen: g, slot: c - m });
    }
  });
  const ancho = Math.max(...out.map(c => c.x)) + FLAT / 2;
  const alto = (filas.length - 1) * VPITCH + 2 * R;
  return { celdas: out, ancho, alto, N };
}

function mover(key, dir) {
  const { pos, N, Na } = distribucion();
  const pers = listaPersonas();
  const yo = pers.find(p => p.key === key);
  const destino = pos[key] + dir;
  if (destino < 0 || destino >= (yo.gen === 2 ? N : Na)) return;
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
// Ancho útil (mm) a la altura y, descontado el marco
function anchoEn(y) {
  const ri = R - S.marco * 2 / Math.sqrt(3), wi = FLAT / 2 - S.marco;
  const ay = Math.abs(y);
  const medio = ay <= ri / 2 ? wi : wi * Math.max(ri - ay, 0) / (ri / 2);
  return Math.min(63, 2 * medio - 4);
}
function partir(texto, fs) {
  const lineas = [];
  const ancho = () => Math.max(anchoEn(-5 + lineas.length * fs * 1.2 + 1), 8);
  for (const parrafo of texto.split('\n')) {
    let l = '';
    for (let pal of parrafo.split(/\s+/).filter(Boolean)) {
      const t = l ? l + ' ' + pal : pal;
      if (medir(t, fs) <= ancho()) { l = t; continue; }
      if (l) lineas.push(l);
      while (medir(pal, fs) > ancho()) {
        let i = pal.length - 1;
        while (i > 1 && medir(pal.slice(0, i), fs) > ancho()) i--;
        lineas.push(pal.slice(0, i)); pal = pal.slice(i);
      }
      l = pal;
    }
    lineas.push(l);
  }
  return lineas;
}
const entra = (lineas, fs) => lineas.every((l, i) => {
  const y = -5 + i * fs * 1.2 + 1;
  return y <= 32 && medir(l, fs) <= anchoEn(y) + .1;
});
function ajustarDesc(texto) {
  let lineas, fs;
  for (const t of [4.2, 4.0, 3.8, 3.6, 3.4, 3.2]) {
    fs = t; lineas = partir(texto, fs);
    if (entra(lineas, fs)) return { fs, lineas, cabe: true };
  }
  return { fs, lineas: lineas.filter((_, i) => -5 + i * fs * 1.2 <= 31), cabe: false };
}

const marcoSVG = p => `<polygon points="${puntos(R - S.marco / Math.sqrt(3))}" fill="none" stroke="${colorDe(p)}" stroke-width="${S.marco}"/>`;

function carasSVG(p, cara, clip) {
  return contenidoSVG(p, cara, clip) + marcoSVG(p);
}
function contenidoSVG(p, cara, clip) {
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
    const e = escala(d), w = d.foto.w * e, h = d.foto.h * e;
    return `<clipPath id="${clip}"><polygon points="${puntos()}"/></clipPath>
      <g clip-path="url(#${clip})"><polygon points="${puntos()}" fill="${d.fondo === 'crema' ? CREMA : '#ffffff'}"/>
      <g transform="translate(${d.dx} ${d.dy}) rotate(${d.rot})"><image href="${d.foto.url}" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" preserveAspectRatio="none"/></g></g>`;
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
    const marca = modo === 'edit' && S.sel === c.p.key ? `<polygon points="${puntos(R + 1.2)}" fill="none" stroke="#fff" stroke-width="3"/><polygon points="${puntos(R + 1.2)}" fill="none" stroke="#000" stroke-width="3" stroke-dasharray="6 5"/>` : '';
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

const swatches = (act, sel, lista, bloqueado) => `<div class="seg">${lista.map(([c, n]) => `<button class="sw ${c === sel ? 'sel' : ''}" data-act="${act}" data-v="${c}" style="background:${c}" title="${n}" aria-label="${n}" ${bloqueado(c) ? 'disabled' : ''}></button>`).join('')}</div>`;
const rgb = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const parecidos = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i])) < 75;

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
      <label>Color de su familia (borde de ${h.g === 'm' ? 'él' : 'ella'} y de sus hijos)</label>${swatches('rama' + i, h.color, PALETA, c => S.hijos.some((o, j) => j !== i && o.color === c) || parecidos(c, S.color))}
      <label>¿Quieres incluir a su pareja?</label>${seg('pareja' + i, h.pareja ? 1 : 0, [[0, 'No'], [1, 'Sí']])}
      <div class="row" style="margin-top:14px"><span>¿Cuántos hijos tiene?</span>${stepper('nnietos', h.nietos.length, 0, 6, i)}</div>
      ${h.nietos.map((n, j) => `<div class="row" style="margin-top:8px"><span class="sub" style="margin:0">Nieto/a ${j + 1}</span>${seg(`sn${i}_${j}`, n.g, [['m', 'Nieto'], ['f', 'Nieta']])}</div>`).join('')}
    </div>`).join('')}`,

  () => `<h2>Elige el aspecto del panal</h2><p class="sub">Toca una persona y muévela dentro de su generación.</p>
    <div class="card">
      <label style="margin-top:0">Separación entre familias</label>${seg('sep', S.sep, [[0, 'Juntas'], [1, 'Un hexágono de color']])}
      <label>Borde de color alrededor</label>${seg('borde', S.borde, [[0, 'Sin borde'], [1, 'Con borde']])}
      <label>Color de relleno</label>${swatches('color', S.color, COLORES.map(c => [c, 'Relleno']), c => S.hijos.some(h => parecidos(c, h.color)))}
      <label>Anchura del borde de familia</label>${seg('marco', S.marco, [[3, '3 mm'], [4, '4 mm']])}
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
      ${ocupado === p.key ? '<div class="ok">Preparando la foto…</div>' : ''}
      ${d.foto && !pincel ? controlesFoto(d) : ''}
    </div>
    ${pincel ? editorPincel() : ''}
    <div class="edit"><div class="card prev"><label style="margin-top:0">Cara delantera</label><svg id="crop" viewBox="-42 -48 84 96"></svg>
      ${d.foto ? `<label class="chk" style="margin-top:8px;font-size:13px"><input type="checkbox" id="guia" ${S.guia ? 'checked' : ''}>Ver guía de cabeza y ojos</label>` : ''}<div id="avFoto"></div>
      ${d.foto ? `<label class="chk" style="margin-top:10px"><input type="checkbox" id="fotoOk" ${d.ok ? 'checked' : ''}>La foto ha quedado bien.</label>` : ''}</div>
      <div class="card prev"><label style="margin-top:0">Cara trasera</label><svg id="back" viewBox="-42 -48 84 96"></svg><div id="avTexto"></div></div></div>`;
  },

  () => {
    const faltas = listaPersonas().flatMap(p => {
      const d = datos(p.key), f = [];
      if (!d.nombre.trim()) f.push('nombre');
      if (!d.foto) f.push('foto');
      else if (!d.ok) f.push('dar el visto bueno a la foto');
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
  if (S.paso === 4) { previas(); if (pincel) pintarPincel(); }
}

function avisosFoto(d) {
  const e = escala(d), av = [];
  if (e * 300 / 25.4 > 1.02) av.push('Poca resolución: puede verse borrosa. Reduce el tamaño o usa otra foto.');
  const a = -d.rot * Math.PI / 180, w = d.foto.w * e / 2, h = d.foto.h * e / 2;
  const fuera = [...Array(6)].map((_, i) => {
    const x = R * Math.sin(i * Math.PI / 3) - d.dx, y = -R * Math.cos(i * Math.PI / 3) - d.dy;
    const u = x * Math.cos(a) - y * Math.sin(a), v = x * Math.sin(a) + y * Math.cos(a);
    return { abajo: v > h + .3, otro: v < -h - .3 || Math.abs(u) > w + .3 };
  });
  if (!d.mask || d.fondo === 'original') {
    if (fuera.some(f => f.abajo || f.otro)) av.push('La foto no llena el hexágono: se verá su borde.');
  } else {
    if (fuera.some(f => f.abajo) && d.toca.abajo) av.push('Se ve el corte inferior de los hombros. Baja o amplía la foto.');
    if (d.toca.arriba) av.push('La persona toca el borde superior: comprueba que la cabeza esté entera.');
    if (d.toca.lados && fuera.some(f => f.otro)) av.push('Puede verse un corte en un lateral. Comprueba la vista.');
  }
  return av;
}

function previas() {
  const p = listaPersonas().find(q => q.key === S.sel), d = datos(p.key);
  const guia = d.foto && S.guia ? `<g fill="none" stroke="#00b7ff" stroke-width=".6" stroke-dasharray="2.5 2" pointer-events="none"><ellipse cy="-7" rx="17" ry="23"/><path d="M-26-10h52"/></g>` : '';
  $('#crop').innerHTML = carasSVG(p, 'front', 'cropclip') + guia;
  $('#back').innerHTML = carasSVG(p, 'back', 'x');
  $('#cnt').textContent = `${d.desc.length} / ${MAX_DESC}`;
  $('#avTexto').innerHTML = ajustarDesc(d.desc).cabe ? '' : '<div class="warn">El texto no cabe. Acórtalo.</div>';
  let av = '';
  if (d.foto) {
    const l = avisosFoto(d);
    av = l.length ? l.map(t => `<div class="warn">${t}</div>`).join('') : '<div class="ok">Sin avisos de encuadre ni resolución.</div>';
  }
  $('#avFoto').innerHTML = av;
}
function cambiada(d) {
  d.ok = false; S.aprobado = false;
  const c = $('#fotoOk'); if (c) c.checked = false;
}
const refrescarPanal = () => { const s = $('.stage'), x = s.scrollLeft; s.innerHTML = panalSVG('edit'); s.scrollLeft = x; };
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
  const h = (g, ns, color) => ({ id: ++uid, g, color, pareja: false, nietos: ns.map(s => ({ id: ++uid, g: s })) });
  S.hijos = [h('m', ['m', 'f', 'm'], PALETA[0][0]), h('f', ['f', 'm'], PALETA[1][0])];
  const nombres = ['Antonio', 'Carmen', 'Luis', 'Pablo', 'Lucía', 'Hugo', 'Marta', 'Sara', 'Daniel'];
  const fondos = ['#7d98a8', '#b58a82', '#8c9c78', '#b59a68', '#8f86a6'];
  listaPersonas().forEach((p, i) => {
    const c = document.createElement('canvas'); c.width = 1000; c.height = 1155;
    const x = c.getContext('2d');
    x.fillStyle = fondos[i % 5]; x.fillRect(0, 0, 1000, 1155);
    x.fillStyle = '#f0dcc6'; x.beginPath(); x.arc(500, 470, 190, 0, 7); x.fill();
    x.fillStyle = '#39434d'; x.beginPath(); x.ellipse(500, 1060, 370, 340, 0, Math.PI, 0); x.fill();
    const d = datos(p.key);
    Object.assign(d, { nombre: nombres[i], desc: 'Texto de ejemplo: aquí se cuenta quién es, dónde nació, a qué se dedica y qué recuerdo quiere dejar a la familia.' });
    nuevaFoto(d, c); d.ok = true;
  });
  S.sel = null;
}

/* ---------- Editor de fotos ---------- */
const CREMA = '#f6efe0';
let ocupado = null, pincel = null, segmentador = null, cola = Promise.resolve();
const lienzo = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
const escala = d => Math.max(FLAT / d.foto.w, 2 * R / d.foto.h) * d.z;
const copia = c => { const n = lienzo(c.width, c.height); n.getContext('2d').drawImage(c, 0, 0); return n; };

function cargarSegmentador() {
  if (segmentador) return segmentador;
  segmentador = new Promise((ok, mal) => {
    const s = document.createElement('script');
    s.src = 'LIBS/selfie_segmentation.js';
    s.onload = ok; s.onerror = () => { s.remove(); mal(new Error('No se pudo cargar')); };
    document.head.appendChild(s);
  }).then(async () => {
    const m = new SelfieSegmentation({ locateFile: f => 'LIBS/' + f });
    m.setOptions({ modelSelection: 0 });
    await m.initialize();
    return m;
  });
  segmentador.catch(() => segmentador = null);
  return segmentador;
}

// Devuelve un lienzo cuyo canal alfa es la silueta. Una foto cada vez.
function mascara(img) {
  const tarea = cola.then(async () => {
    const m = await cargarSegmentador();
    let res = null;
    m.onResults(r => res = r);
    await m.send({ image: img });
    if (!res) throw new Error('Sin resultado');
    const c = lienzo(img.width, img.height), x = c.getContext('2d');
    x.drawImage(res.segmentationMask, 0, 0, c.width, c.height);
    const px = x.getImageData(0, 0, c.width, c.height);
    // Contraste de la máscara para reducir halos
    for (let i = 3; i < px.data.length; i += 4) {
      const t = Math.min(1, Math.max(0, (px.data[i] / 255 - .25) / .5));
      px.data[i] = Math.round(255 * t * t * (3 - 2 * t));
    }
    x.putImageData(px, 0, 0);
    return c;
  });
  cola = tarea.catch(() => {});
  return tarea;
}

function ajustada(d) {
  if (!d.brillo && !d.contraste) return d.orig;
  const c = copia(d.orig), x = c.getContext('2d'), px = x.getImageData(0, 0, c.width, c.height);
  const f = 1 + d.contraste / 100, lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) lut[v] = (v - 128) * f + 128 + d.brillo;
  for (let i = 0; i < px.data.length; i += 4) for (let k = 0; k < 3; k++) px.data[i + k] = lut[px.data[i + k]];
  x.putImageData(px, 0, 0);
  return c;
}

function bordesTocados(m) {
  const w = m.width, h = m.height, a = m.getContext('2d').getImageData(0, 0, w, h).data;
  const parte = (n, f) => { let t = 0; for (let i = 0; i < n; i++) t += a[f(i) * 4 + 3] > 128; return t / n > .02; };
  return {
    arriba: parte(w, i => i), abajo: parte(w, i => (h - 1) * w + i),
    lados: parte(h, i => i * w) || parte(h, i => i * w + w - 1)
  };
}

function componer(d) {
  const base = ajustada(d), conMascara = d.mask && d.fondo !== 'original';
  const c = lienzo(base.width, base.height), x = c.getContext('2d');
  x.drawImage(base, 0, 0);
  if (conMascara) {
    x.globalCompositeOperation = 'destination-in'; x.drawImage(d.mask, 0, 0);
    x.globalCompositeOperation = 'destination-over';
    x.fillStyle = d.fondo === 'crema' ? CREMA : '#fff'; x.fillRect(0, 0, c.width, c.height);
    d.toca = bordesTocados(d.mask);
  }
  d.foto = { url: c.toDataURL('image/jpeg', .92), w: c.width, h: c.height };
}

function nuevaFoto(d, orig) {
  Object.assign(d, { orig, mask: null, auto: null, fondo: 'original', z: 1, dx: 0, dy: 0, rot: 0, brillo: 0, contraste: 0, ok: false });
  componer(d);
}

async function quitarFondo(key, fondo) {
  const d = datos(key), orig = d.orig;
  if (!d.mask) {
    ocupado = key; if (S.paso === 4) render();
    try {
      const m = await mascara(orig);
      if (d.orig !== orig) return;
      d.mask = m; d.auto = copia(m);
    } catch (err) {
      console.error(err);
      alert('No se ha podido quitar el fondo en este dispositivo. Se mantiene la foto original.');
      return;
    } finally { if (ocupado === key) ocupado = null; if (S.paso === 4) render(); }
  }
  d.fondo = fondo; componer(d); d.ok = false;
  if (S.paso === 4) render();
}

const deslizador = (id, texto, min, max, paso, val) => `<label>${texto}</label><input type="range" id="${id}" min="${min}" max="${max}" step="${paso}" value="${val}">`;
const controlesFoto = d => `<label>Fondo</label>${seg('fondo', d.fondo, [['original', 'Original'], ['blanco', 'Blanco'], ['crema', 'Crema']])}
  ${d.mask && d.fondo !== 'original' ? '<div style="margin-top:8px"><button data-act="pincel">✎ Retocar el recorte</button></div>' : ''}
  ${deslizador('z', 'Tamaño (arrastra la foto para colocarla)', .4, 3, .01, d.z)}
  ${deslizador('rot', 'Enderezar', -30, 30, .5, d.rot)}
  ${deslizador('brillo', 'Luz', -60, 60, 1, d.brillo)}
  ${deslizador('contraste', 'Contraste', -40, 60, 1, d.contraste)}
  <div style="margin-top:8px"><button data-act="reajustar">Restablecer encuadre y luz</button></div>`;

const editorPincel = () => `<div class="card"><div class="row"><b>Retocar el recorte</b><button class="pri" data-act="pincelFin">Listo</button></div>
  <p class="sub" style="margin:6px 0">Lo eliminado se ve atenuado.</p>
  ${seg('modo', pincel.modo, [['borrar', 'Borrar'], ['recuperar', 'Recuperar'], ['mover', 'Desplazar vista']])}
  <label>Ampliación</label>${seg('lupa', pincel.lupa, [[1, '1×'], [2, '2×'], [4, '4×']])}
  ${deslizador('grosor', 'Grosor del pincel', 4, 60, 1, pincel.grosor)}
  <div class="seg" style="margin:8px 0"><button data-act="deshacer" ${pincel.hist.length ? '' : 'disabled'}>↶ Deshacer</button><button data-act="recorteAuto">Volver al automático</button></div>
  <div id="visor"><canvas id="lz" style="width:${pincel.lupa * 100}%;touch-action:${pincel.modo === 'mover' ? 'auto' : 'none'}"></canvas></div></div>`;

function pintarPincel() {
  const d = datos(S.sel), c = $('#lz');
  if (c.width !== d.orig.width) { c.width = d.orig.width; c.height = d.orig.height; }
  const x = c.getContext('2d'), base = pincel.base;
  x.globalCompositeOperation = 'source-over';
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  x.globalAlpha = .28; x.drawImage(base, 0, 0); x.globalAlpha = 1;
  const t = pincel.tmp, y = t.getContext('2d');
  y.globalCompositeOperation = 'source-over'; y.clearRect(0, 0, t.width, t.height); y.drawImage(base, 0, 0);
  y.globalCompositeOperation = 'destination-in'; y.drawImage(d.mask, 0, 0);
  x.drawImage(t, 0, 0);
}
function trazo(a, b) {
  const x = datos(S.sel).mask.getContext('2d');
  x.save();
  x.globalCompositeOperation = pincel.modo === 'borrar' ? 'destination-out' : 'source-over';
  x.strokeStyle = '#000'; x.lineCap = 'round'; x.lineJoin = 'round';
  x.lineWidth = pincel.radio;
  x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x + .01, b.y); x.stroke();
  x.restore();
  pintarPincel();
}
const punto = (e, c) => { const r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * c.width / r.width, y: (e.clientY - r.top) * c.height / r.height }; };
function cerrarPincel() {
  if (!pincel) return;
  const d = datos(pincel.key); pincel = null; componer(d); d.ok = false;
}

/* ---------- Eventos ---------- */
document.addEventListener('click', e => {
  const hex = e.target.closest('.stage .hex');
  if (hex) {
    const k = hex.dataset.key;
    if (S.paso === 5) return girar([k], !S.giradas.has(k));
    cerrarPincel();
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
  if (a === 'paso' || a === 'pers' || a === 'ir') cerrarPincel();
  if (a === 'fondo') {
    const d = datos(S.sel);
    if (ocupado) return;
    if (v === 'original') { d.fondo = v; componer(d); cambiada(d); return render(); }
    S.aprobado = false; return quitarFondo(S.sel, v);
  }
  if (a === 'reajustar') { const d = datos(S.sel); Object.assign(d, { z: 1, dx: 0, dy: 0, rot: 0, brillo: 0, contraste: 0 }); componer(d); cambiada(d); return render(); }
  if (a === 'pincel') { const d = datos(S.sel); pincel = { key: S.sel, modo: 'borrar', lupa: 1, grosor: 20, hist: [], base: ajustada(d), tmp: lienzo(d.orig.width, d.orig.height) }; cambiada(d); render(); return $('#lz').scrollIntoView({ block: 'nearest' }); }
  if (a === 'pincelFin') { cerrarPincel(); return render(); }
  if (a === 'modo') pincel.modo = v;
  else if (a === 'lupa') pincel.lupa = +v;
  else if (a === 'deshacer' || a === 'recorteAuto') {
    const d = datos(S.sel);
    if (a === 'recorteAuto') { pincel.hist.push(d.mask); d.mask = copia(d.auto); }
    else d.mask = pincel.hist.pop();
  }
  else if (a === 'paso') { S.paso += +v; S.giradas.clear(); S.cara = 'front'; S.aprobado = false; render(); return scrollTo(0, 0); }
  if (a === 'demo') { ejemplo(); S.paso = 3; }
  else if (a === 'abuelos') { S.abuelos = [v[0] === '1', v[1] === '1']; estructura(); }
  else if (a === 'nhijos') { +v > 0 ? S.hijos.push({ id: ++uid, g: 'm', pareja: false, nietos: [], color: colorLibre() }) : S.hijos.pop(); estructura(); }
  else if (a === 'nnietos') { +v > 0 ? S.hijos[i].nietos.push(nuevoNieto()) : S.hijos[i].nietos.pop(); estructura(); }
  else if ((m = a.match(/^sexo(\d+)$/))) S.hijos[m[1]].g = v;
  else if ((m = a.match(/^pareja(\d+)$/))) { S.hijos[m[1]].pareja = v === '1'; estructura(); }
  else if ((m = a.match(/^sn(\d+)_(\d+)$/))) S.hijos[m[1]].nietos[m[2]].g = v;
  else if (a === 'sep') { S.sep = +v; S.orden = {}; }
  else if (a === 'borde') S.borde = +v;
  else if (a === 'color') S.color = v;
  else if (a === 'marco') S.marco = +v;
  else if ((m = a.match(/^rama(\d+)$/))) S.hijos[m[1]].color = v;
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
  if (t.id === 'guia') { S.guia = t.checked; return previas(); }
  if (t.id === 'fotoOk') { datos(S.sel).ok = t.checked; return; }
  if (t.id === 'grosor') { pincel.grosor = +t.value; return; }
  if (!['nombre', 'desc', 'z', 'rot'].includes(t.id)) return;
  const d = datos(S.sel);
  if (t.id === 'nombre') d.nombre = t.value;
  else if (t.id === 'desc') d.desc = t.value;
  else { d[t.id] = +t.value; cambiada(d); }
  S.aprobado = false;
  previas(); refrescarPanal();
});

document.addEventListener('change', e => {
  if (e.target.id === 'brillo' || e.target.id === 'contraste') {
    const d = datos(S.sel); d[e.target.id] = +e.target.value; componer(d); cambiada(d); previas(); return refrescarPanal();
  }
  if (e.target.id !== 'file' || !e.target.files[0]) return;
  const key = S.sel, url = URL.createObjectURL(e.target.files[0]), img = new Image();
  img.onload = () => {
    const k = Math.min(1, MAX_LADO / Math.max(img.naturalWidth, img.naturalHeight));
    const c = lienzo(Math.round(img.naturalWidth * k), Math.round(img.naturalHeight * k));
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    cerrarPincel(); nuevaFoto(datos(key), c); S.aprobado = false; render();
    quitarFondo(key, 'blanco');
  };
  img.onerror = () => alert('No se puede abrir esa imagen. Prueba con JPG o PNG.');
  img.src = url;
});

let arrastre = null, pintando = null;
document.addEventListener('pointerdown', e => {
  if (e.target.id === 'lz') {
    if (pincel.modo === 'mover') return;
    const c = e.target, d = datos(S.sel);
    c.setPointerCapture(e.pointerId);
    pincel.hist.push(copia(d.mask)); if (pincel.hist.length > 10) pincel.hist.shift();
    $('[data-act="deshacer"]').disabled = false;
    // grosor en píxeles de pantalla, convertido a píxeles de la foto
    pincel.radio = pincel.grosor * c.width / c.getBoundingClientRect().width;
    pintando = punto(e, c); trazo(pintando, pintando);
    return;
  }
  const s = e.target.closest('#crop');
  if (!s || !datos(S.sel).foto || pincel) return;
  s.setPointerCapture(e.pointerId);
  arrastre = { x: e.clientX, y: e.clientY, k: 84 / s.getBoundingClientRect().width };
});
document.addEventListener('pointermove', e => {
  if (pintando) { const p = punto(e, $('#lz')); trazo(pintando, p); pintando = p; return; }
  if (!arrastre) return;
  const d = datos(S.sel);
  d.dx = Math.max(-80, Math.min(80, d.dx + (e.clientX - arrastre.x) * arrastre.k));
  d.dy = Math.max(-90, Math.min(90, d.dy + (e.clientY - arrastre.y) * arrastre.k));
  arrastre.x = e.clientX; arrastre.y = e.clientY;
  cambiada(d); previas();
});
['pointerup', 'pointercancel'].forEach(n => document.addEventListener(n, () => { pintando = null; if (arrastre) { arrastre = null; refrescarPanal(); } }));

window.addEventListener('beforeunload', e => { if (Object.values(S.personas).some(d => d.foto || d.nombre)) e.preventDefault(); });

render();
document.fonts && document.fonts.ready.then(render);
