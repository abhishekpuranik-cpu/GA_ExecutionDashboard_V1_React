/**
 * Local API for GA Execution Dashboard — persists dashboard payloads in MongoDB.
 * Listens on PORT even if MongoDB is temporarily down (routes return 503 until connected).
 */
import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'ga_execution_dashboard';
const PORT = Number(process.env.PORT) || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const indexHtml = path.join(distDir, 'index.html');

let appPkgVersion = '?';
try {
  const raw = fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8');
  appPkgVersion = JSON.parse(raw)?.version || '?';
} catch {
  /* ignore */
}
const SERVER_TAG = `ga-execution-dashboard@${appPkgVersion}`;

const client = new MongoClient(MONGODB_URI);
const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '20mb' }));

/** Cached DB; reset to null on failed operations if needed */
let dbInstance = null;

async function ensureMongo() {
  try {
    if (!dbInstance) {
      await client.connect();
      dbInstance = client.db(DB_NAME);
      console.log(`MongoDB connected (${DB_NAME})`);
    }
    return dbInstance;
  } catch (e) {
    dbInstance = null;
    console.error('MongoDB:', e?.message || String(e));
    return null;
  }
}

function withDb(handler) {
  return async (req, res) => {
    const db = await ensureMongo();
    if (!db) {
      return res.status(503).json({
        error: 'MongoDB unavailable. Start mongod (default mongodb://127.0.0.1:27017), then retry.'
      });
    }
    return handler(req, res, db);
  };
}

app.get('/api/health', async (_req, res) => {
  const db = await ensureMongo();
  res.json({
    ok: true,
    mongo: !!db,
    db: DB_NAME,
    port: PORT
  });
});

app.get(
  '/api/portfolio-data',
  withDb(async (_req, res, db) => {
    try {
      const doc = await db.collection('portfolio_execution').findOne({ _id: 'main' });
      if (!doc?.data) return res.status(404).json({ error: 'No saved portfolio data' });
      res.json({ data: doc.data, updatedAt: doc.updatedAt });
    } catch (e) {
      res.status(500).json({ error: e?.message || String(e) });
    }
  })
);

app.put(
  '/api/portfolio-data',
  withDb(async (req, res, db) => {
    try {
      const { data } = req.body;
      if (!data || typeof data !== 'object') return res.status(400).json({ error: 'body.data (object) required' });
      const now = new Date();
      const portfolioCol = db.collection('portfolio_execution');
      await portfolioCol.updateOne({ _id: 'main' }, { $set: { data, updatedAt: now } }, { upsert: true });
      res.json({ ok: true, updatedAt: now });
    } catch (e) {
      res.status(500).json({ error: e?.message || String(e) });
    }
  })
);

app.get(
  '/api/procurement-bridge',
  withDb(async (_req, res, db) => {
    try {
      const doc = await db.collection('procurement_bridge').findOne({ _id: 'main' });
      if (!doc?.payload) return res.status(404).json({ error: 'No procurement bridge data' });
      res.json({ payload: doc.payload, updatedAt: doc.updatedAt });
    } catch (e) {
      res.status(500).json({ error: e?.message || String(e) });
    }
  })
);

app.put(
  '/api/procurement-bridge',
  withDb(async (req, res, db) => {
    try {
      const { payload } = req.body;
      if (!payload || typeof payload !== 'object') return res.status(400).json({ error: 'body.payload (object) required' });
      const now = new Date();
      await db.collection('procurement_bridge').updateOne({ _id: 'main' }, { $set: { payload, updatedAt: now } }, { upsert: true });
      res.json({ ok: true, updatedAt: now });
    } catch (e) {
      res.status(500).json({ error: e?.message || String(e) });
    }
  })
);

app.get(
  '/api/anantam-dashboard',
  withDb(async (_req, res, db) => {
    try {
      const doc = await db.collection('anantam_dashboard').findOne({ _id: 'main' });
      if (!doc?.data) return res.status(404).json({ error: 'No saved Anantam dashboard' });
      res.json({ data: doc.data, updatedAt: doc.updatedAt });
    } catch (e) {
      res.status(500).json({ error: e?.message || String(e) });
    }
  })
);

app.put(
  '/api/anantam-dashboard',
  withDb(async (req, res, db) => {
    try {
      const { data } = req.body;
      if (!data || typeof data !== 'object') return res.status(400).json({ error: 'body.data (object) required' });
      const now = new Date();
      await db.collection('anantam_dashboard').updateOne({ _id: 'main' }, { $set: { data, updatedAt: now } }, { upsert: true });
      res.json({ ok: true, updatedAt: now });
    } catch (e) {
      res.status(500).json({ error: e?.message || String(e) });
    }
  })
);

app.get(
  '/api/ga-v4-import',
  withDb(async (_req, res, db) => {
    try {
      const doc = await db.collection('ga_v4_import').findOne({ _id: 'main' });
      if (!doc?.payload) return res.status(404).json({ error: 'No saved GA v4 import' });
      res.json({ payload: doc.payload, updatedAt: doc.updatedAt });
    } catch (e) {
      res.status(500).json({ error: e?.message || String(e) });
    }
  })
);

app.put(
  '/api/ga-v4-import',
  withDb(async (req, res, db) => {
    try {
      const { payload } = req.body;
      if (!payload || typeof payload !== 'object') return res.status(400).json({ error: 'body.payload (object) required' });
      const now = new Date();
      await db.collection('ga_v4_import').updateOne({ _id: 'main' }, { $set: { payload, updatedAt: now } }, { upsert: true });
      res.json({ ok: true, updatedAt: now });
    } catch (e) {
      res.status(500).json({ error: e?.message || String(e) });
    }
  })
);

app.get(
  '/api/ga-v4-dashboards',
  withDb(async (_req, res, db) => {
    try {
      const gaV4NamedCol = db.collection('ga_v4_named_dashboards');
      const rows = await gaV4NamedCol.find({}).project({ name: 1, updatedAt: 1, createdAt: 1 }).sort({ updatedAt: -1 }).toArray();
      res.json({
        dashboards: rows.map((r) => ({
          id: r._id.toString(),
          name: r.name,
          updatedAt: r.updatedAt,
          createdAt: r.createdAt
        }))
      });
    } catch (e) {
      res.status(500).json({ error: e?.message || String(e) });
    }
  })
);

app.get(
  '/api/ga-v4-dashboards/:id',
  withDb(async (req, res, db) => {
    try {
      let oid;
      try {
        oid = new ObjectId(req.params.id);
      } catch {
        return res.status(400).json({ error: 'Invalid dashboard id' });
      }
      const doc = await db.collection('ga_v4_named_dashboards').findOne({ _id: oid });
      if (!doc?.payload) return res.status(404).json({ error: 'Dashboard not found' });
      res.json({
        id: doc._id.toString(),
        name: doc.name,
        payload: doc.payload,
        updatedAt: doc.updatedAt
      });
    } catch (e) {
      res.status(500).json({ error: e?.message || String(e) });
    }
  })
);

app.post(
  '/api/ga-v4-dashboards',
  withDb(async (req, res, db) => {
    try {
      const { name, payload } = req.body;
      if (!name || typeof name !== 'string' || !String(name).trim()) {
        return res.status(400).json({ error: 'body.name (non-empty string) required' });
      }
      if (!payload || typeof payload !== 'object') return res.status(400).json({ error: 'body.payload (object) required' });
      const now = new Date();
      const ins = await db.collection('ga_v4_named_dashboards').insertOne({
        name: String(name).trim(),
        payload,
        createdAt: now,
        updatedAt: now
      });
      res.json({ ok: true, id: ins.insertedId.toString(), updatedAt: now });
    } catch (e) {
      res.status(500).json({ error: e?.message || String(e) });
    }
  })
);

app.put(
  '/api/ga-v4-dashboards/:id',
  withDb(async (req, res, db) => {
    try {
      let oid;
      try {
        oid = new ObjectId(req.params.id);
      } catch {
        return res.status(400).json({ error: 'Invalid dashboard id' });
      }
      const { name, payload } = req.body;
      const $set = { updatedAt: new Date() };
      if (typeof name === 'string' && name.trim()) $set.name = name.trim();
      if (payload && typeof payload === 'object') $set.payload = payload;
      const r = await db.collection('ga_v4_named_dashboards').updateOne({ _id: oid }, { $set });
      if (r.matchedCount === 0) return res.status(404).json({ error: 'Dashboard not found' });
      res.json({ ok: true, updatedAt: $set.updatedAt });
    } catch (e) {
      res.status(500).json({ error: e?.message || String(e) });
    }
  })
);

app.delete(
  '/api/ga-v4-dashboards/:id',
  withDb(async (req, res, db) => {
    try {
      let oid;
      try {
        oid = new ObjectId(req.params.id);
      } catch {
        return res.status(400).json({ error: 'Invalid dashboard id' });
      }
      const r = await db.collection('ga_v4_named_dashboards').deleteOne({ _id: oid });
      if (r.deletedCount === 0) return res.status(404).json({ error: 'Dashboard not found' });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e?.message || String(e) });
    }
  })
);

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
}

app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      error: 'API route not found',
      path: req.path,
      server: SERVER_TAG,
      hint: 'Stop any old process on this port and restart with: npm run server'
    });
  }
  if (fs.existsSync(indexHtml)) {
    return res.sendFile(indexHtml);
  }
  res
    .status(503)
    .type('text/plain')
    .send(
      `Frontend build missing (${SERVER_TAG}). On Render: set Build Command to "npm ci && npm run build" and Start Command to "npm run start", then redeploy.`
    );
});

app.listen(PORT, () => {
  console.log(`${SERVER_TAG} — http://127.0.0.1:${PORT} (database: ${DB_NAME})`);
  console.log(`dist: ${fs.existsSync(distDir) ? 'yes' : 'NO — run npm run build'}  index.html: ${fs.existsSync(indexHtml) ? 'yes' : 'no'}`);
  console.log('MongoDB will connect on first request if mongod is running.');
});
