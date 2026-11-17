# aiden. · alcancía PWA v1.1

PWA personal para billetes guardados en una alcancía. React + TypeScript + Vite, IndexedDB local, sin backend ni sincronización. No contiene datos de ejemplo.

## Desarrollo y despliegue

Requiere Node.js 22+. Ejecuta `npm install`, `npm run test` y `npm run build` (o `npm run dev` para desarrollo). El workflow `.github/workflows/deploy.yml` ejecuta pruebas y build antes de publicar GitHub Pages desde `main`. `vite.config.ts` calcula la ruta base, el manifest y el scope de Pages mediante `GITHUB_REPOSITORY`.

Sitio: https://codebyaiden.github.io/aiden-pwa/

## V1.1

- Meta final configurable para el 31/07/2029, independiente del plan mensual. El aporte medio necesario divide lo que falta entre los meses calendario restantes **incluyendo el actual**.
- Gráfica accesible de aportes reales de los seis últimos meses, con valor exacto al seleccionar una barra.
- Simulador temporal, sin escrituras a IndexedDB: utiliza la fórmula de proyección del plan para evitar doble conteo en el mes actual.
- Racha mensual calculada desde los depósitos, con mes actual pendiente si todavía no hay depósito.
- La BD pasa de v1 a v2 **sin borrar movimientos**. Los respaldos v1 se aceptan, se validan y se convierten a v2 antes de la restauración atómica. Las copias nuevas son v2.

## Seguridad y limitaciones

El saldo **siempre** se calcula desde los movimientos guardados. Se confirma cada transacción IndexedDB antes del mensaje de éxito. Un error de almacenamiento no restablece cifras a cero. La simulación no guarda nada. Las copias JSON deben exportarse regularmente: **GitHub Pages no respalda tus datos**. Safari, la PWA instalada y distintos dispositivos pueden usar almacenes separados. Antes de cambiar de dispositivo o reinstalar, exporta tu copia.

Prueba en el iPhone real: instalar desde Safari, guardar/reabrir con modo avión, teclado y safe areas, cambiar de versión, exportar y restaurar archivos. Las pruebas automatizadas no sustituyen ese control.
