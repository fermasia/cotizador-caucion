// Mantener las personalizaciones separadas del catálogo oficial actualizable.
const ArtCatalog = (() => {
    function normalizeActivities(rows) {
        if (!Array.isArray(rows)) throw new Error('El catálogo de actividades no es válido.');
        const seen = new Set();
        return rows.map(row => {
            let codigo = String(row.codigo ?? '').trim().toUpperCase();
            if (/^\d{1,6}$/.test(codigo)) codigo = codigo.padStart(6, '0');
            const descripcion = String(row.descripcion ?? '').trim();
            if (!/^[A-Z0-9][A-Z0-9._/-]{0,23}$/.test(codigo)) {
                throw new Error('Ingresá un código de hasta 24 caracteres, sin espacios.');
            }
            if (!descripcion) throw new Error(`Ingresá la descripción del código ${codigo}.`);
            if (seen.has(codigo)) throw new Error(`Código duplicado: ${codigo}.`);
            seen.add(codigo);
            return { codigo, descripcion };
        });
    }

    function mergeActivities(official, custom = [], deleted = []) {
        const hidden = new Set(deleted);
        const rows = new Map(official.filter(row => !hidden.has(row.codigo)).map(row => [row.codigo, row]));
        custom.forEach(row => rows.set(row.codigo, row));
        return [...rows.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
    }

    function buildChanges(official, edited) {
        const rows = normalizeActivities(edited);
        const base = new Map(official.map(row => [row.codigo, row.descripcion]));
        const present = new Set(rows.map(row => row.codigo));
        return {
            custom: rows.filter(row => base.get(row.codigo) !== row.descripcion),
            deleted: official.filter(row => !present.has(row.codigo)).map(row => row.codigo)
        };
    }

    function createStore(storage, fallback = { activities: [], checkedAt: null }) {
        let state = { official: normalizeActivities(fallback.activities), custom: [], deleted: [], checkedAt: fallback.checkedAt };
        let cacheWarning = false;
        try {
            const saved = storage.getItem('artActivities');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (!Array.isArray(parsed.deleted) || !parsed.deleted.every(code => typeof code === 'string')) {
                    throw new Error('Datos guardados no válidos.');
                }
                state = {
                    official: parsed.official?.length ? normalizeActivities(parsed.official) : state.official,
                    custom: normalizeActivities(parsed.custom),
                    deleted: parsed.deleted, checkedAt: parsed.official?.length ? parsed.checkedAt : state.checkedAt
                };
            }
        } catch {
            cacheWarning = true;
        }

        function commit(next) {
            storage.setItem('artActivities', JSON.stringify(next));
            state = next;
        }

        return {
            cacheWarning,
            getState: () => state,
            getActivities: () => mergeActivities(state.official, state.custom, state.deleted),
            saveEdited(edited, base = state.official) {
                const rows = normalizeActivities(edited);
                const changes = buildChanges(base, rows);
                const editedDescriptions = new Map(rows.map(row => [row.codigo, row.descripcion]));
                const keptCustom = state.custom.filter(row => editedDescriptions.get(row.codigo) === row.descripcion);
                changes.custom = [...new Map([...keptCustom, ...changes.custom].map(row => [row.codigo, row])).values()];
                const restored = new Set(rows.map(row => row.codigo));
                changes.deleted = [...new Set([...state.deleted, ...changes.deleted])].filter(code => !restored.has(code));
                commit({ ...state, ...changes });
            },
            async refresh(fetcher = fetch) {
                const response = await fetcher('/api/ciiu', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
                if (!response.ok) throw new Error('No se pudo consultar el catálogo oficial.');
                const data = await response.json();
                const official = normalizeActivities(data.activities);
                if (!official.length || !data.checkedAt || !Number.isFinite(Date.parse(data.checkedAt))) {
                    throw new Error('El catálogo recibido no es válido.');
                }
                commit({ ...state, official, checkedAt: data.checkedAt });
            }
        };
    }

    return { normalizeActivities, mergeActivities, buildChanges, createStore };
})();

if (typeof module !== 'undefined') module.exports = ArtCatalog;
