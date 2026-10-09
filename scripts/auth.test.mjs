import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../auth.js', import.meta.url), 'utf8').catch(() => '');

async function setup({ user = null, fail = false } = {}) {
    const elements = Object.fromEntries(['auth-screen', 'quote-app', 'auth-actions', 'auth-user', 'auth-status', 'auth-retry', 'sign-in-btn', 'sign-up-btn', 'tool-selector', 'caucion-tool', 'art-tool', 'tool-navigation', 'back-to-tools-btn', 'open-caucion-btn', 'open-art-btn', 'tool-title', 'tools-title', 'art-title', 'caucion-actions', 'art-actions', 'taker-name'].map(id => [id, { hidden: false, disabled: true, textContent: '', value: '', focus() { this.focused = true; }, addEventListener(event, handler) { this[event] = handler; } }]));
    let listener;
    let mounts = 0;
    let artRefreshes = 0;
    let unmounts = 0;
    const clerk = {
        user,
        async load() { if (fail) throw new Error('offline'); },
        addListener(callback) { listener = callback; callback({ user: this.user }); },
        mountUserButton() { mounts++; },
        unmountUserButton() { unmounts++; },
        openSignIn() {},
        openSignUp() {}
    };
    const context = {
        window: { openArtTool() { artRefreshes++; }, Clerk: clerk, __internal_ClerkUICtor: {}, addEventListener(event, callback) { this[event] = callback; }, location: { reload() {} } },
        document: { getElementById(id) { return elements[id]; } },
        console: { error() {} }
    };
    vm.runInNewContext(source, context);
    await context.window.load?.();
    return { elements, refreshes() { return artRefreshes; }, change(user) { listener({ user }); }, counts() { return { mounts, unmounts }; } };
}

test('los controles siguen los cambios de sesión sin duplicar el perfil', async () => {
    const app = await setup();
    assert.equal(app.elements['sign-in-btn'].disabled, false);
    assert.equal(app.elements['auth-user'].hidden, true);
    assert.equal(app.elements['quote-app'].hidden, true);
    assert.equal(app.elements['auth-screen'].hidden, false);
    app.change({ id: 'user_1' });
    app.change({ id: 'user_1' });
    assert.equal(app.elements['auth-actions'].hidden, true);
    assert.equal(app.elements['auth-user'].hidden, false);
    assert.equal(app.elements['quote-app'].hidden, false);
    assert.equal(app.elements['auth-screen'].hidden, true);
    assert.deepEqual(app.counts(), { mounts: 1, unmounts: 0 });
    app.change(null);
    assert.equal(app.elements['auth-actions'].hidden, false);
    assert.equal(app.elements['auth-user'].hidden, true);
    assert.equal(app.elements['quote-app'].hidden, true);
    assert.equal(app.elements['auth-screen'].hidden, false);
    assert.deepEqual(app.counts(), { mounts: 1, unmounts: 1 });
});

test('un fallo de Clerk mantiene deshabilitadas las acciones y permite reintentar', async () => {
    const app = await setup({ fail: true });
    assert.equal(app.elements['sign-in-btn'].disabled, true);
    assert.equal(app.elements['auth-retry'].hidden, false);
    assert.match(app.elements['auth-status'].textContent, /No se pudo/);
    assert.equal(app.elements['quote-app'].hidden, true);
});

test('una sesión existente muestra el selector de cotizadores', async () => {
    const app = await setup({ user: { id: 'user_1' } });
    assert.equal(app.elements['quote-app'].hidden, false);
    assert.equal(app.elements['auth-screen'].hidden, true);
});


test('al iniciar sesión se muestran las dos opciones y se ocultan los formularios', async () => {
    const app = await setup({ user: { id: 'user_1' } });
    assert.equal(app.elements['tool-selector'].hidden, false);
    assert.equal(app.elements['caucion-tool'].hidden, true);
    assert.equal(app.elements['art-tool'].hidden, true);
    assert.equal(app.elements['tool-navigation'].hidden, true);
    assert.equal(app.elements['caucion-actions'].hidden, true);
});

test('permite volver desde ambos cotizadores conservando los datos de Caución', async () => {
    const app = await setup({ user: { id: 'user_1' } });
    app.elements['open-caucion-btn'].click();
    assert.equal(app.elements['caucion-tool'].hidden, false);
    assert.equal(app.elements['tool-selector'].hidden, true);
    assert.equal(app.elements['caucion-actions'].hidden, false);
    assert.equal(app.elements['tool-navigation'].hidden, false);
    app.elements['taker-name'].value = 'Empresa de prueba';
    app.change({ id: 'user_1' });
    assert.equal(app.elements['caucion-tool'].hidden, false);
    app.elements['back-to-tools-btn'].click();
    assert.equal(app.elements['tool-selector'].hidden, false);
    assert.equal(app.elements['caucion-tool'].hidden, true);
    assert.equal(app.elements['tools-title'].focused, true);
    app.elements['open-art-btn'].click();
    assert.equal(app.elements['art-tool'].hidden, false);
    assert.equal(app.elements['tool-selector'].hidden, true);
    assert.equal(app.elements['caucion-actions'].hidden, true);
    assert.equal(app.elements['tool-navigation'].hidden, false);
    app.elements['back-to-tools-btn'].click();
    assert.equal(app.elements['art-tool'].hidden, true);
    app.elements['open-caucion-btn'].click();
    assert.equal(app.elements['taker-name'].value, 'Empresa de prueba');
});

test('al cerrar sesión oculta las herramientas y al reingresar vuelve al selector', async () => {
    const app = await setup({ user: { id: 'user_1' } });
    app.elements['open-art-btn'].click();
    app.change(null);
    assert.equal(app.elements['quote-app'].hidden, true);
    app.change({ id: 'user_2' });
    assert.equal(app.elements['tool-selector'].hidden, false);
    assert.equal(app.elements['art-tool'].hidden, true);
});


test('consulta el catálogo en cada entrada a ART, sin repetir por actualizaciones de sesión', async () => {
    const app = await setup({ user: { id: 'user_1' } });
    assert.equal(app.elements['art-actions'].hidden, true);
    app.elements['open-art-btn'].click();
    assert.equal(app.elements['art-actions'].hidden, false);
    assert.equal(app.refreshes(), 1);
    app.change({ id: 'user_1' });
    assert.equal(app.refreshes(), 1);
    app.elements['back-to-tools-btn'].click();
    assert.equal(app.elements['art-actions'].hidden, true);
    app.elements['open-art-btn'].click();
    assert.equal(app.refreshes(), 2);
});
