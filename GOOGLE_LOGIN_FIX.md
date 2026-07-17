# Google Login - diagnóstico real

La app actual NO está usando `@react-native-google-signin/google-signin`. El ZIP actual usa este flujo:

- `app/(tabs)/profile.tsx` abre un navegador con `WebBrowser.openAuthSessionAsync()`.
- La URL inicial la construye `lib/auth.ts`:
  `/api/app/auth/google/start?returnUrl=...`.

Por eso, si Google muestra `400` o `401 invalid_client` dentro de `accounts.google.com`, el error está en el backend que genera la URL de Google, no en la pantalla de la app.

En Vercel/web revisá estas variables de producción:

- `GOOGLE_WEB_CLIENT_ID`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` o equivalente

El endpoint `/api/app/auth/google/start` debe usar un OAuth Client ID de tipo Web, no iOS. Ese Web Client ID debe existir en Google Cloud y su callback autorizado debe coincidir exactamente con la URL que usa el backend.

Prueba rápida:

```bash
curl -I "https://www.shopx-ar.com/api/app/auth/google/start?returnUrl=shopxapp%3A%2F%2Fauth%2Fgoogle%2Fcallback"
```

Mirá el header `Location`. Tiene que contener un `client_id` real de Google Cloud. Si contiene un ID viejo, un ID iOS, `NUEVO_IOS_CLIENT_ID`, o un client eliminado, Google va a mostrar `invalid_client`.
