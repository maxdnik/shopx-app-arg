# ShopX 1.2.0

Actualización preparada el 13 de septiembre de 2026 contra la web de ShopX y el catálogo vigente.

## Paquetes finales

Código compilado: `202c0d6748d7942cac901e0e3f46cd86e4979336`. Ambos builds terminaron correctamente y están firmados para las tiendas. Las modificaciones posteriores a esa revisión sólo documentan la entrega.

| Plataforma | Versión | Build | Descarga |
| --- | --- | --- | --- |
| iOS | 1.2.0 (38) | [Expo iOS](https://expo.dev/accounts/maxdnik/projects/shopx/builds/d6903a2c-b22e-494c-b378-92a7af78ed8c) | [IPA](https://expo.dev/artifacts/eas/AdksBE9gIh25ebU2s82qhIfNZ7mhDx6KXdH9hAaELSw.ipa) |
| Android | 1.2.0 (8) | [Expo Android](https://expo.dev/accounts/maxdnik/projects/shopx/builds/589cb20c-6ba1-4983-806e-a46601e7d18e) | [AAB](https://expo.dev/artifacts/eas/hebiCK7PKOzapCKvfHS9eHuaBKU6yrzTtslheBm4qlk.aab) |

No se ejecutó EAS Submit ni se enviaron estos builds a las tiendas. El IPA requiere distribución mediante App Store Connect/TestFlight; el AAB se carga en Google Play.

## Cambios para clientes

- Inicio con la selección semanal y las mismas categorías de la web, acceso a tiendas, búsqueda y cotización por link.
- Catálogo paginado y filtros obtenidos del servidor.
- Cotizaciones automáticas de hasta cinco links; cantidades, vigencia y errores por tienda. Solicitudes manuales para otras tiendas.
- Mis cotizaciones: historial, confirmación de datos fiscales y entrega, pago y agrupación con vista previa.
- Carrito con cálculo completo de la operación en el servidor y revisión obligatoria si cambia el total antes del pago.
- Productos externos con cotización real; conservación de variantes, color, talle y cantidad.
- Resumen de cargos que conserva impuestos, derechos, tasas y descuentos.
- Fotos ampliables y seguimiento por producto y entrega parcial.
- Acceso nativo de Google en iOS y Android; registro del esquema iOS en el build y manejo de cancelación.

## Dependencia de servidor

La API compatible ya se integró y desplegó en producción mediante la PR de servidor #303. Incorpora `POST /api/app/cart/preview`, el cálculo compartido con checkout y la selección semanal en `/api/app/home-sections`. Esta app bloquea el pago si no puede confirmar el importe; no sustituye una falla del servidor por un precio local.

## Verificación realizada

- TypeScript: sin errores.
- Cinco pruebas de regresión de app: acceso nativo de Google, conservación de cargos, carrito concurrente y atómico, identidad de variantes y conversión de cotizaciones.
- Cinco pruebas de API: cambio de importe sin crear pagos, importe canónico, compatibilidad anterior, validación de cantidades y cálculo de aranceles de la operación con los tipos de cambio del servidor.
- Expo Doctor: 18/18 verificaciones aprobadas.
- Exportación de bundles JavaScript y recursos para iOS, Android y web completada.
- Lint: sin errores; quedan advertencias previas de dependencias de hooks y constantes sin uso.

Además de estos controles, se generaron el IPA y el AAB firmados indicados arriba. Las pruebas automáticas y la compilación no reemplazan la prueba en dispositivos. El navegador de revisión no pudo abrir la vista local; la inspección visual de la app nueva está pendiente.

## Pasos para publicar

1. API compatible desplegada. Se confirmó el catálogo real (40 productos por categorías y 8 semanales), y un carrito real devolvió HTTP 200 con checkout habilitado y siete filas de desglose. Completar el recorrido de compra desde los builds finales.
2. Ejecutar `npm ci` y `npm run verify:release` en esta revisión.
3. Usar los paquetes finales de la tabla. Para regenerar después de cambios, iniciar sesión con la cuenta autorizada de Expo/EAS y ejecutar `eas build --platform all --profile production`. Se conservan el proyecto EAS, los identificadores y el esquema de ShopX; EAS administra el incremento de build remoto. Versión comercial: 1.2.0.
4. Probar el build firmado en iPhone y Android: inicio de sesión Google/Apple según plataforma, CUIT y dirección, catálogo y variantes, agregar/quitar cantidades, resumen de precios, cotizaciones manuales y agrupadas, zoom y cierre de fotos, seguimiento parcial, retorno desde Mercado Pago y actualización del estado. Verificar que Google Cloud tenga las huellas SHA-1 de las claves de firma de Android (EAS y Play App Signing). Usar cuentas y pagos de prueba autorizados.
5. Verificar privacidad, capturas y metadatos de las tiendas; subir el build probado a TestFlight/Google Play y enviar a revisión.

No se ejecutaron pagos, envíos de cotizaciones, fusiones de cotizaciones ni cambios en pedidos reales durante las pruebas. Los builds se generaron desde la sesión web de Expo y la revisión de código indicada arriba. No se solicitó envío automático a las tiendas. Las revisiones previas al ajuste nativo de Google no deben publicarse; usar exclusivamente iOS (38) y Android (8) indicados arriba.

## Texto sugerido para las tiendas

Renovamos ShopX para acercarte la experiencia de nuestra web: descubrí productos y tiendas de USA, cotizá varios links, consultá tus cotizaciones y seguí tus pedidos. Mejoramos el carrito, la claridad de los importes y la visualización de fotos.

## Referencias de configuración

El build iOS usa Xcode 26.0. La configuración Android de React Native 0.81.5 usa target API 36. Se contrastaron con los [requisitos de Apple](https://developer.apple.com/news/upcoming-requirements/) y [Google Play](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en) vigentes al preparar esta versión. La integración nativa de Google sigue la [guía oficial de Expo](https://docs.expo.dev/guides/google-authentication/) y el [plugin del SDK](https://react-native-google-signin.github.io/docs/setting-up/expo).
