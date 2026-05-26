import React from 'react';

/**
 * Grouped module picker — replaces the legacy sidebar (desktop dropdown + mobile drawer).
 */
export default function ModulesMenu({ open, onClose, nav, currentModule, onSelect }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close menu"
        onClick={onClose}
      />
      <aside className="relative ml-auto w-full max-w-sm h-full bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-semibold text-gray-900">Modules</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg text-gray-500 hover:bg-gray-100 flex items-center justify-center"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          {nav.map((group) => (
            <div key={group.section} className="mb-4">
              <div className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {group.section}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelect(item.id);
                      onClose();
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left min-h-[44px] transition-colors
                      ${currentModule === item.id
                        ? 'bg-cyan-50 text-cyan-800 font-medium border border-cyan-200'
                        : 'text-gray-700 hover:bg-gray-50'
                      }`}
                  >
                    <span className="w-6 text-center text-base flex-shrink-0">{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-semibold">
                        {item.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </div>
  );
}
