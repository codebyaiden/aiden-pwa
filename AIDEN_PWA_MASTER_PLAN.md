aiden. — especificación maestra única: Home + Savings PWA v1

Estado: especificación para Codex; no implica que la app esté construida ni probada.
Objetivo: PWA personal y minimalista, instalada en el iPhone, que registra billetes realmente guardados en una alcancía y permite conocer saldo, aportes, retiros y proyección hasta el 31 de julio de 2029.
Alcance obligatorio: homepage, vista detallada de ahorro, registro/corrección de dinero, aportes mensuales previstos, historial y copias de seguridad.
Idioma de interfaz: español natural; moneda: COP; fechas: America/Bogota.
Destino: GitHub Pages en HTTPS; sin cuentas, sin servidor, sin IA, sin API externa.
Documento único: este mismo archivo contiene toda la especificación funcional, técnica, visual y de pruebas. No depende de otro .md.

> **Orden de prioridades:** integridad del dinero → persistencia y recuperación → claridad de la interfaz → accesibilidad → rendimiento → refinamiento visual y motion.
> 
> **Regla:** toda cifra visible tiene una fuente; todo movimiento tiene una función; todo componente tiene un motivo.

1. Decisiones cerradas y límites

Sí construiremos

	1.	Home funcional, pensado primero para iPhone, con saldo, aportado este mes, objetivo/proyección opcionales y últimas transacciones.
	2.	Vista «Alcancía» con historial, selector de mes, detalle de movimientos, corrección y retiro.
	3.	Acción principal «Añadir dinero» con monto, fecha, nota opcional y confirmación segura.
	4.	Plan mensual configurable y cálculo de cuánto falta para cumplirlo.
	5.	Proyección matemática al 31/07/2029 basada en el plan mensual configurado. Más adelante, si hay suficiente historial real, resumen del promedio histórico, diferenciado de la proyección.
	6.	Animaciones de entrada, paneles, modificación de cifras, progreso, listas y feedback, pero sin movimiento cosmético.
	7.	Guardado local en IndexedDB, modo offline y exportación/importación JSON validada.
	8.	Responsive, contraste adecuado, estados vacíos, errores recuperables y soporte de movimiento reducido.

No construiremos en v1

	●	Calendario, tareas, countdowns, metas independientes o resumen general de vida.
	●	ChatGPT, chat, automatizaciones por mensajes, Action Button/Shortcuts o acceso al banco.
	●	Autenticación, sincronización entre dispositivos, servidor, base de datos remota, analytics, notificaciones push.
	●	Categorías financieras, inversiones, interés compuesto, gamificación, avatar, ilustraciones de cerditos o imágenes de paisaje.
	●	Librerías de UI, charting o animación, navegación compleja ni elementos de demostración en la versión real.

Motivo: si el ahorro local no es confiable, ninguna de las demás funciones es importante.

2. El flujo central de la app

Caso real: el usuario mete un billete de $20.000 en la alcancía física, abre la PWA, pulsa +, registra el monto y confirma.

	1.	Pulsar Añadir dinero abre un panel inferior en móvil; no navega a otra página.
	2.	Aparece un campo Cantidad enfocado si no provoca un salto incorrecto del teclado. Puede escribir 20000 y ver el formato $20.000 de manera legible. Teclas rápidas opcionales establecen una cantidad, no la suman a otra inadvertidamente.
	3.	Fecha predeterminada: hoy en Colombia. Nota opcional. No se solicita información redundante.
	4.	El botón Guardar aporte solo está disponible cuando el valor es válido.
	5.	Mientras se guarda se bloquean dobles pulsaciones. El registro se crea una sola vez dentro de una transacción de IndexedDB.
	6.	Solo después del commit correcto se cierra el panel, aparece el movimiento en historial, cambian los totales calculados y se ejecuta una transición breve de la cifra.
	7.	Se anuncia Aporte guardado de forma discreta. Si falla, el panel conserva lo escrito, describe el error y ofrece Reintentar.
	8.	Al cerrar y reabrir la PWA, el saldo debe salir del registro persistido, nunca de un contador provisional.

No se debe incrementar dinero automáticamente al comenzar un nuevo mes. El plan mensual es una meta, no una transferencia.

3. Arquitectura de información: solo dos vistas

3.1. Homepage (Home)

Objetivo: saber cuánto hay y registrar un billete en menos de dos interacciones.

Orden exacto, arriba abajo:

	1.	Encabezado: marca discreta aiden. y fecha local corta; a la derecha un acceso sin ruido a ajustes/backup. No search, bell, your life in one place, textos de marketing, avatar inventado ni múltiples iconos decorativos.
	2.	Bloque principal oscuro: En mi alcancía + saldo principal COP. Un único punto focal visual; nada de fotografía decorativa.
	3.	Debajo, dos estadísticas secundarias con división ligera (sin tarjetas anidadas): Aportado este mes y Julio de 2029 / Configurar plan si falta el aporte mensual.
	4.	Botón principal + Añadir dinero muy visible, a continuación del saldo o integrado en su borde inferior. La acción nunca debe depender de un icono + sin etiqueta accesible.
	5.	Progreso mensual solo si hay plan válido mayor que cero: Plan mensual, barra, Faltan $X o Plan cumplido. No duplicar etiquetas ni porcentajes innecesarios.
	6.	Movimientos recientes: últimas 3–5 operaciones en filas planas, con fecha y signo; Ver todos abre vista Alcancía.
	7.	Un enlace discreto a historial completo. No footer de marketing ni barra de navegación de cuatro destinos que todavía no existen.

Criterio anti-slop: el número grande es legítimo porque el saldo es la tarea principal, no porque una plantilla estándar requiera un hero con KPI.

3.2. Vista Alcancía

	●	Total actualizado, Aportado este mes, Retirado este mes, y Cambio neto del mes si existen retiros.
	●	Control para seleccionar mes: mes actual por defecto; mes anterior/siguiente disponible si corresponde a meses de registros. El botón de próximo mes no sugiere aportes futuros.
	●	Historial en lista sencilla: + $20.000, fecha, nota si existe. Para retiros: − $5.000. No mostrar signos positivos/negativos solo mediante color.
	●	Tocar una fila abre un detalle pequeño con Editar y Eliminar, no varios iconos secretos.
	●	Acceso secundario Retirar dinero, siempre explícito.
	●	Plan mensual y Proyección a julio de 2029: las cifras y la explicación breve están cerca una de la otra. Editar plan desde la misma sección.
	●	Un gráfico de barras mensual no es requisito. Si se agrega tras tener historial útil, que sea CSS/SVG simple, con etiquetas y valores legibles, sin librería.

3.3. Estados de primera apertura

Sin registros (lo esperable al comprar la alcancía):

	●	Balance $0, Este mes $0.
	●	Mensaje único: Todavía no has registrado dinero.
	●	Botón Añadir dinero.
	●	Julio de 2029 muestra Configurar aporte mensual hasta definir plan; sin inventar un valor.
	●	No cargar transacciones de prueba, no mostrar una gráfica ficticia, no insinuar que existe un saldo bancario.

Con registros, sin plan mensual: el saldo y movimientos funcionan; la previsión se muestra sin cifra, con entrada a configuración.

Plan configurado sin movimientos: prever desde saldo cero según regla de proyección, dejando explícito que es una hipótesis, no dinero existente.

4. Wireframe semántico, no diseño de marketing

┌──────────────────────────────────────┐

│ aiden.                   [ajustes]   │

│ lunes, 16 de noviembre               │

│                                      │

│ ┌──────────────────────────────────┐ │

│ │ En mi alcancía                   │ │

│ │ $166.000                         │ │

│ │ ──────────────────────────────── │ │

│ │ Este mes         Julio de 2029  │ │

│ │ $166.000         $6.600.000*     │ │

│ └──────────────────────────────────┘ │

│                                      │

│ [ + Añadir dinero                 ] │

│                                      │

│ Plan mensual                    83% │

│ █████████████████░░░░                 │

│ Faltan $34.000                       │

│                                      │

│ Movimientos recientes    Ver todos  │

│ + $20.000      Hoy, 16 nov           │

│ + $50.000      10 nov                │

│ + $96.000      3 nov                 │

└──────────────────────────────────────┘

* cifras de EJEMPLO, nunca datos precargados

Este bloque especifica jerarquía, no pixeles finales. La app real tiene que adaptarse a montos grandes, texto escalado, teclado y pantallas pequeñas.

5. Sistema visual integrado (obligatorio)

Esta sección sustituye por completo cualquier archivo de diseño separado. No se requiere los tokens de la sección 5; toda decisión de UI, tokens, microcopy y motion se consulta aquí.

5.1. Principios (orden de prioridad)

	1.	Claridad del dinero: un saldo visible y verificable es la única cifra principal de Home.
	2.	Lectura instantánea: el valor, el período, las acciones y su resultado se entienden sin instrucciones.
	3.	Espacio semántico: lo relacionado se acerca; lo distinto se separa. No gaps iguales en todas partes.
	4.	Composición honesta: cero datos falsos, iconos ornamentales, imágenes de stock, serif itálica por estética o copy de relleno.
	5.	Accesibilidad: contraste, tamaño, foco, teclado, safe areas y Reduce Motion son parte del diseño.
	6.	Motion con intención: no se anima una sección porque sí, sino para explicar un cambio.

5.2. Paleta exacta

|Token                  |Hex      |Destino                                            |
|-----------------------|---------|---------------------------------------------------|
|`--color-bg`           |`#F6F6F6`|fondo general                                      |
|`--color-surface`      |`#FFFFFF`|áreas claras                                       |
|`--color-surface-soft` |`#EFEFEF`|chips, estados seleccionados suaves                |
|`--color-ink`          |`#171717`|texto primario                                     |
|`--color-muted`        |`#616161`|texto secundario en claro                          |
|`--color-line`         |`#E3E3E3`|dividers y bordes delicados                        |
|`--color-hero`         |`#171717`|bloque principal                                   |
|`--color-on-hero`      |`#FFFFFF`|texto principal del bloque oscuro                  |
|`--color-on-hero-muted`|`#BDBDBD`|etiquetas secundarias en bloque oscuro             |
|`--color-focus`        |`#171717`|foco accesible; usar outline offset                |
|`--color-danger`       |`#992A2A`|error/retiro destructivo, única excepción semántica|

Límites: sin púrpuras, degradados, halos, texturas, neón, side-tab stripes, fondos beige por inercia. El color semántico de error puede ser rojo oscuro; los movimientos usan + / − explícitos además del color. No añadir tokens nuevos sin justificación.

5.3. Spacing basado en múltiplos de 4px

:root {

  --space-1: 4px;

  --space-2: 8px;

  --space-3: 12px;

  --space-4: 16px;

  --space-5: 20px;

  --space-6: 24px;

  --space-8: 32px;

  --space-10: 40px;

  --space-12: 48px;

}

|Relación                                  |Gap/padding recomendado       |
|------------------------------------------|------------------------------|
|Ícono y texto de un control               |8px                           |
|Eyebrow de una **cifra útil** y su valor  |4–8px                         |
|Etiqueta y ayuda de input (si se necesita)|4px                           |
|Campo y campo del mismo formulario        |16px                          |
|Grupo interno de hero                     |16–24px                       |
|Padding interior hero                     |24px; 16–20px en ≤359px       |
|Header y hero                             |24px                          |
|Título sección y su primera fila          |12px                          |
|Filas de historial                        |12–16px de padding vertical   |
|Entre secciones distintas                 |24–32px                       |
|Borde del viewport y contenido            |16px en ≤359px; 20px en ≥360px|
|Última fila y safe area inferior          |al menos 24px + safe inset    |

Regla anti-monotonía: no usar gap: 16px como respuesta universal. Las jerarquías solo aparecen cuando la distancia entre grupos difiere de la distancia dentro del grupo. La escala de 4px es una convención elegida para esta app, no una cita literal de Impeccable.

5.4. Tipografía

:root {

  --font-ui: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;

  --text-micro: 12px;    /* solo metadatos legibles, contrastados */

  --text-small: 14px;

  --text-control: 16px;

  --text-body: 16px;

  --text-section: 20px;

  --text-heading: 24px;

  --text-balance-min: 28px;

  --text-balance-max: 38px;

}

	●	Texto body 16px/24px, labels 14px/20px, títulos de sección 20px/26px, encabezado 24px/30px.
	●	Cifra principal clamp(28px, 8vw, 38px) con line-height: 1.1 y font-variant-numeric: tabular-nums.
	●	Usar 400 para body, 500 para labels, 600 para subtítulos y 650/700 solo en saldo o CTA cuando se justifique.
	●	No mayúsculas extensas ni tracking grande en párrafos. No serif itálica genérica, fuentes remotas, degradados de texto o headings gigantes.
	●	Ancho de lectura para descripciones largas: max-width: 65ch; la PWA casi nunca necesita textos largos.
	●	Monto COP entero con separador de miles. Verificar valores largos sin ellipsis ambiguos.
	●	Contraste mínimo 4.5:1 texto normal y 3:1 texto grande; validar en contexto, no solo token aislado.

5.5. Geometría

:root {

  --radius-sm: 8px;

  --radius-control: 12px;

  --radius-card: 20px;

  --radius-sheet: 24px;

  --border-hairline: 1px solid var(--color-line);

  --content-max: 520px;

  --touch-min: 44px;

  --button-height: 52px;

}

	●	Home en una columna. En desktop, centrar contenido sin convertirlo en dashboard empresarial de columnas falsas.
	●	Hero: 20px radius, sin foto, con separadores internos sutiles y sin subtarjetas.
	●	Botón principal altura 52px; icon-only controles de mínimo 44×44px y nombre accesible.
	●	Sheets inferior en móvil y diálogo centrado en escritorio, usando <dialog> si resulta compatible con el comportamiento deseado; probar foco.
	●	Solo un nivel de elevación cuando sea necesario. No aplicar simultáneamente sombra grande y borde a cada tarjeta.
	●	min-width:0 en hijos flex/grid con montos largos; evitar overflow-x de página.
	●	env(safe-area-inset-top), env(safe-area-inset-bottom) y manejo real del teclado virtual.

5.6. Componentes permitidos y comportamiento

|Componente       |Uso                  |Reglas                                             |
|-----------------|---------------------|---------------------------------------------------|
|`AppHeader`      |marca y fecha        |no avatar/bell/search/plus redundante              |
|`SavingsHero`    |total y dos métricas |solo una pieza visual dominante                    |
|`PrimaryButton`  |añadir dinero        |texto legible y feedback de prensa                 |
|`MonthlyProgress`|objetivo mensual     |mostrar solo si plan > 0; cap 100% visual          |
|`MovementRow`    |historial            |plana, monto y fecha, sin card por fila            |
|`MovementDialog` |añadir/retirar/editar|una acción clara por apertura, errores inline      |
|`PlanSettings`   |plan mensual         |una cifra editable, previsión explicada            |
|`BackupDialog`   |export/import        |validación previa, confirmación antes de reemplazar|
|`StatusMessage`  |éxito o error        |frase corta, no banner decorativo                  |

No crear variantes fantasma, estados hover imposibles en móvil ni pantallas sin flujo de uso.

5.7. Motion tokens y reglas

:root {

  --motion-fast: 120ms;

  --motion-row: 180ms;

  --motion-sheet: 240ms;

  --motion-number: 360ms;

  --ease-enter: cubic-bezier(0.20, 0.80, 0.20, 1);

  --ease-exit: cubic-bezier(0.40, 0, 1, 1);

}

@media (prefers-reduced-motion: reduce) {

  /* implementaciones: acortar o eliminar desplazamientos e interpolaciones */

}

	●	El estado real cambia después de commit. No animar dinero inventado mientras el almacenamiento sigue pendiente.
	●	Panel inferior: 16px translation + opacity hasta settled en unos 240ms. No bounce/overshoot.
	●	Valor de saldo: interpolate visual 280–420ms solo después de un movimiento real; primer render sin contador desde cero.
	●	Barra progreso: 260–360ms al cambiar cifra; sin bucles.
	●	Lista: nueva fila opacity + translateY(6px) durante 180ms.
	●	Prensa: scale(.985) breve, accesible, no transition: all.
	●	Reduced motion: resultado instantáneo, mensajes siguen presentes, sin mover paneles ni números.
	●	Evitar pulso permanente, shimmer por costumbre, marqués, cursores parpadeantes, blur grande, confeti, partículas, animaciones de scroll.

5.8. Texto y estados

Texto aprobado: En mi alcancía, Aportado este mes, Julio de 2029, Añadir dinero, Movimientos recientes, Ver todos, Plan mensual, Faltan $X, Plan cumplido, Retirar dinero, Guardar aporte, Nota (opcional), Exportar copia.

Reglas: textos de 1–5 palabras para acciones; explicar limitaciones solo donde el usuario toma una decisión; un mensaje de error nombra lo que falló y qué hacer; no repetir la cifra con sinónimos en tres bloques.

Vacío: Todavía no has registrado dinero. + Añadir dinero.

Sin proyección: Configura tu aporte mensual.

Error guardado: No se pudo guardar. Inténtalo de nuevo. manteniendo contenido del formulario.

Prohibido: Your life, in one place, Chat-powered updates, Unlock your potential, fake testimonials, frases de crecimiento, demodata en producción, fechas inventadas, personalidad AI.

5.9. Breakpoints y QA visual

	●	320px: márgenes 16px, saldo no desborda, sheet desplazable, CTA completo.
	●	360–430px: márgenes 20px, hero 24px; comprobar 375, 390/393 y 430 explícitamente.
	●	768/1280px: max-width:520px, centered, diálogos no exceden viewport.
	●	Texto grande: 200% / ajustes de accesibilidad. Se permite wrap en subtítulos, no truncar datos financieros silenciosamente.
	●	Pantalla con teclado: botón y campo operables, no quedar bajo teclado/home indicator.
	●	Sin JS de motion: todo contenido crítico visible. Ningún elemento nace con opacity:0 esperando callback no garantizado.

5.10. QA anti-slop y fuentes

Impeccable no impone estos tokens. Su catálogo advierte sobre spacing monótono, nested cards, copy repetido, low contrast, tipografía poco legible, motion por estética, glassmorphism y UI genérica. Los valores concretos son decisiones de producto.

Revisar en el código y en pantalla con criterio, no aplicar sugerencias a ciegas:

npx impeccable detect src/

npx impeccable detect http://localhost:5173

Si el detector no está disponible, continuar con revisión manual. No afirmar que estas pruebas ya se ejecutaron.

Referencias:

	●	https://impeccable.style/slop/
	●	https://impeccable.style/docs/layout/
	●	https://impeccable.style/docs/typeset/
	●	https://impeccable.style/docs/animate/
	●	https://impeccable.style/docs/clarify/
	●	https://impeccable.style/docs/design-system/

Prioridad de diseño: si algo se ve «premium» pero dificulta registrar dinero o entenderlo, se elimina.

6. Microcopy: palabras finales de la interfaz

|Contexto          |Texto exacto                                                        |
|------------------|--------------------------------------------------------------------|
|título app        |`aiden.`                                                            |
|hero              |`En mi alcancía`                                                    |
|cifra secundaria  |`Aportado este mes`                                                 |
|cifra previsión   |`Julio de 2029`                                                     |
|acción principal  |`Añadir dinero`                                                     |
|input             |`Cantidad`                                                          |
|confirmación      |`Guardar aporte`                                                    |
|nota              |`Nota (opcional)`                                                   |
|fecha             |`Fecha`                                                             |
|historial         |`Movimientos recientes`                                             |
|vínculo           |`Ver todos`                                                         |
|plan              |`Plan mensual`                                                      |
|meta restante     |`Faltan $X`                                                         |
|meta alcanzada    |`Plan cumplido`                                                     |
|retiro            |`Retirar dinero`                                                    |
|éxito             |`Aporte guardado` / `Retiro registrado`                             |
|error persistencia|`No se pudo guardar. Inténtalo de nuevo.`                           |
|sin historial     |`Todavía no has registrado dinero.`                                 |
|sin plan          |`Configura tu aporte mensual`                                       |
|sin conexión      |no hace falta mensaje permanente si el almacenamiento local funciona|
|backup            |`Exportar copia` / `Importar copia`                                 |

No usar discursos motivacionales, preguntas innecesarias ni el mismo concepto escrito tres veces. La incertidumbre financiera sí debe explicarse junto a la proyección: Estimación si mantienes tu plan mensual. No incluye retiros futuros.

7. Motion: mapa exhaustivo de comportamientos

Principio central: animar la relación entre acción y resultado, no toda la pantalla. La app permanece usable sin animaciones. Respetar prefers-reduced-motion y evitar que el movimiento retrase una operación.

|Evento               |Resultado visual                                                          |Duración objetivo                 |Easing  |Reglas                              |
|---------------------|--------------------------------------------------------------------------|---------------------------------:|--------|------------------------------------|
|Primera apertura     |contenido visible desde el primer frame; refinamiento opcional de opacidad|0–180ms                           |ease-out|nunca ocultar elementos esperando JS|
|Tap en botón         |estado presionado `scale(.985)` + color                                   |90–120ms                          |ease-out|no bounce                           |
|Abrir add sheet      |overlay oscuro moderado + sheet `translateY(16px→0)` y opacidad           |200–260ms                         |ease-out|focus después de abrir, si es seguro|
|Cerrar add sheet     |sheet baja 12–16px y se desvanece                                         |160–220ms                         |ease-in |no perder borrador sin aviso        |
|Seleccionar chip     |cambia borde/fondo, no salto de layout                                    |100–140ms                         |ease-out|color no es único indicador         |
|Input válido/inválido|borde y mensaje inline estable                                            |100–160ms                         |ease-out|no sacudir formularios              |
|Guardado en progreso |botón deshabilitado con texto `Guardando…`                                |sin animación de bucle obligatoria|—       |bloquear duplicados                 |
|Commit exitoso       |cerrar panel, número anterior→nuevo, nueva fila breve                     |280–420ms cifra; 160–220ms fila   |ease-out|solo después del commit             |
|Progreso mensual     |ancho de barra al nuevo porcentaje                                        |260–360ms                         |ease-out|cap visual 100%                     |
|Retiro exitoso       |misma transición de cifra, valor disminuye                                |280–420ms                         |ease-out|nunca mostrar signo equivocado      |
|Edición de monto     |transición hacia valor recalculado                                        |240–360ms                         |ease-out|no reanimar todo el historial       |
|Eliminación          |fila desaparece suavemente después de confirmar                           |160–200ms                         |ease-in |no eliminar antes del commit        |
|Cambiar mes          |crossfade breve del contenido                                             |120–180ms                         |ease-out|conservar contexto                  |
|Error de guardado    |mantener sheet y texto, sin victoria simulada                             |inmediato                         |—       |se puede reintentar                 |
|Toast éxito          |aparecer/desaparecer con opacidad                                         |140–180ms                         |ease-out|no tapa botones                     |
|Cambio offline→online|ningún evento cosmético                                                   |0ms                               |—       |no hay sync remoto                  |

Coreografía exacta de añadir dinero

	●	t=0: clic real del usuario, validación síncrona.
	●	t≈0–commit: aparece estado Guardando…; el saldo y las otras cifras no cambian todavía.
	●	commit correcto: la fuente de datos se refresca, el panel se cierra y la fila nueva entra de forma discreta.
	●	durante 280–420ms: únicamente las cifras que cambiaron interpolan visualmente desde el valor anterior al nuevo; cálculos ya muestran el valor nuevo en estado de aplicación.
	●	final: ninguna animación sigue corriendo ni bloquea interacción; toast corto, accesible.
	●	Si no hubo valor previo (primer render, reabrir app), mostrar saldo sin interpolar desde cero.

Detalle del contador: siempre partir del valor real previo al commit. Formatear cada frame como COP sin decimales. Interrumpir de forma segura si llega otra actualización. Nunca interpolar un saldo negativo. El valor final accesible debe ser exacto y no narrar cientos de números intermedios al lector de pantalla: aria-live para un único anuncio final.

Implementación: CSS transform/opacity/background-color, Web Animations API o requestAnimationFrame pequeño para el valor numérico si realmente aporta. Evitar setInterval para interpolaciones, librerías tipo Framer Motion y animaciones ligadas al scroll. No usar transition: all. No animar height:auto, box-shadow grande, blur de fondo ni cambios que provoquen layout continuo.

Reduce motion: transiciones de desplazamiento/cifra se omiten (0–50ms); no se elimina el feedback de éxito, error o focus. Se recomienda escribir explícitamente CSS de override y probarlo.

Rendimiento: preferir animaciones transform/opacity, evitar repintado de listas enteras, no hacer confeti ni partículas, y comprobar interacción de teclado durante transición.

8. Modelo de datos

Regla: el único origen del dinero es el libro de movimientos. No persistir una copia de balance que pueda desincronizarse.

type MovementType = 'deposit' | 'withdrawal';

type Movement = {

  id: string;                 // UUID creado una vez al confirmar

  type: MovementType;

  amountCOP: number;          // entero seguro positivo; nunca un float

  localDate: string;         // 'YYYY-MM-DD' Colombia

  createdAt: string;         // ISO UTC, orden estable dentro del mismo día

  updatedAt: string;         // ISO UTC

  note?: string;             // máx. 120 caracteres, texto plano

};

type Settings = {

  monthlyPlanCOP: number | null; // null = no establecido; 0 = sin aportes planificados

  targetEndMonth: '2029-07';

  schemaVersion: 1;

};

type BackupV1 = {

  format: 'aiden.savings.backup';

  version: 1;

  exportedAt: string;

  settings: Settings;

  movements: Movement[];

};

	●	IndexedDB: stores movements y settings; indexes por fecha si se justifican, sin tablas extra.
	●	Si se ejecuta una importación, validar todo antes de reemplazar; reemplazo atómico, nunca limpiar primero y luego fallar.
	●	IDs únicos y deduplicación por ID. Los movimientos se crean en una única transacción readwrite. No permitir dobles commits por doble clic.
	●	Montos permitidos: enteros >0, <=999_999_999 COP por operación, límite de seguridad pragmático de v1; cambiar solo mediante decisión explícita. Prohibir NaN, negativos en amountCOP, Infinity, fracciones y cadenas ambiguas.
	●	Fecha del movimiento: no futura; al editar fecha o retiro, evitar secuencias históricas imposibles con saldo bajo cero si los movimientos están ordenados por fecha/creación.
	●	Orden histórico: localDate ascendente y, a igualdad, createdAt + id como desempate. Listado de UI descendente.
	●	Notas solo texto plano. No dangerouslySetInnerHTML para contenido ingresado.
	●	Si el usuario ya guardó dinero antes de instalar la PWA, registrarlo como primer aporte real; no inventar saldo inicial en el código.

Persistencia ante errores

	●	Dejar el borrador abierto si IndexedDB no responde, está bloqueado o falla.
	●	Deshabilitar guardado durante el commit; no hacerlo optimista.
	●	Detectar cambios de esquema y migrar sin borrar movimientos. Si la DB no puede abrirse, mostrar error recuperable, no $0 como si nada hubiera pasado.
	●	Evitar borrar datos mediante Clear accidental; operaciones destructivas con confirmación.
	●	Si la app se abre en más de una pestaña, evitar estados duplicados y refrescar al volver al primer plano. No introducir sync cloud.

9. Cálculos exactos

9.1. Definiciones inconfundibles

saldoActual = SUM(deposit.amountCOP) - SUM(withdrawal.amountCOP)

aportadoMes = SUM(deposit.amountCOP con localDate dentro del mes)

retiradoMes = SUM(withdrawal.amountCOP con localDate dentro del mes)

netoMes = aportadoMes - retiradoMes

	●	El hero muestra Aportado este mes, que significa total de depósitos del mes, no neto.
	●	El objetivo mensual se compara contra neto del mes, porque si sacas dinero de la alcancía no cumpliste el ahorro neto equivalente.
	●	Mostrar Retirado este mes / Cambio neto del mes en el detalle, solo cuando sirva para evitar una lectura engañosa.
	●	Nunca mostrar un + para un retiro. No inferir rendimiento financiero, interés ni inflación.

9.2. Progreso hacia plan mensual

Si monthlyPlanCOP es null o cero, no dibujar barra con división por cero. Si >0:

progressRaw = netoMes / monthlyPlanCOP

progressVisual = clamp(progressRaw, 0, 1)

remainingMonthCOP = max(0, monthlyPlanCOP - netoMes)

	●	Con netoMes < 0, el ancho visual es 0%, pero texto indica el neto negativo si está en detalle.
	●	Con meta superada, barra llena y texto Plan cumplido; no esconder aportes adicionales.
	●	Cambiar plan no cambia movimientos físicos ni saldo.

9.3. Proyección hasta julio de 2029

Esta proyección se basa en un plan constante y no predice la realidad. Se actualiza usando el monto físico registrado.

Para fecha actual hasta julio de 2029 inclusive:

mesesPosteriores = número de meses calendario desde el próximo mes

                   hasta julio 2029, inclusive

pendienteMesActual = max(0, planMensual - netoMes)

proyeccion = saldoActual + pendienteMesActual + mesesPosteriores * planMensual

	●	Si el plan es null, mostrar Configura tu aporte mensual y ninguna cifra inventada.
	●	Si plan = 0, proyección = saldoActual.
	●	Si estamos en julio 2029, mesesPosteriores = 0, solo se suma lo que resta del plan de ese mes.
	●	Después del 31/07/2029, detener proyecciones; cambiar a saldo real / histórico y etiquetar el período terminado.
	●	Un aporte ya registrado queda en saldoActual; su efecto en pendienteMesActual evita que se cuente dos veces el aporte previsto del mes.
	●	No anticipar retiros futuros, cambios de aporte, inflación o intereses; explicar la limitación debajo de la previsión, en una sola línea.

Ejemplo controlado, NO precargar como usuario: 16/11/2026, saldo = $166.000; aportado/neto de noviembre = $166.000; plan = $200.000 mensual. Quedan $34.000 de noviembre y 32 meses posteriores completos. Estimación: $166.000 + $34.000 + 32 × $200.000 = $6.600.000 COP.

Prueba contra conteo doble: si guardas otros $20.000 en noviembre, saldo pasa a $186.000 y faltante del mes a $14.000. Proyección permanece en $6.600.000, suponiendo que igual completarás la meta mensual. Si aportas por encima de ella, la proyección sí aumenta por el excedente real.

9.4. Promedio mensual (secundario y opcional)

Mostrar solo después de 3 meses calendario completos desde el primer movimiento hasta el último mes ya cerrado. Dividir la suma de netos de ese período por el número de meses calendario, incluyendo los meses con cero aportes. Una cifra negativa no se interpreta como rendimiento. Si se ofrece una segunda proyección basada en promedio, etiquetarla Ritmo histórico, separada del Plan mensual, y dejarla fuera de v1 si genera sobrecarga visual.

9.5. Fechas y dinero

	●	Trabajar con YYYY-MM-DD para operaciones por mes; calcular hoy en America/Bogota mediante Intl.DateTimeFormat, no partir de UTC con toISOString().slice(0,10).
	●	Toda suma en pesos enteros, nunca 0.1 + 0.2.
	●	Formato Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }), verificando salida sin decimales. Si la abreviatura ocupa demasiado, usar $166.000 y especificar COP una sola vez cerca.
	●	Validar períodos cruzando diciembre/enero, años bisiestos y cambios de fecha al final del día.

10. Formularios y seguridad de interacción

Añadir dinero

	●	El campo es type="text" inputMode="numeric" o equivalente accesible; el dato interno es texto sin formatear y se transforma a entero seguro al validar. Evitar type="number" que puede aceptar notación exponencial y teclados incómodos.
	●	Permitir pegar 20000 o 20.000 de forma inequívoca; rechazar separadores ambiguos y decimales, no convertirlos silenciosamente.
	●	Opciones rápidas 5.000 / 10.000 / 20.000 / 50.000, solo si mejoran el flujo; sustituyen el monto del input.
	●	Fecha predeterminada hoy, editable hacia el pasado. Nota máximo 120 caracteres.
	●	El texto del botón siempre identifica la acción: Guardar aporte.
	●	Botón disabled mientras inválido o guardando, error inline próximo al campo y control alcanzable por teclado.

Retirar dinero

	●	Entrada secundaria desde la vista de detalle.
	●	El título y el CTA dicen Retirar dinero y Registrar retiro; nunca reciclar Guardar aporte.
	●	No permitir retirar más que el saldo disponible para esa fecha, manteniendo consistencia histórica.
	●	Mostrar confirmación de importe para evitar errores irreversibles.

Editar/eliminar

	●	Edición permite corregir importe, fecha o nota; recalcular derivados. Si afecta el historial y genera saldo inválido, rechazar con explicación.
	●	Eliminación con confirmación Eliminar movimiento; informar que afecta todas las cifras.
	●	No crear un botón de «editar saldo», porque rompería el libro contable.

Backups

	●	Exportación JSON con versión de esquema, fecha, preferencias y movimientos. No incluir credenciales (no existen) ni nombres de familiares.
	●	Importación replace all solo tras validar esquema, IDs, montos, fechas, tipos, integridad aritmética y límites de tamaño; dar un resumen antes de confirmar.
	●	Importación atómica: o se instala el backup completo o permanece toda la información anterior.
	●	Contemplar archivos descargados/compartidos desde iPhone PWA con fallback si el navegador no permite un método: Blob/download; opcional navigator.share si se admite archivos y el usuario pulsa explícitamente.
	●	El archivo de backup es personal. Nunca subirlo a un repositorio público, incluirlo en public/ ni registrarlo en analytics.
	●	Un reminder discreto de exportar después de varios movimientos sin copia puede evaluarse al final, pero no bloquear el registro.

11. Tecnología y organización mínima

Stack: React + TypeScript + Vite + CSS con variables. IndexedDB como persistencia. Se puede usar el paquete pequeño idb solo si reduce errores/boilerplate del IndexedDB nativo. Servicio offline generado mediante vite-plugin-pwa solo si simplifica el mantenimiento frente a un SW manual. Tests de lógica con Vitest.

Sin: React Router en v1 (basta navegación local por estado o hash compatible con GitHub Pages), Tailwind si no aporta valor, framework de componentes, biblioteca de animación, charting, ORM, backend, dependencias de iconos enormes.

Estructura propuesta, crear únicamente conforme se necesite:

/

  AIDEN_PWA_MASTER_PLAN.md

  index.html

  vite.config.ts

  public/

    favicon.svg                 # marca simple monocromática

    icons/                      # íconos PWA generados a tamaño correcto

  src/

    App.tsx

    main.tsx

    styles.css

    components/

      SavingsHero.tsx

      AddMovementDialog.tsx

      MovementList.tsx

      SavingsDetail.tsx

      SettingsDialog.tsx

    savings/

      calculations.ts           # funciones puras

      calculations.test.ts

      validation.ts

      storage.ts

      backup.ts

      types.ts

No forzar una carpeta para cada botón, ni crear archivos vacíos para extensibilidad futura. Preferir componentes por responsabilidad real, sin abstraer todo prematuramente.

GitHub Pages + instalación

	●	Deploy estático con GitHub Actions a HTTPS. Repo de código sin cantidades privadas, exports ni datos personales.
	●	En project pages (usuario.github.io/repo/), configurar base: '/repo/' en Vite, manifest start_url y scope coherentes, referencias de iconos y ruta de Service Worker correctamente delimitadas.
	●	Manifest name: "aiden.", short_name: "aiden", display: "standalone", tema neutro y set de iconos. Prueba la instalación real en iPhone; Safari/iOS reciente puede variar cómo trata «Abrir como app».
	●	El SW debe cachear el app shell y assets versionados para permitir abrirla offline, no respuestas privadas remotas ni APIs inexistentes. Actualizaciones no deben eliminar IndexedDB.
	●	Usar env(safe-area-inset-*); comprobar toolbar/teclado, 100dvh, overscroll y app standalone.
	●	Advertencia crucial: datos del PWA instalado no están garantizados compartidos con Safari, con otra instalación, ni con otra URL/dominio. Cambiar dominio o dispositivo implica exportar e importar copia, si es posible. GitHub Pages no respalda el IndexedDB del usuario.

12. Accesibilidad y rendimiento

	●	Áreas táctiles de al menos 44×44px, y botones principales de 48–52px de altura.
	●	<button> real para botones y <label> asociado para campos; nunca implementar control clickable como <div>.
	●	:focus-visible con foco legible, manejo de Escape y retorno de foco tras cerrar <dialog>; no permitir foco detrás del modal.
	●	Lectores de pantalla: actualización final del saldo/éxito a través de región aria-live="polite"; no anunciar cada cuadro de una interpolación numérica.
	●	El color no es la única indicación de aporte/retiro: prefijos + / − y texto apropiado.
	●	No depender de hover; probar con interacción táctil y teclado.
	●	Contraste AA: 4.5:1 normal, 3:1 títulos grandes; etiquetas auxiliares visibles al sol.
	●	Reducir movimiento y tamaños de letra ampliados sin romper el layout. Evitar layout shift durante carga.
	●	Sin importación de imágenes por defecto: app rápida, con fuentes del sistema. Performance budgets orientativos: interacción de guardado visual sin retrasos artificiales; evitar work innecesario al teclear.

13. Pruebas automatizadas necesarias

Cálculos (unitarias)

	1.	Primera instalación → saldo 0 y sin registros inventados.
	2.	Un depósito de 20.000 → saldo +20.000 y aportado mensual correcto.
	3.	Dos depósitos iguales → ambos cuentan si fueron dos acciones explícitas, pero doble click durante un mismo guardado crea uno solo.
	4.	Retiro después de depositar → saldo menor; aportadoMes no cambia.
	5.	Retirar > disponible histórico → rechazo sin escribir nada.
	6.	Mover la fecha de un depósito al mes anterior altera métricas mensuales pero no saldo final.
	7.	Editar y borrar recalcula balances y validación temporal.
	8.	31 diciembre → 1 enero, febrero bisiesto, medianoche de Colombia.
	9.	Plan sin configurar → proyección no numérica; plan 0 → proyección = saldo.
	10.	Plan 200.000, saldo 166.000, noviembre 2026 → proyección 6.600.000.
	11.	Aporte +20.000 dentro del plan → proyección permanece en 6.600.000.
	12.	Aporte que supera plan → proyección aumenta solo por el excedente, no 2 veces.
	13.	Neto mensual negativo, meta sobrepasada, mes actual julio 2029 y fecha posterior a la meta.
	14.	Monto 0, negativo, decimal, NaN, Infinity, mal pegado, fecha futura, sobre-límite.
	15.	Exportar/importar round-trip; archivo alterado o de otra versión no destruye datos.
	16.	Guardado fallido deja borrador y saldo intacto.

Interacción/visual (manual o automatización disponible)

	●	iPhone 16, safari y app instalada: primer uso, guardar, cerrar, reabrir.
	●	Activar modo avión una vez cargada la app: abrir, ingresar aportes, cerrarla y reabrir offline.
	●	Pantallas CSS 320, 360, 375, 390/393, 430, 768 y 1280 px; sin scroll horizontal.
	●	Textos de 200%, notas largas, saldos con 9 dígitos y top safe area; no recortes.
	●	Teclado abierto en sheet: CTA y campos accesibles; scrolling adecuado.
	●	Reducir movimiento activo: la app sigue dando feedback sin deslizamientos.
	●	Probar dos toques rápidos en guardar y navegación durante una escritura.
	●	Probar fallo inducido en IndexedDB, export/import backup con datos reales de prueba.
	●	Probar recarga después de deploy nuevo: datos intactos y SW actualizado; sin estado atascado.
	●	Teclado/VoiceOver en controles y screen reader en éxito/error.

14. Auditoría anti-slop y diseño

Se tomó como referencia explícita la guía https://impeccable.style/slop/ (consultada en noviembre de 2026), especialmente reglas de Layout & Space, Typography, Motion, Copy, Visual Details, General quality, y trabajo con los tokens de este documento. El catálogo incluye detecciones automatizadas y juicios visuales; un finding invita a revisar, no siempre prohíbe un patrón.

Checklist de revisión visual:

		Todas las medidas no excepcionales usan tokens de los tokens de la sección 5.
		Ninguna sección repite el encabezado como microetiqueta.
		No hay cards dentro de cards ni cinco cuadros idénticos por defecto.
		Los apartados tienen separación mayor que sus elementos internos.
		Aportado este mes no se confunde con saldo, neto o meta.
		Sin shimmer de adorno, cursor falso, pulso perpetuo ni overshoot/bounce.
		Sin gradientes, «AI colors», fotografía de montaña o cerdito 3D.
		Sin sombras + bordes redundantes ni radios extremos.
		Tipografía, contraste, safe areas, notas largas y teclado auditados.
		No textos de marketing ni instrucciones obvias para una sola acción.
		Contenido siempre visible aunque falle un handler de animación.
		No placeholders de dinero ni transacciones de ejemplo al entregar.
		Error claro con salida accionable, no solo Something went wrong.

Cuando el proyecto exista, opcionalmente ejecutar el detector de Impeccable (no es dependencia runtime de la PWA):

npx impeccable detect src/

npx impeccable detect http://localhost:5173

No declarar un escaneo «pasado» sin ejecutarlo ni introducir Impeccable como dependencia permanente solo para conseguir una insignia. Revisar hallazgos en lugar de aplicar todos ciegamente.

15. Orden de ejecución para Codex

Fase 1. Base y lógica: crear Vite React/TS; implementar calculations.ts puro, validación, DB, fechas y sus pruebas. Cero UI falsa. Implementar los tokens de la sección 5 de este documento.

Fase 2. Home funcional: render real desde IndexedDB; vacío verídico; header, hero, estadísticas, CTA, actividad reciente. Sin componentes de otras áreas.

Fase 3. Aportes y retiros: dialog accessible; monto, fecha, nota, chip, commit seguro, edición/eliminación y bloqueo de doble submit. Pruebas de persistencia.

Fase 4. Matemáticas y detalle: plan mensual, progreso, proyección a 2029, historia mensual; tests de errores y fechas.

Fase 5. Motion y accesibilidad: CSS tokens, transiciones medidas, contador después del commit, prefers-reduced-motion, foco, teclado, responsive y estados fallidos.

Fase 6. Persistencia a largo plazo: export/import atómicos, advertencia de datos locales, modo offline, manifest, SW, deploy Pages, pruebas en iPhone.

Fase 7. Control de calidad: auditar contra la sección 5 de este documento y criterios anti-slop. Ejecutar tests, build y pruebas reales que estén disponibles; registrar explícitamente lo que no se pudo probar (especialmente app instalada en iPhone).

No saltar a una fase estética si el flujo de guardar está roto. No ampliar el scope por entusiasmo.

16. Definición de terminado

		Inicio con cero registros muestra $0 y ninguna cifra fabricada.
		Añadir $20.000 crea exactamente un movimiento persistido.
		Se actualizan saldo, aportado mensual, plan/progreso y previsión con cálculos correctos.
		Cerrar/abrir conserva todo; offline funciona tras instalar/cachear.
		Retirar, editar, eliminar y cambiar fecha mantienen consistencia histórica.
		Una importación inválida nunca destruye el historial existente.
		Export/restore funciona en el destino iOS real, no solo en escritorio.
		No hay scroll horizontal, clipping, CTA oculto por teclado, texto ilegible ni espacios arbitrarios.
		Todas las animaciones tienen razón, se pueden interrumpir y respetan Reduce Motion.
		No hay llamadas a servicios externos ni backend ni datos sensibles publicados en GitHub.
		Tests de cálculo y build pasan. Los límites de verificación se documentan honestamente.

Instrucción de arranque para Codex

> Implementa **solo** home + savings v1 de acuerdo con `AIDEN_PWA_MASTER_PLAN.md` (único documento). Lee este archivo completo antes de tocar código. Prioriza la integridad contable y la persistencia. Construye por fases sin ampliar alcance, usando React/TypeScript/Vite/IndexedDB, CSS con tokens y mínimo de dependencias. No uses datos ficticios en la aplicación, efectos decorativos ni texto de relleno. Ejecuta pruebas y build. Declara qué fue probado y qué requiere verificación manual en iPhone; no afirmes compatibilidad sin probarla.

17. Fuentes verificadas y diferenciación

Los siguientes enlaces explican principios del producto o limitaciones técnicas. Los valores exactos de spacing, colores, tiempos y layout son decisiones propuestas para este proyecto, no especificaciones impuestas por esas páginas.

	●	Impeccable, catálogo de slop completo: https://impeccable.style/slop/
	●	Impeccable, layout: https://impeccable.style/docs/layout/
	●	Impeccable, motion: https://impeccable.style/docs/animate/
	●	Impeccable, tipografía: https://impeccable.style/docs/typeset/
	●	Impeccable, copy: https://impeccable.style/docs/clarify/
	●	Impeccable, quality/harden: https://impeccable.style/docs/harden/
	●	Impeccable, design system (único documento): https://impeccable.style/docs/design-system/
	●	GitHub Pages (hosting estático): https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
	●	Apple/WebKit, modo app en iOS 26: https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
	●	Apple, almacenamiento separado en web apps del Home Screen: https://developer.apple.com/videos/play/wwdc2023/10120/

Fin del alcance v1. Nada de otras funciones hasta que Añadir dinero → guardar → reabrir → recuperar saldo sea confiable.

18. Contrato de ejecución y entregables para Codex

Este documento es una orden de implementación, no una petición de otro documento ni una propuesta estética. Si se recibe dentro de un repositorio, primero inspeccionar los archivos y preservar lo existente que sea útil. Si el repositorio está vacío, inicializar una aplicación estática mínima conforme al stack definido.

Entregables de código

	1.	Aplicación ejecutable con npm install, npm run dev, npm run build y npm run test, con scripts reales (no comandos mencionados que no existen).
	2.	Homepage y vista de Savings implementadas con datos leídos de IndexedDB, sin demo data en producción.
	3.	Flujo de crear, retirar, corregir y eliminar movimientos con validación temporal y protección ante duplicados.
	4.	Plan mensual y proyección hasta julio de 2029, funciones puras y pruebas unitarias.
	5.	Diseño monocromático derivado exclusivamente de la sección 5, con animaciones discretas y respeto por Reduce Motion.
	6.	Manifest, iconos válidos, offline app shell, configuración base Vite para GitHub Pages y workflow de GitHub Actions.
	7.	Importación y exportación de backup JSON, validación robusta y restauración atómica.
	8.	README breve solo para instalación, despliegue y limitaciones reales. No crear múltiples archivos .md de planificación ni carpetas sin necesidad.

Decisiones de ingeniería que no deben improvisarse

	●	Escritura correcta: confirmar el commit de IndexedDB antes de mostrar éxito, aumentar el total o cerrar el formulario. Un error mantiene los datos introducidos.
	●	Unicidad: impedir submit doble por botón y teclado mientras hay una operación en curso. Releer la lista desde la BD después del commit, no sumar manualmente un estado en memoria.
	●	Control histórico de saldo: ordenar eventos por fecha y desempate estable; después de cada mutación o importación, recalcular la secuencia acumulada completa. Rechazar si algún saldo parcial es negativo. Explicar el error junto al formulario.
	●	Persistencia local: dos instalaciones, navegadores o dominios pueden tener almacenes distintos. No anunciar sincronización ni respaldo automático.
	●	Actualización PWA: no borrar IndexedDB al refrescar Service Worker; avisar antes de forzar una recarga mientras el formulario tiene cambios.
	●	Protección ante datos dañados: detectar error al abrir BD y mostrar estado de recuperación; nunca reemplazar los datos por un saldo aparente de cero.
	●	Almacenamiento: respaldos de usuario nunca se guardan en public/, repositorio, commits, logs de consola o service-worker cache.
	●	Fechas: la zona America/Bogota define día y mes de las transacciones, incluso si el sistema operativo usa otra zona. Usar fecha local de transacción, no derivar del timestamp UTC para calcular el mes.
	●	Datos financieros: amountCOP es entero positivo y el saldo se deriva de operaciones. No permitir modificaciones directas del saldo.
	●	UI usable: en móviles, el panel debe ser scrollable con teclado abierto; controles táctiles de al menos 44 px; respetar safe area e imágenes reducidas (en este caso no usar imágenes decorativas).
	●	Motion verificable: éxito solo tras commit; no interpolar cifras en primera carga; reducir movimiento cuando la preferencia del sistema lo indique; sin animaciones permanentes.

Flujo de prueba end-to-end indispensable

A. Con BD vacía, mostrar cero real y estado vacío.
B. Crear aporte COP $20.000, verificar movimiento único, saldo $20.000, mes actualizado y persistencia tras recarga.
C. Repetir dos clics rápidos en Guardar aporte: un solo evento. Un segundo aporte deliberado, sí crea otro evento.
D. Retirar COP $5.000 y comprobar que el saldo sea COP $15.000, pero Aportado este mes permanezca COP $20.000.
E. Editar monto y fecha del primer aporte. Verificar que se recalculan todas las vistas/meses.
F. Probar retiro imposible y eliminación que rompería el histórico: rechazar sin pérdida de datos.
G. Exportar e importar backup; comparar movimientos, configuración, saldo y cálculos antes y después.
H. Probar importación inválida: el dataset existente sigue intacto.
I. Con plan COP $200.000 y ejemplo controlado de noviembre de 2026, confirmar fórmula y no doble conteo.
J. Compilar producción, desplegar en ruta /repo/, recargar desde una ruta interna compatible con Pages, reabrir offline y comprobar persistencia.
K. Comprobar pantallas de 320, 390 y 430 px, texto al 200%, teclado virtual y Reduce Motion.

Información honesta en la entrega final: indicar cambios realizados, pruebas automatizadas realmente ejecutadas y sus resultados, pasos para ejecutar y desplegar, riesgos conocidos y verificaciones manuales pendientes (especialmente instalación real en iOS). Nunca afirmar que se probó en un iPhone si no se dispone de uno.

Fuera de alcance sin excepción para v1

No crear calendario, tareas, goals generales, countdowns, chat, automatizaciones por mensaje, Shortcut de Action Button, login, sincronización remota, base de datos cloud, APIs de IA, servidor, push, analítica comercial, inversiones, módulos financieros ajenos a la alcancía o landing page promocional.

Resultado esperado: aplicación usable de principio a fin, con dinero persistente y matemáticas correctas. No terminar entregando solo wireframes, pseudocódigo, plan de trabajo o componentes de apariencia sin funcionalidad.