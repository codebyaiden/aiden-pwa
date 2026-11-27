# aiden. · agenda y finanzas personales PWA v1.3

PWA personal para billetes guardados en una alcancía. React + TypeScript + Vite, IndexedDB local, sin backend ni sincronización. No contiene datos de ejemplo.

## Desarrollo y despliegue

Requiere Node.js 22+. Ejecuta `npm install`, `npm run test` y `npm run build` (o `npm run dev` para desarrollo). El workflow `.github/workflows/deploy.yml` ejecuta pruebas y build antes de publicar GitHub Pages desde `main`. `vite.config.ts` calcula la ruta base, el manifest y el scope de Pages mediante `GITHUB_REPOSITORY`.

Sitio: https://codebyaiden.github.io/aiden-pwa/

## Ahorros v1.1 (conservados)

- Meta final configurable para el 31/07/2029, independiente del plan mensual. El aporte medio necesario divide lo que falta entre los meses calendario restantes **incluyendo el actual**.
- Gráfica accesible de aportes reales de los seis últimos meses, con valor exacto al seleccionar una barra.
- Simulador temporal, sin escrituras a IndexedDB: utiliza la fórmula de proyección del plan para evitar doble conteo en el mes actual.
- Racha mensual calculada desde los depósitos, con mes actual pendiente si todavía no hay depósito.
- La BD pasa de v1 a v2 **sin borrar movimientos**. Los respaldos v1 se aceptan, se validan y se convierten a v2 antes de la restauración atómica. Las copias nuevas son v2.

## Seguridad y limitaciones

El saldo **siempre** se calcula desde los movimientos guardados. Se confirma cada transacción IndexedDB antes del mensaje de éxito. Un error de almacenamiento no restablece cifras a cero. La simulación no guarda nada. Las copias JSON deben exportarse regularmente: **GitHub Pages no respalda tus datos**. Safari, la PWA instalada y distintos dispositivos pueden usar almacenes separados. Antes de cambiar de dispositivo o reinstalar, exporta tu copia.

Prueba en el iPhone real: instalar desde Safari, guardar/reabrir con modo avión, teclado y safe areas, cambiar de versión, exportar y restaurar archivos. Las pruebas automatizadas no sustituyen ese control.

## v1.2: agenda personal

- **Inicio / Calendario / Ahorros / Tareas**, acción central Añadir.
- Calendario con eventos personales, pagos/ingresos previstos, recurrencias y rangos de varios días; los pagos no modifican el dinero en la alcancía.
- Tareas y countdowns opcionales; avisos de vencimiento solo dentro de la app cuando se abre.
- IndexedDB `aiden-savings` v3 agrega stores no destructivos. Los ajustes y el historial financiero siguen en su esquema v2.
- Respaldo integral `aiden.personal.backup` v3. Al importar una copia de ahorro v1/v2, solo se reemplazan los movimientos y los ajustes financieros, conservando agenda/tareas/countdowns.

**iPhone:** guardar la copia JSON antes de actualizar; comprobar la migración, teclado, offline y la instalación real. GitHub Pages no sincroniza ni respalda los datos locales. Una PWA estática no puede garantizar notificaciones del sistema con la aplicación cerrada.


## v1.3: Dinero personal

- **Dinero** separa Alcancía y Gastos e ingresos. No existe saldo bancario inferido.
- Los gastos e ingresos reales usan un nuevo store `financeEntries` en IndexedDB `aiden-savings` v4. Los datos previos se conservan. Las cifras mensuales se calculan del registro real, no del calendario.
- Los vencimientos del calendario siguen siendo previstos. Un registro real vinculado marca esa ocurrencia como pagada/recibida en el mismo commit, sin crear depósitos ni retiros en Alcancía. Una ocurrencia solo puede tener un registro real.
- Los registros reales sobreviven a la eliminación de una serie, pero pierden su vínculo con el evento.
- Backup integral `aiden.personal.backup` v4. Una importación v3 conserva los registros reales actuales y les retira los vínculos de calendario; las copias de ahorros v1/v2 preservan la agenda y los registros de gastos/ingresos.
- Hay un documento opcional `VPS_HANDOFF.md` para un futuro servicio de Web Push. **v1.3 no instala backend ni ofrece push**, solo avisos dentro de la PWA al abrirla.

## Rutina

Aplicación integrada con progreso sin conexión y conexión opcional al VPS. Consulta la [instalación en iPhone, Atajos y recuperación](backend/SETUP.md).
