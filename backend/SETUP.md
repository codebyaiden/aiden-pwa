# Rutina · instalación y uso

La PWA se publica en https://codebyaiden.github.io/aiden-pwa/. La API utiliza `https://109.205.176.230:8443/v1`. Las horas de Rutina siguen el calendario de Colombia. Tu calendario, tareas generales, movimientos y finanzas siguen en IndexedDB. Al conectar Rutina se envían sus ajustes, progreso y contexto al VPS.

## iPhone

1. Abre aiden. en Safari, pulsa **Compartir → Añadir a pantalla de inicio** y abre el icono instalado. Si ya la tienes instalada y aparece una actualización, acéptala.
2. En **Inicio → Rutina**, empieza la rutina y entra en **Avisos y actividad → Conexión y notificaciones**. Pega la clave privada de `/etc/aiden-routine/app.key`. Consúltala en tu sesión SSH autorizada y transfiérela directamente con tu gestor de contraseñas.
3. Pulsa **Activar avisos push** y acepta el permiso. Pulsa **Enviar aviso de prueba**. Después prueba un aviso programado con la PWA cerrada y abre la notificación desde la pantalla bloqueada. Ajusta la presentación de avisos y Focus en iOS si hace falta. Solo hay una suscripción activa en el servidor. Activar otra la reemplaza.
4. Prueba iniciar un paso con temporizador, cerrar la app, abrirla y continuar. Prueba marcar un paso en modo avión y comprueba que reaparece después de reconectar. Los avisos del servidor usan el último progreso que recibió.

## Apple Shortcuts

Crea un atajo reutilizable llamado **Señal de Rutina**. Acepta texto como entrada. Añade **Generar UUID**, luego **Obtener contenido de URL** con los siguientes valores.

| Campo | Valor |
| --- | --- |
| URL | `https://109.205.176.230:8443/v1/shortcut` |
| Método | POST |
| Encabezado Authorization | `Bearer ` seguido por la clave privada de `/etc/aiden-routine/webhook.key` |
| Cuerpo JSON, texto `id` | variable UUID |
| Cuerpo JSON, texto `action` | `signal` |
| Cuerpo JSON, texto `signal` | variable Entrada del atajo |

Prueba desde **Atajos** con el texto `youtube-open` y comprueba **Rutina → Avisos y actividad**. Crea automatizaciones personales que pasen texto a **Ejecutar atajo → Señal de Rutina**. Activa **Ejecutar inmediatamente** donde iOS lo ofrezca.

| Automatización | Texto |
| --- | --- |
| Focus de sueño activado | `sleep-focus` |
| Focus de sueño desactivado | `sleep-focus-off` |
| Al detener la alarma de despertar | `wake-alarm` |
| Al abrir una app que usas al levantarte | `first-app` |
| Focus para videojuegos | `gaming-focus` |
| Abrir YouTube | `youtube-open` |
| Salir de casa / llegar | `away` / `home` |
| Película, pausa o inicio de programación | `movie-playing`, `movie-paused`, `coding` |

Puedes iniciar manualmente los tres últimos tipos si el dispositivo reproductor o editor no ofrece un disparador. La señal de Focus de sueño por sí sola indica incertidumbre. La apertura de una app combinada con el fin de Focus de sueño o con la alarma detenida en un intervalo de 45 minutos puede activar la rutina de mañana. También puedes confirmar con **Ya desperté**. Evita compartir el atajo que contiene tu clave.

## Webhooks

`POST /v1/webhook` usa el mismo encabezado y formato. Cada invocación lógica lleva un ID único de 8 a 100 caracteres alfanuméricos, guiones o guiones bajos. Si tu cliente reintenta una invocación, conserva su ID. Las operaciones admitidas son:

- `{"id":"<uuid>","action":"signal","signal":"coding"}`
- `{"id":"<uuid>","action":"wake"}` para una confirmación explícita.
- `{"id":"<uuid>","action":"snooze","key":"AAAA-MM-DD:movement","minutes":10}` para un aviso del día.
- `{"id":"<uuid>","action":"cancel","key":"AAAA-MM-DD:movement"}` para cancelar avisos del día.

Para cambiar intervalos, horarios y horas de silencio, usa **Avisos y actividad → Horarios e intentos**. La revisión semanal permite descargar un resumen y revisar el JSON de horarios antes de confirmarlo.

## Copias y operación

- En **Ajustes y copias**, exporta el JSON v5 para conservar datos del dispositivo y Rutina juntos. Guárdalo en almacenamiento protegido. Una copia v1–v4 preserva Rutina al importarse.
- `aiden-routine-backup.timer` guarda copias AES-256-GCM de SQLite en `/var/backups/aiden-routine/` con retención de 30 días. Guarda una copia fuera del VPS. Conserva `/etc/aiden-routine/recovery.key` y `service.env` en almacenamiento de secretos separado de las copias. La clave VAPID original permite reutilizar la suscripción restaurada.
- Para comprobar una copia, restaura a un archivo nuevo en un directorio root de modo 0700. Por ejemplo, `node /opt/aiden-routine/backup.mjs restore COPIA.enc /ruta/privada/restore.sqlite /etc/aiden-routine/recovery.key`. El comando autentica la copia y comprueba SQLite. Para reemplazar la base operativa, detén únicamente `aiden-routine`, conserva la base actual y sus archivos WAL/SHM aparte, instala la restauración con los permisos y propietario de la base original y vuelve a iniciar el servicio.
- El servicio escucha en `127.0.0.1:8795`; Nginx publica el API TLS en 8443. El certificado tiene su propio temporizador `aiden-acme.timer`. Los reinicios del backend recuperan su agenda de SQLite. Los avisos inciertos tras una caída pueden reintentarse con la misma etiqueta de notificación.
