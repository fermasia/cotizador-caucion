import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const Backup = existsSync(new URL('../config-backup.js', import.meta.url)) ? require('../config-backup.js') : {};
const caucionSource = readFileSync(new URL('../cotizador.js', import.meta.url), 'utf8');
function app(saved = null, remote = null) {
    const context = vm.createContext({
        console: { log() {}, warn() {} }, Event,
        localStorage: { getItem: () => saved }, window: { addEventListener() {} },
        fetch: async () => ({ ok: true, json: async () => remote }),
        document: { addEventListener() {}, dispatchEvent() {}, createElement: () => ({}),
            getElementById: () => ({ addEventListener() {}, appendChild() {}, options: [], value: '' }) }
    });
    vm.runInContext(caucionSource, context);
    return context;
}
const defaults = JSON.parse(vm.runInContext('JSON.stringify(cotizadorData)', app()));
const activities = { official: [{ codigo: '011211', descripcion: 'Cultivo' }], custom: [{ codigo: 'PROPIO', descripcion: 'Actividad propia' }], deleted: ['011211'], checkedAt: null };
function storage(initial = {}, failKey = null) {
    const values = new Map(Object.entries(initial));
    let failed = false;
    return { values, getItem: key => values.get(key) ?? null,
        removeItem: key => values.delete(key),
        setItem(key, value) {
            if (key === failKey && !failed) { failed = true; throw new Error('Cuota agotada'); }
            values.set(key, value);
        } };
}
function report() {
    return Backup.create({ caucion: defaults, artCompanies: ['ART propia'], artActivities: activities });
}

test('el respaldo conserva maestros, parámetros y personalizaciones sin datos de sesión', () => {
    assert.equal(typeof Backup.create, 'function');
    const exported = report();
    const target = storage({ currentQuote: 'privado', auth: 'sesión' });
    Backup.restore(target, Backup.parse(JSON.stringify(exported)));
    assert.equal(JSON.parse(target.getItem('cotizadorData')).impuestos.iva, 21);
    assert.deepEqual(JSON.parse(target.getItem('artCompanies')), ['ART propia']);
    assert.deepEqual(JSON.parse(target.getItem('artActivities')), activities);
    assert.equal(target.getItem('currentQuote'), 'privado');
    assert.equal(target.getItem('auth'), 'sesión');
});

test('rechaza archivos ajenos, versiones futuras y maestros incompletos antes de escribir', () => {
    assert.equal(typeof Backup.parse, 'function');
    for (const change of [x => x.app = 'otra', x => x.version = 99,
        x => delete x.data.caucion.impuestos.iva,
        x => x.data.caucion.companias[0].prima_minima.ARS = -1,
        x => x.data.artCompanies.push('art propia'),
        x => x.data.artActivities.custom.push({ codigo: 'PROPIO', descripcion: 'Duplicada' }),
        x => x.data.caucion.tiposDocumento[0].mascara = 42]) {
        const backup = report();
        change(backup);
        const target = storage({ cotizadorData: 'anterior' });
        assert.throws(() => Backup.restore(target, backup));
        assert.deepEqual([...target.values], [['cotizadorData', 'anterior']]);
    }
    assert.throws(() => Backup.parse('{mal json'));
});

test('si falla el guardado restaura las claves previas y elimina las nuevas', () => {
    assert.equal(typeof Backup.restore, 'function');
    const target = storage({ cotizadorData: 'anterior', unrelated: 'conservar' }, 'artActivities');
    assert.throws(() => Backup.restore(target, report()), /Cuota agotada/);
    assert.deepEqual([...target.values], [['cotizadorData', 'anterior'], ['unrelated', 'conservar']]);
});

test('exporta configuración guardada y completa los maestros antiguos con valores de respaldo', () => {
    assert.equal(typeof Backup.capture, 'function');
    const saved = structuredClone(defaults);
    delete saved.tiposDocumento;
    saved.impuestos.iva = 12;
    const source = storage({ cotizadorData: JSON.stringify(saved), artCompanies: '["ART guardada"]', artActivities: JSON.stringify(activities), currentQuote: 'privado' });
    const backup = Backup.capture(source, defaults, { activities: [], checkedAt: null });
    assert.equal(backup.data.caucion.impuestos.iva, 12);
    assert.equal(backup.data.caucion.tiposDocumento[0].nombre, 'DNI');
    assert.deepEqual(backup.data.artCompanies, ['ART guardada']);
    assert.equal('currentQuote' in backup.data, false);
    const fresh = Backup.capture(storage(), defaults, { activities: activities.official, checkedAt: null });
    assert.equal(fresh.data.caucion.impuestos.iva, 21);
    assert.deepEqual(fresh.data.artActivities.custom, []);
});

test('los datos del navegador tienen prioridad sobre el JSON de una nueva versión', async () => {
    const saved = structuredClone(defaults);
    saved.companias[0].nombre = 'Personalizada';
    saved.impuestos.iva = 10;
    const context = app(JSON.stringify(saved), defaults);
    await vm.runInContext('loadCotizadorData()', context);
    assert.equal(vm.runInContext('cotizadorData.companias[0].nombre', context), 'Personalizada');
    assert.equal(vm.runInContext('cotizadorData.impuestos.iva', context), 10);
});

function backupInterface() {
    const elements = new Map();
    const source = storage();
    let reloads = 0;
    const downloads = [];
    const element = id => {
        if (!elements.has(id)) elements.set(id, { disabled: true, hidden: false, checked: false, value: '', textContent: '', files: [], handlers: {},
            addEventListener(name, handler) { this.handlers[name] = handler; },
            showModal() { this.open = true; }, close() { this.open = false; this.handlers.close?.(); },
            click() { downloads.push(this.download); }, remove() {} });
        return elements.get(id);
    };
    let ready;
    const context = vm.createContext({ ConfigBackup: Backup, caucionBackupDefaults: defaults, Blob,
        URL: { createObjectURL: () => 'blob:respaldo', revokeObjectURL() {} }, setTimeout: handler => handler(),
        window: { localStorage: source, ciiuDefaultData: { activities: activities.official, checkedAt: null }, location: { reload() { reloads++; } } },
        document: { addEventListener: (name, handler) => ready = handler, getElementById: element, createElement: () => element('download'), body: { appendChild() {} } }
    });
    const file = new URL('../config-backup-ui.js', import.meta.url);
    if (existsSync(file)) vm.runInContext(readFileSync(file, 'utf8'), context);
    ready?.();
    return { element, source, downloads, get reloads() { return reloads; } };
}

test('la importación requiere archivo válido y confirmación antes de reemplazar los maestros', async () => {
    const ui = backupInterface();
    assert.equal(typeof ui.element('backup-file').handlers.change, 'function');
    ui.element('backup-file').files = [{ size: 10, text: async () => '{inválido' }];
    await ui.element('backup-file').handlers.change();
    assert.equal(ui.element('backup-restore').disabled, true);
    assert.equal(ui.source.values.size, 0);
    ui.element('backup-file').files = [{ size: 1000, text: async () => JSON.stringify(report()) }];
    await ui.element('backup-file').handlers.change();
    assert.match(ui.element('backup-summary').textContent, /1 compañía ART/);
    assert.equal(ui.element('backup-restore').disabled, true);
    ui.element('backup-confirm').checked = true;
    ui.element('backup-confirm').handlers.change();
    assert.equal(ui.element('backup-restore').disabled, false);
    ui.element('backup-restore').handlers.click();
    assert.deepEqual(JSON.parse(ui.source.getItem('artCompanies')), ['ART propia']);
    assert.equal(ui.reloads, 1);
});

test('cerrar el respaldo descarta el archivo pendiente y exportar no cambia la configuración', async () => {
    const ui = backupInterface();
    assert.equal(typeof ui.element('backup-export').handlers.click, 'function');
    ui.element('backup-export').handlers.click();
    assert.equal(ui.source.values.size, 0);
    assert.match(ui.downloads[0], /^Sirius_Respaldo_.*\.json$/);
    ui.element('backup-file').files = [{ size: 1000, text: async () => JSON.stringify(report()) }];
    await ui.element('backup-file').handlers.change();
    ui.element('backup-dialog').close();
    assert.equal(ui.element('backup-restore').disabled, true);
    assert.equal(ui.element('backup-confirm').checked, false);
});
