// ================================================================
// CONFIG.JS — Nos invaden los Chadtrieles
// ================================================================
// Este archivo contiene TODOS los valores ajustables del juego.
// Puedes cambiar cualquier número aquí sin tocar la lógica.
// ================================================================


// ----------------------------------------------------------------
// CONFIGURACIÓN DEL CANVAS (tamaño del mapa)
// ----------------------------------------------------------------
const CANVAS_W = 920;  // Ancho del canvas en píxeles
const CANVAS_H = 600;  // Alto del canvas en píxeles


// ----------------------------------------------------------------
// CONFIGURACIÓN DE LA ESCUELA
// ----------------------------------------------------------------
const VIDA_ESCUELA_MAX = 100;  // Vida máxima de la escuela (puntos)
const MONEDAS_INICIALES = 100;  // Monedas con las que empieza el jugador


// ----------------------------------------------------------------
// CONFIGURACIÓN DEL CAMINO (pasillo del colegio)
// Cada punto {x, y} es una esquina donde el pasillo gira.
// El primer punto es la entrada de los enemigos,
// el último punto es la entrada a la escuela.
// ----------------------------------------------------------------
const CAMINO_PUNTOS = [
  { x: 0,   y: 100 },
  { x: 730, y: 100 },
  { x: 730, y: 230 },
  { x: 110, y: 230 },
  { x: 110, y: 365 },
  { x: 800, y: 365 },
  { x: 800, y: 510 },
  { x: 920, y: 510 },
];

const CAMINO_ANCHO = 48;  // Ancho visual del pasillo en píxeles
const TILE         = 46;  // Tamaño de cada baldosa del piso (píxeles)


// ----------------------------------------------------------------
// CONFIGURACIÓN DE LAS OLEADAS
// ----------------------------------------------------------------
const OLEADA = {
  // Cantidad de enemigos normales en la oleada N:
  //   cantidadBase + Math.floor(oleadaActual * multiplicadorPorOleada)
  cantidadBase:           5,    // Mínimo de enemigos en oleada 1
  multiplicadorPorOleada: 1.75,  // Cuántos enemigos más por oleada

  // Cada cuántas oleadas aparece el jefe
  frecuenciaJefe: 5,

  // Tiempo entre apariciones de enemigos (milisegundos)
  retardoEntreEnemigos: 500,      // Base
  retardoAleatorio:     300,      // Se suma un valor aleatorio entre 0 y este número
  retardoAntesDelJefe:  1500,     // Pausa antes de que aparezca el jefe
};


// ----------------------------------------------------------------
// CONFIGURACIÓN DE ENEMIGOS
// ----------------------------------------------------------------
const ENEMIGO_NORMAL = {
  // Vida base y cuánto sube por oleada
  vidaBase:      50,    // HP en oleada 1
  factorVida:    0.35,  // +35% de vida por cada oleada (oleada 5 → 60 × (1 + 4 × 0.35))

  // Velocidad de movimiento (NO escala con oleadas por diseño)
  // Valor más alto = se mueven más rápido
  velocidad:     0.00012,  // Progreso recorrido por milisegundo

  // Daño que hace a la escuela al llegar
  dano:          5,

  // Radio visual del sprite en píxeles
  radio:         14,

  // Monedas base que otorga al morir
  oroBase:       15,    // Oro en oleada 1
  factorOro:     0.25,  // +25% de oro por cada oleada
};

const ENEMIGO_JEFE = {
  vidaBase:    600,   // HP base del jefe (escala igual que normales)
  factorVida:  0.35,  // Mismo factor de escalado de vida que los normales

  velocidad:   0.00006,  // El jefe es más lento (valor menor = más lento)

  dano:        10,    // Daño a la escuela al llegar (el doble que un normal)
  radio:       28,    // Radio visual más grande
  oroBase:     80,    // Recompensa base del jefe
  factorOro:   0.25,

  // Cuánto daño por segundo hacen los enemigos a las barricadas al atacarlas
  danoPorSegundoABarricada: 15,
};


// ----------------------------------------------------------------
// CONFIGURACIÓN DE ESTRUCTURAS DEFENSIVAS
// Cada estructura tiene sus valores base y factores de escalado.
//
// - costoBase:       precio de comprar la primera
// - factorCosto:     precio se multiplica por este valor por cada unidad comprada
//                    Ej: factorCosto 1.8 → 1ra=15, 2da=27, 3ra=49...
// - mejoraCostoBase: precio de la primera mejora de nivel
// - factorMejora:    precio de mejora se multiplica por esto con cada nivel
// ----------------------------------------------------------------
const DEF_ESTRUCTURAS = {

  // --- TORRETAS: dispara proyectiles a los enemigos en su alcance ---
  torretas: {
    color: '#e74c3c',
    emoji: '🎯',
    radio: 20,

    baseDano:   15,    // Daño por proyectil en nivel 1
    factorDano: 1.5,   // Multiplicador de daño por nivel (+50% daño por nivel)

    baseCd:     1000,  // Dispara cada 1 segundo (1000 ms) en nivel 1
    factorCd:   0.85,  // Reduce 15% el tiempo de recarga por nivel (mayor cadencia)

    rango:      170,   // Radio de alcance de disparo en píxeles

    costoBase:        15,   // Precio de la primera torreta
    factorCosto:      1.8,  // Cuánto sube el precio al comprar más

    mejoraCostoBase:  30,   // Precio de la primera mejora de nivel
    factorMejora:     2.2,  // Cuánto sube el precio de mejora por nivel
  },

  // --- PINCHOS (mantenido por compatibilidad) ---
  pinchos: {
    color: '#c0392b',
    emoji: '📌',
    radio: 20,
    baseDps:   5,
    factorDps: 1.6,
    costoBase:        10,
    factorCosto:      1.8,
    mejoraCostoBase:  30,
    factorMejora:     2.2,
  },

  // --- BARRICADAS: muro con HP que bloquea físicamente ---
  barricadas: {
    color: '#2980b9',
    emoji: '🚧',
    radio: 22,

    baseHp:   200,    // HP de la barricada en nivel 1
    factorHp: 2.0,    // Multiplicador de HP por nivel (×2 por nivel)

    costoBase:        25,
    factorCosto:      1.9,

    mejoraCostoBase:  50,
    factorMejora:     2.4,

    costoReparar:     20,   // Precio base de reparar todas las barricadas
  },

  // --- BOMBAS: explosión en área con cooldown ---
  bombas: {
    color: '#e67e22',
    emoji: '💣',
    radio: 24,

    baseDano:   50,    // Daño por explosión en nivel 1
    factorDano: 1.7,   // Multiplicador de daño por nivel (+70% por nivel)

    baseCd:   5000,   // Cooldown en milisegundos (8 segundos en nivel 1)
    factorCd: 0.75,   // El cooldown se multiplica por esto por nivel
                      // (0.75 = reduce 25% el CD por nivel → más rápido)

    radioExplosion: 75,  // Radio del área de explosión en píxeles

    costoBase:        40,
    factorCosto:      2.0,

    mejoraCostoBase:  80,
    factorMejora:     2.5,
  },

};
