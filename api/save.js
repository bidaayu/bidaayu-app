import { InfluxDB, Point } from '@influxdata/influxdb-client';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metode tidak diizinkan' });
  }

  try {
    const { bulk, data } = req.body;

    const url = process.env.INFLUX_URL;
    const token = process.env.INFLUX_TOKEN;
    const org = process.env.INFLUX_ORG;
    const bucket = process.env.INFLUX_BUCKET;

    const client = new InfluxDB({ url, token });
    const writeApi = client.getWriteApi(org, bucket, 'ns');

    // ✅ Jika mode bulk
    if (bulk && Array.isArray(data)) {
      data.forEach((item) => {
        const { tanggal, nis, nama, kelas, status } = item;

        const ts = new Date(tanggal);
        const now = new Date();

        // Hindari timestamp out of retention period
        const timestamp = (now - ts > 1000 * 60 * 60 * 24 * 30) ? now : ts;

        const point = new Point('absensi')
          .tag('kelas', kelas)
          .tag('status', status)
          .stringField('nama', nama)
          .stringField('nis', nis)
          .timestamp(timestamp);

        writeApi.writePoint(point);
      });
    } else {
      // fallback kalau bukan bulk
      const { tanggal, nis, nama, kelas, status } = req.body;

      const point = new Point('absensi')
        .tag('kelas', kelas)
        .tag('status', status)
        .stringField('nama', nama)
        .stringField('nis', nis)
        .timestamp(new Date(tanggal));

      writeApi.writePoint(point);
    }

    await writeApi.close();

    res.status(200).json({ success: true, message: '✅ Semua data absensi tersimpan ke InfluxDB!' });
  } catch (err) {
    console.error('❌ Gagal simpan ke InfluxDB:', err);
    res.status(500).json({ error: err.message || 'Gagal menyimpan data ke InfluxDB' });
  }
}
