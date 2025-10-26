import { InfluxDB, Point } from "@influxdata/influxdb-client";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metode tidak diizinkan" });
  }

  const { tanggal, nis, nama, kelas, status } = req.body;
  if (!tanggal || !nis || !nama || !kelas || !status) {
    return res.status(400).json({ error: "Data tidak lengkap" });
  }

  try {
    const url = process.env.INFLUX_URL;
    const token = process.env.INFLUX_TOKEN;
    const org = process.env.INFLUX_ORG;
    const bucket = process.env.INFLUX_BUCKET;

    const influxDB = new InfluxDB({ url, token });
    const writeApi = influxDB.getWriteApi(org, bucket, "ns");

    const point = new Point("absensi")
      .tag("kelas", kelas)
      .tag("status", status)
      .tag("nama", nama)
      .tag("nis", nis)
      .stringField("status_text", status)
      .timestamp(new Date(tanggal));

    writeApi.writePoint(point);
    await writeApi.close();

    return res.status(200).json({ message: "✅ Data tersimpan ke InfluxDB Cloud" });
  } catch (err) {
    console.error("❌ Gagal menulis ke InfluxDB:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
