import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import {
  Droplets,
  CheckCircle2,
  XCircle,
  Activity,
  Wrench,
  ClipboardList,
  ArrowRight,
  AlertTriangle,
  Package,
  Calendar,
  Users,
  BarChart3,
  UserCog,
  Waves,
  Beaker,
  Thermometer,
  Shield,
  Plus,
} from 'lucide-react';
import { dbQuery } from '../../hooks/useDb';
import { useAppStore } from '../../store/appStore';
import { MODULE_REGISTRY } from '../../config/modules';
import { isModuleAccessible } from '../../utils/moduleAccess';
import { Spinner, Btn, Card } from '../../components/ui';
import TestEntryModal from '../../components/TestEntryModal';
import SteamCheckModal from '../../components/SteamCheckModal';
import PhoneSetupBanner from '../../components/PhoneSetupBanner';
import ModuleCards from '../../components/dashboard/ModuleCards';
import PoolCard from '../../components/pools/PoolCard';
import { isWaterTestPool } from '../../utils/poolUtils';

const MODULE_CARD_DEFS = [
  { key: 'show_manager_dashboard', mod: 'managerdashboard', label: 'Manager View', desc: 'KPIs and facility overview', icon: BarChart3, color: 'from-indigo-50 to-white', border: 'border-indigo-200', iconBg: 'bg-indigo-600', arrow: 'text-indigo-600' },
  { key: 'show_pools', mod: 'pools', label: 'Pool Management', desc: 'Manage pools and spas', icon: Waves, color: 'from-cyan-50 to-white', border: 'border-cyan-200', iconBg: 'bg-cyan-600', arrow: 'text-cyan-600' },
  { key: 'show_assets', mod: 'assets', label: 'Assets', desc: 'Track equipment and inventory', icon: Package, color: 'from-orange-50 to-white', border: 'border-orange-200', iconBg: 'bg-orange-600', arrow: 'text-orange-600' },
  { key: 'show_work_orders', mod: 'workorders', label: 'Work Orders', desc: 'Maintenance requests and tasks', icon: ClipboardList, color: 'from-purple-50 to-white', border: 'border-purple-200', iconBg: 'bg-purple-600', arrow: 'text-purple-600' },
  { key: 'show_maintenance', mod: 'schedules', label: 'Maintenance', desc: 'Scheduled maintenance tasks', icon: Calendar, color: 'from-teal-50 to-white', border: 'border-teal-200', iconBg: 'bg-teal-600', arrow: 'text-teal-600' },
  { key: 'show_rostering', mod: 'rostering', label: 'Rostering', desc: 'Staff shifts and payroll', icon: Calendar, color: 'from-violet-50 to-white', border: 'border-violet-200', iconBg: 'bg-violet-600', arrow: 'text-violet-600' },
  { key: 'show_staff', mod: 'staff', label: 'Staff', desc: 'Staff and qualifications', icon: UserCog, color: 'from-pink-50 to-white', border: 'border-pink-200', iconBg: 'bg-pink-600', arrow: 'text-pink-600' },
  { key: 'show_reports', mod: 'reports', label: 'Reports', desc: 'Facility reports and analytics', icon: BarChart3, color: 'from-emerald-50 to-white', border: 'border-emerald-200', iconBg: 'bg-emerald-600', arrow: 'text-emerald-600' },
  { key: 'show_iltp_poolsafe', mod: 'iltp', label: 'ILTP & PoolSafe', desc: 'Training and audit documentation', icon: Shield, color: 'from-blue-50 to-white', border: 'border-blue-200', iconBg: 'bg-blue-600', arrow: 'text-blue-600' },
  { key: 'profile', mod: 'profile', label: 'My Profile', desc: 'View your staff profile', icon: Users, color: 'from-gray-50 to-white', border: 'border-gray-200', iconBg: 'bg-gray-600', arrow: 'text-gray-600' },
];

export default function Dashboard() {
  const {
    setModule, setSelectedPoolId, settings, toast, facility, licence, setUiMode,
  } = useAppStore();
  const [pools, setPools] = useState([]);
  const [latestTests, setLatestTests] = useState([]);
  const [workSummary, setWorkSummary] = useState({});
  const [todayTests, setTodayTests] = useState([]);
  const [steamToday, setSteamToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [testModal, setTestModal] = useState(false);
  const [testPool, setTestPool] = useState(null);
  const [steamModal, setSteamModal] = useState(false);

  const facilityName = settings.facility_name || facility?.name || 'Aquatic Centre';

  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    Promise.all([
      dbQuery('pools:list', { facility_id: facility?.id }),
      dbQuery('tests:latest_per_pool', { facility_id: facility?.id }),
      dbQuery('reports:workorder_summary'),
      dbQuery('tests:list', { from_date: today, limit: 500 }),
      dbQuery('steamchecks:list', { limit: 200 }),
    ])
      .then(([p, t, ws, todayList, steamList]) => {
        setPools(p || []);
        setLatestTests(t || []);
        setWorkSummary(ws || {});
        setTodayTests((todayList || []).filter((x) => x.test_type === 'routine'));
        setSteamToday((steamList || []).filter((c) => c.check_date === today).length);
      })
      .catch(() => toast('Failed to load dashboard', 'error'))
      .finally(() => setLoading(false));
  }, [facility?.id, toast]);

  const isEnabled = (settingKey) => {
    if (settingKey === 'profile') return true;
    const mod = MODULE_REGISTRY.find((m) => m.settingKey === settingKey || m.id === settingKey);
    if (mod) return isModuleAccessible(mod, settings, licence);
    return settings[settingKey] !== '0';
  };

  const visibleModules = useMemo(
    () => MODULE_CARD_DEFS.filter((m) => isEnabled(m.key)),
    [settings, licence],
  );

  const waterPools = pools.filter((p) => isWaterTestPool(p.type));
  const steamRoomPools = pools.filter((p) => p.type === 'steam_room' || p.type === 'sauna');
  const hasSteamRoom = steamRoomPools.length > 0;

  const getLatestTest = (poolId) => latestTests.find((t) => t.pool_id === poolId && t.test_type === 'routine');

  const compliantCount = todayTests.filter((t) => t.is_compliant === 1 || t.is_compliant === true).length;
  const nonCompliantCount = todayTests.filter((t) => t.is_compliant === 0 || t.is_compliant === false).length;
  const openWorkOrders = (workSummary.open || 0) + (workSummary.in_progress || 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Droplets className="w-12 h-12 text-cyan-500" />
          <p className="text-gray-500">Loading facility data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="-m-4 md:-m-6 lg:-m-8 min-h-full bg-gradient-to-br from-gray-50 via-cyan-50/20 to-gray-50">
      <div className="p-4 md:p-6 lg:p-8">
        <PhoneSetupBanner />

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-100 rounded-xl">
                <Droplets className="w-8 h-8 text-cyan-600" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-500">{facilityName}</p>
              </div>
            </div>
            <p className="text-sm text-gray-500 hidden md:block">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid gap-4 mb-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <QuickAction
            border="border-cyan-200"
            gradient="from-cyan-50 to-white"
            iconBg="bg-cyan-600"
            icon={Droplets}
            arrowColor="text-cyan-600"
            title="Perform Pool Test"
            subtitle="Daily water quality test"
            onClick={() => { setTestPool(null); setTestModal(true); }}
          />
          <QuickAction
            border="border-indigo-200"
            gradient="from-indigo-50 to-white"
            iconBg="bg-indigo-600"
            icon={Beaker}
            arrowColor="text-indigo-600"
            title="Water Balance Test"
            subtitle="Weekly chemical balance"
            onClick={() => setModule('pools')}
          />
          {isEnabled('show_work_orders') && (
            <QuickAction
              border="border-purple-200"
              gradient="from-purple-50 to-white"
              iconBg="bg-purple-600"
              icon={Wrench}
              arrowColor="text-purple-600"
              title="Lodge Work Order"
              subtitle="Create maintenance request"
              onClick={() => setModule('workorders')}
            />
          )}
          <QuickAction
            border="border-red-200"
            gradient="from-red-50 to-white"
            iconBg="bg-red-600"
            icon={AlertTriangle}
            arrowColor="text-red-600"
            title="Log Pool Closure"
            subtitle="Record code or maintenance closure"
            onClick={() => setModule('closures')}
          />
          {hasSteamRoom && (
            <QuickAction
              border="border-amber-200"
              gradient="from-amber-50 to-white"
              iconBg="bg-amber-500"
              icon={Thermometer}
              arrowColor="text-amber-500"
              title="Steam Room Check"
              subtitle="Quick steam / sauna entry"
              onClick={() => setSteamModal(true)}
            />
          )}
          {hasSteamRoom && (
            <QuickAction
              border="border-orange-200"
              gradient="from-orange-50 to-white"
              iconBg="bg-orange-500"
              icon={Thermometer}
              arrowColor="text-orange-500"
              title="Steam Room Tablet"
              subtitle="Full-screen tablet mode"
              onClick={() => {
                setUiMode('steam-tablet');
                window.location.hash = '#steam-tablet';
              }}
            />
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <MiniStat icon={Activity} iconBg="bg-cyan-100" iconColor="text-cyan-600" value={todayTests.length} label="Tests Today" />
          <MiniStat icon={CheckCircle2} iconBg="bg-emerald-100" iconColor="text-emerald-600" value={compliantCount} label="Compliant" />
          <MiniStat icon={XCircle} iconBg="bg-red-100" iconColor="text-red-600" value={nonCompliantCount} label="Non-Compliant" />
          {isEnabled('show_work_orders') && (
            <MiniStat icon={ClipboardList} iconBg="bg-violet-100" iconColor="text-violet-600" value={openWorkOrders} label="Open Orders" />
          )}
          <MiniStat icon={Thermometer} iconBg="bg-orange-100" iconColor="text-orange-600" value={steamToday} label="Steam Checks" />
        </div>

        {/* Pool status */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Current Pool Status</h2>
            <Btn variant="secondary" size="sm" onClick={() => setModule('pools')}>
              Manage Pools
              <ArrowRight className="w-4 h-4" />
            </Btn>
          </div>

          {waterPools.length === 0 ? (
            <Card className="border-dashed border-2 text-center py-12">
              <Droplets className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Pools Added Yet</h3>
              <p className="text-gray-500 mb-4">Add your pools to start tracking water quality</p>
              <Btn onClick={() => setModule('pools')}>
                <Plus className="w-4 h-4" />
                Add Pools
              </Btn>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {waterPools.map((pool) => (
                <PoolCard
                  key={pool.id}
                  pool={pool}
                  latestTest={getLatestTest(pool.id)}
                  onAddTest={(p) => { setTestPool(p); setTestModal(true); }}
                  onViewHistory={(p) => { setSelectedPoolId(p.id); setModule('poolhistory'); }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Module cards */}
        {visibleModules.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Modules</h2>
            <ModuleCards modules={visibleModules} onSelect={setModule} />
          </div>
        )}
      </div>

      <TestEntryModal
        open={testModal}
        onClose={() => { setTestModal(false); setTestPool(null); }}
        pool={testPool}
        pools={waterPools}
        onSaved={() => {
          dbQuery('tests:latest_per_pool').then(setLatestTests);
          const today = format(new Date(), 'yyyy-MM-dd');
          dbQuery('tests:list', { from_date: today, limit: 500 }).then((list) => {
            setTodayTests((list || []).filter((x) => x.test_type === 'routine'));
          });
        }}
      />
      <SteamCheckModal open={steamModal} onClose={() => setSteamModal(false)} pools={pools} />
    </div>
  );
}

function QuickAction({ border, gradient, iconBg, icon: Icon, arrowColor, title, subtitle, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-2 ${border} bg-gradient-to-br ${gradient} hover:shadow-lg transition-shadow rounded-xl text-left w-full`}
    >
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`p-3 ${iconBg} rounded-xl`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500">{subtitle}</p>
          </div>
        </div>
        <ArrowRight className={`w-5 h-5 ${arrowColor}`} />
      </div>
    </button>
  );
}

function MiniStat({ icon: Icon, iconBg, iconColor, value, label }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 ${iconBg} rounded-lg`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
