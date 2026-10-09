import assert from 'node:assert/strict';
import { test } from 'node:test';
import ArtCatalog from '../art-catalog.js';

function storage() {
    const data = new Map();
    return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}
const fallback = { activities: [{ codigo: '011111', descripcion: 'Arroz' }], checkedAt: '2026-10-08T12:00:00Z' };

test('las actividades personalizadas y ediciones sobreviven a actualizaciones y recargas', async () => {
    const saved = storage();
    const store = ArtCatalog.createStore(saved, fallback);
    store.saveEdited([{ codigo: '011111', descripcion: 'Edición propia' }, { codigo: 'ART-1', descripcion: 'Propia' }]);
    let calls = 0;
    const fetcher = async () => {
        calls++;
        return Response.json({ activities: [{ codigo: '011111', descripcion: 'Oficial nueva' }, { codigo: '620100', descripcion: 'Informática' }], checkedAt: '2026-10-09T12:00:00Z' });
    };
    await store.refresh(fetcher);
    await store.refresh(fetcher);
    assert.equal(calls, 2);
    const reloaded = ArtCatalog.createStore(saved, fallback);
    assert.deepEqual(reloaded.getActivities(), [
        { codigo: '011111', descripcion: 'Edición propia' },
        { codigo: '620100', descripcion: 'Informática' },
        { codigo: 'ART-1', descripcion: 'Propia' }
    ]);
});

test('un fallo de actualización conserva el catálogo y las personalizaciones guardadas', async () => {
    const saved = storage();
    const store = ArtCatalog.createStore(saved, fallback);
    store.saveEdited([...fallback.activities, { codigo: 'ART-1', descripcion: 'Propia' }]);
    const previous = JSON.stringify(store.getState());
    await assert.rejects(() => store.refresh(async () => { throw new Error('offline'); }), /offline/);
    assert.equal(JSON.stringify(store.getState()), previous);
    await assert.rejects(() => store.refresh(async () => Response.json({ activities: [] })), /catálogo/i);
    assert.equal(JSON.stringify(ArtCatalog.createStore(saved, fallback).getState()), previous);
});

test('una actualización durante la edición no pierde nuevas actividades oficiales al guardar', async () => {
    const store = ArtCatalog.createStore(storage(), fallback);
    const base = store.getState().official;
    const draft = [{ codigo: '011111', descripcion: 'Edición propia' }];
    await store.refresh(async () => Response.json({ activities: [...fallback.activities, { codigo: '620100', descripcion: 'Informática' }], checkedAt: '2026-10-09T12:00:00Z' }));
    store.saveEdited(draft, base);
    assert.equal(store.getActivities().find(row => row.codigo === '620100').descripcion, 'Informática');
});

test('los datos corruptos usan el respaldo y un fallo de guardado no descarta la edición previa', () => {
    const saved = storage();
    saved.setItem('artActivities', '{invalid');
    const store = ArtCatalog.createStore(saved, fallback);
    assert.ok(store.cacheWarning);
    assert.deepEqual(store.getActivities(), fallback.activities);
    saved.setItem = () => { throw new Error('quota'); };
    assert.throws(() => store.saveEdited([{ codigo: 'ART-1', descripcion: 'Nueva' }]), /quota/);
    assert.deepEqual(store.getActivities(), fallback.activities);
});

test('una eliminación se conserva aunque la fuente retire y luego reincorpore el código', async () => {
    const store = ArtCatalog.createStore(storage(), fallback);
    store.saveEdited([]);
    await store.refresh(async () => Response.json({ activities: [{ codigo: '620100', descripcion: 'Informática' }], checkedAt: '2026-10-09T12:00:00Z' }));
    store.saveEdited(store.getActivities());
    await store.refresh(async () => Response.json({ activities: [...fallback.activities, { codigo: '620100', descripcion: 'Informática' }], checkedAt: '2026-10-10T12:00:00Z' }));
    assert.equal(store.getActivities().some(row => row.codigo === '011111'), false);
});

test('una descripción personalizada sigue protegida cuando coincide temporalmente con la oficial', async () => {
    const store = ArtCatalog.createStore(storage(), fallback);
    store.saveEdited([{ codigo: '011111', descripcion: 'Personalizada' }]);
    await store.refresh(async () => Response.json({ activities: [{ codigo: '011111', descripcion: 'Personalizada' }], checkedAt: '2026-10-09T12:00:00Z' }));
    store.saveEdited(store.getActivities());
    await store.refresh(async () => Response.json({ activities: [{ codigo: '011111', descripcion: 'Cambio posterior oficial' }], checkedAt: '2026-10-10T12:00:00Z' }));
    assert.equal(store.getActivities()[0].descripcion, 'Personalizada');
});

test('una copia guardada sin oficiales recupera el respaldo sin perder actividades propias', () => {
    const saved = storage();
    saved.setItem('artActivities', JSON.stringify({ official: [], custom: [{ codigo: 'ART-PROP', descripcion: 'Propia' }], deleted: [], checkedAt: null }));
    const store = ArtCatalog.createStore(saved, fallback);
    assert.deepEqual(store.getActivities(), [...fallback.activities, { codigo: 'ART-PROP', descripcion: 'Propia' }]);
});
