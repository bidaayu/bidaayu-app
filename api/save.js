import { InfluxDB, Point } from '@influxdata/influxdb-client';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metode tidak diizinkan' });
  }

  try {
    const { data, bulk, tanggal, nis, nama, kelas, status } = req.body;

    const url = process.env.INFLUX_URL;
    const token = process.env.INFLUX_TOKEN;
    const org = process.env.INFLUX_ORG;
    const bucket = process.env.INFLUX_BUCKET;

    const client = new InfluxDB({ url, token });
    const writeApi = client.getWriteApi(org, bucket, 'ns');

    // === Mode bulk ===
    if (bulk && Array.isArray(data)) {
      data.forEach((item) => {
        const point = new Point('absensi')
          .tag('kelas', item.kelas)
          .tag('status', item.status)
          .stringField('nama', item.nama)
          .stringField('nis', item.nis)
          .timestamp(new Date(item.tanggal));

        writeApi.writePoint(point);
      });
    } 
    // === Mode tunggal ===
    else if (tanggal && nis && nama && kelas && status) {
      const point = new Point('absensi')
        .tag('kelas', kelas)
        .tag('status', status)
        .stringField('nama', nama)
        .stringField('nis', nis)
        .timestamp(new Date(tanggal));

      writeApi.writePoint(point);
    } 
    else {
      return res.status(400).json({ error: 'Data tidak lengkap atau format salah' });
    }

    await writeApi.close();
    res.status(200).json({ success: true, message: 'Data absensi berhasil disimpan ke InfluxDB' });
  } catch (err) {
    console.error('❌ Gagal simpan ke InfluxDB:', err);
    res.status(500).json({ error: 'Gagal menyimpan data ke InfluxDB', detail: err.message });
  }
}
