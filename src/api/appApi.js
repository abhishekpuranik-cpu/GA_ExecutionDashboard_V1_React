const base = () => (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

async function parseJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function getHealth() {
  const res = await fetch(`${base()}/api/health`);
  return parseJson(res);
}

/** @returns {Promise<{ data: object, updatedAt?: string } | null>} */
export async function fetchPortfolioData() {
  const res = await fetch(`${base()}/api/portfolio-data`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await parseJson(res);
    throw new Error(body.error || res.statusText);
  }
  return parseJson(res);
}

/** @param {object} data */
export async function savePortfolioData(data) {
  const res = await fetch(`${base()}/api/portfolio-data`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data })
  });
  const body = await parseJson(res);
  if (!res.ok) throw new Error(body.error || res.statusText);
  return body;
}

/** @returns {Promise<{ payload: object, updatedAt?: string } | null>} */
export async function fetchProcurementBridge() {
  const res = await fetch(`${base()}/api/procurement-bridge`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await parseJson(res);
    throw new Error(body.error || res.statusText);
  }
  return parseJson(res);
}

/** @param {object} payload */
export async function saveProcurementBridge(payload) {
  const res = await fetch(`${base()}/api/procurement-bridge`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload })
  });
  const body = await parseJson(res);
  if (!res.ok) throw new Error(body.error || res.statusText);
  return body;
}

/** @returns {Promise<{ data: object, updatedAt?: string } | null>} */
export async function fetchAnantamDashboard() {
  const res = await fetch(`${base()}/api/anantam-dashboard`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await parseJson(res);
    throw new Error(body.error || res.statusText);
  }
  return parseJson(res);
}

/** @param {object} data */
export async function saveAnantamDashboard(data) {
  const res = await fetch(`${base()}/api/anantam-dashboard`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data })
  });
  const body = await parseJson(res);
  if (!res.ok) throw new Error(body.error || res.statusText);
  return body;
}

/** @returns {Promise<{ payload: object, updatedAt?: string } | null>} */
export async function fetchGaV4ImportPayload() {
  const res = await fetch(`${base()}/api/ga-v4-import`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await parseJson(res);
    throw new Error(body.error || res.statusText);
  }
  return parseJson(res);
}

/** @param {object} payload */
export async function saveGaV4ImportPayload(payload) {
  const res = await fetch(`${base()}/api/ga-v4-import`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload })
  });
  const body = await parseJson(res);
  if (!res.ok) throw new Error(body.error || res.statusText);
  return body;
}

/** Fire-and-forget Mongo sync; never throws to caller */
export function savePortfolioDataSilent(data) {
  savePortfolioData(data).catch(() => {});
}

export function saveGaV4ImportPayloadSilent(payload) {
  saveGaV4ImportPayload(payload).catch(() => {});
}
