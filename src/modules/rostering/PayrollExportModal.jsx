import React, { useState, useEffect } from 'react';
import { dbQuery } from '../../hooks/useDb';
import { downloadCsv } from '../../utils/download';
import { Modal, Field, Input, Select, Btn } from '../../components/ui';

export default function PayrollExportModal({ payFrom, payTo, setPayFrom, setPayTo, onClose, onExported }) {
  const [source, setSource] = useState('scheduled');
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (payFrom && payTo) {
      dbQuery('export:payroll_preview', { week_start: payFrom, week_end: payTo, source }).then(setPreview);
    }
  }, [payFrom, payTo, source]);

  return (
    <Modal title="Payroll export" onClose={onClose}>
      <Field label="Pay period from">
        <Input type="date" value={payFrom} onChange={(e) => setPayFrom(e.target.value)} />
      </Field>
      <Field label="Pay period to">
        <Input type="date" value={payTo} onChange={(e) => setPayTo(e.target.value)} />
      </Field>
      <Field label="Export source">
        <Select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="scheduled">Scheduled roster (assignments)</option>
          <option value="approved">Approved timesheets only</option>
        </Select>
      </Field>
      {preview != null && (
        <p className="mt-3 p-3 bg-cyan-50 rounded-lg text-sm text-cyan-900">
          <strong>{preview.count}</strong> row{preview.count !== 1 ? 's' : ''} will be exported ({preview.source}).
        </p>
      )}
      <p className="mt-3 p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
        Bespoke CSV with employee number, pay component code, hours, rate, and amount. See docs/PAYROLL_EXPORT.md.
      </p>
      <div className="flex justify-end gap-2 mt-4">
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={async () => {
          const r = await dbQuery('export:payroll', { week_start: payFrom, week_end: payTo, source });
          downloadCsv(r);
          onExported();
          onClose();
        }}>Export payroll CSV</Btn>
      </div>
    </Modal>
  );
}
