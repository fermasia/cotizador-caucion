// Respaldo versionado de maestros. No incluye cotizaciones ni credenciales.
const ConfigBackup = (() => {
    const keys = ['cotizadorData', 'artCompanies', 'artActivities'];
    const invalid = label => { throw new Error(`El respaldo contiene ${label} no válidos.`); };
    const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    const text = value => typeof value === 'string' && value.trim().length > 0;
    const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;

    function validate(backup) {
        if (!object(backup) || backup.app !== 'sirius-cotizadores') throw new Error('El archivo no es un respaldo de Sirius.');
        if (backup.version !== 1) throw new Error('La versión del respaldo no es compatible con esta aplicación.');
        if (!text(backup.createdAt) || !Number.isFinite(Date.parse(backup.createdAt))) invalid('fecha');
        const data = backup.data;
        if (!object(data) || !object(data.caucion)) invalid('maestros');
        const caucion = data.caucion;
        if (!Array.isArray(caucion.companias)) invalid('compañías');
        caucion.companias.forEach(company => {
            if (!object(company) || !text(company.nombre)) invalid('compañías');
            for (const field of ['prima_minima', 'derecho_emision', 'escribano_solo', 'escribano_colegio']) {
                if (!object(company[field]) || !['ARS', 'USD', 'EUR'].every(currency => number(company[field][currency]))) invalid('importes de compañías');
            }
            if (!number(company.impuesto_pais) || !number(company.recargo_administrativo)) invalid('parámetros de compañías');
        });
        if (!object(caucion.impuestos) || !['intereses_internos', 'tasa_ssn', 'osseg', 'iva'].every(field => number(caucion.impuestos[field]))) invalid('impuestos');
        for (const field of ['periodicidad', 'sellados']) {
            if (!object(caucion[field]) || !Object.entries(caucion[field]).length || !Object.entries(caucion[field]).every(([name, value]) => text(name) && number(value) && (field !== 'periodicidad' || value > 0))) invalid(field);
        }
        if (!Array.isArray(caucion.riesgos) || !caucion.riesgos.every(text)) invalid('riesgos');
        if (!Array.isArray(caucion.tiposDocumento) || !caucion.tiposDocumento.every(row => object(row) && text(row.nombre) && typeof row.mascara === 'string')) invalid('documentos');
        if (!Array.isArray(data.artCompanies)) invalid('compañías ART');
        const companyNames = new Set();
        data.artCompanies.forEach(name => {
            if (!text(name) || name.trim().length > 120) invalid('compañías ART');
            const key = name.trim().replace(/\s+/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            if (companyNames.has(key)) invalid('nombres duplicados de compañías ART');
            companyNames.add(key);
        });
        const activities = data.artActivities;
        if (!object(activities)) invalid('actividades');
        const code = value => typeof value === 'string' && /^[A-Z0-9][A-Z0-9._/-]{0,23}$/.test(value) && (!/^\d+$/.test(value) || value.length === 6);
        for (const field of ['official', 'custom']) {
            if (!Array.isArray(activities[field])) invalid('actividades');
            const seen = new Set();
            activities[field].forEach(row => {
                if (!object(row) || !code(row.codigo) || !text(row.descripcion) || seen.has(row.codigo)) invalid('actividades o códigos duplicados');
                seen.add(row.codigo);
            });
        }
        if (!Array.isArray(activities.deleted) || !activities.deleted.every(code)) invalid('actividades eliminadas');
        if (activities.checkedAt !== null && (!text(activities.checkedAt) || !Number.isFinite(Date.parse(activities.checkedAt)))) invalid('fecha del catálogo');
        return backup;
    }

    function parse(content) {
        if (typeof content !== 'string' || content.length > 5 * 1024 * 1024) throw new Error('El respaldo debe ser un archivo JSON de hasta 5 MB.');
        let backup;
        try {
            backup = JSON.parse(content, (key, value) => {
                if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Clave no permitida');
                return value;
            });
        } catch {
            throw new Error('No se pudo leer el archivo JSON del respaldo.');
        }
        return validate(backup);
    }

    function create(data) {
        return parse(JSON.stringify({ app: 'sirius-cotizadores', version: 1, createdAt: new Date().toISOString(), data }));
    }

    function capture(storage, caucionDefaults, activityDefaults) {
        const read = (key, fallback) => {
            const saved = storage.getItem(key);
            return saved === null ? fallback : JSON.parse(saved);
        };
        return create({
            caucion: { ...caucionDefaults, ...read('cotizadorData', {}) },
            artCompanies: read('artCompanies', []),
            artActivities: read('artActivities', { official: activityDefaults.activities, custom: [], deleted: [], checkedAt: activityDefaults.checkedAt })
        });
    }

    function restore(storage, backup) {
        const validated = parse(JSON.stringify(backup));
        const values = [validated.data.caucion, validated.data.artCompanies, validated.data.artActivities].map(value => JSON.stringify(value));
        const previous = keys.map(key => storage.getItem(key));
        try {
            keys.forEach((key, index) => storage.setItem(key, values[index]));
        } catch (error) {
            try {
                keys.forEach((key, index) => previous[index] === null ? storage.removeItem(key) : storage.setItem(key, previous[index]));
            } catch {
                throw new Error('No se pudo completar ni revertir la importación. Conservá el archivo de respaldo y revisá el almacenamiento del navegador.');
            }
            throw error;
        }
    }

    return { create, capture, parse, restore };
})();

if (typeof module !== 'undefined') module.exports = ConfigBackup;
