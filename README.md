# Nos invaden los Chadtrieles!!!
Juego incremental con mecánicas gacha
En el juego, el malvado Chadtriel T. Pardo invade la escuela, enviando un ejercito de Chadtrieles, tu, como la ultima esperanza debes detenerlos y finalmente vencer a Chadtriel.

Aquí tienes una documentación clara, estructurada y sencilla enfocada exclusivamente en la parte del **juego incremental** para tu proyecto escolar:

---

# Documentación del Proyecto: Nos invaden los Chadtrieles

## 1. Módulo Incremental (Defensa de la Escuela)

### 1.1. Premisa y Objetivo

El malvado **Chadtriel T. Pardo** intenta invadir la escuela enviando hordas continuas de **Chadtrieles**. El objetivo principal del jugador es defender la entrada de la escuela (Punto X) eliminando a los enemigos antes de que rompan las defensas.

---

### 1.2. Bucle Principal de Juego (Game Loop)

El sistema incremental se basa en el avance constante de los enemigos y la acumulación progresiva de recursos:

1. **Aparición de enemigos:** Los Chadtrieles avanzan por el pasillo hacia la escuela en oleadas infinitas.
2. **Defensa:** Las estructuras colocadas en el camino dañan, frenan o destruyen a los enemigos.
3. **Recompensa:** Cada Chadtriel eliminado otorga **Monedas Escolares** (u oro/puntos).
4. **Inversión:** El jugador usa las monedas para construir/mejorar estructuras o para usar el sistema Gacha.

---

### 1.3. Unidades Defensivas (Estructuras)

El jugador cuenta con 3 tipos de defensas para ralentizar y frenar la invasión:

| Estructura | Función Principal | Mecánica Incremental |
| --- | --- | --- |
| **Pinchos** | Daño por contacto / pasivo | Al subir de nivel, aumenta el daño por segundo (DPS) a todos los Chadtrieles que caminen sobre ellos. |
| **Barricadas** | Freno físico (muro) | Cuentan con puntos de vida (HP). Detienen la marcha de los Chadtrieles hasta ser destruidas. Se pueden reparar o subir de vida máxima. |
| **Bombas** | Daño masivo en área | Tienen un tiempo de recarga (Cooldown). Explotan al detectar varios Chadtrieles juntos, causando gran daño a varios objetivos. |

---

### 1.4. Progresión Incremental y Escalado

Para mantener la dificultad y el interés a lo largo del tiempo, el juego escala automáticamente:

* **Dificultad de la Horda:** Con cada oleada superada, los Chadtrieles ganan más vida y aumentan en numero.
* **Costo de Estructuras:** Cada vez que compras o mejoras un tipo de estructura, el precio de la siguiente mejora aumenta exponencialmente.
* **Jefe Final (Chadtriel T. Pardo):** Aparece cada cierto número de oleadas (ejemplo: cada 10 oleadas) como un enemigo especial con una gran barra de vida.

Integrantes:
Benjamín
