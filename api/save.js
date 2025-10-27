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

    // === LOG AWAL ===
    console.log("📥 [SAVE] Permintaan diterima");
    console.log("🔹 Mode Bulk:", bulk);
    console.log("🔹 Jumlah data diterima:", bulk && data ? data.length : 1);

    if (bulk && Array.isArray(data)) {
      data.forEach((item, index) => {
        const { tanggal, nis, nama, kelas, status } = item;

        const ts = new Date(tanggal);
        const now = new Date();

        // 🔒 Hindari error 'timestamp out of retention'
        const timestamp = (now - ts > 1000 * 60 * 60 * 24 * 30) ? now : ts;

        const point = new Point('absensi')
          .tag('kelas', kelas)
          .tag('status', status)
          .stringField('nama', nama)
          .stringField('nis', nis)
          .timestamp(timestamp);

        writeApi.writePoint(point);

        // === LOG PER DATA ===
        console.log(`✅ [${index + 1}] ${nama} (${nis}) - ${kelas} - ${status} @ ${timestamp.toISOString()}`);
      });
    } else {
      // fallback kalau bukan bulk
      const { tanggal, nis, nama, kelas, status } = req.body;
      const timestamp = new Date(tanggal);

      const point = new Point('absensi')
        .tag('kelas', kelas)
        .tag('status', status)
        .stringField('nama', nama)
        .stringField('nis', nis)
        .timestamp(timestamp);

      writeApi.writePoint(point);

      console.log(`✅ [Single] ${nama} (${nis}) - ${kelas} - ${status} @ ${timestamp.toISOString()}`);
    }

    await writeApi.close();

    console.log("🎯 Semua data absensi berhasil dikirim ke InfluxDB!\n");

    res.status(200).json({
      success: true,
      message: '✅ Semua data absensi tersimpan ke InfluxDB!'
    });

  } catch (err) {
    console.error('❌ Gagal simpan ke InfluxDB:', err);
    res.status(500).json({
      error: err.message || 'Gagal menyimpan data ke InfluxDB'
    });
  }
}
