// api/fetch.js
import { InfluxDB } from '@influxdata/influxdb-client'

export default async function handler(req, res) {
  const { tahun, bulan, kelas } = req.query

  const url = process.env.INFLUX_URL
  const token = process.env.INFLUX_TOKEN
  const org = process.env.INFLUX_ORG
  const bucket = process.env.INFLUX_BUCKET

  try {
    const influxDB = new InfluxDB({ url, token })
    const queryApi = influxDB.getQueryApi(org)

    // Query: ambil data absensi bulan dan tahun tertentu
    let fluxQuery = `
      from(bucket: "${bucket}")
        |> range(start: ${tahun}-${bulan.padStart(2, '0')}-01T00:00:00Z, stop: ${tahun}-${bulan.padStart(2, '0')}-31T23:59:59Z)
        |> filter(fn: (r) => r._measurement == "absensi")
    `
    if (kelas) fluxQuery += `|> filter(fn: (r) => r.kelas == "${kelas}")`

    const data = []
    await queryApi.collectRows(fluxQuery, {
      next(row, tableMeta) {
        const o = tableMeta.toObject(row)
        data.push({
          tanggal: o._time,
          status: o.status_text,
          kelas: o.kelas,
          nama: o.nama,
          nis: o.nis,
        })
      },
      error(err) {
        console.error('❌ Query error:', err)
        res.status(500).json({ error: 'Query gagal' })
      },
      complete() {
        res.status(200).json(data)
      },
    })
  } catch (err) {
    console.error('❌ Gagal ambil data:', err)
    res.status(500).json({ error: 'Gagal mengambil data dari InfluxDB' })
  }
}
