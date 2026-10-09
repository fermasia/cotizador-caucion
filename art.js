document.addEventListener('DOMContentLoaded', function () {
    const activitySelect = document.getElementById('art-ciiu');
    const description = document.getElementById('art-description');
    const search = document.getElementById('art-activity-search');
    const results = document.getElementById('art-activity-results');
    const moreResults = document.getElementById('art-activity-more');
    const status = document.getElementById('art-catalog-status');
    const refreshButton = document.getElementById('art-refresh-btn');
    const modal = document.getElementById('activities-modal');
    const editorSearch = document.getElementById('activities-search');
    const table = document.getElementById('activities-table-body');
    const editorError = document.getElementById('activities-error');
    const docType = document.getElementById('art-doc-type');
    const docNumber = document.getElementById('art-doc-number');
    let store;
    let refreshing = null;
    let draft = [];
    let editorBase = [];
    let previousFocus;
    let resultLimit = 20;

    const normalizeSearch = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const matches = (row, query) => normalizeSearch(`${row.codigo} ${row.descripcion}`).includes(normalizeSearch(query.trim()));

    function updateDescription() {
        const selected = store.getActivities().find(row => row.codigo === activitySelect.value);
        description.textContent = selected ? selected.descripcion : 'Seleccioná una actividad para ver su descripción.';
        document.getElementById('art-selected-ciiu').textContent = selected ? `CIIU seleccionado: ${selected.codigo}` : 'Ninguna actividad seleccionada';
    }

    function renderSelector() {
        const focusedCode = document.activeElement?.getAttribute('data-ciiu-code');
        const selected = activitySelect.value;
        const rows = store.getActivities();
        const visible = rows.filter(row => row.codigo === selected || matches(row, search.value));
        activitySelect.replaceChildren(new Option(visible.length ? 'Seleccione una actividad' : 'No se encontraron actividades', ''));
        visible.forEach(row => activitySelect.add(new Option(`${row.codigo} — ${row.descripcion}`, row.codigo)));
        if (rows.some(row => row.codigo === selected)) activitySelect.value = selected;
        updateDescription();
        const matchesFound = rows.filter(row => matches(row, search.value));
        results.replaceChildren();
        const shown = matchesFound.slice(0, resultLimit);
        shown.forEach(row => {
            const item = document.createElement('li');
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'art-activity-result';
            button.setAttribute('data-ciiu-code', row.codigo);
            button.setAttribute('aria-pressed', String(row.codigo === activitySelect.value));
            const code = document.createElement('strong');
            code.textContent = row.codigo;
            const text = document.createElement('span');
            text.className = 'art-activity-result-description';
            text.textContent = row.descripcion;
            const action = document.createElement('span');
            action.className = 'art-activity-result-action';
            action.textContent = row.codigo === activitySelect.value ? '✓ Seleccionada' : 'Seleccionar';
            button.append(code, text, action);
            button.addEventListener('click', () => {
                activitySelect.value = row.codigo;
                renderSelector();
                // Mantener el foco en el resultado elegido al actualizar la lista.
                const index = shown.findIndex(result => result.codigo === row.codigo);
                results.children[index]?.children[0].focus();
            });
            item.appendChild(button);
            results.appendChild(item);
        });
        moreResults.hidden = matchesFound.length <= resultLimit;
        document.getElementById('art-activity-count').textContent = !matchesFound.length
            ? 'No encontramos actividades. Probá con otro código o parte de la descripción.'
            : `${matchesFound.length === 1 ? '1 coincidencia' : `${matchesFound.length} coincidencias`}${matchesFound.length > shown.length ? ` · Mostrando ${shown.length}` : ''}. Seleccioná una actividad de la lista.`;
        if (focusedCode) {
            const index = shown.findIndex(row => row.codigo === focusedCode);
            if (index >= 0) results.children[index].children[0].focus();
            else search.focus();
        }
    }

    function savedDate() {
        const date = store.getState().checkedAt;
        return date && Number.isFinite(Date.parse(date)) ? new Date(date).toLocaleString('es-AR') : 'sin consulta previa';
    }

    const ready = (async () => {
        // Un script local funciona con file://, donde fetch de archivos JSON está bloqueado.
        const fallback = window.ciiuDefaultData;
        // El acceso a localStorage puede fallar en perfiles con almacenamiento bloqueado.
        const storage = {
            getItem: key => window.localStorage.getItem(key),
            setItem: (key, value) => window.localStorage.setItem(key, value)
        };
        store = ArtCatalog.createStore(storage, fallback);
        renderSelector();
        status.textContent = store.cacheWarning ? 'No se pudieron leer los cambios guardados. Se usa el catálogo de respaldo.'
            : `Última consulta del catálogo oficial: ${savedDate()}.`;
    })();

    async function refreshCatalog() {
        await ready;
        if (window.location.protocol === 'file:') {
            status.textContent = 'Catálogo local disponible. Para actualizar desde ARCA, abrí el cotizador desde el servidor. Tus personalizaciones se conservan.';
            return;
        }
        if (refreshing) return refreshing;
        refreshButton.disabled = true;
        status.textContent = 'Consultando actualizaciones del catálogo oficial…';
        refreshing = (async () => {
            try {
                await store.refresh();
                renderSelector();
                status.textContent = `Catálogo oficial consultado: ${savedDate()}. Se conservaron tus personalizaciones.`;
            } catch (error) {
                status.textContent = `No se pudo actualizar o guardar el catálogo. Se conserva la copia disponible (${savedDate()}) y tus personalizaciones.`;
                console.warn('Actualización de actividades:', error);
            } finally {
                refreshButton.disabled = false;
                refreshing = null;
            }
        })();
        return refreshing;
    }

    // Se llama al entrar a ART; no envía datos del tomador a la fuente externa.
    window.openArtTool = refreshCatalog;
    refreshButton.addEventListener('click', refreshCatalog);
    search.addEventListener('input', () => { resultLimit = 20; if (store) { renderSelector(); results.scrollTop = 0; } });
    moreResults.addEventListener('click', () => {
        resultLimit += 20;
        renderSelector();
        if (moreResults.hidden) results.children[results.children.length - 1]?.children[0].focus();
    });
    activitySelect.addEventListener('change', updateDescription);

    function syncDocument() {
        const type = cotizadorData.tiposDocumento.find(row => row.nombre === docType.value);
        docNumber.placeholder = type?.mascara ? type.mascara.replace(/X/g, '0') : '';
        docNumber.value = formatDocNumber(docType.value, docNumber.value);
        docNumber.removeAttribute('aria-invalid');
        document.getElementById('art-doc-number-error').style.display = 'none';
    }

    docType.addEventListener('change', syncDocument);
    document.addEventListener('doc-types-updated', syncDocument);
    docNumber.addEventListener('input', function () {
        const cursor = this.selectionStart;
        const oldLength = this.value.length;
        this.value = formatDocNumber(docType.value, this.value);
        this.setSelectionRange(Math.max(0, cursor + this.value.length - oldLength), Math.max(0, cursor + this.value.length - oldLength));
        this.removeAttribute('aria-invalid');
        document.getElementById('art-doc-number-error').style.display = 'none';
    });
    docNumber.addEventListener('blur', () => {
        const invalid = Boolean(docNumber.value) && !validateDocNumber(docType.value, docNumber.value);
        docNumber.setAttribute('aria-invalid', String(invalid));
        document.getElementById('art-doc-number-error').style.display = invalid ? 'block' : 'none';
    });
    document.getElementById('art-edit-docs-btn').addEventListener('click', openDocsModal);

    function renderEditor() {
        table.replaceChildren();
        draft.forEach(row => {
            if (!matches(row, editorSearch.value)) return;
            const tr = document.createElement('tr');
            for (const [field, label] of [['codigo', 'Código CIIU'], ['descripcion', 'Descripción de actividad']]) {
                const td = document.createElement('td');
                const input = document.createElement('input');
                input.type = 'text';
                input.value = row[field];
                input.setAttribute('aria-label', label);
                if (field === 'codigo') input.maxLength = 24;
                input.addEventListener('input', () => { row[field] = input.value; });
                td.appendChild(input);
                tr.appendChild(td);
            }
            const td = document.createElement('td');
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'btn-remove-company';
            remove.textContent = 'Eliminar';
            remove.setAttribute('aria-label', `Eliminar actividad ${row.codigo || 'nueva'}`);
            remove.addEventListener('click', () => {
                if (!confirm(`¿Eliminar la actividad ${row.codigo || 'nueva'}?`)) return;
                draft.splice(draft.indexOf(row), 1);
                renderEditor();
            });
            td.appendChild(remove);
            tr.appendChild(td);
            table.appendChild(tr);
        });
        document.getElementById('activities-count').textContent = `${table.children.length} de ${draft.length} actividades`;
    }

    async function openEditor() {
        await ready;
        previousFocus = document.activeElement;
        editorBase = store.getState().official;
        draft = store.getActivities().map(row => ({ ...row }));
        editorSearch.value = '';
        editorError.textContent = '';
        renderEditor();
        modal.style.display = 'block';
        editorSearch.focus();
    }

    function closeEditor() {
        modal.style.display = 'none';
        previousFocus?.focus();
    }

    document.getElementById('art-edit-activities-btn').addEventListener('click', openEditor);
    document.getElementById('close-activities-modal').addEventListener('click', closeEditor);
    editorSearch.addEventListener('input', renderEditor);
    document.getElementById('add-activity-btn').addEventListener('click', () => {
        draft.unshift({ codigo: '', descripcion: '' });
        editorSearch.value = '';
        renderEditor();
        table.querySelector('input').focus();
    });
    document.getElementById('save-activities-btn').addEventListener('click', () => {
        try {
            store.saveEdited(draft, editorBase);
            renderSelector();
            closeEditor();
            status.textContent = `Cambios guardados. Última consulta oficial: ${savedDate()}.`;
        } catch (error) {
            editorError.textContent = `${error.message} Si el navegador bloquea el almacenamiento, habilitalo para guardar.`;
        }
    });
    modal.addEventListener('click', event => { if (event.target === modal) closeEditor(); });
    modal.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeEditor();
        if (event.key === 'Tab') {
            const controls = modal.querySelectorAll('button, input');
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
    });
});
