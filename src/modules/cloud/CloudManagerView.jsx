import React, { useEffect, useState } from 'react';
import { AlertTriangle, Droplets, LogOut, RefreshCw } from 'lucide-react';
import { Btn, Spinner, Card } from '../../components/ui';
import {
  fetchCloudManagerDashboard,
  getCloudSession,
  clearCloudSession,
  subscribeCloudPush,
  fetchVapidPublicKey,
} from '../../utils/cloudRelay';

function StatCard({ label, value, tone = 'text-gray-900' }) {
  return (
    <Card className="p-4 border-0 shadow-sm">
      <p className={`text-2xl font-bold ${tone}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </Card>
  );
}

export default function CloudManagerView() {
  const session = getCloudSession();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCloudManagerDashboard();
      setDashboard(data);
    } catch (e) {
      setError(e.message || 'Could not load dashboard');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return undefined;
    let cancelled = false;
    (async () => {
      const vapid = await fetchVapidPublicKey();
      if (!vapid || cancelled) return;
      try {
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapid,
          });
        }
        await subscribeCloudPush(sub.toJSON());
      } catch {
        /* push optional */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function signOut() {
    clearCloudSession();
    window.location.reload();
  }

  if (loading && !dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner />
      </div>
    );
  }

  const stats = dashboard?.stats || {};
  const alerts = dashboard?.alerts || [];

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <header className="bg-white border-b border-gray-200 px-4 py-4 safe-area-pad">
        <div className="max-w-3xl mx-auto flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-indigo-600 font-semibold uppercase tracking-wider">FacilityOS Cloud</p>
            <h1 className="text-xl font-bold text-gray-900">{dashboard?.site_name || session?.site?.name || 'Manager Dashboard'}</h1>
            <p className="text-xs text-gray-500 mt-1">Signed in as {session?.user?.email}</p>
          </div>
          <div className="flex gap-2">
            <Btn size="sm" variant="secondary" onClick={refresh} disabled={loading}>
              <RefreshCw className="w-4 h-4" />
            </Btn>
            <Btn size="sm" variant="secondary" onClick={signOut}>
              <LogOut className="w-4 h-4" />
            </Btn>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Pools tracked" value={stats.pool_count ?? '—'} />
          <StatCard label="Non-compliant" value={stats.non_compliant_count ?? 0} tone="text-red-600" />
          <StatCard label="30-day compliance" value={stats.compliance_rate_30d != null ? `${stats.compliance_rate_30d}%` : '—'} tone="text-emerald-600" />
          <StatCard label="Tests synced" value={stats.tests_synced ?? 0} />
        </div>

        {alerts.length > 0 && (
          <Card className="p-4 border-red-100 bg-red-50/50">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h2 className="font-semibold text-gray-900">Active alerts</h2>
            </div>
            <ul className="space-y-2">
              {alerts.map((a) => (
                <li key={a.pool_id} className="text-sm bg-white rounded-lg border border-red-100 px-3 py-2">
                  <p className="font-medium text-red-800">{a.title}</p>
                  <p className="text-gray-600 text-xs mt-0.5">{a.message}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Droplets className="w-5 h-5 text-cyan-600" />
            <h2 className="font-semibold text-gray-900">Latest pool tests</h2>
          </div>
          {(dashboard?.pools || []).length === 0 ? (
            <p className="text-sm text-gray-500">No water test data synced yet. Log tests on-site with cloud enabled.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {dashboard.pools.map((p) => (
                <li key={p.pool_id} className="py-2 flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-gray-900">{p.pool_name}</span>
                  <span className={p.is_compliant === 0 || p.is_compliant === false ? 'text-red-600 font-semibold' : 'text-emerald-600'}>
                    {p.is_compliant === 0 || p.is_compliant === false ? 'Non-compliant' : 'OK'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <p className="text-xs text-gray-400 text-center">
          Read-only view from cloud cache · last updated {dashboard?.generated_at?.slice(0, 19)?.replace('T', ' ') || '—'}
        </p>
      </main>
    </div>
  );
}
