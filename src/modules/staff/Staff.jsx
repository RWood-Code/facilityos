import React, { useState, useEffect } from 'react';
import { dbQuery } from '../../hooks/useDb';
import { useAppStore } from '../../store/appStore';
import { PageHeader, StatusBadge, Btn, Modal, Field, Input, Select, Textarea, Spinner, Empty, TabBar } from '../../components/ui';
import { format, parseISO, differenceInDays } from 'date-fns';

const ROLES = ['lifeguard','supervisor','pool_technician','manager','admin_staff','other'];
const ROLE_LABELS = { lifeguard:'Lifeguard', supervisor:'Supervisor', pool_technician:'Pool Technician', manager:'Manager', admin_staff:'Admin Staff', other:'Other' };
const ROLE_COLORS = { lifeguard:'bg-cyan-100 text-cyan-700', supervisor:'bg-purple-100 text-purple-700', pool_technician:'bg-blue-100 text-blue-700', manager:'bg-amber-100 text-amber-700', admin_staff:'bg-gray-100 text-gray-700', other:'bg-gray-100 text-gray-600' };

function QualStatus({ expiry }) {
  if (!expiry) return <span className="text-xs text-gray-400">No expiry</span>;
  const days = differenceInDays(parseISO(expiry), new Date());
  if (days < 0) return <span className="text-xs font-medium text-red-600">Expired {Math.abs(days)}d ago</span>;
  if (days <= 30) return <span className="text-xs font-medium text-amber-600">Expires in {days}d</span>;
  return <span className="text-xs text-emerald-600">Valid until {format(parseISO(expiry),'dd MMM yyyy')}</span>;
}

function StaffForm({ staff, onClose, onSaved }) {
  const { toast } = useAppStore();
  const [form, setForm] = useState(staff || {
    first_name: '', last_name: '', email: '', phone: '', role: 'lifeguard', status: 'active',
    pin: '', nzrrp_number: '', nzrrp_expiry: '', notes: '',
    employee_number: '', base_hourly_rate: '', default_pay_component_id: '', employment_type: 'casual',
  });
  const [payComponents, setPayComponents] = useState([]);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    dbQuery('roster:pay_components').then(setPayComponents).catch(() => {});
  }, []);

  async function save() {
    if (!form.first_name || !form.last_name) { toast('Name required', 'warn'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        base_hourly_rate: form.base_hourly_rate === '' ? null : parseFloat(form.base_hourly_rate),
      };
      if (staff?.id) await dbQuery('staff:update', { id: staff.id, ...payload });
      else await dbQuery('staff:create', payload);
      toast(staff ? 'Staff updated' : 'Staff member added');
      onSaved();
    } catch (e) { toast('Save failed', 'error'); }
    finally { setSaving(false); }
  }
  return (
    <Modal title={staff ? 'Edit Staff Member' : 'Add Staff Member'} onClose={onClose} size="lg">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Personal</h4>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First Name" required><Input value={form.first_name} onChange={(e) => set('first_name', e.target.value)} /></Field>
        <Field label="Last Name" required><Input value={form.last_name} onChange={(e) => set('last_name', e.target.value)} /></Field>
        <Field label="Email"><Input type="email" value={form.email || ''} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Phone"><Input value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Role"><Select value={form.role} onChange={(e) => set('role', e.target.value)}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</Select></Field>
        <Field label="Status"><Select value={form.status} onChange={(e) => set('status', e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option><option value="on_leave">On Leave</option></Select></Field>
        <Field label="PIN (4 digits)" hint="Used for test entry sign-off"><Input type="password" maxLength={6} value={form.pin || ''} onChange={(e) => set('pin', e.target.value)} placeholder="••••" /></Field>
        <Field label="NZRRP Number"><Input value={form.nzrrp_number || ''} onChange={(e) => set('nzrrp_number', e.target.value)} /></Field>
        <Field label="NZRRP Expiry"><Input type="date" value={form.nzrrp_expiry || ''} onChange={(e) => set('nzrrp_expiry', e.target.value)} /></Field>
      </div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-4 mb-2">Pay & roster</h4>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Employee number" hint="Used in payroll CSV export"><Input value={form.employee_number || ''} onChange={(e) => set('employee_number', e.target.value)} placeholder="e.g. E001" /></Field>
        <Field label="Employment type"><Select value={form.employment_type || 'casual'} onChange={(e) => set('employment_type', e.target.value)}><option value="casual">Casual</option><option value="permanent">Permanent</option><option value="fixed_term">Fixed term</option></Select></Field>
        <Field label="Base hourly rate ($)"><Input type="number" step="0.01" value={form.base_hourly_rate ?? ''} onChange={(e) => set('base_hourly_rate', e.target.value)} placeholder="0.00" /></Field>
        <Field label="Default pay component"><Select value={form.default_pay_component_id || ''} onChange={(e) => set('default_pay_component_id', e.target.value)}><option value="">— Role default —</option>{payComponents.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}</Select></Field>
      </div>
      <Field label="Notes"><Textarea rows={2} value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} /></Field>
      <div className="flex justify-end gap-2 mt-2">
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn disabled={saving} onClick={save}>{saving?'Saving…':staff?'Save Changes':'Add Staff'}</Btn>
      </div>
    </Modal>
  );
}

function QualForm({ staffId, qual, onClose, onSaved }) {
  const { toast } = useAppStore();
  const [form, setForm] = useState(qual || { staff_id: staffId, qualification:'', issuer:'', issued_date:'', expiry_date:'', cert_number:'', notes:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  async function save() {
    if (!form.qualification) { toast('Qualification name required','warn'); return; }
    try {
      if (qual?.id) await dbQuery('qualifications:update', { id: qual.id, ...form });
      else await dbQuery('qualifications:create', { ...form, staff_id: staffId });
      toast('Qualification saved'); onSaved();
    } catch(e) { toast('Save failed','error'); }
  }
  return (
    <Modal title={qual ? 'Edit Qualification' : 'Add Qualification'} onClose={onClose}>
      <Field label="Qualification" required><Input value={form.qualification} onChange={e=>set('qualification',e.target.value)} placeholder="e.g. Pool Lifeguard, First Aid…" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Issuer"><Input value={form.issuer||''} onChange={e=>set('issuer',e.target.value)} /></Field>
        <Field label="Certificate No."><Input value={form.cert_number||''} onChange={e=>set('cert_number',e.target.value)} /></Field>
        <Field label="Issued"><Input type="date" value={form.issued_date||''} onChange={e=>set('issued_date',e.target.value)} /></Field>
        <Field label="Expiry"><Input type="date" value={form.expiry_date||''} onChange={e=>set('expiry_date',e.target.value)} /></Field>
      </div>
      <Field label="Notes"><Textarea rows={2} value={form.notes||''} onChange={e=>set('notes',e.target.value)} /></Field>
      <div className="flex justify-end gap-2 mt-2">
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save}>Save</Btn>
      </div>
    </Modal>
  );
}

function StaffDetail({ member, onClose, onChanged }) {
  const { toast } = useAppStore();
  const [quals, setQuals] = useState([]);
  const [qualForm, setQualForm] = useState(false);
  const [editQual, setEditQual] = useState(null);

  useEffect(() => { dbQuery('qualifications:list', { staff_id: member.id }).then(q=>setQuals(q||[])); }, [member.id]);

  async function deleteQual(id) {
    if (!confirm('Delete qualification?')) return;
    await dbQuery('qualifications:delete', id);
    setQuals(q => q.filter(x => x.id !== id));
    toast('Deleted');
  }

  return (
    <Modal title={`${member.first_name} ${member.last_name}`} onClose={onClose} size="lg">
      <div className="flex items-center gap-4 mb-5 p-4 bg-gray-50 rounded-xl">
        <div className="w-12 h-12 rounded-full bg-cyan-600 flex items-center justify-center text-white font-bold text-lg">{member.first_name[0]}{member.last_name[0]}</div>
        <div className="flex-1">
          <div className="font-semibold text-gray-900">{member.first_name} {member.last_name}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className={"px-2 py-0.5 rounded-full text-xs font-medium "+(ROLE_COLORS[member.role]||'bg-gray-100 text-gray-600')}>{ROLE_LABELS[member.role]||member.role}</span>
            <StatusBadge status={member.status} />
          </div>
          {member.email && <div className="text-sm text-gray-500 mt-1">{member.email}</div>}
          {member.employee_number && <div className="text-sm text-gray-500">Employee #: {member.employee_number}</div>}
          {(member.base_hourly_rate != null) && <div className="text-sm text-gray-500">Base rate: ${Number(member.base_hourly_rate).toFixed(2)}/hr · {member.employment_type?.replace('_', ' ')}</div>}
          {member.nzrrp_number && <div className="text-sm text-gray-500">NZRRP: {member.nzrrp_number} <QualStatus expiry={member.nzrrp_expiry} /></div>}
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Qualifications</h3>
        <Btn size="sm" onClick={() => setQualForm(true)}>+ Add</Btn>
      </div>
      {quals.length === 0 ? <div className="text-sm text-gray-400 text-center py-4">No qualifications recorded</div> : (
        <div className="space-y-2">
          {quals.map(q => (
            <div key={q.id} className="flex items-start justify-between p-3 rounded-lg border border-gray-200">
              <div>
                <div className="text-sm font-medium text-gray-900">{q.qualification}</div>
                {q.issuer && <div className="text-xs text-gray-500">{q.issuer}{q.cert_number&&` · ${q.cert_number}`}</div>}
                <QualStatus expiry={q.expiry_date} />
              </div>
              <div className="flex gap-1">
                <Btn variant="ghost" size="sm" onClick={() => { setEditQual(q); setQualForm(true); }}>Edit</Btn>
                <Btn variant="ghost" size="sm" onClick={() => deleteQual(q.id)}>✕</Btn>
              </div>
            </div>
          ))}
        </div>
      )}
      {qualForm && <QualForm staffId={member.id} qual={editQual} onClose={()=>{setQualForm(false);setEditQual(null);}} onSaved={()=>{ dbQuery('qualifications:list',{staff_id:member.id}).then(q=>setQuals(q||[])); setQualForm(false); setEditQual(null); }} />}
    </Modal>
  );
}

export default function Staff() {
  const { toast } = useAppStore();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [detailMember, setDetailMember] = useState(null);
  const [tab, setTab] = useState('active');

  const load = () => { setLoading(true); dbQuery('staff:list').then(s=>{ setStaff(s||[]); setLoading(false); }); };
  useEffect(load, []);

  const filtered = staff.filter(s => {
    const qs = !search || `${s.first_name} ${s.last_name} ${s.email||''}`.toLowerCase().includes(search.toLowerCase());
    const qr = filterRole==='all' || s.role===filterRole;
    const qt = tab==='all' || s.status===tab;
    return qs && qr && qt;
  });

  async function deleteMember(id) {
    if (!confirm('Deactivate this staff member?')) return;
    await dbQuery('staff:delete', id);
    toast('Staff member deactivated');
    load();
  }

  return (
    <div>
      <PageHeader title="Staff Management" subtitle="Staff, qualifications, and NZRRP register"
        actions={<Btn onClick={() => { setEditMember(null); setFormOpen(true); }}>+ Add Staff</Btn>} />

      <TabBar tabs={[{value:'active',label:'Active'},{value:'all',label:'All'},{value:'on_leave',label:'On Leave'},{value:'inactive',label:'Inactive'}]} active={tab} onChange={setTab} />

      <div className="flex gap-3 mb-4">
        <input value={search} onChange={e=>setSearch(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-500 flex-1" placeholder="🔍  Search by name or email…" />
        <select value={filterRole} onChange={e=>setFilterRole(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-500 bg-white">
          <option value="all">All roles</option>
          {ROLES.map(r=><option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
      </div>

      {loading ? <Spinner /> : filtered.length===0 ? <Empty icon="👥" title="No staff found" /> : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead><tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider">
              <th className="text-left px-5 py-3">Name</th>
              <th className="text-left px-5 py-3">Role</th>
              <th className="text-left px-5 py-3">Status</th>
              <th className="text-left px-5 py-3">Employee #</th>
              <th className="text-left px-5 py-3">Rate</th>
              <th className="text-left px-5 py-3">NZRRP</th>
              <th className="text-left px-5 py-3">Contact</th>
              <th className="px-5 py-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setDetailMember(s)}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center text-white text-xs font-bold">{s.first_name[0]}{s.last_name[0]}</div>
                      <span className="font-medium text-gray-900">{s.first_name} {s.last_name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3"><span className={"px-2 py-0.5 rounded-full text-xs font-medium "+(ROLE_COLORS[s.role]||'bg-gray-100 text-gray-600')}>{ROLE_LABELS[s.role]||s.role}</span></td>
                  <td className="px-5 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-5 py-3 text-sm font-mono text-gray-600">{s.employee_number || '—'}</td>
                  <td className="px-5 py-3 text-sm font-mono text-gray-600">{s.base_hourly_rate != null ? `$${Number(s.base_hourly_rate).toFixed(2)}` : '—'}</td>
                  <td className="px-5 py-3">{s.nzrrp_number ? <div><div className="text-xs text-gray-700">{s.nzrrp_number}</div><QualStatus expiry={s.nzrrp_expiry} /></div> : <span className="text-xs text-gray-400">—</span>}</td>
                  <td className="px-5 py-3 text-sm text-gray-500">{s.email||'—'}</td>
                  <td className="px-5 py-3" onClick={e=>e.stopPropagation()}>
                    <div className="flex gap-1">
                      <Btn variant="ghost" size="sm" onClick={() => { setEditMember(s); setFormOpen(true); }}>Edit</Btn>
                      <Btn variant="ghost" size="sm" onClick={() => deleteMember(s.id)}>✕</Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && <StaffForm staff={editMember} onClose={()=>{setFormOpen(false);setEditMember(null);}} onSaved={()=>{setFormOpen(false);setEditMember(null);load();}} />}
      {detailMember && <StaffDetail member={detailMember} onClose={()=>setDetailMember(null)} onChanged={load} />}
    </div>
  );
}
