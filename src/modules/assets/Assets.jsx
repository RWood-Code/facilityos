import React, { useState, useEffect } from 'react';
import { dbQuery } from '../../hooks/useDb';
import { useAppStore } from '../../store/appStore';
import { PageHeader, StatusBadge, PriorityBadge, Btn, Modal, Field, Input, Select, Textarea, Spinner, Empty, TabBar } from '../../components/ui';

const ASSET_TYPES = ['pool_equipment','gym_equipment','hvac','electrical','plumbing','safety_equipment','stadium_equipment','other'];
const TYPE_LABELS = { pool_equipment:'Pool Equipment', gym_equipment:'Gym Equipment', hvac:'HVAC', electrical:'Electrical', plumbing:'Plumbing', safety_equipment:'Safety Equipment', stadium_equipment:'Stadium Equipment', other:'Other' };
const TYPE_ICONS = { pool_equipment:'🏊', gym_equipment:'💪', hvac:'🌀', electrical:'⚡', plumbing:'🔧', safety_equipment:'🦺', stadium_equipment:'🏟', other:'📦' };
const STATUS_LABELS = { operational:'Operational', needs_maintenance:'Needs Maintenance', down:'Down', retired:'Retired' };

function AssetForm({ asset, onClose, onSaved }) {
  const { toast } = useAppStore();
  const [form, setForm] = useState(asset || { name:'', asset_type:'pool_equipment', category:'', location:'', manufacturer:'', model_number:'', serial_number:'', purchase_date:'', purchase_cost:'', warranty_expiry:'', status:'operational', notes:'' });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  async function save() {
    if (!form.name||!form.location) { toast('Name and location required','warn'); return; }
    setSaving(true);
    try {
      if (asset?.id) await dbQuery('assets:update', { id: asset.id, ...form });
      else await dbQuery('assets:create', form);
      toast(asset ? 'Asset updated' : 'Asset created');
      onSaved();
    } catch(e) { toast('Save failed','error'); }
    finally { setSaving(false); }
  }
  return (
    <Modal title={asset ? 'Edit Asset' : 'Add Asset'} onClose={onClose} size="lg">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Field label="Asset Name" required><Input value={form.name} onChange={e=>set('name',e.target.value)} /></Field></div>
        <Field label="Type"><Select value={form.asset_type} onChange={e=>set('asset_type',e.target.value)}>{ASSET_TYPES.map(t=><option key={t} value={t}>{TYPE_LABELS[t]}</option>)}</Select></Field>
        <Field label="Category" hint="e.g. Pump, Filter, Treadmill"><Input value={form.category||''} onChange={e=>set('category',e.target.value)} /></Field>
        <Field label="Location" required><Input value={form.location} onChange={e=>set('location',e.target.value)} /></Field>
        <Field label="Status"><Select value={form.status} onChange={e=>set('status',e.target.value)}>{Object.entries(STATUS_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}</Select></Field>
        <Field label="Manufacturer"><Input value={form.manufacturer||''} onChange={e=>set('manufacturer',e.target.value)} /></Field>
        <Field label="Model Number"><Input value={form.model_number||''} onChange={e=>set('model_number',e.target.value)} /></Field>
        <Field label="Serial Number"><Input value={form.serial_number||''} onChange={e=>set('serial_number',e.target.value)} /></Field>
        <Field label="Purchase Date"><Input type="date" value={form.purchase_date||''} onChange={e=>set('purchase_date',e.target.value)} /></Field>
        <Field label="Purchase Cost ($)"><Input type="number" value={form.purchase_cost||''} onChange={e=>set('purchase_cost',e.target.value)} /></Field>
        <Field label="Warranty Expiry"><Input type="date" value={form.warranty_expiry||''} onChange={e=>set('warranty_expiry',e.target.value)} /></Field>
      </div>
      <Field label="Notes"><Textarea rows={2} value={form.notes||''} onChange={e=>set('notes',e.target.value)} /></Field>
      <div className="flex justify-end gap-2 mt-2">
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn disabled={saving} onClick={save}>{saving?'Saving…':asset?'Save Changes':'Add Asset'}</Btn>
      </div>
    </Modal>
  );
}

export default function Assets() {
  const { toast } = useAppStore();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editAsset, setEditAsset] = useState(null);

  const load = () => { setLoading(true); dbQuery('assets:list').then(a=>{ setAssets(a||[]); setLoading(false); }); };
  useEffect(load, []);

  const filtered = assets.filter(a => {
    const qs = !search || `${a.name} ${a.location} ${a.category||''}`.toLowerCase().includes(search.toLowerCase());
    const qt = filterType==='all' || a.asset_type===filterType;
    const qst = filterStatus==='all' || a.status===filterStatus;
    return qs && qt && qst;
  });

  const needsMaint = assets.filter(a=>a.status==='needs_maintenance').length;
  const down = assets.filter(a=>a.status==='down').length;

  return (
    <div>
      <PageHeader title="Assets" subtitle="Equipment register and condition tracking"
        actions={<Btn onClick={()=>{setEditAsset(null);setFormOpen(true);}}>+ Add Asset</Btn>} />

      <div className="grid grid-cols-4 gap-4 mb-5">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-emerald-700">{assets.filter(a=>a.status==='operational').length}</div><div className="text-xs text-emerald-600">Operational</div></div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-amber-700">{needsMaint}</div><div className="text-xs text-amber-600">Needs Maintenance</div></div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-red-700">{down}</div><div className="text-xs text-red-600">Down</div></div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-gray-700">{assets.length}</div><div className="text-xs text-gray-600">Total Assets</div></div>
      </div>

      <div className="flex gap-3 mb-4">
        <input value={search} onChange={e=>setSearch(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-500 flex-1" placeholder="🔍  Search assets…" />
        <select value={filterType} onChange={e=>setFilterType(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none bg-white">
          <option value="all">All types</option>
          {ASSET_TYPES.map(t=><option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
        </select>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none bg-white">
          <option value="all">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {loading ? <Spinner /> : filtered.length===0 ? <Empty icon="⚙" title="No assets found" /> : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead><tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider">
              <th className="text-left px-5 py-3">Asset</th><th className="text-left px-5 py-3">Type</th><th className="text-left px-5 py-3">Location</th><th className="text-left px-5 py-3">Status</th><th className="text-left px-5 py-3">Manufacturer</th><th className="px-5 py-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{TYPE_ICONS[a.asset_type]||'📦'}</span>
                      <div><div className="font-medium text-gray-900">{a.name}</div>{a.category&&<div className="text-xs text-gray-400">{a.category}</div>}</div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600">{TYPE_LABELS[a.asset_type]}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{a.location}</td>
                  <td className="px-5 py-3"><StatusBadge status={a.status} /></td>
                  <td className="px-5 py-3 text-sm text-gray-500">{a.manufacturer||'—'}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1">
                      <Btn variant="ghost" size="sm" onClick={()=>{setEditAsset(a);setFormOpen(true);}}>Edit</Btn>
                      <Btn variant="ghost" size="sm" onClick={async()=>{if(confirm('Retire asset?')){await dbQuery('assets:retire',a.id);toast('Asset retired');load();}}}>Retire</Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {formOpen && <AssetForm asset={editAsset} onClose={()=>{setFormOpen(false);setEditAsset(null);}} onSaved={()=>{setFormOpen(false);setEditAsset(null);load();}} />}
    </div>
  );
}
