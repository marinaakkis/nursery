// adapter.mjs — in-memory адаптер для тестов и e2e без реального egress.
// Реализует контракт adapter.contract.mjs. Idempotent upsert по key.
// Node.js 18+ ESM, stdlib-only.

export function createStubAdapter() {
  const store = new Map(); // projectKey -> Map(key -> doc)

  function projStore(config) {
    const pk = config?.projectKey ?? '_default';
    if (!store.has(pk)) store.set(pk, new Map());
    return store.get(pk);
  }

  return {
    id: 'stub',

    async upsertDocument(doc, config) {
      const proj = projStore(config);
      const existed = proj.has(doc.key);
      proj.set(doc.key, { ...doc });
      return {
        key: doc.key,
        documentId: `${config?.projectKey ?? '_default'}/${doc.key}`,
        created: !existed,
        status: existed ? 200 : 201,
      };
    },

    async search(query, config) {
      const proj = projStore(config);
      const q = String(query?.q ?? '');
      const results = [...proj.values()]
        .filter((d) => (d.content ?? '').includes(q) || (d.title ?? '').includes(q))
        .slice(0, query?.limit ?? 10)
        .map((d) => ({ key: d.key, score: 1, snippet: (d.content ?? '').slice(0, 80) }));
      return { results };
    },

    async health() {
      return { status: 'ok' };
    },

    // Тестовый хелпер (не часть контракта).
    _store: store,
  };
}
