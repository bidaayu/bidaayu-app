// api/getData.js
import { InfluxDB } from "@influxdata/influxdb-client";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const url = process.env.INFLUX_URL;
    const token = process.env.INFLUX_TOKEN;
    const org = process.env.INFLUX_ORG;
    const bucket = process.env.INFLUX_BUCKET;

    const queryApi = new InfluxDB({ url, token }).getQueryApi(org);

    const query = `
      from(bucket: "${bucket}")
        |> range(start: -90d)
        |> filter(fn: (r) => r._measurement == "absensi")
        |> pivot(rowKey:["_time"], columnKey:["_field"], valueColumn:"_value")
        |> sort(columns: ["_time"], desc: false)
    `;

    const rows = [];
    await queryApi.queryRows(query, {
      next(row, tableMeta) {
        const o = tableMeta.toObject(row);
        rows.push({
          tanggal: o._time,
          nis: o.nis,
          nama: o.nama,
          kelas: o.kelas,
          status: o.status_text || o.status,
        });
      },
      error(error) {
        console.error("❌ Query error:", error);
        res.status(500).json({ error: "Failed to query InfluxDB", detail: error.message });
      },
      complete() {
        res.status(200).json(rows);
      },
    });
  } catch (err) {
    console.error("❌ Server error:", err);
    res.status(500).json({ error: "Failed to connect to InfluxDB", detail: err.message });
  }
}
