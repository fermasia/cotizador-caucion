document.addEventListener('DOMContentLoaded', function () {
    const capitas = document.getElementById('art-capitas');
    const payroll = document.getElementById('art-payroll');
    const count = document.getElementById('art-quote-count');
    const cardsContainer = document.getElementById('art-quote-cards');
    const suggestions = document.getElementById('art-company-options');
    const comparisonNote = document.getElementById('art-comparison-note');
    const companyStatus = document.getElementById('art-company-status');
    const modal = document.getElementById('art-companies-modal');
    const companyRows = document.getElementById('art-companies-rows');
    const companyError = document.getElementById('art-companies-error');
    const storage = {
        getItem: key => window.localStorage.getItem(key),
        setItem: (key, value) => window.localStorage.setItem(key, value)
    };
    const companyStore = ArtQuotes.createCompanyStore(storage);
    const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
    const percentage = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
    const touched = new Set();
    const cards = [];
    let companyDraft = [];
    let previousFocus;

    function makeElement(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    function field(parent, id, labelText, type) {
        const group = makeElement('div', 'form-group');
        const label = makeElement('label', '', labelText);
        label.htmlFor = id;
        const input = makeElement('input');
        input.id = id;
        input.type = type;
        const error = makeElement('p', 'error-message');
        error.id = `${id}-error`;
        input.setAttribute('aria-describedby', error.id);
        group.append(label, input, error);
        parent.appendChild(group);
        return { input, error };
    }

    function showError(input, element, message) {
        const visible = touched.has(input.id) && Boolean(message);
        element.textContent = message;
        element.style.display = visible ? 'block' : 'none';
        input.setAttribute('aria-invalid', String(visible));
    }

    function watch(input) {
        for (const event of ['input', 'blur']) {
            input.addEventListener(event, () => { touched.add(input.id); updateQuotes(); });
        }
    }

    function updateQuotes() {
        const activeCount = Number(count.value);
        const result = ArtQuotes.calculate(capitas.value, payroll.value,
            cards.slice(0, activeCount).map(card => ({ company: card.company.input.value, rate: card.rate.input.value })));
        showError(capitas, document.getElementById('art-capitas-error'), result.errors.capitas);
        showError(payroll, document.getElementById('art-payroll-error'), result.errors.payroll);
        cards.forEach((card, index) => {
            card.element.hidden = index >= activeCount;
            const row = result.rows[index];
            if (!row) return;
            showError(card.company.input, card.company.error, row.errors.company);
            showError(card.rate.input, card.rate.error, row.errors.rate);
            for (const key of ['perCapita', 'monthly', 'annual']) {
                card.outputs[key].textContent = row[key] === null ? '—' : money.format(row[key]);
            }
            card.element.classList.toggle('is-lowest', row.lowest);
            card.comparison.hidden = !result.comparisonAvailable || row.monthly === null;
            card.comparison.textContent = row.lowest ? 'Menor prima mensual · 0% de diferencia'
                : row.difference === null ? 'Sin porcentaje de comparación: la menor prima es $0.'
                    : `+${percentage.format(row.difference)}% respecto de la menor prima mensual`;
        });
        comparisonNote.hidden = activeCount === 1;
        comparisonNote.textContent = !result.comparisonAvailable ? 'Completá al menos dos cotizaciones para comparar sus primas.'
            : result.zeroBase ? 'La menor prima es $0. Las alternativas con prima positiva no tienen una diferencia porcentual calculable.'
                : `Se comparan ${result.validCount} cotizaciones completas. Las diferencias se calculan respecto de la menor prima mensual (${money.format(result.lowestMonthly)}).`;
    }

    for (let index = 0; index < 5; index++) {
        const number = index + 1;
        const card = makeElement('section', 'art-quote-card');
        const heading = makeElement('h3', '', `Cotización ${number}`);
        heading.id = `art-quote-title-${number}`;
        card.setAttribute('aria-labelledby', heading.id);
        card.appendChild(heading);
        const company = field(card, `art-quote-company-${number}`, 'Compañía ART:', 'text');
        company.input.setAttribute('list', 'art-company-options');
        company.input.placeholder = 'Elegí una compañía o escribí su nombre';
        company.input.maxLength = 120;
        const rate = field(card, `art-quote-rate-${number}`, 'Alícuota (%):', 'number');
        rate.input.min = '0';
        rate.input.max = '100';
        rate.input.step = 'any';
        rate.input.placeholder = 'Ej.: 2,5';
        const metrics = makeElement('dl', 'art-quote-metrics');
        const outputs = {};
        for (const [key, label] of [['perCapita', 'Prima por cápita mensual'], ['monthly', 'Prima mensual total'], ['annual', 'Prima anual total']]) {
            const row = makeElement('div');
            const term = makeElement('dt', '', label);
            const value = makeElement('dd');
            const output = makeElement('output', '', '—');
            output.setAttribute('aria-label', `${label}, cotización ${number}`);
            output.setAttribute('for', `art-capitas art-payroll ${rate.input.id}`);
            value.appendChild(output);
            row.append(term, value);
            metrics.appendChild(row);
            outputs[key] = output;
        }
        const comparison = makeElement('p', 'art-quote-comparison');
        card.append(metrics, comparison);
        cardsContainer.appendChild(card);
        cards.push({ element: card, company, rate, outputs, comparison });
        watch(company.input);
        watch(rate.input);
    }
    watch(capitas);
    watch(payroll);
    count.addEventListener('change', updateQuotes);

    function updateCompanies() {
        suggestions.replaceChildren();
        const names = companyStore.get();
        names.forEach(name => suggestions.appendChild(new Option(name, name)));
        companyStatus.textContent = names.length ? 'Elegí una sugerencia del maestro o escribí el nombre de otra compañía.'
            : 'El maestro ART está vacío. Agregá compañías en «Editar Compañías ART» o escribí sus nombres en las cotizaciones.';
        if (companyStore.warning) companyStatus.textContent += ' No se pudo leer el maestro guardado.';
    }

    function renderCompanyEditor() {
        companyRows.replaceChildren();
        companyDraft.forEach(row => {
            const item = makeElement('div', 'art-company-editor-row');
            const input = makeElement('input');
            input.type = 'text';
            input.value = row.name;
            input.maxLength = 120;
            input.setAttribute('aria-label', 'Nombre de compañía ART');
            input.addEventListener('input', () => { row.name = input.value; });
            const remove = makeElement('button', 'btn-remove-company', 'Eliminar');
            remove.type = 'button';
            remove.setAttribute('aria-label', `Eliminar compañía ${row.name || 'nueva'}`);
            remove.addEventListener('click', () => {
                if (!confirm(`¿Eliminar la compañía ${row.name || 'nueva'} del maestro ART?`)) return;
                companyDraft.splice(companyDraft.indexOf(row), 1);
                renderCompanyEditor();
            });
            item.append(input, remove);
            companyRows.appendChild(item);
        });
    }

    function closeCompanyEditor() {
        modal.style.display = 'none';
        previousFocus?.focus();
    }

    document.getElementById('art-edit-companies-btn').addEventListener('click', () => {
        previousFocus = document.activeElement;
        companyDraft = companyStore.get().map(name => ({ name }));
        companyError.textContent = '';
        renderCompanyEditor();
        modal.style.display = 'block';
        document.getElementById('art-add-company-btn').focus();
    });
    document.getElementById('art-close-companies-btn').addEventListener('click', closeCompanyEditor);
    document.getElementById('art-add-company-btn').addEventListener('click', () => {
        companyDraft.push({ name: '' });
        renderCompanyEditor();
        companyRows.lastElementChild.querySelector('input').focus();
    });
    document.getElementById('art-save-companies-btn').addEventListener('click', () => {
        try {
            companyStore.save(companyDraft.map(row => row.name));
            updateCompanies();
            companyStatus.textContent = 'Compañías ART guardadas. Podés elegirlas en las cotizaciones o ingresar otros nombres.';
            closeCompanyEditor();
        } catch (error) {
            companyError.textContent = `No se pudo guardar: ${error.message}`;
        }
    });
    modal.addEventListener('click', event => { if (event.target === modal) closeCompanyEditor(); });
    modal.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeCompanyEditor();
        if (event.key === 'Tab') {
            const controls = modal.querySelectorAll('button, input');
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
    });
    updateCompanies();
    updateQuotes();
});
