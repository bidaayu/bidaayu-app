// /api/fetch.js
import { InfluxDB } from '@influxdata/influxdb-client';

const url = process.env.INFLUX_URL;
const token = process.env.INFLUX_TOKEN;
const org = process.env.INFLUX_ORG;
const bucket = 'absensi';

export default async function handler(req, res) {
  const { tahun, bulan, kelas } = req.query;

  if (!tahun || !bulan) {
    return res.status(400).json({ error: 'Parameter tahun dan bulan wajib' });
  }

  try {
    const queryApi = new InfluxDB({ url, token }).getQueryApi(org);

    const startDate = `${tahun}-${String(bulan).padStart(2, '0')}-01T00:00:00Z`;
    const nextMonth = new Date(tahun, bulan, 1);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const stopDate = nextMonth.toISOString();

    let fluxQuery = `
      from(bucket: "${bucket}")
        |> range(start: ${startDate}, stop: ${stopDate})
        |> filter(fn: (r) => r._measurement == "absensi")
    `;

    if (kelas) {
      fluxQuery += `
        |> filter(fn: (r) => r.kelas == "${kelas}")
      `;
    }

    fluxQuery += `
      |> keep(columns: ["_time", "_value", "kelas", "status", "nama", "nis"])
    `;

    // Ambil data
    const rows = await queryApi.collectRows(fluxQuery);

    // Format sederhana
    const data = rows.map(r => ({
      tanggal: r._time,
      kelas: r.kelas,
      status: r.status,
      nama: r.nama,
      nis: r.nis
    }));

    res.status(200).json(data);
  } catch (err) {
    console.error('❌ Flux query failed:', err);
    res.status(500).json({ error: err.message });
  }
}
