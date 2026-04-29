import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ANANTAM_DEFAULTS } from '../data/anantamProjectData.js';
import { fetchAnantamDashboard, saveAnantamDashboard } from '../api/appApi.js';

const AnantamDataContext = createContext(null);

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function AnantamDataProvider({ children }) {
  const [data, setData] = useState(() => deepClone(ANANTAM_DEFAULTS));
  const [mongoNote, setMongoNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetchAnantamDashboard();
        if (cancelled || !r?.data) {
          if (!cancelled && r === null) setMongoNote('MongoDB · no Anantam snapshot yet — click Save after edits');
          return;
        }
        setData(deepClone(r.data));
        const t = r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '';
        setMongoNote(t ? `MongoDB · loaded (${t})` : 'MongoDB · loaded');
      } catch {
        if (!cancelled) setMongoNote('MongoDB offline — built-in extract only');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveToMongo = useCallback(async () => {
    setBusy(true);
    try {
      await saveAnantamDashboard(data);
      setMongoNote('MongoDB · saved just now');
    } catch {
      setMongoNote('MongoDB · save failed (is the API running?)');
    } finally {
      setBusy(false);
    }
  }, [data]);

  const reloadFromMongo = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetchAnantamDashboard();
      if (r?.data) {
        setData(deepClone(r.data));
        const t = r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '';
        setMongoNote(t ? `MongoDB · reloaded (${t})` : 'MongoDB · reloaded');
      } else {
        setMongoNote('MongoDB · no Anantam snapshot saved yet');
      }
    } catch {
      setMongoNote('MongoDB · could not reload');
    } finally {
      setBusy(false);
    }
  }, []);

  const value = useMemo(
    () => ({ data, setData, mongoNote, busy, saveToMongo, reloadFromMongo }),
    [data, mongoNote, busy, saveToMongo, reloadFromMongo]
  );

  return <AnantamDataContext.Provider value={value}>{children}</AnantamDataContext.Provider>;
}

export function useAnantam() {
  const ctx = useContext(AnantamDataContext);
  if (!ctx) throw new Error('useAnantam must be used within AnantamDataProvider');
  return ctx;
}
