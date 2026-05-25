import React, { useState, useEffect } from 'react';
import { dbQuery } from '../../hooks/useDb';
import { useAppStore } from '../../store/appStore';
import { PageHeader, Btn, Modal, Field, Input, Select, Textarea, Spinner, Empty } from '../../components/ui';
import { format, parseISO, isPast, isToday } from 'date-fns';

const FREQUENCIES = ['daily','weekly','monthly','quarterly','semi_annual','annual'];
const FREQ_LABELS = { daily:'Daily', weekly:'Weekly', monthly:'Monthly', quarterly:'Quarterly', semi_annual:'Semi-Annual', annual:'Annual' };
const FREQ_COLORS = { daily:'bg-red-100 text-red-700', weekly:'bg-orange-100 text-orange-700', monthly:'bg-blue-100 text-blue-700', quarterly:'bg-purple-100 text-purple-700', semi_annual:'bg-teal-100 text-teal-700', annual:'bg-gray-100 text-gray-600' };

function ScheduleForm({ schedule, assets, onClose, onSaved }) {
  const { toast } = useAppStore();
  const [form, setForm] = useState(schedule || { task_name:'', description:'', frequency:'monthly', asset_id:'', assigned_to:'', estimated_hours:'', estimated_cost:'', category:'', next_due:'', is_active:1 });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  async function save() {
    if (!form.task_name) { toast('Task name required','warn'); return; }
    setSaving(true);
    try {
      if (schedule?.id) await dbQuery('schedules:update', { id: schedule.id, ...form });
      else await dbQuery('schedules:create', form);
      toast(schedule ? 'Schedule updated' : 'Schedule created');
      onSaved();
    } catch(e) { toast('Save failed','error'); }
    finally { setSaving(false); }
  }
  return (
    <Modal title={schedule ? 'Edit Schedule' : 'New Maintenance Schedule'} onClose={onClose}>
      <Field label="Task Name" required><Input value={form.task_name} onChange={e=>set('task_name',e.target.value)} /></Field>
      <Field label="Description"><Textarea rows={2} value={form.description||''} onChange={e=>set('description',e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Frequency"><Select value={form.frequency} onChange={e=>set('frequency',e.target.value)}>{FREQUENCIES.map(f=><option key={f} value={f}>{FREQ_LABELS[f]}</option>)}</Select></Field>
        <Field label="Asset"><Select value={form.asset_id||''} onChange={e=>set('asset_id',e.target.value)}><option value="">No specific asset</option>{(assets||[]).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
        <Field label="Assigned To"><Input value={form.assigned_to||''} onChange={e=>set('assigned_to',e.target.value)} /></Field>
        <Field label="Category"><Input value={form.category||''} onChange={e=>set('category',e.target.value)} placeholder="e.g. Pool Equipment, Gym…" /></Field>
        <Field label="Est. Hours"><Input type="number" value={form.estimated_hours||''} onChange={e=>set('estimated_hours',e.target.value)} /></Field>
        <Field label="Next Due"><Input type="date" value={form.next_due||''} onChange={e=>set('next_due',e.target.value)} /></Field>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn disabled={saving} onClick={save}>{saving?'Saving…':schedule?'Save Changes':'Create Schedule'}</Btn>
      </div>
    </Modal>
  );
}

export default function Schedules() {
  const { toast } = useAppStore();
  const [schedules, setSchedules] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editSched, setEditSched] = useState(null);

  const load = () => { setLoading(true); Promise.all([dbQuery('schedules:list',{is_active:true}),dbQuery('assets:list')]).then(([s,a])=>{ setSchedules(s||[]); setAssets(a||[]); setLoading(false); }); };
  useEffect(load, []);

  async function markComplete(sched) {
    await dbQuery('schedules:complete', { id: sched.id, completed_date: new Date().toISOString().slice(0,10) });
    toast('Marked complete — next due date updated');
    load();
  }

  const isDue = (s) => s.next_due && (isPast(parseISO(s.next_due)) || isToday(parseISO(s.next_due)));

  return (
    <div>
      <PageHeader title="Maintenance Schedules" subtitle="Recurring maintenance tasks and compliance scheduling"
        actions={<Btn onClick={()=>{setEditSched(null);setFormOpen(true);}}>+ New Schedule</Btn>} />

      {loading ? <Spinner /> : schedules.length===0 ? <Empty icon="📅" title="No schedules" desc="Create maintenance schedules to track recurring tasks" /> : (
        <div className="space-y-3">
          {schedules.map(s => {
            const due = isDue(s);
            return (
              <div key={s.id} className={"bg-white rounded-xl border shadow-sm p-4 "+(due?'border-red-200':'border-gray-200')}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-gray-900">{s.task_name}</span>
                      <span className={"px-2 py-0.5 rounded-full text-xs font-medium "+(FREQ_COLORS[s.frequency]||'bg-gray-100 text-gray-600')}>{FREQ_LABELS[s.frequency]}</span>
                      {due && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">⚠ Due{isToday(parseISO(s.next_due))?' today':' '+s.next_due}</span>}
                    </div>
                    {s.description && <div className="text-sm text-gray-600 mb-1">{s.description}</div>}
                    <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                      {s.asset_name && <span>⚙ {s.asset_name}</span>}
                      {s.assigned_to && <span>👤 {s.assigned_to}</span>}
                      {s.next_due && <span>📅 Next due: {s.next_due}</span>}
                      {s.last_completed && <span>✓ Last done: {s.last_completed}</span>}
                      {s.estimated_hours && <span>⏱ {s.estimated_hours}h</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Btn variant="ghost" size="sm" onClick={()=>{setEditSched(s);setFormOpen(true);}}>Edit</Btn>
                    <Btn variant="success" size="sm" onClick={()=>markComplete(s)}>✓ Done</Btn>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {formOpen && <ScheduleForm schedule={editSched} assets={assets} onClose={()=>{setFormOpen(false);setEditSched(null);}} onSaved={()=>{setFormOpen(false);setEditSched(null);load();}} />}
    </div>
  );
}
