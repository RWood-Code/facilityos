import React, { useEffect, useMemo, useState } from 'react';
import { format, subDays, parseISO, differenceInDays } from 'date-fns';
import {
  BarChart3, TrendingUp, ClipboardList, Wrench, Users, Droplets, AlertTriangle,
  ArrowRight, Award,
} from 'lucide-react';
import { dbQuery } from '../../hooks/useDb';
import { useAppStore } from '../../store/appStore';
import { Spinner, Card } from '../../components/ui';
import { isWaterTestPool } from '../../utils/poolUtils';
import AlertsPanel from '../../components/manager/AlertsPanel';
import ComplianceTrend from '../../components/manager/ComplianceTrend';
import WorkOrderSummary from '../../components/manager/WorkOrderSummary';
import QualificationAlerts from '../../components/manager/QualificationAlerts';
import PoolComplianceGrid from '../../components/manager/PoolComplianceGrid';

function KpiCard({ label, value, sub, icon: Icon, color, bg }) {
  return (
    <Card className="border-0 shadow-sm p-4">
      <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-2`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs font-medium text-gray-600 mt-0.5">{label}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </Card>
  );
}

export default function ManagerDashboard() {
  const { facility, settings, setModule, setSelectedPoolId } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [pools, setPools] = useState([]);
  const [tests, setTests] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [assets, setAssets] = useState([]);
  const [qualifications, setQualifications] = useState([]);
  const [staff, setStaff] = useState([]);
  const [closures, setClosures] = useState([]);
  const [budget, setBudget] = useState(null);

  const facilityName = settings.facility_name || facility?.name || 'Aquatic Centre';

  useEffect(() => {
    setLoading(true);
    const from = format(subDays(new Date(), 90), 'yyyy-MM-dd');
    Promise.all([
      dbQuery('pools:list'),
      dbQuery('tests:list', { from_date: from, limit: 2000 }),
      dbQuery('workorders:list'),
      dbQuery('assets:list'),
      dbQuery('qualifications:list'),
      dbQuery('staff:list', { status: 'active' }),
      dbQuery('closures:list'),
      dbQuery('budget:summary', { year: new Date().getFullYear() }),
    ])
      .then(([p, t, wo, a, q, st, c, b]) => {
        setPools(p || []);
        setTests(t || []);
        setWorkOrders(wo || []);
        setAssets(a || []);
        setQualifications(q || []);
        setStaff(st || []);
        setClosures(c || []);
        setBudget(b || null);
      })
      .finally(() => setLoading(false));
  }, [facility?.id]);

  const stats = useMemo(() => {
    const last30 = subDays(new Date(), 30);
    const recentTests = tests.filter((t) => {
      try { return parseISO(t.test_date) >= last30; } catch { return false; }
    });
    const compliantTests = recentTests.filter((t) => t.is_compliant === 1 || t.is_compliant === true);
    const complianceRate = recentTests.length > 0
      ? Math.round((compliantTests.length / recentTests.length) * 100)
      : null;

    const openWOs = workOrders.filter((wo) => !['completed', 'cancelled'].includes(wo.status));
    const overdueWOs = openWOs.filter((wo) => {
      try { return wo.due_date && differenceInDays(new Date(), parseISO(wo.due_date)) > 0; } catch { return false; }
    });
    const urgentWOs = openWOs.filter((wo) => wo.priority === 'urgent');

    const downAssets = assets.filter((a) => a.status === 'down');
    const needsMaintenance = assets.filter((a) => a.status === 'needs_maintenance');

    const expiredQuals = qualifications.filter((q) => {
      try { return q.expiry_date && differenceInDays(parseISO(q.expiry_date), new Date()) < 0; } catch { return false; }
    });
    const expiringQuals = qualifications.filter((q) => {
      try {
        const d = differenceInDays(parseISO(q.expiry_date), new Date());
        return q.expiry_date && d >= 0 && d <= 30;
      } catch { return false; }
    });

    const activeClosures = closures.filter((c) => !c.reopened_at);

    const waterPools = pools.filter((p) => isWaterTestPool(p.type));
    const nonCompliantPools = waterPools.filter((p) => {
      const latest = tests.filter((t) => t.pool_id === p.id && t.test_type === 'routine')
        .sort((a, b) => ((b.test_date || '') + (b.test_time || '')).localeCompare((a.test_date || '') + (a.test_time || '')))[0];
      return latest && (latest.is_compliant === 0 || latest.is_compliant === false);
    });

    const totalAlerts = nonCompliantPools.length + overdueWOs.length + downAssets.length + expiredQuals.length;

    return {
      complianceRate, recentTests: recentTests.length, compliantTests: compliantTests.length,
      openWOs: openWOs.length, overdueWOs: overdueWOs.length, urgentWOs: urgentWOs.length,
      downAssets: downAssets.length, needsMaintenance: needsMaintenance.length,
      expiredQuals: expiredQuals.length, expiringQuals: expiringQuals.length,
      activeClosures: activeClosures.length, activeStaff: staff.length, totalAlerts,
    };
  }, [pools, tests, workOrders, assets, qualifications, staff, closures]);

  const kpis = [
    {
      label: '30-Day Compliance', value: stats.complianceRate !== null ? `${stats.complianceRate}%` : 'N/A',
      sub: `${stats.compliantTests}/${stats.recentTests} tests`, icon: TrendingUp,
      color: stats.complianceRate === null ? 'text-gray-500' : stats.complianceRate >= 95 ? 'text-emerald-600' : stats.complianceRate >= 80 ? 'text-amber-600' : 'text-red-600',
      bg: stats.complianceRate === null ? 'bg-gray-100' : stats.complianceRate >= 95 ? 'bg-emerald-100' : stats.complianceRate >= 80 ? 'bg-amber-100' : 'bg-red-100',
    },
    {
      label: 'Open Work Orders', value: stats.openWOs,
      sub: stats.overdueWOs > 0 ? `${stats.overdueWOs} overdue` : 'None overdue', icon: ClipboardList,
      color: stats.overdueWOs > 0 ? 'text-red-600' : 'text-violet-600',
      bg: stats.overdueWOs > 0 ? 'bg-red-100' : 'bg-violet-100',
    },
    {
      label: 'Assets Down', value: stats.downAssets,
      sub: `${stats.needsMaintenance} need maintenance`, icon: Wrench,
      color: stats.downAssets > 0 ? 'text-red-600' : 'text-blue-600',
      bg: stats.downAssets > 0 ? 'bg-red-100' : 'bg-blue-100',
    },
    {
      label: 'Active Staff', value: stats.activeStaff,
      sub: stats.expiredQuals > 0 ? `${stats.expiredQuals} expired certs` : stats.expiringQuals > 0 ? `${stats.expiringQuals} expiring soon` : 'All certs current',
      icon: Users,
      color: stats.expiredQuals > 0 ? 'text-red-600' : stats.expiringQuals > 0 ? 'text-amber-600' : 'text-cyan-600',
      bg: stats.expiredQuals > 0 ? 'bg-red-100' : stats.expiringQuals > 0 ? 'bg-amber-100' : 'bg-cyan-100',
    },
    {
      label: 'Pool Closures', value: stats.activeClosures, sub: 'Currently closed', icon: Droplets,
      color: stats.activeClosures > 0 ? 'text-red-600' : 'text-gray-500',
      bg: stats.activeClosures > 0 ? 'bg-red-100' : 'bg-gray-100',
    },
    {
      label: 'Total Alerts', value: stats.totalAlerts, sub: 'Requiring attention', icon: AlertTriangle,
      color: stats.totalAlerts > 0 ? 'text-red-600' : 'text-emerald-600',
      bg: stats.totalAlerts > 0 ? 'bg-red-100' : 'bg-emerald-100',
    },
  ];

  const quickLinks = [
    { label: 'Reports', mod: 'reports', icon: BarChart3 },
    { label: 'Staff & Qualifications', mod: 'staff', icon: Users },
    { label: 'Work Orders', mod: 'workorders', icon: ClipboardList },
    { label: 'Assets', mod: 'assets', icon: Wrench },
    { label: 'Pools', mod: 'pools', icon: Droplets },
    { label: 'Operational View', mod: 'dashboard', icon: BarChart3 },
  ];

  if (loading) return <Spinner />;

  return (
    <div className="-m-4 md:-m-6 lg:-m-8 min-h-full bg-gradient-to-br from-slate-50 via-cyan-50/20 to-slate-50">
      <div className="p-4 md:p-6 lg:p-8">
        <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-100 rounded-xl">
              <BarChart3 className="w-8 h-8 text-cyan-700" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Facility Manager Dashboard</h1>
              <p className="text-gray-500">{facilityName} · {format(new Date(), 'EEEE, d MMMM yyyy')}</p>
            </div>
          </div>
          <button type="button" onClick={() => setModule('dashboard')} className="text-sm text-cyan-600 hover:underline">
            → Operational View
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
        </div>

        {budget && budget.totalBudget > 0 && (
          <Card className="mb-6 border-cyan-100 bg-gradient-to-r from-cyan-50/50 to-white">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Maintenance Budget {budget.year}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  ${Math.round(budget.spent).toLocaleString()}
                  <span className="text-base font-normal text-gray-400"> / ${Math.round(budget.totalBudget).toLocaleString()}</span>
                </p>
              </div>
              <div className="flex-1 min-w-[200px] max-w-md">
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${budget.spent > budget.totalBudget ? 'bg-red-500' : 'bg-cyan-500'}`}
                    style={{ width: `${Math.min(100, Math.round((budget.spent / budget.totalBudget) * 100))}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  ${Math.round(Math.max(0, budget.remaining)).toLocaleString()} remaining
                </p>
              </div>
              <button type="button" onClick={() => setModule('schedules')} className="text-sm text-cyan-600 hover:underline">
                Manage budget →
              </button>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-0 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h3 className="text-base font-semibold text-gray-900">Active Alerts</h3>
                {stats.totalAlerts > 0 && (
                  <span className="ml-auto text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{stats.totalAlerts} issues</span>
                )}
              </div>
              <AlertsPanel
                pools={pools} tests={tests} workOrders={workOrders} assets={assets} qualifications={qualifications}
                onNavigate={setModule} onSelectPool={setSelectedPoolId}
              />
            </Card>

            <Card className="border-0 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-cyan-600" />
                <h3 className="text-base font-semibold text-gray-900">14-Day Compliance Trend</h3>
              </div>
              <ComplianceTrend tests={tests} days={14} />
            </Card>

            <Card className="border-0 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-cyan-600" />
                  <h3 className="text-base font-semibold text-gray-900">Pool Compliance Status</h3>
                </div>
                <button type="button" onClick={() => setModule('pools')} className="text-xs text-cyan-600 hover:underline">Manage →</button>
              </div>
              <PoolComplianceGrid
                pools={pools} tests={tests}
                onNavigate={setModule} onSelectPool={setSelectedPoolId}
              />
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-0 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardList className="w-4 h-4 text-violet-600" />
                <h3 className="text-base font-semibold text-gray-900">Work Orders</h3>
              </div>
              <WorkOrderSummary workOrders={workOrders} onNavigate={setModule} />
            </Card>

            <Card className="border-0 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-4 h-4 text-amber-500" />
                <h3 className="text-base font-semibold text-gray-900">Qualification Alerts</h3>
                {(stats.expiredQuals + stats.expiringQuals) > 0 && (
                  <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    {stats.expiredQuals + stats.expiringQuals}
                  </span>
                )}
              </div>
              <QualificationAlerts qualifications={qualifications} staff={staff} onNavigate={setModule} />
            </Card>

            <Card className="border-0 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900 mb-3">Quick Links</h3>
              <div className="space-y-1">
                {quickLinks.map((l) => {
                  const Icon = l.icon;
                  return (
                    <button
                      key={l.label}
                      type="button"
                      onClick={() => setModule(l.mod)}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-gray-50 text-gray-700 hover:text-cyan-700 transition-colors group text-left"
                    >
                      <Icon className="w-4 h-4 text-gray-400 group-hover:text-cyan-500" />
                      <span className="text-sm">{l.label}</span>
                      <ArrowRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 text-cyan-500" />
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
