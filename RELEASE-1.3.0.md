# ShopX 1.3.0

Actualización del catálogo y las cards para acercar la app a la web vigente.

## Cambios

- Cards con foto cuadrada más grande, marca, categoría, precio final Argentina y botón Comprar que abre el detalle para elegir variantes.
- Accesos directos a GAP y Polo Ralph Lauren desde el inicio.
- Tiendas con catálogo paginado completo. Se elimina el límite anterior de 36 productos por tienda; carga automática y botón Ver más.
- Categorías visibles en varias filas, con cantidades calculadas sobre todo el catálogo de la tienda.
- La navegación general, los filtros y las cards comparten el mismo criterio de categoría.
- Se preservan los identificadores nativos, el proyecto de Expo y los recorridos de carrito y pago existentes.

## Código y API

Código de los paquetes: `64d4b16661be75274551ddecc73c36028f1d1a8c`, repositorio `maxdnik/shopx-app-arg`.

Servidor en producción: `bc816569f8b83515df609217e35295ac818903ed`, repositorio `maxdnik/usa-shopbox`, deployment `dpl_3tLXmovtNLK7YVab3nRvyW7r16sh` con estado READY. Incluye etiquetas compartidas para las cards del inicio.

La API de tiendas conserva `store`, `products` y `count`, e incorpora `categories`, `totalProducts` y `pagination`. La ruta virtual `polo-ralph-lauren` comparte los criterios del catálogo de la marca de la web.

## Validación

- TypeScript sin errores y seis pruebas de regresión aprobadas.
- `npm run verify:release` aprobado localmente y en EAS: bundles iOS, Android y web exportados.
- Catálogo real de Polo: 400 productos únicos en 17 páginas de 24; 11 categorías. Pantalones: 76.
- Catálogo real de GAP: 457 productos únicos en 20 páginas de 24; 12 categorías. Pantalones: 105.
- En ambas marcas se verificó el recorrido hasta la última página, las cantidades por categoría, al menos tres imágenes por producto, disponibilidad y precio final positivo.
- Los 16 accesos a tiendas de la API devuelven categorías cuyas cantidades suman el inventario completo; la categoría de la card está incluida entre los filtros. Columbia y Ross no tienen inventario visible actualmente.
- Los conteos de las 11 categorías generales coinciden entre navegación y resultados: 1.847 productos en total. Se comprobó también el filtro de Pantalones (211) y Sweaters (91).
- Las 12 cards del inicio y la selección semanal devuelven la etiqueta de categoría compartida.
- No se hicieron compras ni se modificaron pedidos reales.

La prueba visual en dispositivos físicos queda pendiente. La exportación y las pruebas automáticas no la reemplazan.

## Distribución

Workflow de release: https://expo.dev/accounts/maxdnik/projects/shopx/workflows/01a10edd-852f-7165-8fd7-9326e3d15fc4

La rama `release/shopx-1.3.0` ejecuta la validación, genera los paquetes de producción para iOS y Android y carga el iOS en App Store Connect mediante la credencial de EAS Submit existente. No se configura un envío a Google Play.

La carga en App Store Connect no equivale a aprobación ni publicación en App Store. La app instalada requiere actualizarse con el nuevo paquete para recibir los cambios de interfaz.

El paquete iOS 1.3.0 (39) terminó correctamente en 4m 42s: https://expo.dev/accounts/maxdnik/projects/shopx/builds/b3bf1307-605f-43f6-af61-3f79ac0a6593

La carga a App Store Connect finalizó con estado Succeeded (1m 39s): https://expo.dev/accounts/maxdnik/projects/shopx/submissions/5c89c5aa-2bc8-4c4f-91b8-4fe195e16e28

App Store Connect solicitó inicio de sesión. El formulario seguro no completó el acceso; no se confirmó sesión autenticada, selección del build en la versión pública ni envío a App Review.

El paquete Android 1.3.0 (9) terminó correctamente en 18m 3s: https://expo.dev/accounts/maxdnik/projects/shopx/builds/e13d7d6f-a977-4935-bd97-c5b501788891

Descargas oficiales de los paquetes firmados (disponibilidad indicada por Expo: 29 días al verificar):

- IPA: https://expo.dev/artifacts/eas/JJ2ynVBvEfslyovPvaiBqlqbezSHxQ80MkqAq7BBnAg.ipa
- AAB: https://expo.dev/artifacts/eas/VQBEEM_9VSqv5R-v105SFgrMXbeR4ISh9F1PC47hfiY.aab

En Google Play Console se confirmó la cuenta ShopXar y el paquete `com.maximodimnik.shopx`. La versión vigente en prueba cerrada Alpha es 1.1.9 (6); no se confirmó acceso habilitado a producción. El panel ofrece Solicitar acceso a producción, que requiere respuestas sobre la prueba realizada.

Se intentó abrir Crear nueva versión en Alpha, incluyendo una pestaña nueva, pero las interacciones del navegador devolvieron timeouts y no apareció el editor. No se cargó el AAB ni se creó o publicó una versión Android. El canal existente conserva la versión anterior. Continuación: https://play.google.com/console/u/0/developers/7468962823380231504/app/4975614131434695858/tracks/4698399519020803636?tab=releases

## Novedades para la tienda

Renovamos las cards y la navegación por categorías. Encontrá todos los productos de Polo Ralph Lauren y GAP, explorá cada tienda con filtros y cantidades actualizadas y seguí recorriendo el catálogo completo desde la app.
