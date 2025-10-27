// /api/fetch.js
import { parse } from "csv-parse/sync";

export default async function handler(req, res) {
  try {
    const { tahun, bulan, kelas } = req.query;
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const REPO = "USERNAME/REPO"; // 🔧 Ganti ke repo kamu

    if (!tahun || !bulan) {
      return res.status(400).json({ error: "Parameter tahun dan bulan wajib diisi" });
    }

    const monthNames = [
      "january","february","march","april","may","june",
      "july","august","september","october","november","december"
    ];
    const fileName = `attendance_${monthNames[bulan - 1]}_${tahun}.csv`;

    // 🔹 Ambil file CSV dari GitHub
    const githubRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${fileName}`, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` },
    });

    if (!githubRes.ok) {
      return res.status(404).json({ error: `File ${fileName} tidak ditemukan di repo GitHub` });
    }

    const fileData = await githubRes.json();
    const csvContent = Buffer.from(fileData.content, "base64").toString("utf8");

    // 🔹 Ubah CSV ke JSON
    const records = parse(csvContent, { columns: true, skip_empty_lines: true });

    // 🔹 Filter kelas jika diperlukan
    const filtered = kelas ? records.filter(r => r.kelas === kelas) : records;

    return res.status(200).json(filtered);
  } catch (err) {
    console.error("❌ Gagal fetch data:", err);
    return res.status(500).json({ error: err.message });
  }
}
