import assert from 'node:assert/strict';
import { test } from 'node:test';

const { default: ArtPDF } = await import('../art-pdf.js').catch(() => ({ default: {} }));
const validDocument = (type, number) => type === 'DNI' && /^\d{8}$/.test(number);
const fixture = () => ({
    takerName: 'Empresa de prueba', docType: 'DNI', docNumber: '12345678',
    activityCode: '011211', activityDescription: 'Cultivo de soja',
    capitas: '10', payroll: '2000000', currentIndex: 0,
    quotes: [{ company: 'Actual', rate: '3' }, { company: 'Propuesta', rate: '2.25' }]
});

test('prepara un PDF con los datos actuales y los ahorros de las cotizaciones activas', () => {
    const data = fixture();
    const report = ArtPDF.prepare(data, validDocument);
    assert.equal(report.errors.length, 0);
    assert.equal(report.result.rows[0].monthly, 60000);
    assert.equal(report.result.rows[1].monthlySavings, 15000);
    assert.equal(report.result.rows[1].annualSavings, 180000);
    assert.equal(report.result.rows[1].savingsPercentage, 25);
    assert.equal(report.activityCode, '011211');
    data.quotes[1].rate = '2';
    const updated = ArtPDF.prepare(data, validDocument);
    assert.equal(updated.result.rows[1].monthly, 40000);
    assert.equal(report.result.rows[1].monthly, 45000);
});

test('impide exportar datos del cliente o actividad incompletos y documentos inválidos', () => {
    for (const [field, value, errorId] of [
        ['takerName', ' ', 'art-taker-name'], ['docType', '', 'art-doc-type'],
        ['docNumber', '123', 'art-doc-number'], ['activityCode', '', 'art-activity-search'],
        ['activityDescription', '', 'art-activity-search']
    ]) {
        const report = ArtPDF.prepare({ ...fixture(), [field]: value }, validDocument);
        assert.ok(report.errors.some(error => error.id === errorId));
    }
});

test('no omite filas incompletas y exige cápitas y masa salarial válidas', () => {
    const data = fixture();
    data.quotes[1].rate = '';
    assert.ok(ArtPDF.prepare(data, validDocument).errors.some(error => error.id === 'art-quote-rate-2'));
    data.quotes[1].rate = '2';
    data.quotes[1].company = '';
    assert.ok(ArtPDF.prepare(data, validDocument).errors.some(error => error.id === 'art-quote-company-2'));
    assert.ok(ArtPDF.prepare({ ...fixture(), capitas: '1.5' }, validDocument).errors.some(error => error.id === 'art-capitas'));
    assert.ok(ArtPDF.prepare({ ...fixture(), payroll: '0' }, validDocument).errors.some(error => error.id === 'art-payroll'));
});

test('admite una cotización única y comparación sin actual, incluido costo base cero', () => {
    const single = { ...fixture(), quotes: [{ company: 'Única', rate: '2' }], currentIndex: null };
    assert.equal(ArtPDF.prepare(single, validDocument).errors.length, 0);
    const data = fixture();
    data.currentIndex = null;
    data.quotes[0].rate = 0;
    const report = ArtPDF.prepare(data, validDocument);
    assert.equal(report.errors.length, 0);
    assert.equal(report.result.zeroBase, true);
    assert.equal(report.result.rows[1].difference, null);
});
