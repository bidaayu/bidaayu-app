// /api/update_csv.js
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

// === Fungsi bantu: buat nama file CSV berdasarkan tanggal pertama dalam data ===
function getCsvFilename(data) {
  if (!data || data.length === 0) return "attendance_unknown.csv";

  const tanggal = data[0].tanggal; // contoh: "2025-10-27"
  const dateObj = new Date(tanggal);
  const monthNames = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december"
  ];
  const month = monthNames[dateObj.getMonth()];
  const year = dateObj.getFullYear();

  return `attendance_${month}_${year}.csv`;
}

// === Handler utama untuk API ===
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { data } = req.body;
    const REPO = "bidaayu/bidaayu-app"; // 🔧 Ganti ini dengan repo kamu, contoh: "lejenlejen/absensi-app"
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

    if (!GITHUB_TOKEN) {
      res.status(500).json({ error: "Missing GitHub token in environment variable" });
      return;
    }

    const FILE_PATH = getCsvFilename(data);
    let fileData = null;
    let records = [];

    // === 1️⃣ Coba ambil file CSV lama dari GitHub ===
    const getFile = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` },
    });

    if (getFile.ok) {
      // File sudah ada → decode base64 ke teks CSV
      fileData = await getFile.json();
      const csvContent = Buffer.from(fileData.content, "base64").toString("utf8");
      if (csvContent.trim().length > 0) {
        records = parse(csvContent, { columns: true });
      }
    } else {
      console.log(`ℹ️ File ${FILE_PATH} belum ada, akan dibuat baru.`);
    }

    // === 2️⃣ Update atau tambah data baru ===
    for (const entry of data) {
      const idx = records.findIndex(
        (r) => r.nis === entry.nis && r.tanggal === entry.tanggal
      );
      if (idx >= 0) {
        records[idx] = entry; // update jika data sudah ada
      } else {
        records.push(entry); // tambahkan jika belum ada
      }
    }

    // === 3️⃣ Ubah kembali jadi CSV string ===
    const newCsv = stringify(records, { header: true });

    // === 4️⃣ Push file baru ke GitHub ===
    const update = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `update attendance ${new Date().toISOString()}`,
        content: Buffer.from(newCsv).toString("base64"),
        sha: fileData?.sha,
      }),
    });

    const result = await update.json();
    if (update.ok) {
      res.status(200).json({
        success: true,
        file: FILE_PATH,
        commit: result.commit?.sha || null,
      });
    } else {
      console.error("GitHub API error:", result);
      res.status(500).json({ error: result });
    }
  } catch (err) {
    console.error("❌ Error update CSV:", err);
    res.status(500).json({ error: err.message });
  }
}
