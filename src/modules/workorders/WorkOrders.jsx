import React, { useState, useEffect } from 'react';
import { dbQuery } from '../../hooks/useDb';
import { useAppStore } from '../../store/appStore';
import { PageHeader, StatusBadge, PriorityBadge, Btn, Modal, Field, Input, Select, Textarea, Spinner, Empty, TabBar } from '../../components/ui';
import { format } from 'date-fns';

const PRIORITIES = ['low','medium','high','urgent'];
const STATUSES = ['open','in_progress','on_hold','completed','cancelled'];

function WorkOrderForm({ wo, assets, onClose, onSaved }) {
  const { toast } = useAppStore();
  const [form, setForm] = useState(wo || { title:'', description:'', location:'', priority:'medium', status:'open', assigned_to:'', asset_id:'', due_date:'', estimated_hours:'', parts_cost:'', labor_cost:'', completion_notes:'' });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  async function save() {
    if (!form.title||!form.location) { toast('Title and location required','warn'); return; }
    setSaving(true);
    try {
      if (wo?.id) await dbQuery('workorders:update', { id: wo.id, ...form });
      else await dbQuery('workorders:create', form);
      toast(wo ? 'Work order updated' : 'Work order created');
      onSaved();
    } catch(e) { toast('Save failed','error'); }
    finally { setSaving(false); }
  }
  return (
    <Modal title={wo ? 'Edit Work Order' : 'New Work Order'} onClose={onClose} size="lg">
      <Field label="Title" required><Input value={form.title} onChange={e=>set('title',e.target.value)} /></Field>
      <Field label="Description"><Textarea rows={2} value={form.description||''} onChange={e=>set('description',e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Location" required><Input value={form.location} onChange={e=>set('location',e.target.value)} /></Field>
        <Field label="Asset"><Select value={form.asset_id||''} onChange={e=>set('asset_id',e.target.value)}><option value="">No specific asset</option>{(assets||[]).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
        <Field label="Priority"><Select value={form.priority} onChange={e=>set('priority',e.target.value)}>{PRIORITIES.map(p=><option key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}</Select></Field>
        <Field label="Status"><Select value={form.status} onChange={e=>set('status',e.target.value)}>{STATUSES.map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}</Select></Field>
        <Field label="Assigned To"><Input value={form.assigned_to||''} onChange={e=>set('assigned_to',e.target.value)} /></Field>
        <Field label="Due Date"><Input type="date" value={form.due_date||''} onChange={e=>set('due_date',e.target.value)} /></Field>
        <Field label="Est. Hours"><Input type="number" value={form.estimated_hours||''} onChange={e=>set('estimated_hours',e.target.value)} /></Field>
        <Field label="Parts Cost ($)"><Input type="number" value={form.parts_cost||''} onChange={e=>set('parts_cost',e.target.value)} /></Field>
      </div>
      {(form.status==='completed'||wo?.status==='completed') && <Field label="Completion Notes"><Textarea rows={2} value={form.completion_notes||''} onChange={e=>set('completion_notes',e.target.value)} /></Field>}
      <div className="flex justify-end gap-2 mt-4">
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn disabled={saving} onClick={save}>{saving?'Saving…':wo?'Save Changes':'Create Work Order'}</Btn>
      </div>
    </Modal>
  );
}

export default function WorkOrders() {
  const { toast } = useAppStore();
  const [workOrders, setWorkOrders] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('open');
  const [formOpen, setFormOpen] = useState(false);
  const [editWO, setEditWO] = useState(null);

  const load = () => { setLoading(true); Promise.all([dbQuery('workorders:list'),dbQuery('assets:list')]).then(([w,a])=>{ setWorkOrders(w||[]); setAssets(a||[]); setLoading(false); }); };
  useEffect(load, []);

  const filtered = workOrders.filter(w => tab==='all' || (tab==='active'?(w.status==='open'||w.status==='in_progress'):w.status===tab));

  const PRIORITY_COLORS = { urgent:'border-l-red-500', high:'border-l-orange-400', medium:'border-l-amber-400', low:'border-l-gray-300' };

  return (
    <div>
      <PageHeader title="Work Orders" subtitle="Maintenance requests and task tracking"
        actions={<Btn onClick={()=>{setEditWO(null);setFormOpen(true);}}>+ New Work Order</Btn>} />

      <TabBar tabs={[{value:'active',label:'Active'},{value:'open',label:'Open'},{value:'in_progress',label:'In Progress'},{value:'on_hold',label:'On Hold'},{value:'completed',label:'Completed'},{value:'all',label:'All'}]} active={tab} onChange={setTab} />

      {loading ? <Spinner /> : filtered.length===0 ? <Empty icon="📋" title="No work orders" desc="All clear in this category" /> : (
        <div className="space-y-3">
          {filtered.map(wo => (
            <div key={wo.id} className={"bg-white rounded-xl border border-l-4 border-gray-200 shadow-sm p-4 "+(PRIORITY_COLORS[wo.priority]||'border-l-gray-300')}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">{wo.title}</span>
                    <PriorityBadge priority={wo.priority} />
                    <StatusBadge status={wo.status} />
                  </div>
                  <div className="text-sm text-gray-500">{wo.location}{wo.asset_name&&` · ${wo.asset_name}`}</div>
                  {wo.description && <div className="text-sm text-gray-600 mt-1 line-clamp-2">{wo.description}</div>}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    {wo.assigned_to && <span>👤 {wo.assigned_to}</span>}
                    {wo.due_date && <span>📅 Due {wo.due_date}</span>}
                    {wo.estimated_hours && <span>⏱ {wo.estimated_hours}h est.</span>}
                    <span>Created {format(new Date(wo.created_at),'dd MMM')}</span>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Btn variant="ghost" size="sm" onClick={()=>{setEditWO(wo);setFormOpen(true);}}>Edit</Btn>
                  {wo.status!=='completed' && <Btn variant="success" size="sm" onClick={async()=>{ await dbQuery('workorders:update',{id:wo.id,status:'completed',completed_date:new Date().toISOString().slice(0,10)}); toast('Work order completed'); load(); }}>Complete</Btn>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {formOpen && <WorkOrderForm wo={editWO} assets={assets} onClose={()=>{setFormOpen(false);setEditWO(null);}} onSaved={()=>{setFormOpen(false);setEditWO(null);load();}} />}
    </div>
  );
}
