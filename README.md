# Notes_VTT 🎵

PWA de notas musicales: guardá letras, ideas y rimas de tus canciones con chips de links directos a los beats de YouTube.

**App en vivo:** https://notes-vtt.web.app

## ✨ Características

- Notas con nombre de canción, beat (nombre o link de YouTube) y contenido
- Los links pegados se vuelven clickeables y se detectan como chips de beat
- Paleta de 6 colores para las notas (azul eléctrico, cian, morado, rosa, verde, ámbar)
- Búsqueda instantánea por título y contenido
- Login con Google — cada usuario ve solo sus notas (Firestore + reglas por `ownerId`)
- Sincronización en tiempo real entre dispositivos (Firestore `onSnapshot` + cache persistente offline)
- Funciona sin internet (Service Worker + cache local)
- Chapa de artista (apodo) personal
- Diseño dark pixel-art: fuentes Press Start 2P, Bungee y Sora, iconos pixel y estética de vinilo

## 🛠 Stack

- HTML/CSS/JS vanilla (sin frameworks)
- Firebase Hosting, Firestore y Authentication (Google) — SDK v10.12.2 por CDN
- Service Worker propio para modo offline

## 📦 Estructura

```
Notes_VTT/
├── index.html          # markup principal
├── css/styles.css      # estilos
├── js/app.js           # lógica (auth, Firestore, render)
├── sw.js               # service worker (offline)
├── manifest.json       # manifiesto PWA
├── img/                # imágenes (iconos pixel, fondo, máscara)
└── icons/              # iconos de la PWA (192/512)
```

## 🚀 Deploy

```bash
firebase deploy --only hosting --project notes-vtt
```

> Nota: al cambiar CSS/JS hay que subir la versión de los links (`?v=N` en index.html) y la versión del cache en `sw.js` para que los usuarios reciban la actualización.