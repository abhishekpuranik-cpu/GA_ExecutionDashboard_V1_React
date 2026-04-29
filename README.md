# GA Construction Execution Dashboard (React)

Multi-tab interactive dashboard with:
- Business, Operational, and Transactional layers
- Project-wise filtering
- KPI cards with health status
- SPI/CPI trend chart with hover inspection
- Planned vs Actual completion chart
- CSV template download and data upload support

## Run

```bash
npm install
npm run dev
```

## CSV Template Format

Use columns:

`projectId,section,key,value`

Where:
- `projectId`: `all`, `p1`, `p2`, `p3`
- `section`: `executive`, `business`, `operational`, `transactional`, `trend`, `completion`
- `key`: examples: `completion`, `cpi`, `irr`, `spi_Nov`, `cpi_Apr`, `planned_0`, `actual_0`, `label_0`
- `value`: numeric for KPIs/metrics, text for `label_*`

Download the built-in template from the UI for exact keys.
