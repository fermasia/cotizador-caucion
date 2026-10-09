import { copyFile, mkdir } from 'node:fs/promises';

// Publicar únicamente los archivos de la aplicación.
const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
await mkdir(output, { recursive: true });

for (const name of ['index.html', 'cotizador.js', 'sirius_logo.png', 'clerk-config.js', 'auth.js', 'art.js', 'art-catalog.js', 'ciiu-data.js', 'art-quotes-model.js', 'art-quotes.js']) {
    await copyFile(new URL(name, root), new URL(name, output));
}

console.log('Archivos públicos preparados en dist/');
