# Plan: Oponentes IA + Selector de modo y tamaño

## 1. Contexto y objetivos

Añadir oponentes controlados por IA al Snake 3D, con selector de modo (Solo, vs 2, vs 3, vs 4) y selector de tamaño del tablero, manteniendo el diseño actual y sin romper la funcionalidad existente.

---

## 2. Decisiones de diseño

### 2.1 Modos de juego
| Modo | Jugadores | Serpientes IA |
|------|-----------|---------------|
| Solo (default) | 1 | 0 |
| vs 2 | 1 | 1 |
| vs 3 | 1 | 2 |
| vs 4 | 1 | 3 |

### 2.2 Colores de serpientes
- **Paleta disponible**: Verde (#00cc44), Rojo (#cc2222), Azul (#2266cc), Amarillo (#ccaa00)
- **Selector de color del jugador**: 4 botones tipo "chip" en la pantalla de inicio. Verde es el color por defecto.
- **Asignación de colores a IA**:
  - Las serpientes IA eligen color aleatoriamente de los 3 colores restantes (excluyendo el color del jugador)
  - Los colores de las IA no se repiten entre ellas
  - Ejemplo: si el jugador elige Verde, las IA reparten Rojo, Azul y Amarillo al azar
  - En modo vs 2 (1 IA): elige 1 de los 3 restantes al azar
  - En modo vs 3 (2 IA): reparten 2 de los 3 restantes al azar
  - En modo vs 4 (3 IA): usan los 3 restantes (única combinación posible)

### 2.3 Tamaño del tablero
- **Base**: GRID_SIZE = 22 (actual)
- **Escalado por modo**:
  - Solo: ×1.0 → 22
  - vs 2: ×1.25 → 28
  - vs 3: ×1.50 → 33
  - vs 4: ×1.75 → 39
- **Modificador manual**: ±50% sobre el tamaño del modo
  - Límite mínimo: 16
  - Límite máximo: 50
- **Ejemplo**: Modo "vs 3" (base 33) con -50% → 16 (límite), con +50% → 49 (redondeado)

### 2.4 High Score independiente
Cada combinación modo+tamaño+dificultad tiene su propio record:
- Key en localStorage: `snake3d_hs_{mode}_{gridSize}_{difficulty}`
- Ejemplo: `snake3d_hs_solo_22_easy`, `snake3d_hs_vs4_39_hard`
- El contador de partidas (`snake3d_games`) sigue siendo global

### 2.5 Dificultad de la IA
| Dificultad | Comete errores | Estrategia | Agresividad |
|------------|----------------|------------|-------------|
| **Fácil** | ~30% de las veces elige dirección aleatoria entre las seguras | Busca manzana más cercana, sin táctica | 0% — solo supervivencia |
| **Medio** (default) | ~10% de errores aleatorios | Busca manzana + intenta cortar rutas de **cualquier otra serpiente** (jugador u otras IA) | 40% — intenta arrinconar a cualquier serpiente más corta si tiene ventaja de longitud |
| **Difícil** | ~2% de errores (casi perfecto) | Planifica 2-3 pasos adelante, prioriza manzanas estratégicas | 70% — agresivo con **todas las serpientes**: bloquea pasillos, fuerza a cualquier serpiente a zonas peligrosas |

**Detalle del comportamiento por nivel**:

- **Fácil**:
  - 70% de las veces elige la dirección óptima hacia la manzana más cercana
  - 30% elige al azar entre las direcciones seguras (puede girar sin razón)
  - No intenta interactuar con **ninguna otra serpiente** (jugador u otras IA) más allá de evitar colisiones
  - Al morir, su cuerpo queda como cadáver permanente (obstáculo)

- **Medio**:
  - 90% óptimo, 10% error aleatorio
  - Detecta si **cualquier otra serpiente** (jugador u otra IA) se acerca a un pasillo estrecho y se posiciona para bloquearla
  - Si es más larga que **otra serpiente**, prioriza cortar su ruta sobre comer
  - Respeta una "zona de respeto" de 3 celdas alrededor de **cualquier otra serpiente** (no entra a menos que sea ventajoso)

- **Difícil**:
  - 98% óptimo, 2% error (para que sea vencible)
  - Mira 2-3 pasos adelante: evalúa no solo la celda destino, sino a dónde la lleva
  - Bloquea activamente pasillos y esquinas donde **cualquier otra serpiente** (jugador u otra IA) podría refugiarse
  - Si **otra serpiente** comete un error (se queda en zona cerrada), la IA aprovecha inmediatamente para arrinconarla
  - Prioriza crecer para tener más ventaja de bloqueo contra **todas las serpientes**
  - **Siempre vencible**: el jugador habilidoso puede ganar evitando zonas de conflicto y comiendo primero

### 2.6 Comportamiento IA (común a todos los niveles)
- **Movimiento**: Cada IA se mueve al mismo ritmo que el jugador (MOVE_INTERVAL)
- **Lógica base de decisión**:
  1. Evaluar las 3 direcciones posibles (continuar, izquierda, derecha)
  2. Descartar las que matan (pared, cuerpo propio, cuerpo de otra serpiente, obstáculo, cadáver)
  3. Aplicar estrategia según dificultad (ver tabla arriba)
  4. Si ninguna dirección es segura, la IA muere y su cuerpo queda como cadáver permanente
- **Colisiones** (las serpientes IA se comportan como jugadores reales):
  - **Cabeza contra cuerpo**: Si la cabeza de una serpiente (jugador o IA) choca con el CUERPO (no la cabeza) de otra serpiente viva → la que choca muere, la otra sigue viva
  - **Cabeza contra cabeza**: Si dos serpientes chocan cabeza con cabeza al mismo tiempo → ambas mueren
  - **IA contra IA**: Misma regla que arriba — cabeza contra cuerpo mata solo a la que choca, cabeza contra cabeza mata a ambas
  - **Jugador contra IA**: Misma regla — si el jugador choca con el cuerpo de una IA, el jugador muere; si la IA choca con el cuerpo del jugador, la IA muere; cabeza con cabeza → ambos mueren
  - **Contra obstáculos estáticos**: Pared, obstáculo, cadáver → muere quien choca
- **Cadáveres**:
  - Cuando una IA muere, su cuerpo se queda en el tablero como obstáculo permanente (no desaparece, no respawnea)
  - Los cadáveres se tratan como obstáculos: bloquean el paso de jugador e IA
  - Se renderizan con un tono grisáceo/oscurecido para distinguirlos de las IA vivas
  - Los cadáveres cuentan para `isOccupied()` y `isSafeForObstacle()`
- **Comer manzanas**: Las IA también comen manzanas y crecen. Las manzanas comidas por IA no dan puntos al jugador.
- **Sin respawn**: Las IA no respawnean. Una vez muertas, su cadáver queda como obstáculo permanente

### 2.7 UI/UX
- **Pantalla de inicio** (overlay):
  - Selector de color: 4 botones tipo "chip" con punto de color (Verde | Rojo | Azul | Amarillo) — Verde seleccionado por defecto
  - Selector de modo: botones tipo "chip" (Solo | vs 2 | vs 3 | vs 4)
  - Selector de dificultad: botones tipo "chip" (Fácil | Medio | Difícil) — solo visible en modos vs
  - Selector de tamaño: slider con valor actual y base del modo
  - Botón JUGAR (mismo estilo actual)
  - La subtítulo cambia según el modo
- **HUD**:
  - Mostrar puntuación del jugador (actual)
  - Mostrar high score del modo/tamaño actual
  - Opcional: mini-barra de longitud de cada IA (para competitividad)
- **Game Over**:
  - Mensaje indica si fue por pared, cuerpo propio, obstáculo, o serpiente IA

---

## 3. Arquitectura de cambios

### 3.1 Nuevos archivos
| Archivo | Propósito |
|---------|-----------|
| `js/ai.js` | Lógica de IA: decisión de dirección (con niveles de dificultad), movimiento, detección de colisiones, cadáveres, táctica de arrinconamiento |
| `js/ui.js` | Gestión de la UI del overlay: selector de color, selector de modo, selector de dificultad, selector de tamaño, actualización de labels y high score |

### 3.2 Archivos modificados
| Archivo | Cambios |
|---------|---------|
| `js/config.js` | Añadir constantes de colores (`SNAKE_COLORS`), colores de IA, parámetros de dificultad, función `resolveGridSize(mode, modifier)` |
| `js/state.js` | Añadir `aiSnakes[]`, `gameMode`, `difficulty`, `playerColor`, `gridSize`, `gridSizeModifier` |
| `js/scene.js` | Reconstruir floor+walls dinámicamente según GRID_SIZE, ajustar fog |
| `js/snake.js` | Soportar múltiples serpientes con colores configurables, función `buildSnake(color)`, color del jugador desde `playerColor` |
| `js/apples.js` | `isOccupied()` debe incluir serpientes IA, `spawnOneApple()` respeta todas las serpientes |
| `js/obstacles.js` | `isSafeForObstacle()` debe incluir serpientes IA |
| `js/game.js` | `step()` incluye colisiones con IA, `initGame()` inicializa IA, `die()` acepta causa |
| `js/main.js` | Loop incluye `stepAI()`, botón JUGAR lee configuración de UI (modo + dificultad + tamaño) |
| `js/controls.js` | Sin cambios (solo controla al jugador) |
| `js/particles.js` | Sin cambios |
| `js/audio.js` | Opcional: SFX para muerte de IA |
| `index.html` | Añadir selectores de color, modo, dificultad y tamaño en el overlay, link a `js/ai.js` y `js/ui.js` |
| `css/style.css` | Estilos para selectores de color, modo, dificultad y tamaño |

### 3.3 Orden de carga (actualizado)
```
config → state → audio → scene → snake → apples → obstacles → particles → ai → game → controls → ui → main
```

### 3.4 Infraestructura de tests unitarios
- **Framework**: Jest (sin build step, se ejecuta directamente con `npx jest`)
- **Estrategia**: Tests de lógica pura (config, state helpers, IA decision, colisiones). El código de Three.js (rendering) queda fuera del scope.
- **Estructura**: Carpeta `tests/` con archivos `*.test.js`, uno por módulo testeable
- **Ejecución**: `npx jest` desde la raíz del proyecto (WSL)
- **Flujo de trabajo**:
  - **Fase 0**: Crear infraestructura de tests + tests del código EXISTENTE (baseline) antes de tocar nada
  - **Cada fase posterior**: Añadir tests para las nuevas funciones antes/durante la implementación
  - **Gate**: Los tests de la fase anterior deben pasar antes de empezar la siguiente fase
- **Cobertura objetivo**:
  - `config.js`: 100% (funciones puras: `resolveGridSize()`, validación de colores)
  - `state.js`: 90%+ (helpers: `getHighScoreKey()`, gestión de scores)
  - `ai.js`: 90%+ (decisión de dirección, evaluación de seguridad, asignación de colores, colisiones IA↔IA)
  - `apples.js`: 80%+ (`isOccupied()`, lógica de spawn)
  - `obstacles.js`: 80%+ (`isSafeForObstacle()`)
  - `game.js`: 70%+ (lógica de colisiones, causa de muerte)
  - `ui.js`: 60%+ (funciones puras: `getGameConfig()`, validación de inputs)
  - `snake.js`, `scene.js`, `main.js`, `controls.js`, `audio.js`, `particles.js`: sin tests (dependen de Three.js/DOM)

---

## 4. Plan de implementación (fases)

### Fase 0: Infraestructura de tests + baseline
- [x] 0.1 Crear `package.json` con Jest como dependencia de desarrollo
- [x] 0.2 Crear carpeta `tests/` y archivo `tests/config.test.js` con tests del código EXISTENTE de `config.js` (GRID_SIZE, MOVE_INTERVAL, TURN_ANGLE, NUM_APPLES, MAX_OBSTACLES, log/showErr)
- [x] 0.3 Crear `tests/state.test.js` con tests del código EXISTENTE de `state.js` (gameState, score, highScore, etc.)
- [x] 0.4 Crear `tests/apples.test.js` con tests de `isOccupied()` actual
- [x] 0.5 Crear `tests/obstacles.test.js` con tests de `isSafeForObstacle()` actual
- [x] 0.6 Verificar que todos los tests de baseline pasan (verde) antes de continuar
- [x] 0.7 Añadir script en `package.json`: `"test": "jest"` y `"test:watch": "jest --watch"`

### Fase 1: Infraestructura de configuración
- [x] 1.1 Modificar `config.js`: añadir constantes de colores (`SNAKE_COLORS` = Verde, Rojo, Azul, Amarillo), colores de IA, parámetros de dificultad, función `resolveGridSize()`
- [x] 1.2 Modificar `state.js`: añadir variables de modo, dificultad, `playerColor`, tamaño, serpientes IA
- [x] 1.3 Modificar `config.js`: hacer GRID_SIZE dinámico (se establece desde UI)
- [x] 1.4 **Tests**: Actualizar `tests/config.test.js` — tests de `resolveGridSize()` (todos los modos, límites 16/50, valores intermedios), validación de `SNAKE_COLORS`
- [x] 1.5 **Tests**: Actualizar `tests/state.test.js` — tests de nuevas variables de estado (`gameMode`, `difficulty`, `playerColor`)
- [x] 1.6 **Gate**: `npx jest` pasa antes de continuar (270 tests, 40/40 funciones 100%)

### Fase 2: UI de selección

### Fase 2: UI de selección
- [x] 2.1 Crear `js/ui.js`: funciones `buildColorSelector()`, `buildModeSelector()`, `buildDifficultySelector()`, `buildSizeSelector()`, `getGameConfig()`
- [x] 2.2 Modificar `index.html`: añadir contenedores para selectores (color, modo, dificultad, tamaño) en el overlay
- [x] 2.3 Modificar `css/style.css`: estilos para chips de color (con punto de color), chips de modo, chips de dificultad, y slider de tamaño
- [x] 2.4 Modificar `ui.js`: lógica de visibilidad (dificultad solo visible en modos vs)
- [x] 2.5 Modificar `ui.js`: actualizar highscoreEl al cambiar modo/dificultad/tamaño
- [x] 2.6 Modificar `main.js`: al pulsar JUGAR, leer config completa (color + modo + dificultad + tamaño) antes de `initGame()`
- [x] 2.7 **Tests**: Crear `tests/ui.test.js` — tests de `getGameConfig()` (combinaciones modo+dificultad+color+tamaño), validación de inputs
- [x] 2.8 **Gate**: `npx jest` pasa antes de continuar (284 tests, 41/49 funciones 84%)

### Fase 3: Escalado dinámico del tablero

### Fase 3: Escalado dinámico del tablero
- [x] 3.1 Modificar `scene.js`: función `rebuildBoard(gridSize)` que reconstruye floor+walls+fog
- [x] 3.2 Modificar `scene.js`: llamar `rebuildBoard()` desde `initGame()`
- [x] 3.3 Ajustar cámara inicial según tamaño del tablero
- [x] 3.4 **Gate**: `npx jest` pasa (284 tests, 41/50 funciones 82%)

### Fase 4: Múltiples serpientes (infraestructura)
- [x] 4.1 Modificar `snake.js`: `buildSnake(color)` acepta color, soporta múltiples grupos
- [x] 4.2 Modificar `snake.js`: `refreshSnake(snakeData, groupIndex)` soporta múltiples serpientes
- [x] 4.3 Modificar `apples.js`: `isOccupied()` incluye serpientes IA
- [x] 4.4 Modificar `obstacles.js`: `isSafeForObstacle()` incluye serpientes IA
- [x] 4.5 **Tests**: Actualizar `tests/apples.test.js` — `isOccupied()` con serpientes IA en la celda, sin IA en la celda
- [x] 4.6 **Tests**: Actualizar `tests/obstacles.test.js` — `isSafeForObstacle()` con serpientes IA cercanas
- [x] 4.7 **Gate**: `npx jest` pasa antes de continuar (314 tests)

### Fase 5: Lógica de IA (1-3 oponentes, 3 niveles de dificultad)
- [x] 5.1 Crear `js/ai.js`: estructura de datos para IA (snake, direction, color, alive, corpse) — hasta 3 instancias
- [x] 5.2 Implementar `initAI()`: crear serpientes IA según modo (vs2=1, vs3=2, vs4=3) en posiciones seguras, asignar colores aleatorios de los 3 restantes (excluyendo el color del jugador, sin repetir entre IA)
- [x] 5.3 Implementar `aiEvaluateDirections(aiIndex)`: evaluar las 3 direcciones posibles, descartar las letales
- [x] 5.4 Implementar `aiDecideDirection(aiIndex, difficulty)`:
  - Fácil: 70% óptimo, 30% aleatorio entre seguras
  - Medio: 90% óptimo, 10% aleatorio + táctica de arrinconamiento contra **cualquier otra serpiente** (40%)
  - Difícil: 98% óptimo, 2% aleatorio + táctica de arrinconamiento contra **cualquier otra serpiente** (70%) + lookahead 2-3 pasos
- [x] 5.5 Implementar `aiCorneringStrategy(aiIndex, targetIndex)`: detectar pasillos estrechos, posicionar para bloquear a **cualquier otra serpiente** (jugador u otra IA) — la IA evalúa agresividad contra todas las serpientes del tablero
- [x] 5.6 Implementar `stepAI()`: mover todas las IA, detectar colisiones, comer manzanas
- [x] 5.7 Implementar `aiDie(aiIndex)`: muerte + partículas + convertir cuerpo en cadáver permanente
- [x] 5.8 **Tests**: Crear `tests/ai.test.js` — tests de:
  - `aiEvaluateDirections()`: dirección segura vs letal (pared, cuerpo propio, cuerpo de otra serpiente, obstáculo, cadáver)
  - `aiDecideDirection()`: distribución de errores por dificultad (Fácil 30%, Medio 10%, Difícil 2%)
  - `initAI()`: número de IA por modo, asignación de colores (sin repetir, sin igualar al jugador)
  - `aiDie()`: conversión a cadáver, estado `alive=false`
  - `nearestApple()`: manzana más cercana por Manhattan distance
  - `aiCorneringStrategy()`: arrinconamiento de serpientes más cortas
  - `stepAI()`: movimiento, colisiones, comer manzanas
  - `refreshAISnakes()`: renderizado de mallas IA
- [x] 5.9 Modificar `main.js`: llamar `stepAI()` en el loop + `refreshAISnakes()`
- [x] 5.10 **Tests**: Crear `tests/ui-dom.test.js` — tests de funciones DOM de UI (buildColorSelector, buildModeSelector, etc.)
- [x] 5.11 **Gate**: `npx jest` pasa antes de continuar (344 tests, 57/58 funciones 98%)

### Fase 6: Colisiones jugador ↔ IA
- [x] 6.1 Modificar `game.js`: `step()` detecta colisión con cuerpo de IA → `die('ai')`
- [x] 6.2 Modificar `game.js`: `step()` detecta colisión con cadáveres → `die()`
- [ ] 6.3 Modificar `game.js`: `die(cause)` acepta causa, muestra mensaje apropiado
- [ ] 6.4 Modificar `index.html`: overlay muestra causa de muerte
- [ ] 6.5 **Tests**: Crear `tests/game.test.js` — tests de:
  - Colisión cabeza contra cuerpo (solo muere la que choca)
  - Colisión cabeza contra cabeza (ambas mueren)
  - IA↔IA: cabeza contra cuerpo, cabeza contra cabeza
  - Jugador↔IA: cabeza contra cuerpo, cabeza contra cabeza
  - Causa de muerte: `'wall'`, `'self'`, `'obstacle'`, `'corpse'`, `'ai'`
- [ ] 6.6 **Gate**: `npx jest` pasa antes de continuar

### Fase 7: High Score por modo/dificultad/tamaño
- [ ] 7.1 Modificar `state.js`: función `getHighScoreKey(mode, difficulty, gridSize)`
- [ ] 7.2 Modificar `game.js`: `die()` guarda high score con key específica (incluye dificultad)
- [ ] 7.3 Modificar `ui.js`: actualizar highscoreEl al cambiar modo/dificultad/tamaño
- [ ] 7.4 **Tests**: Actualizar `tests/state.test.js` — tests de `getHighScoreKey()` (todas las combinaciones modo/dificultad/tamaño), lectura/escritura de scores
- [ ] 7.5 **Gate**: `npx jest` pasa antes de continuar

### Fase 8: Pulido y testing
- [ ] 8.1 **Tests finales**: `npx jest` — todos los tests pasan, revisar cobertura (`npx jest --coverage`)
- [ ] 8.2 Verificar que modo "Solo" funciona igual que antes
- [ ] 8.3 Verificar modos vs 2 (1 IA), vs 3 (2 IA), vs 4 (3 IA)
- [ ] 8.4 Verificar dificultad Fácil (errores ~30%, sin táctica)
- [ ] 8.5 Verificar dificultad Medio (errores ~10%, arrinconamiento 40%)
- [ ] 8.6 Verificar dificultad Difícil (errores ~2%, arrinconamiento 70%, lookahead)
- [ ] 8.7 Verificar que en Difícil el jugador habilidoso puede ganar
- [ ] 8.8 Verificar selector de tamaño en límites (16 y 50)
- [ ] 8.9 Verificar high scores independientes por modo/dificultad/tamaño
- [ ] 8.10 Verificar en móvil (responsive)
- [ ] 8.11 Ajustar parámetros de dificultad si es necesario
- [ ] 8.12 **Tests**: Añadir tests para cualquier edge case descubierto durante el testing manual

---

## 5. Consideraciones técnicas

### 5.1 Rendimiento
- El floor checkerboard se reconstruye solo al iniciar partida (no cada frame)
- Las serpientes IA comparten geometría/material (solo cambian color del material)
- Máximo 5 serpientes simultáneas → impacto mínimo en rendimiento

### 5.2 IA - Algoritmo de decisión base
```
Para cada dirección posible (actual, izquierda, derecha):
  1. Calcular celda destino
  2. Verificar si es segura (no pared, no cuerpo, no obstáculo)
  3. Si es segura, calcular distancia a manzana más cercana
  4. Elegir dirección con menor distancia a manzana
Si ninguna dirección es segura:
  Elegir la que da más tiempo (mayor distancia al obstáculo más cercano)
```

### 5.3 IA - Modificadores por dificultad
```
FÁCIL:
  - 70% probabilidad: usar algoritmo base (óptimo)
  - 30% probabilidad: elegir al azar entre direcciones seguras
  - Sin táctica de arrinconamiento

MEDIO:
  - 90% probabilidad: usar algoritmo base
  - 10% probabilidad: elegir al azar entre seguras
  - 40% de los ticks: activar táctica de arrinconamiento
    → Si la IA es más larga que el jugador y detecta pasillo estrecho,
      prioriza posicionarse para bloquear la ruta del jugador

DIFÍCIL:
  - 98% probabilidad: usar algoritmo base con lookahead de 2-3 pasos
    → No solo evalúa la celda destino, sino a dónde la lleva en 2-3 ticks
  - 2% probabilidad: elegir al azar (para que sea vencible)
  - 70% de los ticks: activar táctica de arrinconamiento agresiva
    → Bloquea pasillos, fuerza al jugador a zonas con menos espacio
    → Prioriza crecer para tener más ventaja de bloqueo
```

### 5.4 IA - Táctica de arrinconamiento
- Detectar si el jugador está a ≤5 celdas de una pared o zona cerrada
- Si la IA puede posicionarse entre el jugador y la salida de esa zona, lo hace
- En Medio: solo si la IA es más larga que el jugador
- En Difícil: siempre, incluso si la IA es más corta (apuesta a crecer rápido)

### 5.3 Posiciones iniciales de IA
- Distribuir serpientes IA en esquinas opuestas del tablero
- Distancia mínima entre serpientes al inicio: GRID_SIZE / 3
- La serpiente del jugador siempre empieza a la izquierda (como ahora)

### 5.4 Sincronización de movimiento
- Jugador e IA se mueven en el mismo tick (cada MOVE_INTERVAL ms)
- Primero se mueven las IA, luego el jugador (para que el jugador vea el resultado)
- Esto evita que el jugador se beneficie de moverse "después" de ver la IA

---

## 6. Rollback plan

Si algo falla:
1. Los archivos nuevos (`js/ai.js`, `js/ui.js`) se pueden eliminar
2. Los archivos modificados tienen secciones claramente marcadas con comentarios `// ─── AI MODE ───`
3. El modo "Solo" con GRID_SIZE=22 debe funcionar idéntico al código actual

---

## 7. Hoja de ruta futura (multijugador real)

Cuando se quiera añadir multijugador real:
- La lógica de IA (`js/ai.js`) se puede reemplazar por mensajes WebSocket
- La estructura de `aiSnakes[]` es compatible con jugadores remotos
- Solo cambiaría la fuente de las decisiones de dirección (local vs remoto)
- Se necesitaría un servidor (Node.js / Azure Functions) para coordinar
