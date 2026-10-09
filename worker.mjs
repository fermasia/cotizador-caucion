import { fetchOfficialActivities } from './ciiu-source.mjs';

export default {
    async fetch(request, env) {
        const path = new URL(request.url).pathname;
        if (path !== '/api/ciiu') return env.ASSETS.fetch(request);
        if (request.method !== 'GET') {
            return new Response('Método no permitido', { status: 405, headers: { Allow: 'GET' } });
        }
        try {
            const data = await fetchOfficialActivities();
            return Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
        } catch (error) {
            console.error(JSON.stringify({ message: 'No se pudo actualizar CIIU', error: error.message }));
            return Response.json({ error: 'No se pudo consultar el catálogo oficial.' }, {
                status: 502, headers: { 'Cache-Control': 'no-store' }
            });
        }
    }
};
