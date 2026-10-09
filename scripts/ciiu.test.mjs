import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Estos casos detectan pérdidas de ceros, reemplazos de personalizaciones y catálogos parciales.
const model = await import('../art-catalog.js').catch(() => ({ default: {} }));
const source = await import('../ciiu-source.mjs').catch(() => ({}));
const { normalizeActivities, mergeActivities, buildChanges } = model.default;
const official = [
    { codigo: '011111', descripcion: 'Cultivo de arroz' },
    { codigo: '620100', descripcion: 'Servicios informáticos' }
];

test('conserva los ceros y acepta códigos personalizados, rechazando duplicados y vacíos', () => {
    assert.deepEqual(normalizeActivities([{ codigo: '11111', descripcion: ' Arroz ' }, { codigo: 'ART-PROP', descripcion: 'Especial' }]), [
        { codigo: '011111', descripcion: 'Arroz' }, { codigo: 'ART-PROP', descripcion: 'Especial' }
    ]);
    assert.throws(() => normalizeActivities([{ codigo: '11111', descripcion: 'A' }, { codigo: '011111', descripcion: 'B' }]), /duplicado/i);
    assert.throws(() => normalizeActivities([{ codigo: '123456', descripcion: '' }]), /descripci/i);
});

test('una actualización agrega actividades sin pisar ediciones ni restaurar eliminaciones', () => {
    const changes = buildChanges(official, [
        { codigo: '011111', descripcion: 'Arroz personalizado' },
        { codigo: 'ART-PROP', descripcion: 'Actividad propia' }
    ]);
    const updated = [...official, { codigo: '410011', descripcion: 'Construcción' }];
    const result = mergeActivities(updated, changes.custom, changes.deleted);
    assert.deepEqual(result, [
        { codigo: '011111', descripcion: 'Arroz personalizado' },
        { codigo: '410011', descripcion: 'Construcción' },
        { codigo: 'ART-PROP', descripcion: 'Actividad propia' }
    ]);
    assert.deepEqual(mergeActivities(updated, JSON.parse(JSON.stringify(changes)).custom, changes.deleted), result);
});

test('las descripciones oficiales sin edición reciben cambios de la fuente', () => {
    const changes = buildChanges(official, official);
    assert.deepEqual(changes.custom, []);
    assert.equal(mergeActivities([{ codigo: '011111', descripcion: 'Nueva descripción' }], changes.custom, changes.deleted)[0].descripcion, 'Nueva descripción');
});

test('extrae códigos y descripciones, decodifica entidades y excluye actividades ocupacionales', () => {
    const html = '<li><b>011111: </b>Cultivo de arroz</li><li><b>620100: </b>Programación &amp; asesoría</li><li><b>000007: </b>Jubilado</li>';
    assert.deepEqual(source.parseActivities(html, 2), [
        { codigo: '011111', descripcion: 'Cultivo de arroz' },
        { codigo: '620100', descripcion: 'Programación & asesoría' }
    ]);
    assert.throws(() => source.parseActivities('<html>Sin catálogo</html>'), /catálogo/i);
    assert.throws(() => source.parseActivities(html), /catálogo/i);
});

test('rechaza fallos HTTP de la fuente oficial', async () => {
    await assert.rejects(() => source.fetchOfficialActivities(async () => new Response('offline', { status: 503 })), /HTTP/);
});

test('el respaldo local contiene el catálogo completo y descripciones utilizables', async () => {
    const context = { window: {} };
    vm.runInNewContext(await readFile(new URL('../ciiu-data.js', import.meta.url), 'utf8'), context);
    const saved = context.window.ciiuDefaultData;
    assert.ok(saved.activities.length >= 900);
    assert.equal(saved.activities.find(row => row.codigo === '011111').descripcion, 'Cultivo de arroz');
    assert.equal(new Set(saved.activities.map(row => row.codigo)).size, saved.activities.length);
    assert.ok(saved.activities.every(row => /^\d{6}$/.test(row.codigo) && row.descripcion.trim()));
});
