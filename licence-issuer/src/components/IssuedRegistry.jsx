import React, { useState, useEffect } from 'react';
import { api, copyText } from '../api';

export default function IssuedRegistry({ refreshKey }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  function load() {
    setLoading(true);
    api.issued()
      .then((r) => setRecords(r.records || []))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [refreshKey]);

  const filtered = records.filter((r) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      r.organisation?.toLowerCase().includes(q)
      || r.licence_key?.toLowerCase().includes(q)
      || r.notes?.toLowerCase().includes(q)
    );
  });

  async function remove(id) {
    if (!window.confirm('Remove this record from the registry? (Does not revoke the licence on site.)')) return;
    await api.removeIssued(id);
    load();
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Issued licences</h2>
          <p className="text-sm text-slate-500 mt-0.5">{records.length} record{records.length !== 1 ? 's' : ''} in local registry</p>
        </div>
        <input
          type="search"
          placeholder="Search org, key, notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full md:w-64 outline-none focus:border-cyan-500"
        />
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm py-8 text-center">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-slate-400 text-sm py-8 text-center">No issued licences yet</p>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                <th className="py-2 px-2">Issued</th>
                <th className="py-2 px-2">Organisation</th>
                <th className="py-2 px-2">Key</th>
                <th className="py-2 px-2">Plan</th>
                <th className="py-2 px-2">Expires</th>
                <th className="py-2 px-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/80">
                  <td className="py-2.5 px-2 text-xs text-slate-500 whitespace-nowrap">
                    {r.issued_at?.slice(0, 10)}
                  </td>
                  <td className="py-2.5 px-2 font-medium text-slate-900">
                    {r.organisation}
                    {r.notes && <div className="text-[10px] text-slate-400 font-normal truncate max-w-[140px]">{r.notes}</div>}
                  </td>
                  <td className="py-2.5 px-2">
                    <button
                      type="button"
                      className="font-mono text-xs text-cyan-700 hover:underline text-left"
                      onClick={() => copyText(r.licence_key)}
                      title="Click to copy"
                    >
                      {r.licence_key}
                    </button>
                  </td>
                  <td className="py-2.5 px-2 capitalize text-slate-600">{r.plan}</td>
                  <td className="py-2.5 px-2 text-slate-600">{r.expires_at}</td>
                  <td className="py-2.5 px-2 text-right whitespace-nowrap">
                    <button type="button" className="text-xs text-slate-500 hover:text-slate-800 mr-2" onClick={() => copyText(JSON.stringify(r.package, null, 2))}>JSON</button>
                    <button type="button" className="text-xs text-red-500 hover:text-red-700" onClick={() => remove(r.id)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
