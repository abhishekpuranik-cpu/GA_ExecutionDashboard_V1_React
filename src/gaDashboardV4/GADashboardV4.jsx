import { useEffect, useRef } from 'react';
import bodyHtml from './GADashboardV4Body.html?raw';
import './gaDashboardV4Full.css';
import { mountGADashboardV4 } from './gaDashboardV4Engine.js';
import { fetchGaV4ImportPayload } from '../api/appApi.js';
import { STORAGE_KEY } from './gaDashboardV4Import.js';

/**
 * Golden Abodes Construction Command Centre — pixel-parity port of
 * GA_Dashboard_v4 (1).html (static HTML + Chart.js + inline script).
 * Markup is injected from GADashboardV4Body.html; behaviour from gaDashboardV4Engine.js.
 * Loads last import snapshot from MongoDB (when API is up) before restoring localStorage.
 */
export default function GADashboardV4() {
  const rootRef = useRef(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    let teardown = () => {};
    let cancelled = false;

    (async () => {
      try {
        const r = await fetchGaV4ImportPayload();
        if (!cancelled && r?.payload) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(r.payload));
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* offline — keep existing localStorage */
      }
      if (cancelled) return;
      el.innerHTML = bodyHtml;
      teardown = mountGADashboardV4();
    })();

    return () => {
      cancelled = true;
      teardown();
    };
  }, []);

  return <div ref={rootRef} className="ga-dashboard-v4-root" />;
}
