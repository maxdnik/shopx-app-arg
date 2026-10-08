# ShopX 1.4.0

Inicio de ecommerce basado en la imagen aprobada por el usuario: productos y fotografías como contenido principal, azul marino y cian, bloques compactos y navegación inferior uniforme.

## Cambios

- Encabezado compacto, buscador visible, dirección de entrega y banner fotográfico «De USA a tu puerta».
- Accesos circulares a Ropa, Zapatillas, Tecnología y LEGO.
- «No lo necesito, pero lo quiero» visible en el inicio y pantalla con la colección completa. Usa la misma selección de productos que la web.
- Cards con fotos reales, favoritos, precio final en ARS y carrito. Si hay variantes, el botón abre el detalle para elegirlas.
- GAP y Polo Ralph Lauren con fotografías incluidas en la app y enlaces a sus catálogos completos.
- Barra inferior compacta con Inicio, Categorías, Cotizar, Pedidos y Mi cuenta.
- Se retiran del inicio «Selecciones ShopX», las guías editoriales y los bloques explicativos de compra.

Los productos y precios del mockup eran ilustrativos. La implementación muestra inventario real y calcula ARS a partir del precio final y la cotización efectiva del servidor. Si falla la cotización, muestra explícitamente el precio final en USD.

## API

`GET /api/app/want-it` en `maxdnik/usa-shopbox`, PR 377, merge `c8f1cb8ed73e1195d7c19b12bdc1558de484d917`.

Producción verificada el 8 de octubre de 2026: 13 productos con imágenes y precio final positivo. El endpoint conserva orden, identificadores y variantes, excluye productos no disponibles y reutiliza el motor de precios y la selección existentes. No modifica el inventario.

El servidor pasó TypeScript, lint y smoke determinista. Su auditoría de dependencias conserva el fallo previo documentado en el proyecto; este cambio no modifica dependencias ni controles. La vista previa usa una base sin inventario; se verificó la colección en producción después del despliegue.

## Validación

- `npm run verify:release`: TypeScript, nueve pruebas y exportación iOS/Android/web aprobados.
- ESLint aprobado para los archivos de interfaz y datos modificados.
- Pruebas de precio final, conversión, productos visibles, selección de variantes, orden, caché y recuperación ante errores.
- Los recursos fotográficos principales están incluidos en el paquete.

La comprobación visual interactiva y en dispositivos físicos queda pendiente: el entorno no permitió abrir la vista previa en el navegador. La compilación y las pruebas automáticas no sustituyen esa revisión.

## Distribución

La rama `release/shopx-1.4.0` ejecuta el workflow de EAS para validar, generar iOS y Android y cargar el paquete iOS a App Store Connect con la configuración existente. No configura un envío a Google Play ni una publicación automática en las tiendas.

La app instalada requiere un paquete nuevo: el proyecto no tiene actualización OTA configurada. La carga a App Store Connect no equivale a aprobación ni publicación en App Store.

## Novedades para la tienda

Renovamos el inicio de ShopX. Descubrí productos con fotos y precios finales, explorá tus marcas favoritas y encontrá la selección «No lo necesito, pero lo quiero». Guardá favoritos y agregá productos al carrito desde el inicio.
