# Carpeta de Imágenes del Juego

Coloca aquí las imágenes para personalizar el juego.
Si las imágenes no existen, el juego usa dibujos de respaldo automáticamente.

## Archivos esperados

| Archivo          | Usado para                        | Tamaño recomendado |
|------------------|-----------------------------------|--------------------|
| `torretas.png`   | Estructura de torreta en el mapa  | 64×64 px           |
| `barricadas.png` | Estructura de barricada en el mapa| 64×64 px           |
| `bombas.png`     | Estructura de bomba en el mapa    | 64×64 px           |
| `chadtriel.png`  | Sprite de enemigo normal          | 64×64 px           |
| `jefe.png`       | Sprite del jefe (Chadtriel T. Pardo) | 64×64 px        |

## Tips

- Usa imágenes con fondo transparente (`.png`) para mejor resultado.
- El juego escala las imágenes automáticamente al tamaño necesario.
- Si la imagen falla al cargar, el juego usa el dibujo de respaldo sin errores.
