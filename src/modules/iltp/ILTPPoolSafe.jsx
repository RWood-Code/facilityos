import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Shield, Plus } from 'lucide-react';
import { dbQuery } from '../../hooks/useDb';
import { useAppStore } from '../../store/appStore';
import {
  PageHeader, TabBar, Spinner, Btn, Card, Modal, Field, Input, Select, Textarea, Empty,
} from '../../components/ui';
import AttachmentField, { AttachmentBadges } from '../../components/iltp/AttachmentField';

const DOC_TYPES = [
  ['training_manual', 'Training Manual'],
  ['procedure', 'Procedure'],
  ['checklist', 'Checklist'],
  ['other', 'Other'],
];

const AUDIT_TYPES = [
  ['annual_inspection', 'Annual Inspection'],
  ['spot_check', 'Spot Check'],
  ['follow_up', 'Follow-up'],
];

const AUDIT_STATUS = {
  compliant: 'bg-emerald-100 text-emerald-700',
  non_compliant: 'bg-red-100 text-red-700',
  actions_required: 'bg-amber-100 text-amber-700',
  pending: 'bg-gray-100 text-gray-600',
};

const POOLSAFE_CATEGORIES = [
  ['policy', 'Policy'],
  ['procedure', 'Procedure'],
  ['form', 'Form'],
  ['reference', 'Reference'],
];

export default function ILTPPoolSafe() {
  const { settings, toast } = useAppStore();
  const [tab, setTab] = useState('iltp');
  const [loading, setLoading] = useState(true);
  const [audits, setAudits] = useState([]);
  const [iltpDocs, setIltpDocs] = useState([]);
  const [poolsafeDocs, setPoolsafeDocs] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const disabled = settings.iltp_poolsafe === '0' || settings.show_iltp_poolsafe === '0';

  async function load() {
    setLoading(true);
    try {
      const [a, i, p] = await Promise.all([
        dbQuery('poolsafe_audits:list'),
        dbQuery('iltp:list'),
        dbQuery('poolsafe_docs:list'),
      ]);
      setAudits(a || []);
      setIltpDocs(i || []);
      setPoolsafeDocs(p || []);
    } catch {
      toast('Failed to load ILTP & PoolSafe data', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate(kind) {
    const today = format(new Date(), 'yyyy-MM-dd');
    const base = { attachments: [] };
    if (kind === 'audit') {
      setForm({ ...base, audit_date: today, audit_type: 'annual_inspection', auditor: '', status: 'pending', summary: '', notes: '' });
    } else if (kind === 'iltp') {
      setForm({ ...base, document_name: '', document_type: 'training_manual', upload_date: today, expiry_date: '', description: '', notes: '' });
    } else {
      setForm({ ...base, document_name: '', category: 'policy', version: '1.0', upload_date: today, effective_date: '', review_date: '', is_current: true, description: '', notes: '' });
    }
    setModal({ kind, edit: null });
  }

  function openEdit(kind, item) {
    setForm({
      ...item,
      attachments: item.attachments || [],
      is_current: item.is_current !== false && item.is_current !== 0,
    });
    setModal({ kind, edit: item });
  }

  async function save() {
    setSaving(true);
    try {
      const channelMap = { audit: 'poolsafe_audits', iltp: 'iltp', poolsafe: 'poolsafe_docs' };
      const prefix = channelMap[modal.kind];
      const payload = { ...form };
      if (modal.kind === 'poolsafe') payload.is_current = payload.is_current ? 1 : 0;
      if (modal.edit) {
        await dbQuery(`${prefix}:update`, { id: modal.edit.id, ...payload });
      } else {
        await dbQuery(`${prefix}:create`, payload);
      }
      setModal(null);
      await load();
      toast('Saved', 'success');
    } catch (e) {
      toast(e.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(kind, id) {
    if (!window.confirm('Delete this record?')) return;
    const prefix = { audit: 'poolsafe_audits', iltp: 'iltp', poolsafe: 'poolsafe_docs' }[kind];
    try {
      await dbQuery(`${prefix}:delete`, id);
      await load();
      toast('Deleted', 'success');
    } catch {
      toast('Delete failed', 'error');
    }
  }

  if (disabled) {
    return (
      <Card className="max-w-md mx-auto mt-12 text-center py-12">
        <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Module Disabled</h3>
        <p className="text-gray-600 text-sm">ILTP & PoolSafe is turned off in Settings.</p>
      </Card>
    );
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="ILTP & PoolSafe"
        subtitle="Independent Laboratory Testing Programme documentation and PoolSafe audit records"
        badge="Compliance"
        actions={(
          <Btn onClick={() => openCreate(tab === 'audits' ? 'audit' : tab === 'poolsafe' ? 'poolsafe' : 'iltp')}>
            <Plus className="w-4 h-4" />
            Add {tab === 'audits' ? 'Audit' : tab === 'poolsafe' ? 'Document' : 'ILTP Document'}
          </Btn>
        )}
      />

      <TabBar
        tabs={[
          { value: 'iltp', label: 'ILTP Documents' },
          { value: 'audits', label: 'PoolSafe Audits' },
          { value: 'poolsafe', label: 'PoolSafe Docs' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'iltp' && (
        <DocList
          items={iltpDocs}
          emptyIcon="📚"
          emptyTitle="No ILTP documents"
          render={(doc) => (
            <RecordRow
              key={doc.id}
              title={doc.document_name}
              meta={`${doc.document_type?.replace(/_/g, ' ')} · uploaded ${doc.upload_date}`}
              sub={doc.expiry_date ? `Expires ${doc.expiry_date}` : doc.description}
              attachments={doc.attachments}
              onEdit={() => openEdit('iltp', doc)}
              onDelete={() => removeItem('iltp', doc.id)}
            />
          )}
        />
      )}

      {tab === 'audits' && (
        <DocList
          items={audits}
          emptyIcon="🛡"
          emptyTitle="No PoolSafe audits"
          render={(audit) => (
            <RecordRow
              key={audit.id}
              title={`${audit.audit_type?.replace(/_/g, ' ')} — ${audit.audit_date}`}
              meta={audit.auditor || 'Auditor not recorded'}
              badge={audit.status}
              badgeClass={AUDIT_STATUS[audit.status] || AUDIT_STATUS.pending}
              sub={audit.summary || audit.notes}
              attachments={audit.attachments}
              onEdit={() => openEdit('audit', audit)}
              onDelete={() => removeItem('audit', audit.id)}
            />
          )}
        />
      )}

      {tab === 'poolsafe' && (
        <DocList
          items={poolsafeDocs}
          emptyIcon="📄"
          emptyTitle="No PoolSafe documents"
          render={(doc) => (
            <RecordRow
              key={doc.id}
              title={doc.document_name}
              meta={`v${doc.version} · ${doc.category} · ${doc.upload_date}`}
              badge={doc.is_current ? 'Current' : 'Superseded'}
              badgeClass={doc.is_current ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}
              sub={doc.description || doc.change_summary}
              attachments={doc.attachments}
              onEdit={() => openEdit('poolsafe', doc)}
              onDelete={() => removeItem('poolsafe', doc.id)}
            />
          )}
        />
      )}

      {modal && (
        <Modal
          title={modal.edit ? 'Edit record' : 'Add record'}
          onClose={() => setModal(null)}
          size="lg"
        >
          {modal.kind === 'audit' && (
            <>
              <Field label="Audit date" required><Input type="date" value={form.audit_date || ''} onChange={(e) => setForm({ ...form, audit_date: e.target.value })} /></Field>
              <Field label="Audit type"><Select value={form.audit_type || 'annual_inspection'} onChange={(e) => setForm({ ...form, audit_type: e.target.value })}>{AUDIT_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
              <Field label="Auditor"><Input value={form.auditor || ''} onChange={(e) => setForm({ ...form, auditor: e.target.value })} /></Field>
              <Field label="Status"><Select value={form.status || 'pending'} onChange={(e) => setForm({ ...form, status: e.target.value })}>{Object.keys(AUDIT_STATUS).map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</Select></Field>
              <Field label="Summary"><Textarea rows={3} value={form.summary || ''} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></Field>
              <Field label="Notes"><Textarea rows={2} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
              <AttachmentField attachments={form.attachments} onChange={(attachments) => setForm({ ...form, attachments })} />
            </>
          )}
          {modal.kind === 'iltp' && (
            <>
              <Field label="Document name" required><Input value={form.document_name || ''} onChange={(e) => setForm({ ...form, document_name: e.target.value })} /></Field>
              <Field label="Type"><Select value={form.document_type || 'training_manual'} onChange={(e) => setForm({ ...form, document_type: e.target.value })}>{DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
              <Field label="Upload date"><Input type="date" value={form.upload_date || ''} onChange={(e) => setForm({ ...form, upload_date: e.target.value })} /></Field>
              <Field label="Expiry date"><Input type="date" value={form.expiry_date || ''} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></Field>
              <Field label="Description"><Textarea rows={2} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
              <Field label="Notes"><Textarea rows={2} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
              <AttachmentField attachments={form.attachments} onChange={(attachments) => setForm({ ...form, attachments })} />
            </>
          )}
          {modal.kind === 'poolsafe' && (
            <>
              <Field label="Document name" required><Input value={form.document_name || ''} onChange={(e) => setForm({ ...form, document_name: e.target.value })} /></Field>
              <Field label="Category"><Select value={form.category || 'policy'} onChange={(e) => setForm({ ...form, category: e.target.value })}>{POOLSAFE_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
              <Field label="Version"><Input value={form.version || '1.0'} onChange={(e) => setForm({ ...form, version: e.target.value })} /></Field>
              <Field label="Upload date"><Input type="date" value={form.upload_date || ''} onChange={(e) => setForm({ ...form, upload_date: e.target.value })} /></Field>
              <Field label="Effective date"><Input type="date" value={form.effective_date || ''} onChange={(e) => setForm({ ...form, effective_date: e.target.value })} /></Field>
              <Field label="Review date"><Input type="date" value={form.review_date || ''} onChange={(e) => setForm({ ...form, review_date: e.target.value })} /></Field>
              <Field label="Description"><Textarea rows={2} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
              <label className="flex items-center gap-2 text-sm mb-4">
                <input type="checkbox" checked={!!form.is_current} onChange={(e) => setForm({ ...form, is_current: e.target.checked })} />
                Current version
              </label>
              <AttachmentField attachments={form.attachments} onChange={(attachments) => setForm({ ...form, attachments })} />
            </>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="secondary" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function DocList({ items, emptyIcon, emptyTitle, render }) {
  if (!items.length) {
    return <Empty icon={emptyIcon} title={emptyTitle} desc="Add your first record using the button above." />;
  }
  return <div className="space-y-3">{items.map(render)}</div>;
}

function RecordRow({ title, meta, sub, badge, badgeClass, attachments, onEdit, onDelete }) {
  return (
    <Card className="flex flex-col sm:flex-row sm:items-start gap-3 justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          {badge && <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${badgeClass}`}>{badge}</span>}
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{meta}</p>
        {sub && <p className="text-sm text-gray-600 mt-1 line-clamp-2">{sub}</p>}
        <AttachmentBadges attachments={attachments} />
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <Btn size="sm" variant="secondary" onClick={onEdit}>Edit</Btn>
        <Btn size="sm" variant="danger" onClick={onDelete}>Delete</Btn>
      </div>
    </Card>
  );
}
