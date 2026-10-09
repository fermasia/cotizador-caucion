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
