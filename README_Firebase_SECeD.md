# Sincronización por tramo (Firebase) — SECeD - Control

Con esto podrás tener **editor** y **visor** viendo el mismo tramo en tiempo real.

## Publicar en GitHub Pages
1. Sube todos estos archivos a la **raíz** del repositorio (no dentro de una subcarpeta).
2. Activa Pages: Settings → Pages → Deploy from a branch → `main` / `(root)`.

## Configurar Firebase
1. https://console.firebase.google.com → **Add project**.
2. **Build → Firestore Database** → Create database (Production).
3. **Project settings (⚙️) → Your apps → Web app** → copia `firebaseConfig`.
4. Edita `firebase-config.js` y pega tu config:
```js
window.FIREBASE_CONFIG = {
  apiKey: "…",
  authDomain: "…",
  projectId: "…",
  storageBucket: "…",
  messagingSenderId: "…",
  appId: "…"
};
```
5. (Para pruebas) Reglas abiertas (NO en producción):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /tramos/{tramo} {
      allow read, write: if true;
    }
  }
}
```

## Uso
- **Editor:** `https://TU-USUARIO.github.io/TU-REPO/?tramo=mi-tramo`
- **Visor:** `https://TU-USUARIO.github.io/TU-REPO/?viewer=1&tramo=mi-tramo`

Si no pones `?tramo=…`, la app lo pide al abrir.  
Sin Firebase, funcionará en **localStorage** (solo este navegador).

## Notas
- Cambiar tramo: añade `?tramo=otro-tramo` o borra `sessionStorage`.
- El reloj toma hora de Internet (WorldTimeAPI).
