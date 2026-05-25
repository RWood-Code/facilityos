import Dashboard from '../modules/dashboard/Dashboard';
import Pools from '../modules/pools/Pools';
import Staff from '../modules/staff/Staff';
import Assets from '../modules/assets/Assets';
import WorkOrders from '../modules/workorders/WorkOrders';
import Schedules from '../modules/schedules/Schedules';
import Reports from '../modules/reports/Reports';
import Settings from '../modules/settings/Settings';
import Rostering from '../modules/rostering/Rostering';
import Dosing from '../modules/dosing/Dosing';
import SteamRoom from '../modules/steam/SteamRoom';
import Closures from '../modules/closures/Closures';
import Profile from '../modules/profile/Profile';

export const MODULE_REGISTRY = [
  { id: 'dashboard', label: 'Dashboard', icon: '⊞', section: 'Overview', component: Dashboard, alwaysOn: true },
  { id: 'pools', label: 'Pool Management', icon: '🏊', section: 'Operations', component: Pools, settingKey: 'show_pools' },
  { id: 'dosing', label: 'Dosing Calculator', icon: '🧪', section: 'Operations', component: Dosing, settingKey: 'show_dosing' },
  { id: 'closures', label: 'Pool Closures', icon: '🚫', section: 'Operations', component: Closures, settingKey: 'show_closures' },
  { id: 'steam', label: 'Steam & Sauna', icon: '♨️', section: 'Operations', component: SteamRoom, settingKey: 'show_steam' },
  { id: 'workorders', label: 'Work Orders', icon: '📋', section: 'Operations', component: WorkOrders, settingKey: 'show_work_orders' },
  { id: 'schedules', label: 'Maintenance', icon: '📅', section: 'Operations', component: Schedules, settingKey: 'show_maintenance' },
  { id: 'rostering', label: 'Rostering', icon: '🗓', section: 'People & Assets', component: Rostering, settingKey: 'show_rostering', badge: 'Beta' },
  { id: 'staff', label: 'Staff', icon: '👥', section: 'People & Assets', component: Staff, settingKey: 'show_staff' },
  { id: 'assets', label: 'Assets', icon: '⚙', section: 'People & Assets', component: Assets, settingKey: 'show_assets' },
  { id: 'reports', label: 'Reports', icon: '📊', section: 'Reporting', component: Reports, settingKey: 'show_reports' },
  { id: 'profile', label: 'My Profile', icon: '👤', section: 'System', component: Profile, alwaysOn: true },
  { id: 'settings', label: 'Settings', icon: '⚙', section: 'System', component: Settings, alwaysOn: true },
];

export const MODULE_MAP = Object.fromEntries(MODULE_REGISTRY.map((m) => [m.id, m.component]));
export const MODULE_TITLES = Object.fromEntries(MODULE_REGISTRY.map((m) => [m.id, m.label]));

export function buildNavGroups(settings = {}) {
  const isEnabled = (mod) => {
    if (mod.alwaysOn) return true;
    if (!mod.settingKey) return true;
    return settings[mod.settingKey] !== '0';
  };
  const sections = [...new Set(MODULE_REGISTRY.map((m) => m.section))];
  return sections
    .map((section) => ({
      section,
      items: MODULE_REGISTRY.filter((m) => m.section === section && isEnabled(m)).map((m) => ({
        id: m.id,
        icon: m.icon,
        label: m.label,
        settingKey: m.settingKey,
        badge: m.badge,
      })),
    }))
    .filter((g) => g.items.length > 0);
}
