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

## Respaldo de maestros y parámetros

Al pie de la pantalla de selección de cotizadores, «Respaldo de configuración»
permite descargar un JSON con fecha y versión de formato. Incluye compañías de
Caución y ART, impuestos, períodos, sellados, riesgos, tipos de documento y el
catálogo ART con sus personalizaciones y eliminaciones. Exporta los cambios
guardados; guardá los editores antes de descargar. No incluye cotizaciones,
datos de clientes ni credenciales.

Para restaurar, elegí el archivo, revisá el resumen y confirmá el reemplazo.
Podés descargar la configuración actual antes de importar. La importación
valida todo el respaldo antes de guardar y recarga la aplicación para actualizar
ambos cotizadores; las cotizaciones en curso se perderán. Si falla una escritura,
intenta recuperar las claves anteriores y muestra cualquier error. Los archivos
incompatibles, corruptos o mayores a 5 MB se rechazan sin cambiar los maestros.

Publicar una nueva versión bajo el mismo origen HTTPS conserva el almacenamiento
del navegador. Los maestros guardados tienen prioridad sobre la configuración
publicada. El respaldo permite trasladarlos a otro navegador o dominio, o
recuperarlos tras borrar el almacenamiento. La configuración es propia de cada
navegador; no se sincroniza por cuenta de usuario.

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

Con dos o más cotizaciones se puede marcar una como «Actual del cliente».
Solo una tarjeta puede ser la referencia. Las propuestas muestran el ahorro
mensual, anual y porcentual frente a ella; si son más caras se indica el costo
adicional y si cuestan lo mismo se muestra «Sin ahorro». El costo actual se
calcula con su alícuota y la misma masa salarial y cápitas, no se ingresa una
factura independiente. Una referencia incompleta impide comparar hasta
completarla. Si el costo actual es cero, se comparan importes y se omite el
porcentaje de propuestas con costo positivo.

«Comparar por menor prima» quita la referencia y recupera la comparación original.
Al reducir la cantidad de cotizaciones, se limpia la referencia si su tarjeta
queda oculta o si queda una única cotización. Los datos de las filas se conservan.
La selección de referencia se mantiene durante la sesión de la página y al
volver desde el selector de herramientas; no se guarda después de recargar.

«Editar Compañías ART» mantiene un maestro independiente, inicialmente vacío,
guardado bajo `artCompanies` en `localStorage`. Los nombres aparecen como
sugerencias en cada cotización; también se pueden escribir nombres manualmente.
Los cálculos funcionan sin conexión una vez cargada la aplicación.

«Exportar a PDF» genera un documento A4 vertical con la estética de Caución:
logo Sirius, datos del cliente, documento, actividad CIIU, fecha e identificación
de cotización, cápitas, masa salarial en ARS y las primas de todas las cotizaciones
visibles. Si se marca una actual, incluye los ahorros o costos adicionales;
en caso contrario, las diferencias respecto de la menor prima. Una cotización
única se exporta sin tabla de diferencias.

La exportación valida nombre, documento según su máscara, actividad seleccionada,
cápitas, masa salarial y compañía/alícuota de cada fila visible. Toma los datos
actuales del formulario en cada exportación y no usa la cotización de Caución.
El PDF mantiene el mismo formato al exportarse desde móvil o escritorio y agrega
páginas con encabezado y numeración cuando las descripciones son extensas.
Requiere las bibliotecas jsPDF y AutoTable ya utilizadas por Caución; si no cargan,
se muestra un mensaje para reintentar.
