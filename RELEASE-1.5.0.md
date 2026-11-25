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

Esta versión usa los cambios de [usa-shopbox, PR #523](https://github.com/maxdnik/usa-shopbox/pull/523), incluidos los contratos móviles de contenido y oportunidades, precios y cupones, recuperación de canjes y dirección completa. El PR superó todo su CI y quedó integrado. Se verificó que `/api/version` de producción devuelve el commit `724e45168a58e981ab39704340a1c1f277860a97`.

Además de las pruebas aisladas, se aprobaron cuatro escenarios con modelos y transacciones reales en un MongoDB replica set de CI: creación y recuperación, concurrencia con la misma clave, dos claves que compiten por un uso y rollback cuando falla el consumo. La autenticación, la cotización externa y la entrega de correo se simulan; no se generan compras ni cobros de producción. [CI del backend y transacciones](https://github.com/maxdnik/usa-shopbox/actions/runs/45665922910).

## Validación

`npm run verify:release` **aprobado** en la preparación final:

| Comprobación | Resultado |
| --- | --- |
| TypeScript (`tsc --noEmit`) | Aprobado |
| Pruebas automáticas | 61/61: 24 anteriores, 14 de cuenta y carrito, 13 de catálogo, 10 de checkout |
| Exportación Expo | iOS, Android y web aprobados |
| ESLint de los archivos revisados | Sin errores ni advertencias |
| Compilaciones nativas EAS | iOS y Android aprobados |
| Carga de iOS a App Store Connect | Falló; requiere consultar el error en Expo |

La exportación de Expo comprueba los bundles y recursos; no genera por sí sola un binario nativo firmado ni acredita una publicación en las tiendas.

## Distribución

Se mantienen Expo SDK 54, Google y Apple nativos, los identificadores `com.maximodimnik.shopx` de iOS y Android y la configuración existente del proyecto y perfiles EAS.

El workflow [release-1.5.0.yml](.eas/workflows/release-1.5.0.yml), asociado a la rama `release/shopx-1.5.0`, ejecuta la verificación, construye iOS y Android y sube la compilación iOS a App Store Connect. La carga a App Store Connect no publica automáticamente en App Store. El workflow no configura un envío a Google Play.

En la [ejecución de esta versión](https://expo.dev/accounts/maxdnik/projects/shopx/workflows/01a213b8-31d8-7a36-8fa0-899e90a59884), la verificación y ambas compilaciones terminaron correctamente. El [job de carga a Apple](https://expo.dev/accounts/maxdnik/projects/shopx/workflows/01a213b8-31d8-7a36-8fa0-899e90a59884#job-01a213c0-112e-7e1e-bded-280f17b8c80c) terminó con error; GitHub solo informa `Job has errored.`. No se determinó la causa porque no hay una sesión autenticada de Expo disponible para consultar el detalle. No se reintentó sin diagnóstico y no se publicó la actualización en las tiendas.

## QA pendiente en dispositivos

- Recorrer inicio, campañas, oportunidades, filtros del buscador, detalle de ofertas y cotización con red lenta o interrumpida.
- Verificar registro y enlace de email, recuperación, ingreso nativo con Google/Apple y edición de CUIT y dirección, incluidos CPA y localidades compartidas.
- Comprobar canje total y parcial, retorno desde Mercado Pago, cierre y reapertura durante un canje, cambio de cuenta y productos agregados mientras se confirma una compra, en un entorno de prueba.
- Revisar pedidos de varios paquetes, estados de Andreani, accesibilidad, teclado y áreas seguras en iOS y Android.

La validación automática no reemplaza estas pruebas ni la comprobación del backend desplegado.
