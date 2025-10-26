import { InfluxDB } from "@influxdata/influxdb-client";

export default async function handler(req, res) {
  try {
    const { tahun, bulan, kelas } = req.query;

    if (!tahun || !bulan) {
      return res.status(400).json({ error: "Parameter tahun dan bulan wajib diisi" });
    }

    const url = process.env.INFLUX_URL;
    const token = process.env.INFLUX_TOKEN;
    const org = process.env.INFLUX_ORG;
    const bucket = process.env.INFLUX_BUCKET;

    if (!url || !token || !org || !bucket) {
      console.error("❌ ENV tidak lengkap:", { url, token: !!token, org, bucket });
      return res.status(500).json({ error: "Konfigurasi server tidak lengkap (cek Environment Variables di Vercel)" });
    }

    const influxDB = new InfluxDB({ url, token });
    const queryApi = influxDB.getQueryApi(org);

    const start = `${tahun}-${bulan.toString().padStart(2, "0")}-01T00:00:00Z`;
    const endDate = new Date(tahun, bulan, 0);
    const end = `${tahun}-${bulan.toString().padStart(2, "0")}-${endDate.getDate()}T23:59:59Z`;

    let fluxQuery = `
      from(bucket: "${bucket}")
        |> range(start: ${JSON.stringify(start)}, stop: ${JSON.stringify(end)})
        |> filter(fn: (r) => r._measurement == "absensi")
        |> filter(fn: (r) => r._field == "status_text")
    `;

    if (kelas) {
      fluxQuery += `|> filter(fn: (r) => r.kelas == "${kelas}")`;
    }

    console.log("🔍 Query:", fluxQuery);

    const data = [];
    await queryApi.collectRows(fluxQuery, {
      next(row, tableMeta) {
        const o = tableMeta.toObject(row);
        data.push({
          tanggal: o._time,
          kelas: o.kelas,
          nama: o.nama,
          nis: o.nis,
          status: o._value
        });
      },
      error(error) {
        console.error("❌ Query error:", error);
      },
      complete() {
        console.log(`✅ Total data diambil: ${data.length}`);
      }
    });

    return res.status(200).json(data);
  } catch (err) {
    console.error("
