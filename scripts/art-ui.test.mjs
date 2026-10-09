import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

async function localFileApp() {
    const elements = new Map();
    let initialize;
    let networkCalls = 0;
    class Element {
        value = '';
        textContent = '';
        children = [];
        style = {};
        handlers = {};
        attributes = {};
        addEventListener(event, handler) { this.handlers[event] = handler; }
        setAttribute(name, value) { this.attributes[name] = String(value); }
        getAttribute(name) { return this.attributes[name] ?? null; }
        appendChild(child) { this.children.push(child); }
        append(...children) { this.children.push(...children); }
        focus() { context.document.activeElement = this; }
        replaceChildren(...children) { this.children = children; this.value = children[0]?.value ?? ''; }
        add(child) { this.children.push(child); }
    }
    const context = vm.createContext({
        console: { warn() {} }, AbortSignal, Date,
        window: { location: { protocol: 'file:' }, localStorage: { getItem() { return null; }, setItem() {} } },
        fetch: async () => { networkCalls++; throw new TypeError('Failed to fetch'); },
        document: {
            createElement() { return new Element(); },
            getElementById(id) {
                if (!elements.has(id)) elements.set(id, new Element());
                return elements.get(id);
            },
            addEventListener(event, handler) { if (event === 'DOMContentLoaded') initialize = handler; }
        },
        Option: class { constructor(text, value) { this.textContent = text; this.value = value; } },
        openDocsModal() {}
    });
    for (const filename of ['ciiu-data.js', 'art-catalog.js', 'art.js']) {
        const code = await readFile(new URL(`../${filename}`, import.meta.url), 'utf8').catch(() => '');
        vm.runInContext(code, context);
    }
    initialize();
    await new Promise(resolve => setImmediate(resolve));
    return { elements, context, networkCalls: () => networkCalls };
}

test('al abrir como archivo permite buscar por código sin descargar el catálogo', async () => {
    const app = await localFileApp();
    const search = app.elements.get('art-activity-search');
    const select = app.elements.get('art-ciiu');
    search.value = '410021';
    search.handlers.input();
    assert.ok(select.children.some(row => row.value === '410021'));
    select.value = '410021';
    select.handlers.change();
    assert.match(app.elements.get('art-description').textContent, /edificios no residenciales/i);
    assert.equal(app.networkCalls(), 0);
});

test('muestra coincidencias seleccionables con código y descripción sin abrir un combo', async () => {
    const app = await localFileApp();
    const search = app.elements.get('art-activity-search');
    search.value = '1112';
    search.handlers.input();
    const results = app.elements.get('art-activity-results');
    assert.equal(results.children.length, 3);
    const button = results.children[0].children[0];
    assert.ok(button.children[0].textContent);
    assert.ok(button.children[1].textContent);
    button.handlers.click();
    assert.equal(app.elements.get('art-ciiu').value, button.children[0].textContent);
    assert.equal(app.elements.get('art-description').textContent, button.children[1].textContent);
    assert.equal(results.children[0].children[0].attributes['aria-pressed'], 'true');
    search.value = 'SIN COINCIDENCIA xyz';
    search.handlers.input();
    assert.equal(results.children.length, 0);
    assert.match(app.elements.get('art-activity-count').textContent, /No encontramos/i);
    assert.equal(app.elements.get('art-ciiu').value, button.children[0].textContent);
});

test('permite ver más resultados sin perder la búsqueda ni la selección', async () => {
    const app = await localFileApp();
    const results = app.elements.get('art-activity-results');
    assert.equal(results.children.length, 20);
    app.elements.get('art-activity-more').handlers.click();
    assert.equal(results.children.length, 40);
    const search = app.elements.get('art-activity-search');
    search.value = '410021';
    search.handlers.input();
    assert.equal(results.children.length, 1);
    assert.equal(app.elements.get('art-activity-more').hidden, true);
});

test('conserva el foco en la misma actividad después de actualizar el catálogo', async () => {
    const app = await localFileApp();
    app.elements.get('art-activity-search').value = '1112';
    app.elements.get('art-activity-search').handlers.input();
    const results = app.elements.get('art-activity-results');
    results.children[1].children[0].focus();
    app.context.window.location.protocol = 'http:';
    app.context.fetch = async () => ({ ok: true, json: async () => app.context.window.ciiuDefaultData });
    await app.context.window.openArtTool();
    assert.equal(app.context.document.activeElement, results.children[1].children[0]);
});

test('al abrir como archivo encuentra actividades por nombre sin distinguir acentos', async () => {
    const app = await localFileApp();
    const search = app.elements.get('art-activity-search');
    search.value = 'CONSTRUCCION';
    search.handlers.input();
    assert.ok(app.elements.get('art-ciiu').children.some(row => row.value === '410021'));
    await app.context.window.openArtTool();
    assert.match(app.elements.get('art-catalog-status').textContent, /servidor/i);
    assert.equal(app.networkCalls(), 0);
});
