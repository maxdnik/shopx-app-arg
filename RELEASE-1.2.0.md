# ShopX 1.2.0

Actualización preparada el 13 de septiembre de 2026 contra la web de ShopX y el catálogo vigente.

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

Estos controles no equivalen a compilar un IPA/AAB firmado ni a probar la app en un dispositivo. El navegador de revisión no pudo abrir la vista local; la inspección visual de la app nueva está pendiente.

## Pasos para publicar

1. API compatible desplegada. Se confirmó el catálogo real (40 productos por categorías y 8 semanales); completar el recorrido de compra desde los builds finales.
2. Ejecutar `npm ci` y `npm run verify:release` en esta revisión.
3. Iniciar sesión con la cuenta autorizada de Expo/EAS y generar la compilación de producción: `eas build --platform all --profile production`. Se conservan el proyecto EAS, los identificadores y el esquema de ShopX; EAS administra el incremento de build remoto. Versión comercial: 1.2.0.
4. Probar el build firmado en iPhone y Android: inicio de sesión Google/Apple según plataforma, CUIT y dirección, catálogo y variantes, agregar/quitar cantidades, resumen de precios, cotizaciones manuales y agrupadas, zoom y cierre de fotos, seguimiento parcial, retorno desde Mercado Pago y actualización del estado. Verificar que Google Cloud tenga las huellas SHA-1 de las claves de firma de Android (EAS y Play App Signing). Usar cuentas y pagos de prueba autorizados.
5. Verificar privacidad, capturas y metadatos de las tiendas; subir el build probado a TestFlight/Google Play y enviar a revisión.

No se ejecutaron pagos, envíos de cotizaciones, fusiones de cotizaciones ni cambios en pedidos reales durante las pruebas. Los builds se generan desde la sesión web de Expo y la rama de esta actualización. No se solicitó envío automático a las tiendas. Las revisiones previas al ajuste nativo de Google no deben publicarse; usar los enlaces de la revisión final indicados en la PR.

## Texto sugerido para las tiendas

Renovamos ShopX para acercarte la experiencia de nuestra web: descubrí productos y tiendas de USA, cotizá varios links, consultá tus cotizaciones y seguí tus pedidos. Mejoramos el carrito, la claridad de los importes y la visualización de fotos.
