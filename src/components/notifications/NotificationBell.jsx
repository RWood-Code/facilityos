import React, { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { dbQuery } from '../../hooks/useDb';
import { cn } from '../../lib/utils';

export default function NotificationBell({ onNavigate, onSelectPool }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const panelRef = useRef(null);

  async function load() {
    try {
      const [list, count] = await Promise.all([
        dbQuery('notifications:list', { limit: 20 }),
        dbQuery('notifications:unread_count'),
      ]);
      setItems(list || []);
      setUnread(count?.count || 0);
    } catch {
      setItems([]);
      setUnread(0);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  async function markRead(ids) {
    await dbQuery('notifications:mark_read', { ids });
    load();
  }

  async function markAllRead() {
    await dbQuery('notifications:mark_read', { all: true });
    load();
  }

  function handleClick(n) {
    markRead([n.id]);
    setOpen(false);
    if (n.link_module === 'poolhistory' && n.related_id) {
      onSelectPool?.(n.related_id);
    } else if (n.link_module && onNavigate) {
      onNavigate(n.link_module);
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-cyan-600 hover:bg-gray-50 transition-colors"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-xl border border-gray-200 shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">Notifications</span>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="text-xs text-cyan-600 hover:text-cyan-700 flex items-center gap-1">
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">No notifications</div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleClick(n)}
                  className={cn(
                    'w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors',
                    !n.is_read && 'bg-cyan-50/50',
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-cyan-500 mt-1.5 flex-shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{n.title}</p>
                      {n.message && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>}
                      <p className="text-[10px] text-gray-400 mt-1">
                        {n.created_at ? format(parseISO(n.created_at.replace(' ', 'T')), 'd MMM, h:mm a') : ''}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
