// /api/fetch.js
import { InfluxDB } from "@influxdata/influxdb-client";

export default async function handler(req, res) {
  try {
    const { tahun, bulan } = req.query;

    const url = process.env.INFLUX_URL;
    const token = process.env.INFLUX_TOKEN;
    const org = process.env.INFLUX_ORG;
    const bucket = process.env.INFLUX_BUCKET;

    if (!url || !token || !org || !bucket) {
      console.error("❌ ENV tidak lengkap");
      return res.status(500).json({ error: "Konfigurasi InfluxDB belum lengkap" });
    }

    const influxDB = new InfluxDB({ url, token });
    const queryApi = influxDB.getQueryApi(org);

    const startDate = new Date(tahun, bulan-1, 1); // bulan 0-index
    const stopDate = new Date(tahun, bulan, 1); // bulan berikutnya
    
    const fluxQuery = `
    from(bucket: "absensi")
    |> range(start: 2025-10-01T00:00:00Z, stop: 2025-11-01T00:00:00Z)
    |> filter(fn: (r) => r._measurement == "absensi")
    |> keep(columns: ["_time", "_value", "kelas", "status", "nama", "nis"]) 
    `;

    console.log("🔍 Query:", fluxQuery);
    const data = [];
    await queryApi.collectRows(fluxQuery, {
      next(row) {
        data.push(row);
      },
      error(error) {
        console.error("❌ Query error:", error);
      },
      complete() {
        console.log("✅ Query selesai:", data.length, "baris");
      },
    });

    res.status(200).json(data);
  } catch (err) {
    console.error("❌ Server error:", err);
    res.status(500).json({ error: "Gagal mengambil data dari InfluxDB", detail: err.message });
  }

}



