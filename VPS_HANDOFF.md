# aiden. | transferencia opcional a VPS

Estado: **sin servidor contratado, inspeccionado o configurado por esta actualización**. La PWA v1.3 permanece alojada en GitHub Pages. Este documento no autoriza modificar un servidor existente.

## Arquitectura real
- Frontend: React + TypeScript + Vite + vite-plugin-pwa, servido estáticamente en GitHub Pages bajo `/aiden-pwa/`. El service worker precachea el app shell; no hay backend ni llamadas a APIs privadas.
- Datos: IndexedDB `aiden-savings` versión 4; stores `movements`, `settings`, `events`, `eventOccurrenceStates`, `tasks`, `countdowns`, `financeEntries`. Todos los registros permanecen en el dispositivo.
- Copias: JSON `aiden.personal.backup` v4, compatible con v3 y ahorros v1/v2. La importación es transaccional. **No subir copias personales al VPS ni al repositorio**.
- Recordatorios actuales: solo dentro de la aplicación al abrirla o recuperar el foco, calculados con fechas de Colombia. No existe push operativo, registro de suscripción ni sincronización remota.

## Qué requeriría servidor
Solo el envío de push con la PWA cerrada y consentido voluntariamente. El calendario, cálculos, movimientos y tareas deben seguir locales. No se necesita migrar la web a VPS para realizar push.

## Auditoría previa obligatoria en el VPS
Con acceso expresamente autorizado, documentar sin exponer secretos: distribución, versión y arquitectura; CPU, RAM y disco disponible; servicios y puertos en uso; dominio, DNS, certificados HTTPS; firewall, parches y actualizaciones; cuentas y permisos; herramientas/runtime disponibles; procesos desplegados y política de backup. No detener ni instalar nada antes de revisar colisiones.

## Diseño mínimo recomendado para una fase futura de Web Push
1. Confirmar compatibilidad del navegador/iOS actuales. En iPhone, solicitar suscripción desde la app agregada a pantalla de inicio y solo tras una acción voluntaria del usuario. No prometer entrega garantizada.
2. Generar VAPID public/private con herramientas adecuadas. Exponer solo la **clave pública** al cliente; mantener privada en secretos del servidor, nunca en código del repositorio ni GitHub Pages.
3. API HTTPS reducida, con autorización antiabuso y autenticación fuerte para registrar/quitar la suscripción. No implementar endpoints públicos abiertos que acepten suscripciones o calendarios de terceros.
4. Consentimiento granular para compartir **solo fechas de vencimiento y un identificador opaco**, nunca saldos, importes ni conceptos salvo opt-in adicional. El servidor no recibirá la base IndexedDB ni copias integrales.
5. Protección de endpoints: validación estricta, límites de tasa y tamaño, CORS limitado al origen de Pages, CSRF/origin checks donde correspondan, política de retención breve y logs sin contenido financiero. HTTPS también entre el dispositivo y la API.
6. Persistir mínimamente suscripciones de navegador cifradas/almacenadas con controles de acceso y agenda mínima de vencimientos. Evaluar almacenamiento embebido si el servidor lo permite; no añadir Docker, PostgreSQL ni Redis sin necesidad comprobada.
7. Cron diario que calcula calendario **America/Bogota** y envía recordatorios a 3 y 1 día antes una sola vez por `subscription + opaqueDueId + dueDate + reminderWindow`. Garantizar idempotencia y manejar reintentos.
8. Al marcar pago o al editar/eliminar el vencimiento, revocar/actualizar su programación cuando haya consentimiento. Cuando la suscripción expira (404/410) eliminarla. Mostrar opción para desactivar, eliminar todo y exportar el estado del consentimiento.
9. Notificación genérica por defecto: «Tienes un pago próximo». No mostrar descripción, fecha concreta ni importe en la pantalla bloqueada sin permiso separado.
10. Verificación: pruebas unitarias de calendario/bogotá, permisos, CORS, pérdida de red, 404/410, rate limits, duplicados, desactivación, actualización y rollback. Probar en iOS instalado, incluyendo app cerrada; si no funciona, conservar recordatorios internos.

## Variables de entorno de una fase futura (sin valores)
- `PORT`: puerto HTTP local detrás de HTTPS.
- `PUBLIC_ORIGIN`: origen permitido de GitHub Pages.
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
- `STORAGE_PATH`: ruta privada con permisos restringidos para suscripciones y vencimientos mínimos.
- `API_AUTH_SECRET` / credenciales de autenticación según amenaza real, con rotación documentada.
- `TZ=America/Bogota` (además de conversiones explícitas de fecha).

## Despliegue seguro y vuelta atrás
Primero auditar el sistema. Luego preparar usuario no privilegiado, HTTPS, política de reinicio y logs sin datos sensibles. Desplegar en puerto libre sin interferir con otros servicios; probar endpoints y revocación antes de habilitar consentimiento en frontend. Mantener Pages como alojamiento y regresar a recordatorios internos al desactivar la función. La base de ahorros nunca se modifica por fallos de push.

## Información faltante
SO, arquitectura, memoria, disco, disponibilidad de dominio/subdominio, DNS, certificados, servicios actuales, permisos del usuario, sistema de gestión de procesos, políticas de backup, firewall, disponibilidad de HTTPS y consentimiento para Web Push. Ninguno de estos datos se ha verificado.

Este documento describe un posible trabajo posterior, no una instalación ni implementación de notificaciones push en v1.3.
