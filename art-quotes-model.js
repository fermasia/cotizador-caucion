const ArtQuotes = (() => {
    function numberFrom(value) {
        if (value === null || value === undefined || String(value).trim() === '') return null;
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
    }

    // Compensar la precisión binaria también en importes mayores a un peso.
    const roundMoney = value => Math.round((value + Number.EPSILON * Math.max(1, Math.abs(value))) * 100) / 100;

    function calculate(capitasValue, payrollValue, quotes, currentIndex = null) {
        if (!Array.isArray(quotes) || quotes.length < 1 || quotes.length > 5) {
            throw new Error('La cantidad de cotizaciones debe estar entre 1 y 5.');
        }
        if (currentIndex !== null && (!Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex >= quotes.length)) {
            throw new Error('La cotización de referencia debe estar entre las cotizaciones activas.');
        }
        const capitas = numberFrom(capitasValue);
        const payroll = numberFrom(payrollValue);
        const errors = {
            capitas: Number.isSafeInteger(capitas) && capitas > 0 ? '' : 'Ingresá una cantidad entera de cápitas mayor a cero.',
            payroll: payroll !== null && payroll > 0 && payroll <= Number.MAX_SAFE_INTEGER / 1200
                ? '' : 'Ingresá una masa salarial mensual positiva y válida.'
        };
        const rows = quotes.map((quote, index) => {
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
                difference: null, lowest: false, current: index === currentIndex,
                monthlySavings: null, annualSavings: null, savingsPercentage: null
            };
        });
        const complete = rows.filter(row => row.monthly !== null);
        const lowestMonthly = complete.length ? Math.min(...complete.map(row => row.monthly)) : null;
        const referenceMonthly = currentIndex === null ? lowestMonthly : rows[currentIndex].monthly;
        const comparisonAvailable = complete.length >= 2 && referenceMonthly !== null;
        const zeroBase = comparisonAvailable && referenceMonthly === 0;
        if (comparisonAvailable) {
            complete.forEach(row => {
                row.lowest = row.monthly === lowestMonthly;
                row.difference = referenceMonthly > 0 ? (row.monthly - referenceMonthly) / referenceMonthly * 100
                    : row.monthly === referenceMonthly ? 0 : null;
                if (currentIndex !== null) {
                    row.monthlySavings = roundMoney(referenceMonthly - row.monthly);
                    row.annualSavings = roundMoney(rows[currentIndex].annual - row.annual);
                    row.savingsPercentage = row.difference === null ? null : -row.difference || 0;
                }
            });
        }
        return { rows, errors, validCount: complete.length, comparisonAvailable, lowestMonthly, zeroBase, currentIndex, referenceMonthly };
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
