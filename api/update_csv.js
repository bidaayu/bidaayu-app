// /api/update_csv.js
import fetch from "node-fetch";
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
  const REPO = "USERNAME/REPOSITORY_NAME"; // 🔧 ganti: contoh "lejenlejen/absensi-app"
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

  if (!GITHUB_TOKEN) {
    return res.status(500).json({ error: "Missing GitHub token in environment variable" });
  }

  // Tentukan nama file berdasarkan bulan
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
      // file belum ada → nanti akan dibuat baru
      console.log(`ℹ️ File ${FILE_PATH} belum ada, akan dibuat baru.`);
    }

    // 2️⃣ Update atau tambahkan data absensi
    for (const entry of data) {
      const idx = records.findIndex(
        (r) => r.nis === entry.nis && r.tanggal === entry.tanggal
      );
      if (idx >= 0) {
        records[idx] = entry;
      } else {
        records.push(entry);
      }
    }

    // 3️⃣ Konversi kembali ke CSV string
    const newCsv = stringify(records, { header: true });

    // 4️⃣ Push ke GitHub (buat baru atau update)
    const update = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `update attendance ${new Date().toISOString()}`,
        content: Buffer.from(newCsv).toString("base64"),
        sha: fileData?.sha, // hanya dikirim kalau file lama ada
      }),
    });

    const result = await update.json();
    if (update.ok) {
      res.status(200).json({ success: true, file: FILE_PATH, commit: result.commit.sha });
    } else {
      res.status(500).json({ error: result });
    }
  } catch (err) {
    console.error("❌ Error update CSV:", err);
    res.status(500).json({ error: err.message });
  }
}
