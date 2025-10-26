const studentsFile = document.getElementById('studentsFile');
const attendanceFile = document.getElementById('attendanceFile');
const classSelect = document.getElementById('classSelect');

const hadirCount = document.getElementById('hadirCount');
const izinCount = document.getElementById('izinCount');
const sakitCount = document.getElementById('sakitCount');
const alfaCount = document.getElementById('alfaCount');
const ctx1 = document.getElementById('attendanceChart');
const ctx2 = document.getElementById('classPieChart');

let students = [];
let attendance = [];
let chart;
// --- EVENT UPLOAD ---
classSelect.addEventListener('change', updateDashboardByClass);
const monthSelect = document.getElementById("monthSelect");
monthSelect.addEventListener("change", updateDashboardByClass);

// --- HANDLE FILES ---
function handleStudentFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    students = parseCSV(event.target.result);
    console.log("Data siswa:", students);
    refreshClassList();
  };
  reader.readAsText(file);
}

function handleAttendanceFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    attendance = parseCSV(event.target.result);
    console.log("Data absensi:", attendance);
  };
  reader.readAsText(file);
}

function parseCSV(csv) {
  const rows = csv
    .replace(/\r/g, "") // hapus karakter carriage return
    .trim()
    .split("\n")
    .filter(r => r.trim() !== "");

  // header ke huruf kecil semua
  const header = rows[0].split(",").map(h => h.trim().toLowerCase());

  return rows.slice(1).map(row => {
    const values = row.split(",").map(v => v.trim());
    const obj = {};
    header.forEach((key, i) => (obj[key] = values[i] || ""));
    return obj;
  });
}

// --- Buat Dropdown Kelas ---
function refreshClassList() {
  const classes = [...new Set(students.map(s => s.kelas))];
  classSelect.innerHTML = '<option value="">-- Pilih Kelas --</option>';
  classes.forEach(k => {
    const opt = document.createElement("option");
    opt.value = k;
    opt.textContent = k;
    classSelect.appendChild(opt);
  });
  classSelect.disabled = false;
}

function updateDashboardByClass() {
  const selectedClass = classSelect.value;
  const selectedMonth = parseInt(monthSelect.value); // ambil bulan dari dropdown
  if (!selectedClass || attendance.length === 0) {
    alert("Pastikan kedua file sudah diunggah dan kelas dipilih!");
    return;
  }

  // Filter siswa berdasarkan kelas
  const classStudents = students.filter(s => s.kelas === selectedClass);
  const nisSet = new Set(classStudents.map(s => s.nis));

  // Filter absensi sesuai kelas
  let classAttendance = attendance.filter(a => nisSet.has(a.nis));

  // Tentukan bulan sebelumnya
  const currentYear = new Date().getFullYear();
  const previousMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
  const previousYear = selectedMonth === 1 ? currentYear - 1 : currentYear;

  // Ambil data bulan sebelumnya + bulan terpilih
  let filteredData = [];
  if (!isNaN(selectedMonth)) {
    filteredData = classAttendance.filter(row => {
      const date = new Date(row.tanggal);
      if (isNaN(date)) return false;
      const m = date.getMonth() + 1;
      const y = date.getFullYear();
      // Ambil data dari bulan sebelumnya DAN bulan terpilih
      return (
        (m === previousMonth && y === previousYear) ||
        (m === selectedMonth && y === currentYear)
      );
    });
  } else {
    filteredData = classAttendance;
  }

  console.log("Kelas:", selectedClass);
  console.log("Bulan dipilih:", selectedMonth);
  console.log("Data absensi (bulan sebelumnya & bulan ini):", filteredData);

  // === Gunakan data gabungan untuk summary & grafik ===
  updateSummary(filteredData);
  showClassPieChart(filteredData);
  compareMonths(filteredData);

  // === Update judul dashboard ===
  const dashboardTitle = document.getElementById("dashboardTitle");
  if (selectedMonth) {
    const monthNames = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const prevName = monthNames[previousMonth - 1];
    const currName = monthNames[selectedMonth - 1];
    dashboardTitle.textContent = `Perbandingan Absensi ${prevName} & ${currName} (${selectedClass})`;
  } else {
    dashboardTitle.textContent = `Ringkasan Absensi Semua Bulan (${selectedClass})`;
  }
}


// --- Hitung dan Tampilkan Summary + Grafik ---
function updateSummary(data) {
  const count = { Hadir: 0, Izin: 0, Sakit: 0, Alfa: 0 };
  const dailyStats = {};

  data.forEach(d => {
    const date = d.tanggal;
    if (!dailyStats[date]) {
      dailyStats[date] = { Hadir: 0, Izin: 0, Sakit: 0, Alfa: 0 };
    }

    const status = (d.status || "").replace(/\r/g, "").trim();
    if (count[status] !== undefined) {
      count[status]++;
      dailyStats[date][status]++;
    }
  });

  // Hitung total semua status
  const total = Object.values(count).reduce((a, b) => a + b, 0);

  // Ubah ke persentase (dibulatkan 1 angka desimal)
  const percent = {};
  for (const key in count) {
    percent[key] = total > 0 ? ((count[key] / total) * 100).toFixed(1) : 0;
  }

  // Tampilkan hasil di dashboard
  hadirCount.textContent = `${percent.Hadir}%`;
  izinCount.textContent = `${percent.Izin}%`;
  sakitCount.textContent = `${percent.Sakit}%`;
  alfaCount.textContent = `${percent.Alfa}%`;

  // Konversi dailyStats ke persentase juga (untuk chart)
  const dailyPercent = {};
  Object.keys(dailyStats).forEach(date => {
    const dayTotal = Object.values(dailyStats[date]).reduce((a, b) => a + b, 0);
    dailyPercent[date] = {};
    for (const key in dailyStats[date]) {
      dailyPercent[date][key] = dayTotal > 0
        ? ((dailyStats[date][key] / dayTotal) * 100).toFixed(1)
        : 0;
    }
  });

  updateChart(dailyPercent); // kirim data persentase ke grafik
}

// --- Fungsi Bandingkan Bulan Ini vs Bulan Lalu (berdasarkan dropdown) ---
function compareMonths(attendanceData) {
  const monthSelect = document.getElementById("monthSelect");
  const selectedMonth = parseInt(monthSelect.value); // nilai dari dropdown (1-12)

  // Tentukan tahun saat ini (bisa juga diubah jika kamu punya dropdown tahun)
  const currentYear = new Date().getFullYear();

  // Hitung bulan dan tahun sebelumnya
  const previousMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
  const previousYear = selectedMonth === 1 ? currentYear - 1 : currentYear;

  const monthlyData = {
    current: { Hadir: 0, Izin: 0, Sakit: 0, Alfa: 0 },
    previous: { Hadir: 0, Izin: 0, Sakit: 0, Alfa: 0 }
  };

  console.log(attendanceData);
  attendanceData.forEach(row => {
    const date = new Date(row.tanggal);
    if (isNaN(date)) return; // abaikan tanggal invalid

    const status = (row.status || row.Status || "").trim();
    const m = date.getMonth() + 1;
    const y = date.getFullYear();

    if (y === currentYear && m === selectedMonth && monthlyData.current[status] !== undefined)
      monthlyData.current[status]++;
    else if (y === previousYear && m === previousMonth && monthlyData.previous[status] !== undefined)
      monthlyData.previous[status]++;
  });
  
  console.log(monthlyData.current, monthlyData.previous);
  // total kehadiran masing-masing bulan
  const totalCurr = Object.values(monthlyData.current).reduce((a, b) => a + b, 0);
  const totalPrev = Object.values(monthlyData.previous).reduce((a, b) => a + b, 0);

  // tampilkan persentase per status
  for (const key in monthlyData.current) {
    const currPct = totalCurr > 0 ? (monthlyData.current[key] / totalCurr) * 100 : 0;
    const prevPct = totalPrev > 0 ? (monthlyData.previous[key] / totalPrev) * 100 : 0;
    console.log(currPct, prevPct);
    // update kartu summary: tampilkan bulan ini & bulan lalu (tanpa selisih)
    const el = document.getElementById(key.toLowerCase() + "Count");
    if (el) {
      el.innerHTML = `
        <strong>${currPct.toFixed(1)}%</strong>
        <div style="font-size:0.8rem;color:gray">
          ${prevPct.toFixed(1)}% bulan lalu
        </div>
      `;
    }
  }
}

// --- Grafik Per Hari (Bulanan) ---
function updateChart(dailyStats) {
  const sortedDates = Object.keys(dailyStats).sort();
  const hadirData = sortedDates.map(d => dailyStats[d].Hadir);
  const izinData = sortedDates.map(d => dailyStats[d].Izin);
  const sakitData = sortedDates.map(d => dailyStats[d].Sakit);
  const alfaData = sortedDates.map(d => dailyStats[d].Alfa);

  if (chart) chart.destroy();
  chart = new Chart(ctx1, {
    type: 'line',
    data: {
      labels: sortedDates,
      datasets: [
        { label: 'Hadir', data: hadirData, borderColor: '#2ecc71', tension: 0.3 },
        { label: 'Izin', data: izinData, borderColor: '#f1c40f', tension: 0.3 },
        { label: 'Sakit', data: sakitData, borderColor: '#3498db', tension: 0.3 },
        { label: 'Alfa', data: alfaData, borderColor: '#e74c3c', tension: 0.3 }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

// --- Fungsi untuk menampilkan pie chart absensi per status (bukan per kelas) ---
function showClassPieChart(data) {
  if (!data || data.length === 0) return;

  // Hitung total tiap status di kelas yang dipilih
  const statusTotals = { Hadir: 0, Izin: 0, Sakit: 0, Alfa: 0 };

  data.forEach(row => {
    const status = (row.Status || row.status || "").trim();
    if (statusTotals[status] !== undefined) {
      statusTotals[status]++;
    }
  });

  const totalAll = Object.values(statusTotals).reduce((a, b) => a + b, 0);
  if (totalAll === 0) return;

  const labels = Object.keys(statusTotals);
  const values = Object.values(statusTotals).map(v =>
    ((v / totalAll) * 100).toFixed(1)
  );

  // Hancurkan chart lama kalau ada
  if (window.classPieChart && typeof window.classPieChart.destroy === "function") {
    window.classPieChart.destroy();
  }

  const canvas = document.getElementById("classPieChart");
  const ctx = canvas.getContext("2d");

  // Buat chart baru
  window.classPieChart = new Chart(ctx2, {
    type: "pie",
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: [
          "#2ecc71", // Hadir
          "#f1c40f", // Izin
          "#3498db", // Sakit
          "#e74c3c"  // Alfa
        ]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" },
        title: {
          display: false,
          text: "Persentase Status Absensi Kelas"
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const label = context.label;
              const value = context.parsed;
              return `${label}: ${value}%`;
            }
          }
        }
      },
      layout: { padding: 10 }
    }
  });
}



// --- AUTO LOAD CSV TANPA KLIK ---
// Fungsi untuk load file CSV dari folder yang sama
async function loadCSVFile(filePath) {
  try {
    const response = await fetch(filePath);
    if (!response.ok) throw new Error(`Gagal memuat ${filePath}`);
    const text = await response.text();
    return parseCSV(text);
  } catch (err) {
    console.error("Error loading", filePath, err);
    return [];
  }
}

// Jalankan otomatis setelah halaman selesai dimuat
window.addEventListener("DOMContentLoaded", async () => {
  try {
    console.log("Memuat data otomatis...");

    // Ganti nama file sesuai milikmu
    students = await loadCSVFile("students_all.csv");
    attendance = await loadCSVFile("attendance_all.csv");

    console.log("Data siswa:", students);
    console.log("Data absensi:", attendance);

    // Tampilkan dropdown kelas
    refreshClassList();

    // Auto pilih kelas pertama (opsional)
    if (classSelect.options.length > 1) {
      classSelect.selectedIndex = 1; // pilih kelas pertama setelah "-- Pilih Kelas --"
      updateDashboardByClass();
    }

    // Tampilkan pie chart global langsung
    showClassPieChart(attendance);

  } catch (err) {
    console.error("Gagal inisialisasi dashboard:", err);
  }
});

function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', newTheme);
  
  const btn = document.querySelector('.theme-toggle');
  btn.textContent = newTheme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
  
  // Update charts if they exist
  if (window.attendanceChart) {
    updateChartTheme(chart);
  }
  if (window.classPieChart) {
    updateChartTheme(window.classPieChart);
  }
}

function updateChartTheme(chart) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#f1f5f9' : '#2d3748';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)';
  
  if (chart.options.scales) {
    chart.options.scales.x.ticks.color = textColor;
    chart.options.scales.y.ticks.color = textColor;
    chart.options.scales.x.grid.color = gridColor;
    chart.options.scales.y.grid.color = gridColor;
  }
  if (chart.options.plugins.legend) {
    chart.options.plugins.legend.labels.color = textColor;
  }
  chart.update();
}