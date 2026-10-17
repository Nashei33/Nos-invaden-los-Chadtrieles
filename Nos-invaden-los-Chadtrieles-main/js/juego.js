// ================================================================
// JUEGO.JS — Nos invaden los Chadtrieles
// Lógica principal del juego (game loop, dibujo, mecánicas).
// Los valores ajustables están en js/config.js
// ================================================================


// ----------------------------------------------------------------
// IMÁGENES DE ESTRUCTURAS Y ENEMIGOS
// Coloca tus imágenes en la carpeta img/ con estos nombres:
//   img/torretas.png   → Sprite de la torreta en el mapa
//   img/barricadas.png → Sprite de la barricada en el mapa
//   img/bombas.png     → Sprite de la bomba en el mapa
//   img/chadtriel.png  → Sprite de enemigo normal
//   img/jefe.png       → Sprite del jefe Chadtriel T. Pardo
// Si las imágenes no están, el juego usa dibujos de respaldo.
// ----------------------------------------------------------------
const IMAGENES = {
  torretas:   new Image(),
  barricadas: new Image(),
  bombas:     new Image(),
  chadtriel:  new Image(),
  jefe:       new Image(),
};
IMAGENES.torretas.src   = 'img/torretas.png';
IMAGENES.barricadas.src = 'img/barricadas.png';
IMAGENES.bombas.src     = 'img/bombas.png';
IMAGENES.chadtriel.src  = 'img/chadtriel.png';
IMAGENES.jefe.src       = 'img/jefe.png';

/** Devuelve true si la imagen se cargó correctamente */
function imgCargada(img) {
  return img.complete && img.naturalWidth > 0;
}


// ----------------------------------------------------------------
// REFERENCIAS AL DOM
// ----------------------------------------------------------------
const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');

// Ajustar el tamaño del canvas según config.js
canvas.width  = CANVAS_W;
canvas.height = CANVAS_H;


// ----------------------------------------------------------------
// ESTADO DEL JUEGO
// Objeto central que guarda toda la información de la partida.
// ----------------------------------------------------------------
let estado = crearEstadoInicial();

/** Crea un estado limpio para una partida nueva */
function crearEstadoInicial() {
  return {
    monedas:       MONEDAS_INICIALES,
    vidaEscuela:   VIDA_ESCUELA_MAX,
    oleadaActual:  0,
    oleadaEnCurso: false,
    totalEliminados: 0,
    totalLlegaron:   0,
    gameOver: false,

    // Nivel actual de cada tipo de estructura (global para todas las colocadas)
    niveles: {
      torretas:   1,
      barricadas: 1,
      bombas:     1,
    },

    // Cuántas unidades de cada tipo se han comprado (para escalar precio)
    compradasCount: {
      torretas:   0,
      barricadas: 0,
      bombas:     0,
    },

    estructuras: [],   // Lista de estructuras colocadas en el mapa
    enemigos:    [],   // Lista de enemigos activos en pantalla
    proyectiles: [],   // Proyectiles disparados por las torretas
    colaSpawn:   [],   // Cola de spawn (se vacía cuando salen los timeouts)
    explosiones: [],   // Efectos visuales de explosión activos

    tiempoAnterior:     0,
    _finOleadaPendiente: false,
    spawnTimeouts:       [],
  };
}


// ================================================================
// UTILIDADES GENERALES
// ================================================================

/** Distancia euclidiana entre dos puntos {x, y} */
function distancia(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/** Agrega un mensaje al log visible en el panel lateral */
function log(msg, color = '#ccc') {
  const div = document.getElementById('log');
  const p   = document.createElement('p');
  p.style.color = color;
  p.textContent = msg;
  div.prepend(p);
  // Limitar a 30 mensajes para no sobrecargar el DOM
  while (div.children.length > 30) div.removeChild(div.lastChild);
}

/** Muestra un texto flotante sobre el canvas (monedas ganadas, daño, etc.) */
function msgFlotante(x, y, texto, color = '#f0c040') {
  const rect = canvas.getBoundingClientRect();
  const msg  = document.createElement('div');
  msg.className   = 'float-msg';
  msg.textContent = texto;
  msg.style.left  = (rect.left + x) + 'px';
  msg.style.top   = (rect.top  + y) + 'px';
  msg.style.color = color;
  document.body.appendChild(msg);
  setTimeout(() => msg.remove(), 1200);
}


// ================================================================
// ECONOMÍA: CÁLCULO DE COSTOS
// ================================================================

/** Costo de comprar una estructura (escala con cuántas hay colocadas) */
function costosCompra(tipo) {
  const d    = DEF_ESTRUCTURAS[tipo];
  const cant = estado.compradasCount[tipo];
  return Math.round(d.costoBase * Math.pow(d.factorCosto, cant));
}

/** Costo de subir un nivel a un tipo de estructura */
function costoMejora(tipo) {
  const d  = DEF_ESTRUCTURAS[tipo];
  const nv = estado.niveles[tipo];
  return Math.round(d.mejoraCostoBase * Math.pow(d.factorMejora, nv - 1));
}

/** Costo de reparar todas las barricadas dañadas */
function costoReparar() {
  return Math.round(
    DEF_ESTRUCTURAS.barricadas.costoReparar * estado.niveles.barricadas * 0.8
  );
}


// ================================================================
// ACTUALIZACIÓN DEL PANEL LATERAL
// ================================================================

function actualizarUI() {
  document.getElementById('stat-monedas').textContent    = Math.floor(estado.monedas);
  document.getElementById('stat-oleada').textContent     = estado.oleadaActual;
  document.getElementById('stat-eliminados').textContent = estado.totalEliminados;
  document.getElementById('stat-llegaron').textContent   = estado.totalLlegaron;

  // Barra y texto de vida de la escuela
  const vidaPct = (estado.vidaEscuela / VIDA_ESCUELA_MAX) * 100;
  document.getElementById('barra-vida').style.width = Math.max(0, vidaPct) + '%';
  document.getElementById('stat-vida-num').textContent =
    Math.max(0, Math.ceil(estado.vidaEscuela)) + '/' + VIDA_ESCUELA_MAX;

  // Botón de oleada
  const btnOleada = document.getElementById('btn-oleada');
  if (estado.oleadaEnCurso) {
    btnOleada.textContent = `🌊 Oleada ${estado.oleadaActual} en curso...`;
    btnOleada.disabled = true;
  } else if (estado.gameOver) {
    btnOleada.textContent = 'Game Over';
    btnOleada.disabled = true;
  } else {
    btnOleada.textContent = `▶ Iniciar Oleada ${estado.oleadaActual + 1}`;
    btnOleada.disabled = false;
  }

  // Estadísticas de estructuras en el panel
  const n = estado.niveles;
  const d = DEF_ESTRUCTURAS;

  const danoTorretas = Math.round(d.torretas.baseDano * Math.pow(d.torretas.factorDano, n.torretas - 1));
  const cdTorretas   = (d.torretas.baseCd * Math.pow(d.torretas.factorCd, n.torretas - 1) / 1000).toFixed(2);
  const cadencia     = (1 / parseFloat(cdTorretas)).toFixed(1);
  const hpBarricadas = Math.round(d.barricadas.baseHp * Math.pow(d.barricadas.factorHp, n.barricadas - 1));
  const danoBombas   = Math.round(d.bombas.baseDano   * Math.pow(d.bombas.factorDano, n.bombas - 1));
  const cdBombas     = (d.bombas.baseCd * Math.pow(d.bombas.factorCd, n.bombas - 1) / 1000).toFixed(1);

  document.getElementById('stats-torretas').textContent   = `Daño: ${danoTorretas} | Disp: c/${cdTorretas}s (${cadencia}/s) | Nivel: ${n.torretas}`;
  document.getElementById('stats-barricadas').textContent = `HP: ${hpBarricadas} | Nivel: ${n.barricadas}`;
  document.getElementById('stats-bombas').textContent     = `Daño: ${danoBombas} | CD: ${cdBombas}s | Nivel: ${n.bombas}`;

  // Costos de compra y mejora
  document.getElementById('costo-torretas').textContent    = costosCompra('torretas');
  document.getElementById('costo-barricadas').textContent = costosCompra('barricadas');
  document.getElementById('costo-bombas').textContent     = costosCompra('bombas');
  document.getElementById('mejora-torretas').textContent   = costoMejora('torretas');
  document.getElementById('mejora-barricadas').textContent= costoMejora('barricadas');
  document.getElementById('mejora-bombas').textContent    = costoMejora('bombas');
  document.getElementById('costo-reparar').textContent    = costoReparar();

  // Deshabilitar botones si no hay monedas suficientes
  document.getElementById('btn-mej-torretas').disabled    = estado.monedas < costoMejora('torretas');
  document.getElementById('btn-mej-barricadas').disabled = estado.monedas < costoMejora('barricadas');
  document.getElementById('btn-mej-bombas').disabled     = estado.monedas < costoMejora('bombas');
  document.getElementById('btn-reparar').disabled        = estado.monedas < costoReparar() ||
    !estado.estructuras.some(s => s.tipo === 'barricadas' && s.activa && s.hpActual < s.hpMax);
}


// ================================================================
// DIBUJO DEL FONDO: PISO DE BALDOSAS DE COLEGIO
// ================================================================

function dibujarFondo() {
  // Fondo base gris
  ctx.fillStyle = '#c8c8d0';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Baldosas alternadas en dos tonos de gris
  for (let col = 0; col * TILE < CANVAS_W; col++) {
    for (let fil = 0; fil * TILE < CANVAS_H; fil++) {
      ctx.fillStyle = (col + fil) % 2 === 0 ? '#cececd' : '#b8b8c2';
      ctx.fillRect(col * TILE, fil * TILE, TILE, TILE);
    }
  }

  // Juntas entre baldosas (líneas grises oscuras)
  ctx.strokeStyle = '#9696a0';
  ctx.lineWidth   = 1;
  for (let x = 0; x <= CANVAS_W; x += TILE) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
  }
  for (let y = 0; y <= CANVAS_H; y += TILE) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
  }
}


// ================================================================
// DIBUJO DEL CAMINO (pasillo del colegio)
// ================================================================

function dibujarCamino() {
  const pts = CAMINO_PUNTOS;

  // Sombra del pasillo
  ctx.lineWidth   = CAMINO_ANCHO + 10;
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineJoin    = 'round';
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
  ctx.stroke();

  // Superficie del pasillo (gris más oscuro que el piso)
  ctx.lineWidth   = CAMINO_ANCHO;
  ctx.strokeStyle = '#8a8a96';
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
  ctx.stroke();

  // Líneas punteadas del pasillo (estilo corredor escolar)
  ctx.setLineDash([12, 10]);
  ctx.lineWidth   = 1.5;
  ctx.strokeStyle = '#7a7a88';
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
  ctx.stroke();
  ctx.setLineDash([]);

  // Borde del pasillo
  ctx.lineWidth   = CAMINO_ANCHO + 4;
  ctx.strokeStyle = '#5a5a6a';
  ctx.globalCompositeOperation = 'destination-over';
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';

  // Marcador de inicio (verde)
  ctx.fillStyle = '#27ae60';
  ctx.beginPath();
  ctx.arc(pts[0].x + 6, pts[0].y, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ENTRADA', pts[0].x + 6, pts[0].y + 3);

  // Marcador de fin (escuela)
  const ult = pts[pts.length - 1];
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.arc(ult.x - 12, ult.y, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = '18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🏫', ult.x - 12, ult.y + 6);
}


// ================================================================
// GEOMETRÍA DEL CAMINO
// ================================================================

/** Longitud total del camino (se calcula una sola vez y se guarda) */
let _longitudCamino = null;
function longitudCamino() {
  if (_longitudCamino) return _longitudCamino;
  let t = 0;
  for (let i = 0; i < CAMINO_PUNTOS.length - 1; i++) {
    t += distancia(CAMINO_PUNTOS[i], CAMINO_PUNTOS[i + 1]);
  }
  return (_longitudCamino = t);
}

/**
 * Dado un progreso (0..1), devuelve la posición {x,y}
 * del punto sobre el camino.
 */
function posEnCamino(progreso) {
  let objetivo = progreso * longitudCamino();
  for (let i = 0; i < CAMINO_PUNTOS.length - 1; i++) {
    const seg = distancia(CAMINO_PUNTOS[i], CAMINO_PUNTOS[i + 1]);
    if (objetivo <= seg) {
      const t = objetivo / seg;
      return {
        x: CAMINO_PUNTOS[i].x + t * (CAMINO_PUNTOS[i + 1].x - CAMINO_PUNTOS[i].x),
        y: CAMINO_PUNTOS[i].y + t * (CAMINO_PUNTOS[i + 1].y - CAMINO_PUNTOS[i].y),
      };
    }
    objetivo -= seg;
  }
  return CAMINO_PUNTOS[CAMINO_PUNTOS.length - 1];
}

/**
 * Devuelve true si el punto (px, py) está sobre el pasillo.
 * Usado para validar dónde colocar estructuras.
 */
function estaEnCamino(px, py) {
  const margen = CAMINO_ANCHO / 2 + 4;
  for (let i = 0; i < CAMINO_PUNTOS.length - 1; i++) {
    const a = CAMINO_PUNTOS[i];
    const b = CAMINO_PUNTOS[i + 1];
    if (distanciaSegmento(px, py, a.x, a.y, b.x, b.y) <= margen) return true;
  }
  return false;
}

/** Distancia de un punto (px,py) al segmento de línea (ax,ay)→(bx,by) */
function distanciaSegmento(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return distancia({ x: px, y: py }, { x: ax, y: ay });
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return distancia({ x: px, y: py }, { x: ax + t * dx, y: ay + t * dy });
}


// ================================================================
// GENERACIÓN DE ENEMIGOS
// ================================================================

/**
 * Crea el objeto de un enemigo usando los valores de config.js.
 * @param {number} oleada   - Número de la oleada actual
 * @param {boolean} esJefe  - true si es el jefe Chadtriel T. Pardo
 */
function crearEnemigo(oleada, esJefe = false) {
  const cfg = esJefe ? ENEMIGO_JEFE : ENEMIGO_NORMAL;

  // Escalar vida y oro según oleada (solo la vida y el oro suben)
  const factorVida = 1 + (oleada - 1) * cfg.factorVida;
  const factorOro  = 1 + (oleada - 1) * cfg.factorOro;

  return {
    id:        Date.now() + Math.random(), // Identificador único
    esJefe,
    nombre:    esJefe ? 'Chadtriel T. Pardo' : 'Chadtriel',
    color:     esJefe ? '#8e44ad' : '#c0392b',

    vida:      Math.round(cfg.vidaBase * factorVida),
    vidaMax:   Math.round(cfg.vidaBase * factorVida),
    velocidad: cfg.velocidad,   // Velocidad FIJA (no escala con oleadas)
    radio:     cfg.radio,
    dano:      cfg.dano,
    oro:       Math.round(cfg.oroBase * factorOro),

    progreso: 0,       // 0 = inicio del camino, 1 = llegó a la escuela
    x: CAMINO_PUNTOS[0].x,
    y: CAMINO_PUNTOS[0].y,
    muerto: false,
    parado: false,
    barricadaObjetivo: null,
  };
}


// ================================================================
// CONTROL DE OLEADAS
// ================================================================

/** Inicia la siguiente oleada de enemigos */
function iniciarOleada() {
  if (estado.oleadaEnCurso || estado.gameOver) return;

  estado.oleadaActual++;
  estado.oleadaEnCurso      = true;
  estado._finOleadaPendiente = false;

  const oleada      = estado.oleadaActual;
  const esRondaJefe = (oleada % OLEADA.frecuenciaJefe === 0);
  const cantNormales = OLEADA.cantidadBase + Math.floor(oleada * OLEADA.multiplicadorPorOleada);

  // Construir cola de apariciones con retardos
  estado.colaSpawn = [];
  let delay = 0;
  for (let i = 0; i < cantNormales; i++) {
    delay += OLEADA.retardoEntreEnemigos + Math.random() * OLEADA.retardoAleatorio;
    estado.colaSpawn.push({ delay, esJefe: false });
  }
  if (esRondaJefe) {
    delay += OLEADA.retardoAntesDelJefe;
    estado.colaSpawn.push({ delay, esJefe: true });
  }

  if (esRondaJefe) {
    log(`⚠️ OLEADA ${oleada}: ¡LLEGA EL JEFE CHADTRIEL T. PARDO!`, '#9b59b6');
  } else {
    log(`🌊 Oleada ${oleada}: ${cantNormales} Chadtrieles se aproximan.`, '#3498db');
  }

  // Programar cada aparición con setTimeout
  const spawns = [...estado.colaSpawn];
  spawns.forEach(({ delay: d, esJefe }) => {
    const tid = setTimeout(() => {
      if (!estado.gameOver && estado.oleadaEnCurso) {
        estado.enemigos.push(crearEnemigo(estado.oleadaActual, esJefe));
        if (estado.colaSpawn.length > 0) estado.colaSpawn.pop();
      }
    }, d);
    estado.spawnTimeouts.push(tid);
  });

  actualizarUI();
}

/** Verifica si todos los enemigos de la oleada fueron eliminados */
function verificarFinOleada() {
  if (!estado.oleadaEnCurso || estado._finOleadaPendiente) return;
  if (estado.enemigos.length === 0 && estado.colaSpawn.length === 0) {
    estado._finOleadaPendiente = true;
    const tid = setTimeout(() => {
      // Doble chequeo: confirmamos que sigan sin haber enemigos
      if (estado.enemigos.length === 0 && estado.oleadaEnCurso && !estado.gameOver) {
        estado.oleadaEnCurso       = false;
        estado._finOleadaPendiente = false;
        log(`✅ ¡Oleada ${estado.oleadaActual} completada!`, '#27ae60');
        actualizarUI();
      } else {
        estado._finOleadaPendiente = false;
      }
    }, 1500);
    estado.spawnTimeouts.push(tid);
  }
}


// ================================================================
// MODO COLOCACIÓN DE ESTRUCTURAS
// ================================================================

let modoColocacion = null; // Tipo de estructura que se va a colocar

/** Activa el modo colocación para un tipo de estructura */
function seleccionarEstructura(tipo) {
  if (estado.gameOver) return;
  const costo = costosCompra(tipo);
  if (estado.monedas < costo) {
    log(`❌ Sin monedas para ${tipo} (necesitas ${costo}🪙)`, '#e74c3c');
    return;
  }
  modoColocacion = tipo;
  const def = DEF_ESTRUCTURAS[tipo];

  if (tipo === 'torretas') {
    document.getElementById('modo-badge').textContent =
      `🖱️ Clic en el piso (fuera del pasillo) para colocar ${def.emoji} ${tipo}`;
    document.getElementById('instruccion').textContent =
      'Haz clic fuera del pasillo. [Esc] para cancelar.';
  } else {
    document.getElementById('modo-badge').textContent =
      `🖱️ Clic en el pasillo para colocar ${def.emoji} ${tipo}`;
    document.getElementById('instruccion').textContent =
      'Haz clic sobre el pasillo. [Esc] para cancelar.';
  }

  document.getElementById('modo-badge').classList.add('activo');
  document.querySelectorAll('.estructura-item').forEach(el => el.classList.remove('seleccionada'));
  document.getElementById('ui-' + tipo).classList.add('seleccionada');
}

/** Cancela el modo colocación */
function cancelarColocacion() {
  modoColocacion = null;
  document.getElementById('modo-badge').classList.remove('activo');
  document.getElementById('instruccion').textContent = '';
  document.querySelectorAll('.estructura-item').forEach(el => el.classList.remove('seleccionada'));
}

/** Crea la estructura en las coordenadas dadas y la añade al estado */
function colocarEstructuraEn(tipo, x, y) {
  const nv    = estado.niveles[tipo];
  const nueva = { tipo, x, y, id: Date.now() + Math.random() };

  if (tipo === 'torretas') {
    nueva.dano    = Math.round(
      DEF_ESTRUCTURAS.torretas.baseDano * Math.pow(DEF_ESTRUCTURAS.torretas.factorDano, nv - 1)
    );
    nueva.cd      = Math.round(
      DEF_ESTRUCTURAS.torretas.baseCd * Math.pow(DEF_ESTRUCTURAS.torretas.factorCd, nv - 1)
    );
    nueva.rango   = DEF_ESTRUCTURAS.torretas.rango;
    nueva.timerCd = 0;
    nueva.angulo  = 0;

  } else if (tipo === 'barricadas') {
    nueva.hpMax    = Math.round(
      DEF_ESTRUCTURAS.barricadas.baseHp * Math.pow(DEF_ESTRUCTURAS.barricadas.factorHp, nv - 1)
    );
    nueva.hpActual = nueva.hpMax;
    nueva.activa   = true;

  } else if (tipo === 'bombas') {
    nueva.dano    = Math.round(
      DEF_ESTRUCTURAS.bombas.baseDano * Math.pow(DEF_ESTRUCTURAS.bombas.factorDano, nv - 1)
    );
    nueva.cd      = Math.round(
      DEF_ESTRUCTURAS.bombas.baseCd * Math.pow(DEF_ESTRUCTURAS.bombas.factorCd, nv - 1)
    );
    nueva.timerCd = 0;
  }

  estado.estructuras.push(nueva);
}

// Evento: clic en el canvas para colocar la estructura seleccionada
canvas.addEventListener('click', (e) => {
  if (!modoColocacion || estado.gameOver) return;

  const rect   = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx     = (e.clientX - rect.left) * scaleX;
  const my     = (e.clientY - rect.top) * scaleY;

  // Las torretas se colocan fuera del pasillo; las barricadas y bombas sobre el pasillo
  if (modoColocacion === 'torretas') {
    if (estaEnCamino(mx, my)) {
      log('⚠️ Las torretas deben colocarse fuera del pasillo.', '#e67e22');
      return;
    }
  } else {
    if (!estaEnCamino(mx, my)) {
      log('⚠️ Esta estructura debe colocarse sobre el pasillo.', '#e67e22');
      return;
    }
  }

  // Evitar colocar fuera de los márgenes del mapa
  if (mx < 20 || mx > CANVAS_W - 20 || my < 20 || my > CANVAS_H - 20) {
    log('⚠️ Muy cerca del borde del mapa.', '#e67e22');
    return;
  }

  if (estado.estructuras.some(s => distancia({ x: mx, y: my }, s) < 24)) {
    log('⚠️ Demasiado cerca de otra estructura.', '#e67e22');
    return;
  }

  const costo = costosCompra(modoColocacion);
  if (estado.monedas < costo) {
    log(`❌ Sin monedas (necesitas ${costo}🪙)`, '#e74c3c');
    cancelarColocacion();
    return;
  }

  estado.monedas -= costo;
  estado.compradasCount[modoColocacion]++;
  colocarEstructuraEn(modoColocacion, mx, my);
  log(`✅ ${DEF_ESTRUCTURAS[modoColocacion].emoji} ${modoColocacion} colocada (-${costo}🪙)`, '#27ae60');
  cancelarColocacion();
  actualizarUI();
});

// Tecla Escape cancela el modo colocación
document.addEventListener('keydown', e => { if (e.key === 'Escape') cancelarColocacion(); });


// ================================================================
// MEJORAS Y REPARACIÓN
// ================================================================

/** Sube el nivel de un tipo de estructura y actualiza las colocadas */
function mejorarEstructura(tipo) {
  const costo = costoMejora(tipo);
  if (estado.monedas < costo) {
    log(`❌ Sin monedas para mejorar (necesitas ${costo}🪙)`, '#e74c3c');
    return;
  }

  estado.monedas -= costo;
  estado.niveles[tipo]++;
  const nv = estado.niveles[tipo];

  // Recalcular estadísticas de todas las estructuras ya colocadas de ese tipo
  estado.estructuras.forEach(s => {
    if (s.tipo !== tipo) return;

    if (tipo === 'torretas') {
      s.dano = Math.round(
        DEF_ESTRUCTURAS.torretas.baseDano * Math.pow(DEF_ESTRUCTURAS.torretas.factorDano, nv - 1)
      );
      s.cd   = Math.round(
        DEF_ESTRUCTURAS.torretas.baseCd * Math.pow(DEF_ESTRUCTURAS.torretas.factorCd, nv - 1)
      );

    } else if (tipo === 'barricadas') {
      const nuevoMax = Math.round(
        DEF_ESTRUCTURAS.barricadas.baseHp * Math.pow(DEF_ESTRUCTURAS.barricadas.factorHp, nv - 1)
      );
      if (s.activa) {
        // Mantiene la misma proporción de HP al mejorar
        s.hpActual = Math.round((s.hpActual / s.hpMax) * nuevoMax);
        s.hpMax    = nuevoMax;
      }

    } else if (tipo === 'bombas') {
      s.dano = Math.round(
        DEF_ESTRUCTURAS.bombas.baseDano * Math.pow(DEF_ESTRUCTURAS.bombas.factorDano, nv - 1)
      );
      s.cd   = Math.round(
        DEF_ESTRUCTURAS.bombas.baseCd * Math.pow(DEF_ESTRUCTURAS.bombas.factorCd, nv - 1)
      );
    }
  });

  log(`⬆️ ${DEF_ESTRUCTURAS[tipo].emoji} ${tipo} → Nivel ${nv} (-${costo}🪙)`, '#2ecc71');
  actualizarUI();
}

/** Repara todas las barricadas dañadas */
function repararBarricadas() {
  const costo = costoReparar();
  const necesitaReparar = estado.estructuras.some(s => s.tipo === 'barricadas' && s.activa && s.hpActual < s.hpMax);
  if (!necesitaReparar || estado.monedas < costo) return;

  estado.monedas -= costo;
  estado.estructuras.forEach(s => {
    if (s.tipo === 'barricadas' && s.activa) s.hpActual = s.hpMax;
  });
  log(`🔧 Barricadas reparadas (-${costo}🪙)`, '#8e44ad');
  actualizarUI();
}

// Conectar el botón de oleada
document.getElementById('btn-oleada').addEventListener('click', iniciarOleada);


// ================================================================
// LÓGICA DE JUEGO: ACTUALIZACIÓN POR FRAME
// ================================================================

/** Actualiza el movimiento de todos los enemigos */
function actualizarEnemigos(dt) {
  for (let i = estado.enemigos.length - 1; i >= 0; i--) {
    const en = estado.enemigos[i];
    if (en.muerto) continue;

    if (en.parado) {
      // Atacar la barricada que lo bloquea
      const bar = estado.estructuras.find(s => s.id === en.barricadaObjetivo);
      if (!bar || !bar.activa) {
        en.parado = false;
        en.barricadaObjetivo = null;
      } else {
        bar.hpActual -= ENEMIGO_JEFE.danoPorSegundoABarricada * (dt / 1000);
        if (bar.hpActual <= 0) {
          bar.activa = false;
          // Quitar la barricada destruida para liberar el pasillo
          const idx = estado.estructuras.indexOf(bar);
          if (idx !== -1) estado.estructuras.splice(idx, 1);
          log(`💥 ¡Barricada destruida!`, '#e74c3c');
          en.parado = false;
          en.barricadaObjetivo = null;
        }
      }
      continue;
    }

    // Mover al enemigo a lo largo del camino
    en.progreso += en.velocidad * dt;
    const pos = posEnCamino(en.progreso);
    en.x = pos.x;
    en.y = pos.y;

    // Detectar colisión con barricadas activas
    const bar = estado.estructuras.find(s =>
      s.tipo === 'barricadas' && s.activa &&
      distancia({ x: en.x, y: en.y }, s) < (en.radio + 18)
    );
    if (bar) {
      en.parado = true;
      en.barricadaObjetivo = bar.id;
      // Retroceder ligeramente para no penetrar la barricada
      en.progreso = Math.max(0, en.progreso - en.velocidad * dt * 4);
      const pos2 = posEnCamino(en.progreso);
      en.x = pos2.x;
      en.y = pos2.y;
      continue;
    }

    // ¿Llegó a la escuela?
    if (en.progreso >= 1) {
      estado.vidaEscuela -= en.dano;
      estado.totalLlegaron++;
      estado.enemigos.splice(i, 1);

      if (estado.vidaEscuela <= 0) {
        estado.vidaEscuela = 0;
        activarGameOver();
        return;
      }
      log(`😱 Un ${en.nombre} llegó! (-${en.dano}❤️)`, '#e74c3c');
    }
  }
}

/** Aplica la lógica de ataque de las estructuras (torretas y bombas) */
function actualizarEstructuras(dt) {
  estado.estructuras.forEach(s => {

    if (s.tipo === 'torretas') {
      if (s.timerCd > 0) {
        s.timerCd -= dt;
      }

      // Buscar el enemigo más avanzado en el camino dentro de su rango
      let objetivo = null;
      let maxProgreso = -1;

      for (const en of estado.enemigos) {
        if (!en.muerto) {
          const d = distancia(s, en);
          if (d <= s.rango) {
            if (en.progreso > maxProgreso) {
              maxProgreso = en.progreso;
              objetivo = en;
            }
          }
        }
      }

      if (objetivo) {
        // Orientar torreta hacia el objetivo
        s.angulo = Math.atan2(objetivo.y - s.y, objetivo.x - s.x);

        // Si terminó el cooldown, disparar
        if (s.timerCd <= 0) {
          s.timerCd = s.cd;

          estado.proyectiles.push({
            x: s.x,
            y: s.y,
            targetId: objetivo.id,
            targetX: objetivo.x,
            targetY: objetivo.y,
            dano: s.dano,
            velocidad: 480, // píxeles por segundo
          });
        }
      }
    }

    if (s.tipo === 'bombas') {
      // Contar cooldown
      if (s.timerCd > 0) { s.timerCd -= dt; return; }

      // Detectar enemigos en el radio de explosión
      const cerca = estado.enemigos.filter(en =>
        !en.muerto && distancia({ x: en.x, y: en.y }, s) < DEF_ESTRUCTURAS.bombas.radioExplosion
      );
      if (cerca.length > 0) {
        cerca.forEach(en => {
          en.vida -= s.dano;
          if (en.vida <= 0) matarEnemigo(en);
        });
        estado.explosiones.push({
          x: s.x, y: s.y, radio: 0,
          radioMax: DEF_ESTRUCTURAS.bombas.radioExplosion,
          vida: 600,
        });
        msgFlotante(s.x, s.y, `💥 -${s.dano}`, '#f39c12');
        s.timerCd = s.cd; // Reiniciar cooldown
      }
    }
  });

  // Limpiar enemigos marcados como muertos en este frame
  estado.enemigos = estado.enemigos.filter(en => !en.muerto);
}

/** Mata a un enemigo y otorga monedas al jugador */
function matarEnemigo(en) {
  if (en.muerto) return;
  en.muerto = true;
  en.vida   = -1;
  estado.monedas += en.oro;
  estado.totalEliminados++;
  msgFlotante(en.x, en.y - 14, `+${en.oro}🪙`, '#f0c040');
  if (en.esJefe) log(`🏆 ¡JEFE DERROTADO! +${en.oro}🪙`, '#9b59b6');
}


/** Mueve los proyectiles disparados por las torretas e inflige daño */
function actualizarProyectiles(dt) {
  const dtSec = dt / 1000;
  for (let i = estado.proyectiles.length - 1; i >= 0; i--) {
    const p = estado.proyectiles[i];

    // Seguir la posición del enemigo si aún vive
    const enemigoVivo = estado.enemigos.find(e => e.id === p.targetId && !e.muerto);
    if (enemigoVivo) {
      p.targetX = enemigoVivo.x;
      p.targetY = enemigoVivo.y;
    }

    const dx = p.targetX - p.x;
    const dy = p.targetY - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const paso = p.velocidad * dtSec;

    if (dist <= paso || dist <= 12) {
      // Impacto del proyectil
      if (enemigoVivo) {
        enemigoVivo.vida -= p.dano;
        msgFlotante(enemigoVivo.x, enemigoVivo.y - 12, `-${p.dano}`, '#f1c40f');
        if (enemigoVivo.vida <= 0) {
          matarEnemigo(enemigoVivo);
        }
      }
      estado.proyectiles.splice(i, 1);
    } else {
      p.x += (dx / dist) * paso;
      p.y += (dy / dist) * paso;
    }
  }
}

/** Dibuja los proyectiles de las torretas en pantalla */
function dibujarProyectiles() {
  estado.proyectiles.forEach(p => {
    ctx.fillStyle = '#f39c12';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });
}


// ================================================================
// DIBUJO DE ESTRUCTURAS (con imagen PNG o dibujo de respaldo)
// ================================================================

function dibujarEstructuras() {
  estado.estructuras.forEach(s => {

    if (s.tipo === 'barricadas') {
      if (!s.activa) return;
      const pct   = s.hpActual / s.hpMax;
      const color = pct > 0.5 ? '#3498db' : (pct > 0.25 ? '#e67e22' : '#e74c3c');

      if (imgCargada(IMAGENES.barricadas)) {
        ctx.save();
        ctx.globalAlpha = 0.6 + pct * 0.4; // Se vuelve más transparente con menos HP
        ctx.drawImage(IMAGENES.barricadas, s.x - 22, s.y - 22, 44, 44);
        ctx.restore();
      } else {
        // Respaldo: rectángulo con borde
        ctx.strokeStyle = color;
        ctx.lineWidth   = 5;
        ctx.strokeRect(s.x - 20, s.y - 20, 40, 40);
        ctx.fillStyle   = '#fff';
        ctx.font        = '20px sans-serif';
        ctx.textAlign   = 'center';
        ctx.fillText('🚧', s.x, s.y + 7);
      }

      // Barra de vida de la barricada
      ctx.fillStyle = '#111';
      ctx.fillRect(s.x - 18, s.y + 20, 36, 5);
      ctx.fillStyle = color;
      ctx.fillRect(s.x - 18, s.y + 20, 36 * pct, 5);

    } else if (s.tipo === 'torretas') {
      if (imgCargada(IMAGENES.torretas)) {
        ctx.save();
        ctx.translate(s.x, s.y);
        if (s.angulo !== undefined) {
          ctx.rotate(s.angulo);
        }
        ctx.drawImage(IMAGENES.torretas, -22, -22, 44, 44);
        ctx.restore();
      } else {
        // Respaldo: torreta metálica con cañón direccionable
        ctx.fillStyle = '#34495e';
        ctx.beginPath();
        ctx.arc(s.x, s.y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.angulo || 0);

        // Cañón de la torreta
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(0, -4, 18, 8);
        ctx.strokeStyle = '#7b241c';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(0, -4, 18, 8);

        // Cúpula central
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Radio de alcance tenue
      ctx.strokeStyle = 'rgba(231, 76, 60, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.rango || DEF_ESTRUCTURAS.torretas.rango, 0, Math.PI * 2);
      ctx.stroke();

    } else if (s.tipo === 'bombas') {
      const pctCd = s.timerCd > 0 ? (s.timerCd / s.cd) : 0;

      if (imgCargada(IMAGENES.bombas)) {
        ctx.save();
        ctx.globalAlpha = pctCd > 0 ? 0.5 : 1.0; // Atenuada en cooldown
        ctx.drawImage(IMAGENES.bombas, s.x - 22, s.y - 22, 44, 44);
        ctx.restore();
      } else {
        // Respaldo: círculo con emoji
        ctx.fillStyle   = pctCd > 0 ? '#555' : '#e67e22';
        ctx.beginPath();
        ctx.arc(s.x, s.y, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth   = 2;
        ctx.stroke();
        ctx.fillStyle   = '#fff';
        ctx.font        = '18px sans-serif';
        ctx.textAlign   = 'center';
        ctx.fillText('💣', s.x, s.y + 7);
      }

      // Arco que muestra el progreso del cooldown
      if (pctCd > 0) {
        ctx.strokeStyle = '#f39c12';
        ctx.lineWidth   = 3;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 24, -Math.PI / 2, -Math.PI / 2 + (1 - pctCd) * Math.PI * 2);
        ctx.stroke();
      }

      // Radio de detección (círculo tenue)
      ctx.strokeStyle = 'rgba(230,126,34,0.12)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, DEF_ESTRUCTURAS.bombas.radioExplosion, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
}


// ================================================================
// DIBUJO DE ENEMIGOS (con imagen PNG o dibujo de respaldo)
// ================================================================

function dibujarEnemigos() {
  estado.enemigos.forEach(en => {
    if (en.muerto) return;

    const pos = posEnCamino(en.progreso);
    en.x = pos.x;
    en.y = pos.y;

    const img = en.esJefe ? IMAGENES.jefe : IMAGENES.chadtriel;

    // Sombra bajo el personaje
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(en.x, en.y + en.radio, en.radio * 0.8, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (imgCargada(img)) {
      const sz = en.radio * 2.2;
      ctx.drawImage(img, en.x - sz / 2, en.y - sz / 2, sz, sz);
    } else {
      // Respaldo: círculo coloreado con emoji
      ctx.fillStyle   = en.color;
      ctx.beginPath();
      ctx.arc(en.x, en.y, en.radio, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = en.esJefe ? '#6c3483' : '#7b241c';
      ctx.lineWidth   = 2;
      ctx.stroke();
      ctx.fillStyle   = '#fff';
      ctx.font        = en.esJefe ? '22px sans-serif' : '14px sans-serif';
      ctx.textAlign   = 'center';
      ctx.fillText(en.esJefe ? '👑' : '😈', en.x, en.y + (en.esJefe ? 8 : 5));
    }

    // Barra de vida del enemigo
    const barW    = en.radio * 2.4;
    const pctVida = Math.max(0, en.vida / en.vidaMax);
    ctx.fillStyle = '#111';
    ctx.fillRect(en.x - barW / 2, en.y - en.radio - 10, barW, 5);
    ctx.fillStyle = pctVida > 0.5 ? '#2ecc71' : (pctVida > 0.25 ? '#f39c12' : '#e74c3c');
    ctx.fillRect(en.x - barW / 2, en.y - en.radio - 10, barW * pctVida, 5);

    // Etiqueta del jefe
    if (en.esJefe) {
      ctx.fillStyle = '#f0c040';
      ctx.font      = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CHADTRIEL T. PARDO', en.x, en.y - en.radio - 13);
    }
  });
}


// ================================================================
// EFECTOS VISUALES: EXPLOSIONES
// ================================================================

function actualizarExplosiones(dt) {
  for (let i = estado.explosiones.length - 1; i >= 0; i--) {
    const exp = estado.explosiones[i];
    exp.vida  -= dt;
    exp.radio  = exp.radioMax * (1 - exp.vida / 600);

    if (exp.vida <= 0) { estado.explosiones.splice(i, 1); continue; }

    const a = exp.vida / 600;
    ctx.strokeStyle = `rgba(255,140,0,${a})`;
    ctx.lineWidth   = 4;
    ctx.beginPath();
    ctx.arc(exp.x, exp.y, exp.radio, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `rgba(255,80,0,${a * 0.18})`;
    ctx.beginPath();
    ctx.arc(exp.x, exp.y, exp.radio, 0, Math.PI * 2);
    ctx.fill();
  }
}


// ================================================================
// GAME OVER Y REINICIO
// ================================================================

function activarGameOver() {
  estado.gameOver      = true;
  estado.oleadaEnCurso = false;

  document.getElementById('stats-final-texto').innerHTML = `
    🌊 Oleadas superadas: <span>${estado.oleadaActual}</span><br>
    💀 Chadtrieles eliminados: <span>${estado.totalEliminados}</span><br>
    😱 Enemigos que llegaron: <span>${estado.totalLlegaron}</span><br>
    🏗️ Estructuras colocadas: <span>${estado.estructuras.length}</span><br>
    💰 Monedas finales: <span>${Math.floor(estado.monedas)}</span>
  `;
  document.getElementById('pantalla-gameover').classList.add('activo');
}

let animFrameId = null;

function reiniciarJuego() {
  const mejorOleada = estado.oleadaActual;

  // Cancelar todos los timeouts pendientes de la oleada anterior
  if (estado.spawnTimeouts) {
    estado.spawnTimeouts.forEach(id => clearTimeout(id));
  }

  // Resetear longitud del camino (por si cambió la config)
  _longitudCamino = null;

  estado = crearEstadoInicial();
  estado.tiempoAnterior = performance.now();

  document.getElementById('pantalla-gameover').classList.remove('activo');
  cancelarColocacion();
  log(`🔄 ¡Nueva partida! Récord anterior: oleada ${mejorOleada}.`, '#f0c040');

  if (animFrameId) cancelAnimationFrame(animFrameId);
  animFrameId = requestAnimationFrame(gameLoop);
  actualizarUI();
}


// ================================================================
// GAME LOOP PRINCIPAL (requestAnimationFrame)
// ================================================================

function gameLoop(timestamp) {
  if (estado.gameOver) return;

  const dt = Math.min(timestamp - estado.tiempoAnterior, 100); // Cap de 100ms
  estado.tiempoAnterior = timestamp;

  // Limpiar el canvas en cada frame
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // --- DIBUJAR ---
  dibujarFondo();       // Piso de baldosas
  dibujarCamino();      // Pasillo del colegio

  // --- ACTUALIZAR Y DIBUJAR ESTRUCTURAS Y PROYECTILES ---
  actualizarEstructuras(dt);
  actualizarProyectiles(dt);
  dibujarEstructuras();
  dibujarProyectiles();

  // --- ACTUALIZAR Y DIBUJAR ENEMIGOS ---
  actualizarEnemigos(dt);
  dibujarEnemigos();

  // --- EFECTOS ---
  actualizarExplosiones(dt);

  // --- LÓGICA ---
  verificarFinOleada();
  actualizarUI();

  animFrameId = requestAnimationFrame(gameLoop);
}


// ================================================================
// INICIO DEL JUEGO
// ================================================================
log('🎮 ¡Juego listo! Coloca estructuras e inicia la primera oleada.', '#27ae60');
log('💡 Tip: Coloca Barricadas para frenar y Torretas para disparar.', '#3498db');
log('🎯 Torreta = Disparos rápidos | 🚧 Barricada = Bloqueo | 💣 Bomba = Área', '#888');

actualizarUI();

// Arrancar el game loop
animFrameId = requestAnimationFrame(function primer(ts) {
  estado.tiempoAnterior = ts;
  animFrameId = requestAnimationFrame(gameLoop);
});
