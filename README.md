# Finanzas Personales

## Estructura del proyecto

```
finanzas-app/
├── formulario.html        ← App de registro (móvil)
├── dashboard.html         ← Dashboard de análisis
├── fav_formulario.svg
├── fav_dashboard.svg
│
├── css/
│   ├── global.css         ← Variables y reset compartido
│   ├── formulario.css     ← Estilos del formulario
│   └── dashboard.css      ← Estilos del dashboard
│
└── js/
    ├── firebase-config.js ← Firebase (módulo ES) — compartido
    ├── formulario.js      ← Lógica del formulario
    └── dashboard.js       ← Lógica del dashboard
```

## Cómo funciona la arquitectura

- `firebase-config.js` se carga como `<script type="module">` y expone
  todas las funciones en `window._*` para que los scripts normales puedan usarlas.
- Cuando el estado de auth cambia, llama a `window.onFirebaseUser(user)` o
  `window.onFirebaseSignOut()`, que cada página define en su propio JS.
- Los archivos CSS son independientes; `global.css` existe para futuras
  variables o componentes compartidos.

## Despliegue

Servir desde cualquier servidor estático (Firebase Hosting, Netlify, Vercel, etc).
No requiere build step — vanilla JS/CSS/HTML puro.
