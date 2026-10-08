# Cotizador de la app y web

Referencia: `maxdnik/usa-shopbox` en `c4ad3d3d43e73076569907c31e2925b5b4b3f527`.

- El cálculo automático sigue usando `/api/amazon-quote-batch`, con el destino del perfil y las reglas de precios del servidor. No hay una segunda fórmula en la app.
- Mismas identidades y normalización de URLs, variantes de eBay/Target/Sephora, límite de cinco links, dos tiendas y tres unidades por producto.
- Espera máxima de 25 segundos como en la web, cancelación y protección contra respuestas de solicitudes canceladas.
- Se conserva el error específico del proveedor. Los fallos de lectura de Amazon permanecen en automático; las revisiones de dimensiones y los fallos compatibles de otras tiendas habilitan el formulario manual.
- El formulario manual usa `/api/quotes` autenticado, código postal argentino obligatorio, hasta diez productos y campos independientes de nombre, talle, color, cantidad y comentarios. Solo un envío explícito crea solicitudes; restaurar el borrador o iniciar sesión no las crea.
- Un resultado parcial conserva productos válidos y permite quitar el enlace fallido/recalcular. No se envía al carrito una cotización parcial, vencida o bloqueada.
- Cantidades y eliminaciones se asocian por identidad del producto, incluyendo URLs cortas resueltas, no por posición en la lista original.

## Verificación

TypeScript y 16 pruebas de paridad, con cobertura de URLs/variantes, errores del proveedor, tiempo máximo, cancelación, vencimiento, resultados parciales, código postal, borradores y envío explícito.

La prueba real del producto Best Buy 6302559 devolvió el producto y el precio consolidado. La validación siguiente del carrito detectó un lector distinto en el backend compartido. Corregido en `usa-shopbox` (`8619163d1b41d6d1a4b6a075d8afac485f341d6d`) para revalidar las tiendas integradas con el mismo lector y evidencia del cotizador. Cuatro pruebas adicionales verifican que se ignoran precios/logística del cliente y se conservan los bloqueos por stock, datos incompletos y envío no habilitado.

La versión aprobada se validó en Expo Go SDK 57 y se incorpora a la release nativa iOS con SDK 54 y el perfil de producción existente. El workflow `release-ios-1.4.0-final.yml` verifica, compila y sube el nuevo build a App Store Connect, sin enviarlo a revisión. No se crean órdenes, pagos ni solicitudes manuales reales durante QA.
