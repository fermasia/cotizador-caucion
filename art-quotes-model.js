const ArtQuotes = (() => {
    function numberFrom(value) {
        if (value === null || value === undefined || String(value).trim() === '') return null;
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
    }

    // Compensar la precisión binaria también en importes mayores a un peso.
    const roundMoney = value => Math.round((value + Number.EPSILON * Math.max(1, Math.abs(value))) * 100) / 100;

    function calculate(capitasValue, payrollValue, quotes) {
        if (!Array.isArray(quotes) || quotes.length < 1 || quotes.length > 5) {
            throw new Error('La cantidad de cotizaciones debe estar entre 1 y 5.');
        }
        const capitas = numberFrom(capitasValue);
        const payroll = numberFrom(payrollValue);
        const errors = {
            capitas: Number.isSafeInteger(capitas) && capitas > 0 ? '' : 'Ingresá una cantidad entera de cápitas mayor a cero.',
            payroll: payroll !== null && payroll > 0 && payroll <= Number.MAX_SAFE_INTEGER / 1200
                ? '' : 'Ingresá una masa salarial mensual positiva y válida.'
        };
        const rows = quotes.map(quote => {
            const company = String(quote.company ?? '').trim();
            const rate = numberFrom(quote.rate);
            const rowErrors = {
                company: company && company.length <= 120 ? '' : 'Elegí o ingresá el nombre de la compañía.',
                rate: rate !== null && rate >= 0 && rate <= 100 ? '' : 'Ingresá una alícuota entre 0 y 100%.'
            };
            const valid = !errors.capitas && !errors.payroll && !rowErrors.company && !rowErrors.rate;
            const monthly = valid ? roundMoney(payroll * (rate / 100)) : null;
            return {
                company, rate, errors: rowErrors, monthly,
                perCapita: valid ? roundMoney(monthly / capitas) : null,
                annual: valid ? roundMoney(monthly * 12) : null,
                difference: null, lowest: false
            };
        });
        const complete = rows.filter(row => row.monthly !== null);
        const comparisonAvailable = complete.length >= 2;
        const lowestMonthly = complete.length ? Math.min(...complete.map(row => row.monthly)) : null;
        const zeroBase = comparisonAvailable && lowestMonthly === 0;
        if (comparisonAvailable) {
            complete.forEach(row => {
                row.lowest = row.monthly === lowestMonthly;
                row.difference = lowestMonthly > 0 ? (row.monthly - lowestMonthly) / lowestMonthly * 100
                    : row.lowest ? 0 : null;
            });
        }
        return { rows, errors, validCount: complete.length, comparisonAvailable, lowestMonthly, zeroBase };
    }

    function normalizeCompanies(names) {
        if (!Array.isArray(names)) throw new Error('El maestro de compañías ART no es válido.');
        const seen = new Set();
        return names.map(value => {
            const name = String(value).trim().replace(/\s+/g, ' ');
            if (!name || name.length > 120) throw new Error('Ingresá un nombre de compañía de hasta 120 caracteres.');
            const key = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            if (seen.has(key)) throw new Error(`Nombre de compañía duplicado: ${name}.`);
            seen.add(key);
            return name;
        });
    }

    function createCompanyStore(storage) {
        let companies = [];
        let warning = false;
        try {
            const saved = storage.getItem('artCompanies');
            if (saved) companies = normalizeCompanies(JSON.parse(saved));
        } catch {
            warning = true;
        }
        return {
            warning,
            get: () => companies.slice(),
            save(names) {
                const normalized = normalizeCompanies(names);
                storage.setItem('artCompanies', JSON.stringify(normalized));
                companies = normalized;
            }
        };
    }

    return { calculate, createCompanyStore };
})();

if (typeof module !== 'undefined') module.exports = ArtQuotes;
