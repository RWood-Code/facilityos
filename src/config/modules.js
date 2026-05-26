import { lazy } from 'react';
import Dashboard from '../modules/dashboard/Dashboard';
import Pools from '../modules/pools/Pools';
import Staff from '../modules/staff/Staff';
import Assets from '../modules/assets/Assets';
import WorkOrders from '../modules/workorders/WorkOrders';
import Schedules from '../modules/schedules/Schedules';
import Reports from '../modules/reports/Reports';
import Settings from '../modules/settings/Settings';
import Dosing from '../modules/dosing/Dosing';
import SteamRoom from '../modules/steam/SteamRoom';
import Closures from '../modules/closures/Closures';
import Profile from '../modules/profile/Profile';
import PoolHistory from '../modules/poolhistory/PoolHistory';
import { isModuleAccessible } from '../utils/moduleAccess';

const ManagerDashboard = lazy(() => import('../modules/managerdashboard/ManagerDashboard'));
const Rostering = lazy(() => import('../modules/rostering/Rostering'));
const ILTPPoolSafe = lazy(() => import('../modules/iltp/ILTPPoolSafe'));

export const MODULE_REGISTRY = [
  { id: 'dashboard', label: 'Dashboard', icon: '⊞', section: 'Overview', component: Dashboard, alwaysOn: true },
  { id: 'managerdashboard', label: 'Manager View', icon: '📈', section: 'Overview', component: ManagerDashboard, settingKey: 'show_manager_dashboard', licenceKey: 'manager_dashboard', lazy: true },
  { id: 'pools', label: 'Pool Management', icon: '🏊', section: 'Operations', component: Pools, settingKey: 'show_pools', licenceKey: 'pools' },
  { id: 'poolhistory', label: 'Pool History', icon: '📈', section: 'Operations', component: PoolHistory, settingKey: 'show_pools', licenceKey: 'pools', navHidden: true },
  { id: 'dosing', label: 'Dosing Calculator', icon: '🧪', section: 'Operations', component: Dosing, settingKey: 'show_dosing', licenceKey: 'dosing' },
  { id: 'closures', label: 'Pool Closures', icon: '🚫', section: 'Operations', component: Closures, settingKey: 'show_closures', licenceKey: 'closures' },
  { id: 'steam', label: 'Steam & Sauna', icon: '♨️', section: 'Operations', component: SteamRoom, settingKey: 'show_steam', licenceKey: 'steam' },
  { id: 'workorders', label: 'Work Orders', icon: '📋', section: 'Operations', component: WorkOrders, settingKey: 'show_work_orders', licenceKey: 'workorders' },
  { id: 'schedules', label: 'Maintenance', icon: '📅', section: 'Operations', component: Schedules, settingKey: 'show_maintenance', licenceKey: 'schedules' },
  { id: 'rostering', label: 'Rostering', icon: '🗓', section: 'People & Assets', component: Rostering, settingKey: 'show_rostering', licenceKey: 'rostering', lazy: true },
  { id: 'staff', label: 'Staff', icon: '👥', section: 'People & Assets', component: Staff, settingKey: 'show_staff', licenceKey: 'staff' },
  { id: 'assets', label: 'Assets', icon: '⚙', section: 'People & Assets', component: Assets, settingKey: 'show_assets', licenceKey: 'assets' },
  { id: 'reports', label: 'Reports', icon: '📊', section: 'Reporting', component: Reports, settingKey: 'show_reports', licenceKey: 'reports' },
  { id: 'iltp', label: 'ILTP & PoolSafe', icon: '🛡', section: 'Reporting', component: ILTPPoolSafe, settingKey: 'show_iltp_poolsafe', licenceKey: 'iltp_poolsafe', lazy: true },
  { id: 'profile', label: 'My Profile', icon: '👤', section: 'System', component: Profile, alwaysOn: true },
  { id: 'settings', label: 'Settings', icon: '⚙', section: 'System', component: Settings, alwaysOn: true },
];

export const MODULE_MAP = Object.fromEntries(MODULE_REGISTRY.map((m) => [m.id, m.component]));
export const MODULE_TITLES = Object.fromEntries(MODULE_REGISTRY.map((m) => [m.id, m.label]));

export function buildNavGroups(settings = {}, licence = null) {
  return [...new Set(MODULE_REGISTRY.map((m) => m.section))]
    .map((section) => ({
      section,
      items: MODULE_REGISTRY.filter(
        (m) => m.section === section && isModuleAccessible(m, settings, licence) && !m.navHidden
      ).map((m) => ({
        id: m.id,
        icon: m.icon,
        label: m.label,
        settingKey: m.settingKey,
        badge: m.badge,
      })),
    }))
    .filter((g) => g.items.length > 0);
}

export function getModuleConfig(moduleId) {
  return MODULE_REGISTRY.find((m) => m.id === moduleId);
}

const MOBILE_NAV_IDS = ['dashboard', 'pools', 'steam', 'managerdashboard'];

const MOBILE_SHORT_LABELS = {
  dashboard: 'Home',
  pools: 'Pools',
  steam: 'Steam',
  managerdashboard: 'Manager',
  settings: 'Settings',
};

export function buildMobileNavItems(settings = {}, licence = null) {
  return MOBILE_NAV_IDS
    .map((id) => MODULE_REGISTRY.find((m) => m.id === id))
    .filter((m) => m && isModuleAccessible(m, settings, licence))
    .map((m) => ({
      id: m.id,
      icon: m.icon,
      label: m.label,
      shortLabel: MOBILE_SHORT_LABELS[m.id] || m.label.split(' ')[0],
    }));
}
