export const SOURCE_URL = 'https://serviciosweb.afip.gob.ar/genericos/nomencladorActividades/index.aspx';

function decodeText(value) {
    const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
    return value.replace(/<[^>]*>/g, '').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, key) => {
        if (key.startsWith('#')) {
            const code = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1));
            return code <= 0x10ffff ? String.fromCodePoint(code) : match;
        }
        return entities[key.toLowerCase()];
    }).replace(/\s+/g, ' ').trim();
}

export function parseActivities(html, minimum = 900) {
    const rows = new Map();
    for (const match of html.matchAll(/<li>\s*<b>\s*(\d{6})\s*:\s*<\/b>(.*?)<\/li>/gis)) {
        // La tabla anexa de ocupaciones no corresponde a actividades económicas.
        if (match[1].startsWith('0000')) continue;
        const descripcion = decodeText(match[2]);
        if (!descripcion) throw new Error('Descripción vacía en el catálogo oficial.');
        if (rows.has(match[1])) throw new Error('Código duplicado en el catálogo oficial.');
        rows.set(match[1], { codigo: match[1], descripcion });
    }
    // No reemplazar una copia válida con una página de error o una extracción parcial.
    if (rows.size < minimum) throw new Error('El catálogo oficial está vacío o incompleto.');
    return [...rows.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
}

export async function fetchOfficialActivities(fetcher = fetch) {
    const response = await fetcher(SOURCE_URL, { signal: AbortSignal.timeout(12000), cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status} en el catálogo oficial.`);
    if (!response.headers.get('content-type')?.includes('text/html')) throw new Error('Formato de catálogo no válido.');
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 1500000) throw new Error('El catálogo supera el tamaño permitido.');
            chunks.push(value);
        }
    } finally {
        await reader.cancel();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    chunks.forEach(chunk => { bytes.set(chunk, offset); offset += chunk.length; });
    const html = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { activities: parseActivities(html), source: SOURCE_URL, checkedAt: new Date().toISOString() };
}
