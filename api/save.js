import { InfluxDB, Point } from '@influxdata/influxdb-client';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metode tidak diizinkan' });
  }

  try {
    const { tanggal, nis, nama, kelas, status } = req.body;

    const url = process.env.INFLUX_URL;
    const token = process.env.INFLUX_TOKEN;
    const org = process.env.INFLUX_ORG;
    const bucket = process.env.INFLUX_BUCKET;

    const client = new InfluxDB({ url, token });
    const writeApi = client.getWriteApi(org, bucket, 'ns');

    const point = new Point('absensi')
      .tag('kelas', kelas)
      .tag('status', status)
      .stringField('nama', nama)
      .stringField('nis', nis)
      .timestamp(new Date(tanggal));

    writeApi.writePoint(point);
    await writeApi.close();

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('❌ Gagal simpan ke InfluxDB:', err);
    res.status(500).json({ error: 'Gagal menyimpan data ke InfluxDB' });
  }
}
