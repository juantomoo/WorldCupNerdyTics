# FIFA World Cup 2026 · Nerdytics v2.1 vanilla

Plataforma de visualización de datos en tiempo real y predicciones con IA para el Mundial FIFA 2026.

## Cambios en esta versión (v2.1)

### 🐛 Fix: "Partidos de Hoy" usa fecha local del PC
Antes la sección **Partidos de Hoy** comparaba fechas en UTC (`toISOString().slice(0, 10)`), lo que omitía partidos del día local cuando el usuario estaba en husos horarios negativos (ej. EDT, PDT, etc.).

Ahora se usa la fecha local del dispositivo (`fmtLocalDateKey`) tanto para "hoy" como para cada partido, así que muestra **todos los partidos del día calendario local**.

### 📺 Nueva función: DSports TV (reproductor + 12 mirrors)
Vista dedicada con un reproductor de vídeo en vivo que muestra el canal DSports con **12 mirrors alternativos** (los 10 primeros del playlist + DSports 2 HD y DSports HD como respaldo).

**Características del reproductor:**
- **HLS.js** (CDN: jsdelivr) con fallback automático a HLS nativo en Safari/iOS.
- **Selector lateral** con los 12 mirrors — un click cambia el canal sin recargar la página.
- **Auto-failover** (8 s) si una fuente no responde: salta al siguiente mirror.
- **Modo Auto**: prueba todos los mirrors en orden y deja el primero que cargue.
- **Estado en vivo**: cada canal muestra un dot (gris = idle, cyan parpadeante = cargando, verde = en vivo, rojo = falló).
- **Controles custom**: silenciar (M), Picture-in-Picture (P), pantalla completa (F).
- **Atajos de teclado**: M (mute), F (fullscreen), P (PiP).
- **Stats en vivo**: mirror activo, estado, resolución, bitrate (cuando HLS.js está disponible).
- **Responsive**: lista de canales al costado en desktop, debajo del reproductor en móvil.
- **Cleanup automático**: al cambiar de tab, pausa el vídeo y libera la instancia HLS.js.

## Stack

- HTML/CSS/JS vanilla (sin frameworks)
- Datos en tiempo real vía ESPN API
- Predicción: Poisson + Dixon-Coles + Elo
- Simulación Monte Carlo (10.000 escenarios)
- PWA (offline-ready)
- i18n ES/EN

## Estructura

```
wc26-vanilla/
├── index.html              # Entry point
├── app.css                 # Estilos (incluye reproductor DSports)
├── app.js                  # Lógica de vistas, router, reproductor
├── data.js                 # Equipos, H2H, **DSPORTS_CHANNELS**
├── espn.js                 # Wrapper ESPN API
├── i18n.js                 # Traducciones
├── montecarlo.js           # Simulación de torneo
├── predictor.js            # Predicción Poisson + Dixon-Coles + Elo
├── state.js                # Settings, favoritos, predicciones
├── sw.js                   # Service Worker (PWA)
└── manifest.webmanifest    # PWA manifest
```

## Cómo ejecutar

```bash
# Cualquier servidor estático
python3 -m http.server 8000
# o
npx serve .
```

Abrir `http://localhost:8000`.

## Tests E2E (Playwright)

```bash
node test_dsports.mjs
```

Verifica:
- Tab DSports en sidebar
- 12 canales en lista
- Cambio de canal funciona
- Responsive (375 / 768 / 1440)
- Cleanup al salir del tab
- Sin errores JS
