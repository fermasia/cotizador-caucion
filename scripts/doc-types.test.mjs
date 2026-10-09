import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

test('el maestro de documentos actualiza ambos cotizadores con las mismas máscaras', async () => {
    const elements = new Map();
    const context = vm.createContext({
        console,
        Event,
        localStorage: { getItem() { return null; } },
        window: { addEventListener() {} },
        document: {
            addEventListener() {}, dispatchEvent() {},
            getElementById(id) {
                if (!elements.has(id)) {
                    elements.set(id, { value: '', options: [], addEventListener() {}, appendChild(option) { this.options.push(option); },
                        set innerHTML(value) { this.options = []; this.value = ''; } });
                }
                return elements.get(id);
            },
            createElement() { return {}; }
        }
    });
    vm.runInContext(await readFile(new URL('../cotizador.js', import.meta.url), 'utf8'), context);
    vm.runInContext("cotizadorData.tiposDocumento = [{ nombre: 'Documento propio', mascara: 'XXX-XXX' }]; loadDocTypesIntoSelector();", context);
    for (const id of ['doc-type', 'art-doc-type']) {
        assert.equal(elements.get(id).options[0].value, 'Documento propio');
        elements.get(id).value = 'Documento propio';
    }
    assert.equal(vm.runInContext("formatDocNumber('Documento propio', '123456')", context), '123-456');
    assert.equal(vm.runInContext("validateDocNumber('Documento propio', '123-456')", context), true);
    assert.equal(vm.runInContext("validateDocNumber('Documento propio', '123')", context), false);
    vm.runInContext("cotizadorData.tiposDocumento[0].mascara = 'XX-XXXX'; loadDocTypesIntoSelector();", context);
    assert.equal(elements.get('art-doc-type').value, 'Documento propio');
    assert.equal(vm.runInContext("formatDocNumber('Documento propio', '123456')", context), '12-3456');
});
