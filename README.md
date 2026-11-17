# aiden. · alcancía PWA

App personal de ahorros en COP. React, TypeScript, Vite e IndexedDB; sin backend ni datos de demostración.

## Ejecutar

Requiere Node.js 22+.

```sh
npm install
npm run dev
npm run test
npm run build
npm run preview
```

## GitHub Pages

1. Crea un repositorio para esta carpeta, con rama `main`, y sube los archivos incluyendo `package-lock.json` una vez generado con `npm install`.
2. En Settings → Pages selecciona **GitHub Actions** como fuente.
3. Al hacer push a `main`, el workflow prueba, compila y publica `dist`.
4. La configuración calcula automáticamente `base`, `start_url` y `scope` con `GITHUB_REPOSITORY`. Para previsualizar otra ruta localmente usa `VITE_BASE_PATH=/repo/ npm run build`.
5. En Safari del iPhone, abre el sitio HTTPS, usa Compartir → Añadir a pantalla de inicio y comprueba la apertura sin red.

## Importante

- Los registros viven en IndexedDB **de cada navegador, instalación y origen**. No están en GitHub y no tienen sincronización ni respaldo automático.
- Exporta copias JSON regularmente desde Ajustes. Antes de cambiar de teléfono, dominio o reinstalar, exporta y comprueba el archivo.
- Importar un archivo validado **reemplaza** todos los datos actuales, de manera atómica.
- Los resultados en iOS real, el teclado, el modo offline después de instalar y la exportación en Safari deben probarse en un iPhone. El build local no sustituye esa prueba.
