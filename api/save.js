import { InfluxDB, Point } from '@influxdata/influxdb-client';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metode tidak diizinkan' });
  }

  const url = process.env.INFLUX_URL;
  const token = process.env.INFLUX_TOKEN;
  const org = process.env.INFLUX_ORG;
  const bucket = process.env.INFLUX_BUCKET;

  const client = new InfluxDB({ url, token });
  const writeApi = client.getWriteApi(org, bucket, 'ns');

  try {
    const { bulk, data } = req.body;

    console.log("📥 [SAVE] Permintaan diterima");
    console.log(`🔹 Mode Bulk: ${bulk}`);
    console.log(`🔹 Jumlah data diterima: ${data?.length || 0}`);

    if (bulk && Array.isArray(data)) {
      let counter = 0;
      for (const item of data) {
        const { tanggal, nis, nama, kelas, status } = item;

        const point = new Point('absensi')
          .tag('kelas', kelas)
          .tag('status', status)
          .stringField('nama', nama)
          .stringField('nis', nis)
          .timestamp(new Date(tanggal));

        writeApi.writePoint(point);
        counter++;

        console.log(`✅ [${counter}] ${nama} (${nis}) - ${kelas} - ${status} @ ${tanggal}`);

        // beri jeda kecil agar semua data benar-benar terkirim (Vercel cepat menutup koneksi)
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // flush semua sebelum close
      await writeApi.flush();
      await writeApi.close();

      console.log("🎯 Semua data absensi berhasil dikirim ke InfluxDB!");
      return res.status(200).json({ success: true, count: data.length });
    }

    // === MODE SATUAN (non-bulk) ===
    const { tanggal, nis, nama, kelas, status } = req.body;

    const point = new Point('absensi')
      .tag('kelas', kelas)
      .tag('status', status)
      .stringField('nama', nama)
      .stringField('nis', nis)
      .timestamp(new Date(tanggal));

    writeApi.writePoint(point);
    await writeApi.flush();
    await writeApi.close();

    console.log(`✅ [SINGLE] ${nama} (${nis}) - ${kelas} - ${status} @ ${tanggal}`);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Gagal simpan ke InfluxDB:", err);
    res.status(500).json({ error: err.message || 'Gagal menyimpan data ke InfluxDB' });
  }
}
