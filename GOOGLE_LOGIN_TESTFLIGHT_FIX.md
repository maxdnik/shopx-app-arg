# Fix TestFlight Google Login - ShopX

## Diagnóstico

El error mostrado en TestFlight es:

> Error 401: invalid_client
> The OAuth client was not found.

Esto ocurre dentro de `accounts.google.com`, antes de que la app llame a `/api/app/auth/google` en la web. Por lo tanto, el backend no llega a intervenir todavía.

En el zip de la app, el OAuth iOS Client ID está hardcodeado en tres lugares:

- `lib/google-auth-config.ts`
- `app.json > expo.ios.infoPlist.GIDClientID`
- `app.json > plugins > @react-native-google-signin/google-signin > iosUrlScheme`

El valor actual es:

```txt
935352834479-alqde8iks44c9l892mm1nmrrmt65vdgqc.apps.googleusercontent.com
```

Google está rechazando ese client ID. La causa práctica es que ese OAuth Client ID iOS no existe, fue eliminado, pertenece a otro proyecto o no corresponde al bundle iOS de producción.

## Qué hay que hacer en Google Cloud

Crear/revisar una credencial OAuth Client ID de tipo **iOS** con:

```txt
Bundle ID: com.maximodimnik.shopx
```

Copiar:

```txt
Client ID: xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
Reversed Client ID: com.googleusercontent.apps.xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Qué modifica este fix

Agrega `app.config.js` para que Expo/EAS tome los IDs de variables de entorno y no vuelva a quedar un iOS Client ID viejo hardcodeado dentro del build.

Reemplaza `lib/google-auth-config.ts` para que no use fallback hardcodeado de iOS.

Ajusta `app/(tabs)/profile.tsx` para mostrar un error claro si falta la configuración antes de abrir Google.

## Variables a cargar en EAS antes del build iOS

```txt
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=935352834479-pdl30nl91se82noe814lup4gv4o9or03.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=PEGAR_ACA_EL_CLIENT_ID_IOS_REAL.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_REVERSED_CLIENT_ID=com.googleusercontent.apps.PEGAR_ACA_EL_CLIENT_ID_IOS_REAL_SIN_.apps.googleusercontent.com
```

Ejemplo para construir luego:

```bash
eas build --platform ios --profile production --clear-cache
```

## Variables a cargar en Vercel

En el proyecto web, el endpoint `src/app/api/app/auth/google/route.ts` ya acepta varios audiences. Igual conviene cargar el iOS Client ID real:

```txt
GOOGLE_CLIENT_ID=935352834479-pdl30nl91se82noe814lup4gv4o9or03.apps.googleusercontent.com
GOOGLE_WEB_CLIENT_ID=935352834479-pdl30nl91se82noe814lup4gv4o9or03.apps.googleusercontent.com
GOOGLE_IOS_CLIENT_ID=PEGAR_ACA_EL_CLIENT_ID_IOS_REAL.apps.googleusercontent.com
```

Después redeploy de Vercel.

## Validación rápida

1. Correr `npx expo config --type public` y confirmar que aparezcan:
   - `ios.infoPlist.GIDClientID` con el nuevo iOS Client ID real.
   - `ios.infoPlist.GIDServerClientID` con el Web Client ID.
   - `plugins.@react-native-google-signin/google-signin.iosUrlScheme` con el Reversed Client ID.
2. Generar build nuevo de TestFlight con `--clear-cache`.
3. Probar login con Google.
4. Si Google abre y vuelve a la app pero falla después, revisar logs de Vercel de `/api/app/auth/google`; ese sería un problema posterior de audience/token, no el 401 actual.
