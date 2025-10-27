// /api/update_csv.js
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

// Fungsi bantu untuk dapatkan nama file CSV berdasarkan tanggal pertama dalam data
function getCsvFilename(data) {
  if (!data || data.length === 0) return "attendance_unknown.csv";

  const tanggal = data[0].tanggal; // format "YYYY-MM-DD"
  const dateObj = new Date(tanggal);
  const monthNames = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december"
  ];
  const month = monthNames[dateObj.getMonth()];
  const year = dateObj.getFullYear();

  return `attendance_${month}_${year}.csv`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { data } = req.body;
  const REPO = "bidaayu/bidaayu-app"; // 🔧 ganti sesuai repo kamu
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

  if (!GITHUB_TOKEN) {
    return res.status(500).json({ error: "Missing GitHub token in environment variable" });
  }

  const FILE_PATH = getCsvFilename(data);

  try {
    // 1️⃣ Coba ambil file CSV dari GitHub
    let fileData = null;
    let records = [];

    const getFile = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` },
    });

    if (getFile.ok) {
      // file sudah ada → decode isinya
      fileData = await getFile.json();
      const csvContent = Buffer.from(fileData.content, "base64").toString("utf8");
      if (csvContent.trim().length > 0) {
        records = parse(csvContent, { columns: true });
      }
    } else {
      console.log(`ℹ️ File ${FILE_PATH} belum ada, akan dibuat baru.`);
    }

    // 2️⃣ Update atau tambahkan data absensi
    for (const entry of data) {
      const idx = records.findIndex(
        (r) => r.ni
