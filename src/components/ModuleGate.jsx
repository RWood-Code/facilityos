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
    return null;
  }

  return children;
}
