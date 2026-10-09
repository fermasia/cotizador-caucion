document.addEventListener('DOMContentLoaded', function () {
    const capitas = document.getElementById('art-capitas');
    const payroll = document.getElementById('art-payroll');
    const count = document.getElementById('art-quote-count');
    const cardsContainer = document.getElementById('art-quote-cards');
    const suggestions = document.getElementById('art-company-options');
    const comparisonNote = document.getElementById('art-comparison-note');
    const companyStatus = document.getElementById('art-company-status');
    const resetReference = document.getElementById('art-reset-reference');
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
    let currentQuoteIndex = null;
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
        // Una tarjeta oculta no puede seguir siendo la referencia de la comparación.
        if (activeCount === 1 || (currentQuoteIndex !== null && currentQuoteIndex >= activeCount)) currentQuoteIndex = null;
        resetReference.hidden = currentQuoteIndex === null;
        const result = ArtQuotes.calculate(capitas.value, payroll.value,
            cards.slice(0, activeCount).map(card => ({ company: card.company.input.value, rate: card.rate.input.value })), currentQuoteIndex);
        showError(capitas, document.getElementById('art-capitas-error'), result.errors.capitas);
        showError(payroll, document.getElementById('art-payroll-error'), result.errors.payroll);
        cards.forEach((card, index) => {
            card.element.hidden = index >= activeCount;
            card.currentOption.hidden = activeCount === 1;
            card.currentInput.checked = index === currentQuoteIndex;
            card.element.classList.toggle('is-current', index === currentQuoteIndex);
            const row = result.rows[index];
            if (!row) return;
            showError(card.company.input, card.company.error, row.errors.company);
            showError(card.rate.input, card.rate.error, row.errors.rate);
            for (const key of ['perCapita', 'monthly', 'annual']) {
                card.outputs[key].textContent = row[key] === null ? '—' : money.format(row[key]);
            }
            card.element.classList.toggle('is-lowest', row.lowest);
            card.comparison.hidden = !result.comparisonAvailable || row.monthly === null;
            card.comparison.classList.toggle('has-savings', row.monthlySavings > 0);
            card.comparison.classList.toggle('has-extra-cost', row.monthlySavings < 0);
            if (currentQuoteIndex !== null) {
                const percent = row.savingsPercentage === null ? 'Porcentaje no calculable: el costo actual es $0.'
                    : `${percentage.format(Math.abs(row.savingsPercentage))}% ${row.monthlySavings < 0 ? 'más que' : 'de ahorro frente a'} la actual`;
                card.comparison.textContent = row.current ? 'Referencia · costo actual del cliente'
                    : row.monthlySavings === 0 ? 'Sin ahorro · mismo costo que la actual'
                        : `${row.monthlySavings > 0 ? 'Ahorro' : 'Costo adicional'}: ${money.format(Math.abs(row.monthlySavings))}/mes\n${money.format(Math.abs(row.annualSavings))}/año · ${percent}`;
            } else {
                card.comparison.textContent = row.lowest ? 'Menor prima mensual · 0% de diferencia'
                    : row.difference === null ? 'Sin porcentaje de comparación: la menor prima es $0.'
                    : `+${percentage.format(row.difference)}% respecto de la menor prima mensual`;
            }
        });
        comparisonNote.hidden = activeCount === 1;
        if (currentQuoteIndex !== null) {
            comparisonNote.textContent = result.referenceMonthly === null ? 'Completá la cotización actual y los datos de cápitas y masa salarial para calcular los ahorros.'
                : !result.comparisonAvailable ? 'Completá al menos una propuesta para compararla con la cotización actual.'
                    : `Referencia: cotización ${currentQuoteIndex + 1} · ${result.rows[currentQuoteIndex].company} · ${money.format(result.referenceMonthly)}/mes. Los ahorros se calculan con la misma masa salarial y cápitas.${result.zeroBase ? ' El costo actual es $0; se comparan importes sin calcular porcentajes para propuestas con costo positivo.' : ''}`;
        } else {
            comparisonNote.textContent = !result.comparisonAvailable ? 'Completá al menos dos cotizaciones para comparar sus primas.'
                : result.zeroBase ? 'La menor prima es $0. Las alternativas con prima positiva no tienen una diferencia porcentual calculable.'
                : `Se comparan ${result.validCount} cotizaciones completas. Las diferencias se calculan respecto de la menor prima mensual (${money.format(result.lowestMonthly)}).`;
        }
    }

    for (let index = 0; index < 5; index++) {
        const number = index + 1;
        const card = makeElement('section', 'art-quote-card');
        const heading = makeElement('h3', '', `Cotización ${number}`);
        heading.id = `art-quote-title-${number}`;
        card.setAttribute('aria-labelledby', heading.id);
        card.appendChild(heading);
        const currentOption = makeElement('label', 'art-current-option');
        const currentInput = makeElement('input');
        currentInput.id = `art-quote-current-${number}`;
        currentInput.type = 'radio';
        currentInput.name = 'art-current-quote';
        currentInput.value = String(index);
        currentInput.setAttribute('aria-label', `Actual del cliente · cotización ${number}`);
        currentOption.append(currentInput, makeElement('span', '', 'Actual del cliente'));
        card.appendChild(currentOption);
        currentInput.addEventListener('change', () => {
            if (!currentInput.checked) return;
            currentQuoteIndex = index;
            updateQuotes();
        });
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
        cards.push({ element: card, company, rate, outputs, comparison, currentInput, currentOption });
        watch(company.input);
        watch(rate.input);
    }
    watch(capitas);
    watch(payroll);
    count.addEventListener('change', updateQuotes);
    resetReference.addEventListener('click', () => {
        currentQuoteIndex = null;
        updateQuotes();
    });

    const exportButton = document.getElementById('art-export-pdf-btn');
    const exportStatus = document.getElementById('art-pdf-status');
    let exportErrors = [];
    exportButton.addEventListener('click', () => {
        exportErrors.forEach(error => document.getElementById(error.id).removeAttribute('aria-invalid'));
        exportErrors = [];
        exportStatus.textContent = '';
        updateQuotes();
        const activity = document.getElementById('art-ciiu');
        const report = ArtPDF.prepare({
            takerName: document.getElementById('art-taker-name').value,
            docType: document.getElementById('art-doc-type').value,
            docNumber: document.getElementById('art-doc-number').value,
            activityCode: activity.value,
            activityDescription: activity.value ? (activity.selectedOptions?.[0]?.textContent ?? '').slice(activity.value.length + 3) : '',
            capitas: capitas.value, payroll: payroll.value, currentIndex: currentQuoteIndex,
            quotes: cards.slice(0, Number(count.value)).map(card => ({ company: card.company.input.value, rate: card.rate.input.value }))
        }, validateDocNumber);
        if (report.errors.length) {
            exportErrors = report.errors;
            exportErrors.forEach(error => document.getElementById(error.id).setAttribute('aria-invalid', 'true'));
            exportStatus.textContent = `${report.errors[0].message} Revisá los campos marcados antes de exportar.`;
            document.getElementById(report.errors[0].id).focus();
            return;
        }
        if (!window.jspdf?.jsPDF) {
            exportStatus.textContent = 'No se pudo cargar la biblioteca de PDF. Revisá tu conexión y recargá la página para reintentar.';
            return;
        }
        exportButton.disabled = true;
        try {
            const { doc, filename } = ArtPDF.build(report, {
                jsPDF: window.jspdf.jsPDF,
                logo: typeof logoDataUrl === 'string' ? logoDataUrl : null
            });
            doc.save(filename);
            exportStatus.textContent = 'PDF generado con los datos y las cotizaciones visibles.';
        } catch (error) {
            console.error('Error al generar PDF de ART:', error);
            exportStatus.textContent = 'No se pudo generar el PDF. Revisá tu conexión y volvé a intentar.';
        } finally {
            exportButton.disabled = false;
        }
    });

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
