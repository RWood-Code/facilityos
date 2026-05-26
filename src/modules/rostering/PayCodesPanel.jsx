import React, { useState, useEffect } from 'react';
import { dbQuery } from '../../hooks/useDb';
import { useAppStore } from '../../store/appStore';
import { Card, Btn, Field, Input, Select, Modal } from '../../components/ui';

const CATEGORIES = ['earning', 'leave', 'allowance'];

export default function PayCodesPanel() {
  const { toast } = useAppStore();
  const [codes, setCodes] = useState([]);
  const [edit, setEdit] = useState(null);

  function load() {
    dbQuery('roster:pay_components', { include_inactive: true }).then(setCodes);
  }

  useEffect(() => { load(); }, []);

  async function save(form) {
    await dbQuery('roster:pay_component_save', form);
    toast('Pay code saved');
    setEdit(null);
    load();
  }

  return (
    <Card>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">Pay component codes</h3>
          <p className="text-sm text-gray-500">Used on shifts and exported in payroll CSV.</p>
        </div>
        <Btn size="sm" onClick={() => setEdit({ code: '', name: '', category: 'earning', default_rate: 0, rate_multiplier: 1, export_code: '', is_active: 1, sort_order: codes.length + 1 })}>+ Add code</Btn>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-500 border-b">
            <th className="text-left py-2">Code</th>
            <th className="text-left py-2">Name</th>
            <th className="text-left py-2">Category</th>
            <th className="text-right py-2">Default rate</th>
            <th className="text-right py-2">Multiplier</th>
            <th className="text-left py-2">Export code</th>
            <th className="text-left py-2">Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {codes.map((c) => (
            <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="py-2 font-mono font-medium">{c.code}</td>
              <td className="py-2">{c.name}</td>
              <td className="py-2 capitalize text-gray-500">{c.category}</td>
              <td className="py-2 text-right font-mono">${(c.default_rate || 0).toFixed(2)}</td>
              <td className="py-2 text-right font-mono">×{c.rate_multiplier || 1}</td>
              <td className="py-2 font-mono text-xs">{c.export_code || c.code}</td>
              <td className="py-2">{c.is_active ? 'Active' : 'Inactive'}</td>
              <td className="py-2 text-right"><Btn variant="ghost" size="sm" onClick={() => setEdit(c)}>Edit</Btn></td>
            </tr>
          ))}
        </tbody>
      </table>

      {edit && (
        <PayCodeModal code={edit} onClose={() => setEdit(null)} onSave={save} />
      )}
    </Card>
  );
}

function PayCodeModal({ code, onClose, onSave }) {
  const [form, setForm] = useState({ ...code });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal title={form.id ? 'Edit pay code' : 'New pay code'} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Code" required><Input value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} /></Field>
        <Field label="Export code"><Input value={form.export_code || ''} onChange={(e) => set('export_code', e.target.value.toUpperCase())} placeholder="Same as code if blank" /></Field>
        <Field label="Name" required className="col-span-2"><Input value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Category">
          <Select value={form.category} onChange={(e) => set('category', e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Sort order"><Input type="number" value={form.sort_order || 0} onChange={(e) => set('sort_order', parseInt(e.target.value, 10) || 0)} /></Field>
        <Field label="Default rate ($/hr)"><Input type="number" step="0.01" value={form.default_rate ?? 0} onChange={(e) => set('default_rate', parseFloat(e.target.value) || 0)} /></Field>
        <Field label="Rate multiplier"><Input type="number" step="0.01" value={form.rate_multiplier ?? 1} onChange={(e) => set('rate_multiplier', parseFloat(e.target.value) || 1)} /></Field>
        <Field label="Active">
          <Select value={form.is_active ? '1' : '0'} onChange={(e) => set('is_active', e.target.value === '1' ? 1 : 0)}>
            <option value="1">Active</option>
            <option value="0">Inactive</option>
          </Select>
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => onSave({ ...form, export_code: form.export_code || form.code })}>Save</Btn>
      </div>
    </Modal>
  );
}
