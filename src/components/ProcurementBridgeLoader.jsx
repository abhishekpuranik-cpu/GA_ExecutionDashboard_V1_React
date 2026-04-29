import { useEffect, useState } from 'react';
import { fetchProcurementBridge, saveProcurementBridge } from '../api/appApi.js';

/** Legacy key — data now persists in MongoDB via local API */
const STORAGE_KEY = 'ga_procurement_bridge_snapshot';

/**
 * Import JSON produced by CAD BOQ tool → "Download bridge JSON (Execution dashboard)".
 * Stores a snapshot in MongoDB for reload across sessions (replaces browser-only session storage).
 */
export default function ProcurementBridgeLoader() {
  const [status, setStatus] = useState('');
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetchProcurementBridge();
        if (cancelled || !r?.payload) return;
        const data = r.payload;
        const n = data.procurementSummary?.length ?? 0;
        setSummary(data.procurementSummary?.slice(0, 8) ?? []);
        const t = r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '';
        setStatus(`Loaded from MongoDB${t ? ` (${t})` : ''}. ${n} summary line(s).`);
      } catch {
        if (!cancelled) setStatus('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setStatus('Reading…');
    setSummary(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.source !== 'cad-boq-tool' && !data.procurementSummary) {
        setStatus('This file is not a CAD BOQ bridge export (missing procurementSummary).');
        return;
      }
      await saveProcurementBridge(data);
      const n = data.procurementSummary?.length ?? 0;
      setSummary(data.procurementSummary?.slice(0, 8) ?? []);
      setStatus(`Saved to MongoDB. ${n} summary line(s) stored (${STORAGE_KEY} no longer required).`);
    } catch (err) {
      setStatus(err?.message || String(err));
    }
  };

  return (
    <div className="proc-bridge-panel">
      <strong>CAD BOQ → procurement bridge</strong>
      <p className="proc-bridge-hint">
        From <em>cad-boq-tool</em> open <strong>Charts & analytics</strong> → download{' '}
        <code>*-execution-bridge.json</code>, then pick that file here. Data is stored in MongoDB (local API).
      </p>
      <label className="proc-bridge-file">
        <span>Import bridge JSON</span>
        <input type="file" accept="application/json,.json" onChange={onFile} />
      </label>
      {status && <p className="proc-bridge-status">{status}</p>}
      {summary?.length > 0 && (
        <table className="proc-bridge-mini">
          <thead>
            <tr>
              <th>Material</th>
              <th>Grade</th>
              <th>Unit</th>
              <th>Qty</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((r, i) => (
              <tr key={i}>
                <td>{r.material}</td>
                <td>{r.gradeSpec}</td>
                <td>{r.unit}</td>
                <td>{r.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export { STORAGE_KEY };
