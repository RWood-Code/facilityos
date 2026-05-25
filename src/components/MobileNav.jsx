import React from 'react';

export default function MobileNav({ items, currentModule, onSelect, onMore }) {
  const slots = items.slice(0, 4);
  const hasMore = items.length > 4 || onMore;

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-gray-200 safe-area-bottom"
      aria-label="Mobile navigation"
    >
      <div className="flex items-stretch justify-around min-h-[56px]">
        {slots.map((item) => {
          const active = currentModule === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-w-0 min-h-[56px] transition-colors
                ${active ? 'text-cyan-600' : 'text-gray-500 active:text-gray-700'}`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="text-[10px] font-medium truncate max-w-full px-1">{item.shortLabel || item.label}</span>
            </button>
          );
        })}
        {hasMore && (
          <button
            type="button"
            onClick={onMore}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-gray-500"
          >
            <span className="text-lg leading-none">☰</span>
            <span className="text-[10px] font-medium">More</span>
          </button>
        )}
      </div>
    </nav>
  );
}
