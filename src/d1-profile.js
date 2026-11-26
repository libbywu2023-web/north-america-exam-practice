// Request-local diagnostic wrapper. Never log SQL text or bound values.
export function profileD1(db) {
  const totals = { statements: 0, measured: 0, unmeasured: 0, failed: 0, rows_read: 0, rows_written: 0 };
  const queries = new Map();
  const native = new WeakMap();
  const fingerprint = sql => {
    let hash = 2166136261;
    for (const c of sql) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
    return (hash >>> 0).toString(16).padStart(8, '0');
  };
  function record(sql, result, failed = false) {
    const id = fingerprint(sql);
    const q = queries.get(id) || { id, statements: 0, rows_read: 0, rows_written: 0, unmeasured: 0, failed: 0 };
    queries.set(id, q);
    totals.statements++; q.statements++;
    if (failed) { totals.failed++; q.failed++; }
    const m = result?.meta;
    if (typeof m?.rows_read !== 'number' || typeof m?.rows_written !== 'number') {
      totals.unmeasured++; q.unmeasured++; return;
    }
    totals.measured++;
    for (const key of ['rows_read', 'rows_written']) { totals[key] += m[key]; q[key] += m[key]; }
  }
  function wrap(stmt, sql) {
    const wrapped = {
      bind(...args) { return wrap(stmt.bind(...args), sql); },
      async all() { return execute('all'); },
      async run() { return execute('run'); },
      async first(column) {
        // first() hides D1 metadata. Use all() only in diagnostic mode.
        const result = await execute('all');
        const row = result.results?.[0];
        if (!row) return null;
        if (column === undefined) return row;
        if (!(column in row)) throw new Error('D1_COLUMN_NOTFOUND');
        return row[column];
      },
      async raw(...args) {
        try { const result = await stmt.raw(...args); record(sql, null); return result; }
        catch (error) { record(sql, null, true); throw error; }
      }
    };
    async function execute(method) {
      try { const result = await stmt[method](); record(sql, result); return result; }
      catch (error) { record(sql, null, true); throw error; }
    }
    native.set(wrapped, { stmt, sql });
    return wrapped;
  }
  return {
    db: {
      prepare(sql) { return wrap(db.prepare(sql), sql); },
      async batch(statements) {
        const entries = statements.map(s => native.get(s));
        try {
          const results = await db.batch(entries.map(e => e.stmt));
          entries.forEach((e, i) => record(e.sql, results[i]));
          return results;
        } catch (error) { entries.forEach(e => record(e.sql, null, true)); throw error; }
      }
    },
    summary() { return { ...totals, top: [...queries.values()].sort((a,b) => b.rows_read-a.rows_read).slice(0,10) }; }
  };
}
