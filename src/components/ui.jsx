import React from 'react';

export function Toasts({ toasts }) {
  return (
    <div className="fixed bottom-24 lg:bottom-5 right-4 lg:right-5 flex flex-col gap-2 z-50 pointer-events-none safe-area-bottom">
      {toasts.map(t => (
        <div key={t.id} className={"flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm border min-w-[240px] max-w-sm pointer-events-auto " +
          (t.type==='error' ? 'bg-red-50 border-red-200 text-red-800' : t.type==='warn' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800')}>
          <span>{t.type==='error'?'✗':t.type==='warn'?'⚠':'✓'}</span>
          <span className="flex-1">{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

export function Modal({ title, children, onClose, size='md' }) {
  const w = {sm:'max-w-sm',md:'max-w-lg',lg:'max-w-2xl',xl:'max-w-4xl'}[size];
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className={"bg-white rounded-2xl shadow-2xl w-full "+w+" max-h-[90vh] flex flex-col"} onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-lg">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, badge }) {
  return (
    <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          {badge && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">{badge}</span>}
        </div>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, delta, accent='cyan', icon }) {
  const borders = {cyan:'border-t-cyan-500',emerald:'border-t-emerald-500',amber:'border-t-amber-500',red:'border-t-red-500',purple:'border-t-purple-500',blue:'border-t-blue-500'};
  return (
    <div className={"bg-white rounded-xl border border-gray-200 p-4 border-t-2 shadow-sm "+borders[accent]}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900 leading-none">{value ?? '—'}</p>
          {delta && <p className="text-xs text-gray-500 mt-1">{delta}</p>}
        </div>
        {icon && <span className="text-2xl opacity-20">{icon}</span>}
      </div>
    </div>
  );
}

export function ComplianceBadge({ compliant }) {
  if (compliant===null||compliant===undefined) return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">No data</span>;
  return compliant
    ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">✓ Compliant</span>
    : <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">✗ Non-compliant</span>;
}

export function PriorityBadge({ priority }) {
  const m = {urgent:'bg-red-100 text-red-700',high:'bg-orange-100 text-orange-700',medium:'bg-amber-100 text-amber-700',low:'bg-gray-100 text-gray-600'};
  return <span className={"inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize "+(m[priority]||m.medium)}>{priority}</span>;
}

export function StatusBadge({ status }) {
  const m = {open:'bg-blue-100 text-blue-700',in_progress:'bg-amber-100 text-amber-700',on_hold:'bg-gray-100 text-gray-600',completed:'bg-emerald-100 text-emerald-700',cancelled:'bg-red-100 text-red-400',operational:'bg-emerald-100 text-emerald-700',needs_maintenance:'bg-amber-100 text-amber-700',down:'bg-red-100 text-red-700',retired:'bg-gray-100 text-gray-400',active:'bg-emerald-100 text-emerald-700',inactive:'bg-gray-100 text-gray-400',on_leave:'bg-amber-100 text-amber-700'};
  return <span className={"inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize "+(m[status]||'bg-gray-100 text-gray-500')}>{status?.replace(/_/g,' ')}</span>;
}

export function Empty({ icon='📭', title, desc, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-5xl mb-4 opacity-30">{icon}</span>
      <h3 className="text-sm font-semibold text-gray-700 mb-1">{title}</h3>
      {desc && <p className="text-xs text-gray-500 max-w-xs mb-4">{desc}</p>}
      {action}
    </div>
  );
}

export function Spinner() {
  return <div className="flex items-center justify-center py-16"><div className="w-7 h-7 border-2 border-gray-200 border-t-cyan-600 rounded-full animate-spin" /></div>;
}

export function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-5">
      {tabs.map(t => (
        <button key={t.value} onClick={()=>onChange(t.value)}
          className={"px-4 py-1.5 rounded-lg text-sm font-medium transition-all "+(active===t.value?'bg-white text-gray-900 shadow-sm':'text-gray-500 hover:text-gray-700')}>
          {t.label}
          {t.badge!=null && <span className="ml-1.5 bg-cyan-600 text-white text-xs px-1.5 rounded-full">{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, required, children, hint }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}{required&&<span className="text-red-500 ml-0.5">*</span>}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

export function Input({ className='', ...props }) {
  return <input className={"w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 "+className} {...props} />;
}

export function Select({ children, className='', ...props }) {
  return <select className={"w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 bg-white "+className} {...props}>{children}</select>;
}

export function Textarea({ className='', ...props }) {
  return <textarea className={"w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 resize-none "+className} {...props} />;
}

export function Btn({ variant='primary', size='md', children, className='', ...props }) {
  const base = 'inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-all cursor-pointer border-0 disabled:opacity-50 disabled:cursor-not-allowed';
  const v = {primary:'bg-cyan-600 hover:bg-cyan-700 text-white',secondary:'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300',danger:'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200',success:'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200',ghost:'bg-transparent hover:bg-gray-100 text-gray-600'};
  const s = {sm:'text-xs px-3 py-1.5',md:'text-sm px-4 py-2',lg:'text-sm px-5 py-2.5'};
  return <button className={`${base} ${v[variant]} ${s[size]} ${className}`} {...props}>{children}</button>;
}

export function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200/80 shadow-sm p-5 ${className}`}>
      {children}
    </div>
  );
}

export function ParamRow({ label, value, unit, compliant }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-900">{value!=null?`${value}${unit?' '+unit:''}`:'-'}</span>
        {compliant===true && <span className="text-emerald-500 text-xs">✓</span>}
        {compliant===false && <span className="text-red-500 text-xs">✗</span>}
      </div>
    </div>
  );
}
