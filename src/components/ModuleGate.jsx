import React, { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { MODULE_REGISTRY } from '../config/modules';
import { isModuleAccessible, getModuleBlockReason } from '../utils/moduleAccess';

export default function ModuleGate({ moduleId, children }) {
  const { settings, licence, setModule, toast } = useAppStore();
  const mod = MODULE_REGISTRY.find((m) => m.id === moduleId) || MODULE_REGISTRY[0];

  useEffect(() => {
    if (!isModuleAccessible(mod, settings, licence)) {
      const reason = getModuleBlockReason(mod, settings, licence);
      toast(reason || 'This module is not available', 'warn');
      setModule('dashboard');
    }
  }, [moduleId, settings, licence]);

  if (!isModuleAccessible(mod, settings, licence)) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        This section is not available on your current plan or settings.
      </div>
    );
  }

  return children;
}
