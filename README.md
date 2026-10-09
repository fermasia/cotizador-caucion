# Cotizadores de seguros Sirius

Aplicación con cotizadores de Caución y ART. Después de
iniciar sesión se elige una herramienta; ambas permiten volver al selector.

## Desarrollo

```sh
npm ci
npm run dev
```

`npm run check` verifica la sintaxis. `npm test` comprueba acceso, navegación,
documentos compartidos y actualización/persistencia del catálogo de actividades.
`npm run build` copia únicamente los archivos públicos a `dist/`.

## Cuentas con Clerk

La aplicación está vinculada a Clerk `app_3KOQCZqpfPQPgoDXKjaiWOtBYrp`
(Cotizador-Sirius). Configurar únicamente la **Publishable Key** en
`clerk-config.js`; este archivo es público. Nunca colocar una Secret Key.
La integración sigue la [guía oficial de JavaScript](https://clerk.com/docs/js-frontend/getting-started/quickstart)
y carga el SDK y sus componentes desde el dominio de Clerk.

La pantalla inicial permite iniciar sesión y crear una cuenta. El cotizador
se muestra solo con una sesión activa; el perfil aparece en el encabezado sin
agregar una fila. Al cerrar sesión, vuelve la pantalla de acceso.
Esta visibilidad se controla en el navegador: los archivos estáticos siguen
siendo públicos y las cotizaciones no se sincronizan entre cuentas.

```sh
clerk doctor
npm test
npm run dev
```

Para probar, seleccionar «Crear cuenta» y completar el registro. El botón de
perfil debe aparecer al finalizar; permite administrar la cuenta y cerrar sesión.
Antes de publicar con Clerk en producción, configurar su instancia de producción
y utilizar su clave pública correspondiente.

## Publicación en Cloudflare

La configuración está en `wrangler.jsonc`. El sitio se publica en:

https://cotizador-sirius.cerbero.workers.dev

```sh
npx wrangler login
npm run deploy
```

El comando de publicación reconstruye `dist/` antes de subir los archivos.
No se publican archivos de configuración, dependencias ni directorios ocultos.

## Datos y servicios externos

La aplicación utiliza los valores predeterminados de `cotizador.js` cuando
`datos_cotizador.json` no está disponible. Los cambios de configuración se
guardan en el navegador de cada usuario, no se comparten entre usuarios.

Las fuentes y bibliotecas de PDF se cargan desde servicios externos.
El tipo de cambio intenta consultarse sin credenciales; si la consulta falla,
se puede ingresar manualmente. No incluir credenciales en el JavaScript público.

## ART y catálogo de actividades

ART incluye Datos del Tomador, Riesgo a Cubrir, Cápitas y Masa Salarial, y hasta
cinco cotizaciones para comparar. Comparte el maestro de tipos
de documento y las máscaras de Caución, pero mantiene sus campos independientes.
El buscador CIIU filtra por código o descripción y muestra las coincidencias en
una lista de opciones visibles. Cada opción incluye código, descripción completa
y una acción de selección; también se puede elegir con Tab y Enter. El panel de
descripción identifica el código seleccionado. Se muestran inicialmente hasta
20 coincidencias y «Mostrar más actividades» permite seguir recorriendo el catálogo.

Cada entrada a ART consulta `GET /api/ciiu`; «Actualizar catálogo» permite
reintentar manualmente. El Worker consulta el
[nomenclador público de ARCA](https://serviciosweb.afip.gob.ar/genericos/nomencladorActividades/index.aspx)
(CIIU Revisión 4 / Formulario 883), preserva los seis dígitos y excluye la tabla
anexa de ocupaciones. Rechaza respuestas incompletas o con formato inesperado.
La fuente y el momento de consulta se muestran en ART; no se envían datos del
tomador a ARCA.

`ciiu-data.js` contiene una copia inicial de 951 actividades. Se carga como script
para que la búsqueda funcione también al abrir `index.html` directamente como archivo.
El catálogo consultado,
las actividades personalizadas y las eliminaciones se guardan en `localStorage`
bajo `artActivities`. Las descripciones editadas tienen prioridad sobre futuras
actualizaciones oficiales. Si la consulta falla, se conserva la copia disponible.
«Editar Actividades» permite agregar, editar y eliminar; «Guardar Cambios» valida
códigos únicos y descripciones completas antes de guardar. Los cambios son propios
del navegador, como los demás maestros; no se sincronizan entre usuarios.

Usar `npm run dev` para probar la actualización automática. Con un servidor
puramente estático como `python3 -m http.server`, el formulario y el editor funcionan
con el respaldo, pero `/api/ciiu` requiere el Worker.

## Primas y comparación de ART

Ingresar cantidad entera de cápitas y masa salarial mensual en ARS. Elegir de una
a cinco cotizaciones e ingresar compañía y alícuota porcentual para cada una.
Las primas se calculan al cambiar los datos:

- Prima mensual total: masa salarial mensual × alícuota / 100.
- Prima por cápita mensual: prima mensual total / cantidad de cápitas.
- Prima anual total: prima mensual total × 12.

Los importes se redondean a dos decimales. Con dos o más cotizaciones completas,
se destacan las de menor prima mensual y se muestra la diferencia porcentual de
las demás respecto de ese importe. Si la menor prima es cero, no se calcula una
diferencia porcentual para las alternativas positivas. Reducir la cantidad de
cotizaciones conserva las filas ocultas durante la sesión.

«Editar Compañías ART» mantiene un maestro independiente, inicialmente vacío,
guardado bajo `artCompanies` en `localStorage`. Los nombres aparecen como
sugerencias en cada cotización; también se pueden escribir nombres manualmente.
Los cálculos funcionan sin conexión una vez cargada la aplicación. ART todavía
no exporta cotizaciones.
