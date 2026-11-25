# ShopX 1.5.0

Actualización de la app para incorporar los cambios recientes de la web. Fecha de preparación: 25 de noviembre de 2026.

## Cambios

- **Inicio y oportunidades:** contenido y campañas actuales del servidor, acceso a sus colecciones y pantalla nativa de oportunidades con filtros y comparaciones fechadas. Una oportunidad se vuelve a cotizar antes de comprar; su precio histórico no se usa para cobrar.
- **Buscador v2:** usa `/api/search/v2`, con productos agrupados, ofertas por tienda, filtros, ordenamiento y paginación por cursor. Respeta disponibilidad, condición e importabilidad al abrir una oferta.
- **Cotizador:** espera de hasta 185 segundos para la cotización automática, cancelación de peticiones y protección frente a respuestas anteriores. Conserva vendedor, oferta, variante y selecciones al identificar un producto; dos ofertas distintas no se mezclan en el carrito ni al retirar unidades compradas.
- **Cuenta y dirección:** registro con verificación de email, reenvío de verificación, recuperación de contraseña y aceptación explícita de los términos vigentes. Validación del dígito verificador de CUIT/CUIL, CP y CPA, con selección de localidad cuando el código es compartido. Las respuestas de una sesión anterior no reemplazan ni cierran una sesión nueva.
- **Carrito y cupones:** precios, descuentos y tipos de cambio provienen del servidor. Se muestra el desglose y se confirma el importe antes de abrir Mercado Pago. Los canjes totales crean pedidos sin cargo; los parciales permiten pagar la diferencia. Una clave de idempotencia y la solicitud exacta quedan guardadas por cuenta para recuperar el resultado después de una interrupción. La recuperación consulta primero al servidor y el reintento requiere una acción del usuario. Al confirmar, se descuentan únicamente las unidades compradas y se conservan las incorporaciones posteriores.
- **Seguimiento:** eventos públicos de Andreani por paquete, envíos parciales y estado general coherente con el pedido. Un evento de un paquete no adelanta por sí solo toda la orden. Los pedidos bonificados con saldo cero se muestran sin botón de pago; los saldos positivos conservan la opción de pagar.

## Dependencia del backend

Esta versión necesita los cambios de [usa-shopbox, PR #523](https://github.com/maxdnik/usa-shopbox/pull/523), incluidos los contratos móviles de contenido y oportunidades, precios y cupones, recuperación de canjes y dirección completa. El PR debe superar su CI y quedar integrado y desplegado antes de distribuir la app con estos flujos. Estas notas no dan por realizada su integración.

Las transacciones de MongoDB, la atomicidad del consumo del cupón y los reintentos se verificaron con mocks. Queda pendiente comprobarlos con un entorno de MongoDB que soporte transacciones, además del CI del backend.

## Validación

`npm run verify:release` **aprobado** en la preparación final:

| Comprobación | Resultado |
| --- | --- |
| TypeScript (`tsc --noEmit`) | Aprobado |
| Pruebas automáticas | 61/61: 24 anteriores, 14 de cuenta y carrito, 13 de catálogo, 10 de checkout |
| Exportación Expo | iOS, Android y web aprobados |
| ESLint de los archivos revisados | Sin errores ni advertencias |

La exportación de Expo comprueba los bundles y recursos; no genera por sí sola un binario nativo firmado ni acredita una publicación en las tiendas.

## Distribución

Se mantienen Expo SDK 54, Google y Apple nativos, los identificadores `com.maximodimnik.shopx` de iOS y Android y la configuración existente del proyecto y perfiles EAS.

El workflow [release-1.5.0.yml](.eas/workflows/release-1.5.0.yml), asociado a la rama `release/shopx-1.5.0`, ejecuta la verificación, construye iOS y Android y sube la compilación iOS a App Store Connect. La carga a App Store Connect no publica automáticamente en App Store. El workflow no configura un envío a Google Play.

## QA pendiente en dispositivos

- Recorrer inicio, campañas, oportunidades, filtros del buscador, detalle de ofertas y cotización con red lenta o interrumpida.
- Verificar registro y enlace de email, recuperación, ingreso nativo con Google/Apple y edición de CUIT y dirección, incluidos CPA y localidades compartidas.
- Comprobar canje total y parcial, retorno desde Mercado Pago, cierre y reapertura durante un canje, cambio de cuenta y productos agregados mientras se confirma una compra, en un entorno de prueba.
- Revisar pedidos de varios paquetes, estados de Andreani, accesibilidad, teclado y áreas seguras en iOS y Android.

La validación automática no reemplaza estas pruebas ni la comprobación del backend desplegado.
