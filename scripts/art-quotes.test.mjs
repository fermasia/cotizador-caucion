import assert from 'node:assert/strict';
import { test } from 'node:test';

const { default: ArtQuotes } = await import('../art-quotes-model.js').catch(() => ({ default: {} }));

test('calcula primas sin importe fijo y diferencias respecto de la opción más económica', () => {
    const result = ArtQuotes.calculate(10, 2000000, [
        { company: 'ART A', rate: '2' }, { company: 'ART B', rate: '3' }
    ]);
    assert.equal(result.rows[0].monthly, 40000);
    assert.equal(result.rows[0].perCapita, 4000);
    assert.equal(result.rows[0].annual, 480000);
    assert.equal(result.rows[0].difference, 0);
    assert.equal(result.rows[0].lowest, true);
    assert.equal(result.rows[1].monthly, 60000);
    assert.equal(result.rows[1].annual, 720000);
    assert.equal(result.rows[1].difference, 50);
    assert.equal(result.rows[1].lowest, false);
});

test('redondea importes a centavos sin multiplicar una prima por cápita redondeada', () => {
    const result = ArtQuotes.calculate(3, 1000000, [{ company: 'ART', rate: '2.3' }]);
    assert.equal(result.rows[0].monthly, 23000);
    assert.equal(result.rows[0].perCapita, 7666.67);
    assert.equal(result.rows[0].annual, 276000);
    assert.equal(result.comparisonAvailable, false);
    assert.equal(result.rows[0].difference, null);
    const halfCent = ArtQuotes.calculate(1, 10.075, [{ company: 'ART', rate: 100 }]);
    assert.equal(halfCent.rows[0].monthly, 10.08);
    assert.equal(halfCent.rows[0].annual, 120.96);
});

test('compara hasta cinco alternativas, admite empates y omite filas incompletas', () => {
    const result = ArtQuotes.calculate(20, 1000000, [
        { company: 'A', rate: 3 }, { company: 'B', rate: 2 }, { company: 'C', rate: 2 },
        { company: 'D', rate: 5 }, { company: '', rate: '' }
    ]);
    assert.equal(result.validCount, 4);
    assert.equal(result.rows[1].lowest, true);
    assert.equal(result.rows[2].lowest, true);
    assert.equal(result.rows[3].difference, 150);
    assert.equal(result.rows[4].monthly, null);
    assert.ok(result.rows[4].errors.company);
    assert.ok(result.rows[4].errors.rate);
});

test('no divide por cero ni muestra porcentajes infinitos con una alícuota cero', () => {
    const result = ArtQuotes.calculate(1, 100000, [{ company: 'A', rate: 0 }, { company: 'B', rate: 1 }]);
    assert.equal(result.rows[0].monthly, 0);
    assert.equal(result.rows[0].difference, 0);
    assert.equal(result.rows[1].difference, null);
    assert.equal(result.zeroBase, true);
});

test('rechaza cantidades fraccionarias, importes inválidos y alícuotas fuera de rango', () => {
    for (const [capitas, payroll] of [[0, 1000], [1.5, 1000], [2, -1], ['', ''], [2, Infinity]]) {
        const result = ArtQuotes.calculate(capitas, payroll, [{ company: 'A', rate: 2 }]);
        assert.equal(result.rows[0].monthly, null);
        assert.equal(result.comparisonAvailable, false);
        assert.ok(result.errors.capitas || result.errors.payroll);
    }
    for (const rate of ['', -1, 101, Infinity]) {
        const result = ArtQuotes.calculate(1, 1000, [{ company: 'A', rate }]);
        assert.equal(result.rows[0].monthly, null);
        assert.ok(result.rows[0].errors.rate);
    }
    assert.throws(() => ArtQuotes.calculate(1, 1000, []), /1.*5/);
    assert.throws(() => ArtQuotes.calculate(1, 1000, Array(6).fill({ company: 'A', rate: 2 })), /1.*5/);
});

test('el maestro ART guarda nombres propios, rechaza duplicados y conserva datos ante un fallo de guardado', () => {
    const saved = new Map();
    const storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
    const store = ArtQuotes.createCompanyStore(storage);
    store.save([' ART propia ', 'Otra ART']);
    assert.deepEqual(ArtQuotes.createCompanyStore(storage).get(), ['ART propia', 'Otra ART']);
    assert.throws(() => store.save(['ART A', 'art a']), /duplicad/i);
    assert.throws(() => store.save(['']), /nombre/i);
    storage.setItem = () => { throw new Error('quota'); };
    assert.throws(() => store.save(['Nueva ART']), /quota/);
    assert.deepEqual(store.get(), ['ART propia', 'Otra ART']);
});

test('compara todas las propuestas contra la cotización actual aunque otra sea más económica', () => {
    const result = ArtQuotes.calculate(10, 2000000, [
        { company: 'Propuesta A', rate: 2.25 },
        { company: 'Actual', rate: 3 },
        { company: 'Propuesta B', rate: 2.5 }
    ], 1);
    assert.equal(result.currentIndex, 1);
    assert.equal(result.referenceMonthly, 60000);
    assert.equal(result.rows[1].current, true);
    assert.equal(result.rows[0].monthlySavings, 15000);
    assert.equal(result.rows[0].annualSavings, 180000);
    assert.equal(result.rows[0].savingsPercentage, 25);
    assert.equal(result.rows[2].monthlySavings, 10000);
    assert.equal(result.rows[2].annualSavings, 120000);
    assert.ok(Math.abs(result.rows[2].savingsPercentage - 16.6666666667) < 0.000001);
});

test('distingue ahorro, costo adicional y empate y permite cambiar la referencia', () => {
    const quotes = [
        { company: 'Actual', rate: 3 }, { company: 'Más cara', rate: 4 }, { company: 'Igual', rate: 3 }
    ];
    const result = ArtQuotes.calculate(10, 2000000, quotes, 0);
    assert.equal(result.rows[1].monthlySavings, -20000);
    assert.equal(result.rows[1].annualSavings, -240000);
    assert.ok(result.rows[1].savingsPercentage < 0);
    assert.equal(result.rows[2].monthlySavings, 0);
    assert.equal(result.rows[2].savingsPercentage, 0);
    const changed = ArtQuotes.calculate(10, 2000000, quotes, 1);
    assert.equal(changed.rows[0].monthlySavings, 20000);
    assert.equal(changed.rows[0].savingsPercentage, 25);
});

test('una cotización actual incompleta impide comparar sin sustituirla por la menor prima', () => {
    const quotes = [{ company: '', rate: 3 }, { company: 'A', rate: 2 }, { company: 'B', rate: 2.5 }];
    const result = ArtQuotes.calculate(10, 2000000, quotes, 0);
    assert.equal(result.comparisonAvailable, false);
    assert.equal(result.referenceMonthly, null);
    assert.equal(result.rows[1].monthlySavings, null);
    assert.equal(result.rows[1].difference, null);
    const withoutCurrent = ArtQuotes.calculate(10, 2000000, quotes);
    assert.equal(withoutCurrent.comparisonAvailable, true);
    assert.equal(withoutCurrent.rows[2].difference, 25);
});

test('un costo actual de cero permite comparar importes sin dividir por cero', () => {
    const result = ArtQuotes.calculate(1, 100000, [
        { company: 'Actual', rate: 0 }, { company: 'Propuesta', rate: 1 }, { company: 'Igual', rate: 0 }
    ], 0);
    assert.equal(result.zeroBase, true);
    assert.equal(result.rows[1].monthlySavings, -1000);
    assert.equal(result.rows[1].annualSavings, -12000);
    assert.equal(result.rows[1].savingsPercentage, null);
    assert.equal(result.rows[2].savingsPercentage, 0);
});

test('redondea el ahorro a centavos y rechaza referencias fuera de las cotizaciones activas', () => {
    const quotes = [{ company: 'Actual', rate: 10 }, { company: 'Propuesta', rate: 5 }];
    const result = ArtQuotes.calculate(1, 10.1, quotes, 0);
    assert.equal(result.rows[1].monthlySavings, 0.5);
    assert.equal(result.rows[1].annualSavings, 6);
    for (const index of [-1, 2, 1.5, '0']) {
        assert.throws(() => ArtQuotes.calculate(1, 10.1, quotes, index), /referencia/i);
    }
});

async function quoteInterface({ pdfAvailable = true } = {}) {
    const { readFile } = await import('node:fs/promises');
    const { default: vm } = await import('node:vm');
    const { default: ArtPDF } = await import('../art-pdf.js');
    const exports = [];
    const elements = new Map();
    let initialize;
    class Element {
        children = [];
        handlers = {};
        attributes = {};
        style = {};
        value = '';
        textContent = '';
        hidden = false;
        checked = false;
        classes = new Set();
        classList = { toggle: (name, active) => active ? this.classes.add(name) : this.classes.delete(name) };
        set id(value) { this._id = value; elements.set(value, this); }
        get id() { return this._id; }
        addEventListener(event, handler) { this.handlers[event] = handler; }
        setAttribute(name, value) { this.attributes[name] = String(value); }
        appendChild(child) { this.children.push(child); }
        append(...children) { this.children.push(...children); }
        replaceChildren(...children) { this.children = children; }
        removeAttribute(name) { delete this.attributes[name]; }
        focus() { this.focused = true; }
    }
    const document = {
        createElement: () => new Element(),
        getElementById(id) {
            if (!elements.has(id)) { const element = new Element(); element.id = id; }
            return elements.get(id);
        },
        addEventListener(event, callback) { if (event === 'DOMContentLoaded') initialize = callback; }
    };
    document.getElementById('art-quote-count').value = '2';
    const window = { localStorage: { getItem: () => null, setItem() {} }, jspdf: pdfAvailable ? { jsPDF: class {} } : undefined };
    const pdf = { prepare: ArtPDF.prepare, build(report) { return { doc: { save() { exports.push(report); } }, filename: 'test.pdf' }; } };
    vm.runInNewContext(await readFile(new URL('../art-quotes.js', import.meta.url), 'utf8'), { document, window, ArtQuotes, ArtPDF: pdf, Intl, validateDocNumber: (type, value) => type === 'DNI' && /^\d{8}$/.test(value) });
    initialize();
    const change = (id, value, event = 'input') => {
        const element = elements.get(id);
        element.value = value;
        element.handlers[event]();
    };
    change('art-capitas', '10');
    change('art-payroll', '2000000');
    change('art-quote-company-1', 'Actual');
    change('art-quote-rate-1', '3');
    change('art-quote-company-2', 'Propuesta');
    change('art-quote-rate-2', '2.25');
    return { elements, change, exports, document, cards: elements.get('art-quote-cards').children };
}

test('la interfaz usa una única referencia y muestra ahorro o costo adicional al cambiarla', async () => {
    const app = await quoteInterface();
    const current = app.elements.get('art-quote-current-1');
    assert.ok(current, 'Debe permitir marcar la cotización actual');
    current.checked = true;
    current.handlers.change();
    assert.equal(current.checked, true);
    assert.equal(app.elements.get('art-quote-current-2').checked, false);
    const savings = app.cards[1].children.at(-1).textContent;
    assert.match(savings, /Ahorro/);
    assert.match(savings, /15\.000,00/);
    assert.match(savings, /180\.000,00/);
    assert.match(savings, /25%/);
    const second = app.elements.get('art-quote-current-2');
    second.checked = true;
    second.handlers.change();
    assert.equal(current.checked, false);
    assert.match(app.cards[0].children.at(-1).textContent, /Costo adicional/);
    app.elements.get('art-reset-reference').handlers.click();
    assert.equal(second.checked, false);
    assert.match(app.elements.get('art-comparison-note').textContent, /menor prima/);
});

test('la interfaz pide completar la actual y limpia la referencia cuando se oculta su tarjeta', async () => {
    const app = await quoteInterface();
    const current = app.elements.get('art-quote-current-2');
    assert.ok(current, 'Debe permitir marcar la cotización actual');
    current.checked = true;
    current.handlers.change();
    app.change('art-quote-company-2', '');
    assert.match(app.elements.get('art-comparison-note').textContent, /Completá.*actual/);
    assert.equal(app.cards[0].children.at(-1).hidden, true);
    app.change('art-quote-count', '1', 'change');
    assert.equal(current.checked, false);
    app.change('art-quote-count', '2', 'change');
    app.change('art-quote-company-2', 'Propuesta');
    assert.equal(current.checked, false);
    assert.match(app.elements.get('art-comparison-note').textContent, /menor prima/);
    assert.equal(app.elements.get('art-quote-rate-2').value, '2.25');
});


test('exportar ART valida el cliente y no genera un PDF incompleto', async () => {
    const app = await quoteInterface();
    const button = app.elements.get('art-export-pdf-btn');
    assert.ok(button?.handlers.click, 'Debe existir la acción de exportar ART');
    button.handlers.click();
    assert.equal(app.exports.length, 0);
    assert.match(app.elements.get('art-pdf-status').textContent, /nombre.*cliente/i);
    assert.equal(app.elements.get('art-taker-name').focused, true);
});

test('exportar ART toma los últimos valores, la referencia y solo las cotizaciones visibles', async () => {
    const app = await quoteInterface();
    const button = app.elements.get('art-export-pdf-btn');
    assert.ok(button?.handlers.click, 'Debe existir la acción de exportar ART');
    for (const [id, value] of [['art-taker-name', 'Cliente de prueba'], ['art-doc-type', 'DNI'], ['art-doc-number', '12345678'], ['art-ciiu', '011211']]) {
        app.document.getElementById(id).value = value;
    }
    app.elements.get('art-ciiu').selectedOptions = [{ textContent: '011211 — Cultivo de soja' }];
    app.elements.get('art-quote-current-1').checked = true;
    app.elements.get('art-quote-current-1').handlers.change();
    app.change('art-quote-rate-2', '2');
    button.handlers.click();
    assert.equal(app.exports.length, 1);
    assert.equal(app.exports[0].result.rows.length, 2);
    assert.equal(app.exports[0].result.rows[1].monthlySavings, 20000);
    assert.equal(app.exports[0].activityDescription, 'Cultivo de soja');
    app.change('art-quote-count', '1', 'change');
    button.handlers.click();
    assert.equal(app.exports[1].result.rows.length, 1);
    assert.equal(app.exports[1].result.currentIndex, null);
});
