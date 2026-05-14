const palette = ["#0f766e", "#2563eb", "#d97706", "#7c3aed", "#db2777", "#475569", "#16a34a", "#dc2626", "#0891b2", "#9333ea"];

const sampleCsv = `Order Date,Region,Sales Rep,Product,Category,Units,Unit Price,Revenue,Profit,Customer Type,Channel,Satisfaction
2025-01-04,North,Ava,Atlas Keyboard,Hardware,14,84.25,1179.50,236.20,Enterprise,Partner,8
2025-01-07,West,Liam,Flux Monitor,Hardware,7,310.00,2170.00,499.10,SMB,Online,9
2025-01-11,South,Noah,Nova Desk,Office,5,455.75,2278.75,341.81,Enterprise,Direct,7
2025-01-18,East,Mia,Cloud Seat,Software,31,39.99,1239.69,681.83,Startup,Online,10
2025-02-03,North,Eva,Atlas Keyboard,Hardware,22,84.25,1853.50,370.70,SMB,Direct,8
2025-02-09,West,Leo,Beacon Mouse,Hardware,40,26.50,1060.00,222.60,Consumer,Retail,6
2025-02-14,South,Ava,Cloud Seat,Software,18,39.99,719.82,395.90,Startup,Online,9
2025-02-21,East,Mia,Nova Desk,Office,9,455.75,4101.75,656.28,Enterprise,Partner,7
2025-03-02,North,Noah,Flux Monitor,Hardware,12,310.00,3720.00,781.20,SMB,Direct,8
2025-03-12,West,Eva,Cloud Seat,Software,44,39.99,1759.56,967.76,Startup,Online,10
2025-03-16,South,Leo,Atlas Keyboard,Hardware,16,84.25,1348.00,269.60,Consumer,Retail,7
2025-03-24,East,Liam,Beacon Mouse,Hardware,57,26.50,1510.50,317.21,SMB,Partner,8
2025-04-05,North,Mia,Nova Desk,Office,11,455.75,5013.25,802.12,Enterprise,Direct,9
2025-04-12,West,Noah,Atlas Keyboard,Hardware,19,84.25,1600.75,320.15,Consumer,Online,6
2025-04-20,South,Eva,Flux Monitor,Hardware,6,310.00,1860.00,390.60,SMB,Partner,7
2025-05-01,East,Ava,Cloud Seat,Software,39,39.99,1559.61,857.79,Startup,Online,10
2025-05-09,North,Leo,Beacon Mouse,Hardware,63,26.50,1669.50,350.60,Consumer,Retail,6
2025-05-16,West,Liam,Nova Desk,Office,8,455.75,3646.00,583.36,Enterprise,Direct,8
2025-05-23,South,Mia,Atlas Keyboard,Hardware,25,84.25,2106.25,421.25,SMB,Online,9
2025-06-02,East,Noah,Flux Monitor,Hardware,10,310.00,3100.00,651.00,Enterprise,Partner,8`;

let charts = [];

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("csvFile").addEventListener("change", handleFileUpload);
  runDashboard(sampleCsv, "Demo dataset");
});

function handleFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => runDashboard(String(reader.result || ""), file.name);
  reader.readAsText(file);
}

function runDashboard(csvText, name) {
  const parsed = parseCsv(csvText);
  if (!parsed.headers.length || !parsed.rows.length) {
    renderError("The CSV needs a header row and at least one data row.");
    return;
  }

  const analysis = analyzeDataset(parsed.headers, parsed.rows);
  const chartSpecs = buildChartSpecs(analysis).slice(0, 40);

  updateMetrics(analysis, name);
  renderColumns(analysis.columns);
  renderFormulas();
  renderPreview(parsed.headers, parsed.rows);
  renderCharts(chartSpecs);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(value.trim());
      value = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(value.trim());
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  row.push(value.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);

  const headers = (rows.shift() || []).map((header, index) => header || `Column ${index + 1}`);
  const normalizedRows = rows.map((cells) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = cells[index] ?? "";
    });
    return record;
  });

  return { headers, rows: normalizedRows };
}

function analyzeDataset(headers, rows) {
  const columns = headers.map((name) => analyzeColumn(name, rows.map((row) => row[name])));
  return {
    headers,
    rows,
    columns,
    numeric: columns.filter((column) => column.kind === "number"),
    date: columns.filter((column) => column.kind === "date"),
    category: columns.filter((column) => column.kind === "category"),
    text: columns.filter((column) => column.kind === "text"),
  };
}

function analyzeColumn(name, rawValues) {
  const values = rawValues.map(cleanCell);
  const filled = values.filter((value) => value !== "");
  const total = values.length || 1;
  const unique = new Set(filled.map((value) => value.toLowerCase())).size;
  const numericValues = filled.map(parseNumber).filter(Number.isFinite);
  const dateValues = filled.map(parseDate).filter((value) => value instanceof Date && !Number.isNaN(value.getTime()));
  const numberRatio = numericValues.length / Math.max(filled.length, 1);
  const dateRatio = dateValues.length / Math.max(filled.length, 1);
  const uniqueRatio = unique / Math.max(filled.length, 1);
  const headerHint = inferHeaderHint(name);

  let kind = "text";
  if (dateRatio >= 0.82 || (headerHint === "date" && dateRatio >= 0.55)) kind = "date";
  else if (numberRatio >= 0.82 && headerHint !== "id") kind = "number";
  else if (unique <= 30 || uniqueRatio <= 0.5 || headerHint === "category") kind = "category";

  const stats = kind === "number" ? numericStats(numericValues) : {};
  const topValues = topCounts(filled);

  return {
    name,
    kind,
    total,
    filled: filled.length,
    missing: total - filled.length,
    unique,
    uniqueRatio,
    confidence: confidenceScore(kind, numberRatio, dateRatio, uniqueRatio, filled.length),
    numericValues,
    dateValues,
    values,
    topValues,
    stats,
    sample: filled.slice(0, 4).join(", "),
  };
}

function inferHeaderHint(name) {
  const lower = name.toLowerCase();
  if (/\b(date|time|month|year|created|updated|dob)\b/.test(lower)) return "date";
  if (/\b(id|uuid|code|zip|postal|phone)\b/.test(lower)) return "id";
  if (/\b(type|status|category|region|country|state|city|segment|channel|rep|name)\b/.test(lower)) return "category";
  return "unknown";
}

function cleanCell(value) {
  return String(value ?? "").trim();
}

function parseNumber(value) {
  if (value === "") return NaN;
  const normalized = String(value).replace(/[$,%\s]/g, "").replace(/,/g, "");
  if (!/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(normalized)) return NaN;
  return Number(normalized);
}

function parseDate(value) {
  if (!value || Number.isFinite(parseNumber(value))) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function confidenceScore(kind, numberRatio, dateRatio, uniqueRatio, filled) {
  if (!filled) return 0;
  if (kind === "number") return Math.round(numberRatio * 100);
  if (kind === "date") return Math.round(dateRatio * 100);
  if (kind === "category") return Math.round((1 - Math.min(uniqueRatio, 0.9)) * 100);
  return Math.round(Math.min(95, 55 + uniqueRatio * 40));
}

function numericStats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  const mean = n ? sum / n : 0;
  const variance = n > 1 ? sorted.reduce((acc, value) => acc + (value - mean) ** 2, 0) / (n - 1) : 0;
  return {
    n,
    sum,
    min: sorted[0] ?? 0,
    max: sorted[n - 1] ?? 0,
    mean,
    median: percentile(sorted, 0.5),
    q1: percentile(sorted, 0.25),
    q3: percentile(sorted, 0.75),
    variance,
    stdDev: Math.sqrt(variance),
  };
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function topCounts(values, limit = 12) {
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function updateMetrics(analysis, name) {
  document.getElementById("datasetName").textContent = name;
  document.getElementById("rowCount").textContent = analysis.rows.length.toLocaleString();
  document.getElementById("columnCount").textContent = analysis.headers.length.toLocaleString();
  document.getElementById("numericCount").textContent = analysis.numeric.length;
  document.getElementById("dateCount").textContent = analysis.date.length;
  document.getElementById("categoryCount").textContent = analysis.category.length;
}

function renderColumns(columns) {
  const rows = columns.map((column) => `
    <tr>
      <td><strong>${escapeHtml(column.name)}</strong></td>
      <td><span class="pill ${column.kind}">${column.kind}</span></td>
      <td>${column.filled.toLocaleString()} / ${column.total.toLocaleString()}</td>
      <td>${column.missing.toLocaleString()}</td>
      <td>${column.unique.toLocaleString()}</td>
      <td>${column.confidence}%</td>
      <td>${column.kind === "number" ? formatNumber(column.stats.mean) : escapeHtml(column.sample || "empty")}</td>
    </tr>
  `).join("");

  document.getElementById("columnsTable").innerHTML = `
    <table>
      <thead>
        <tr><th>Header</th><th>Type</th><th>Filled</th><th>Missing</th><th>Unique</th><th>Confidence</th><th>Signal</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderFormulas() {
  const formulas = [
    ["Mean", "x̄ = (Σxᵢ) / n"],
    ["Sample Variance", "s² = Σ(xᵢ - x̄)² / (n - 1)"],
    ["Standard Deviation", "s = sqrt(s²)"],
    ["Missing Rate", "missing % = missing cells / total rows × 100"],
    ["Category Share", "share(category) = count(category) / non-empty count × 100"],
    ["Histogram Bin Width", "width = (max(x) - min(x)) / ceil(sqrt(n))"],
    ["Correlation", "r = Σ((xᵢ - x̄)(yᵢ - ȳ)) / sqrt(Σ(xᵢ - x̄)²Σ(yᵢ - ȳ)²)"],
  ];

  document.getElementById("formulaList").innerHTML = formulas.map(([title, formula]) => `
    <div class="formula"><strong>${title}</strong><code>${formula}</code></div>
  `).join("");
}

function renderPreview(headers, rows) {
  document.getElementById("previewCount").textContent = `${Math.min(rows.length, 20)} of ${rows.length.toLocaleString()} rows`;
  const head = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const body = rows.slice(0, 20).map((row) => `
    <tr>${headers.map((header) => `<td>${escapeHtml(row[header])}</td>`).join("")}</tr>
  `).join("");
  document.getElementById("previewTable").innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function buildChartSpecs(analysis) {
  const specs = [];
  const numeric = analysis.numeric;
  const categories = analysis.category;
  const dates = analysis.date;

  categories.forEach((category) => {
    specs.push(categoryBar(category));
    specs.push(categoryDoughnut(category));
  });

  numeric.forEach((column) => {
    specs.push(histogram(column));
    specs.push(boxSummary(column));
  });

  categories.forEach((category) => {
    numeric.forEach((number) => {
      specs.push(categoryAggregate(analysis.rows, category, number, "sum"));
      specs.push(categoryAggregate(analysis.rows, category, number, "avg"));
    });
  });

  dates.forEach((dateColumn) => {
    numeric.forEach((number) => specs.push(timeSeries(analysis.rows, dateColumn, number)));
  });

  for (let i = 0; i < numeric.length; i++) {
    for (let j = i + 1; j < numeric.length; j++) {
      specs.push(scatterPlot(analysis.rows, numeric[i], numeric[j]));
    }
  }

  categories.forEach((category) => {
    dates.forEach((dateColumn) => specs.push(categoryOverTime(analysis.rows, dateColumn, category)));
  });

  return specs.filter(Boolean).sort((a, b) => b.score - a.score);
}

function categoryBar(column) {
  return {
    score: 90 - column.uniqueRatio * 10,
    title: `Top ${column.name}`,
    note: "Frequency distribution for common text values.",
    type: "bar",
    data: {
      labels: column.topValues.map((item) => item.label),
      datasets: [{ label: "Rows", data: column.topValues.map((item) => item.count), backgroundColor: palette[0] }],
    },
  };
}

function categoryDoughnut(column) {
  return {
    score: 78 - column.uniqueRatio * 10,
    title: `${column.name} Share`,
    note: "Category share based on non-empty rows.",
    type: "doughnut",
    data: {
      labels: column.topValues.slice(0, 8).map((item) => item.label),
      datasets: [{ data: column.topValues.slice(0, 8).map((item) => item.count), backgroundColor: palette }],
    },
  };
}

function histogram(column) {
  const bins = makeBins(column.numericValues);
  return {
    score: 86,
    title: `${column.name} Distribution`,
    note: "Histogram using square-root bin count.",
    type: "bar",
    data: {
      labels: bins.map((bin) => bin.label),
      datasets: [{ label: "Rows", data: bins.map((bin) => bin.count), backgroundColor: palette[2] }],
    },
  };
}

function boxSummary(column) {
  const labels = ["Min", "Q1", "Median", "Q3", "Max"];
  const stats = column.stats;
  return {
    score: 74,
    title: `${column.name} Five-Number Summary`,
    note: "Min, quartiles, median, and max for numeric spread.",
    type: "line",
    data: {
      labels,
      datasets: [{
        label: column.name,
        data: [stats.min, stats.q1, stats.median, stats.q3, stats.max],
        borderColor: palette[1],
        backgroundColor: "rgba(37, 99, 235, 0.14)",
        fill: true,
        tension: 0.25,
      }],
    },
  };
}

function categoryAggregate(rows, category, number, mode) {
  const grouped = new Map();
  rows.forEach((row) => {
    const key = cleanCell(row[category.name]) || "Unknown";
    const value = parseNumber(row[number.name]);
    if (!Number.isFinite(value)) return;
    const current = grouped.get(key) || { sum: 0, count: 0 };
    current.sum += value;
    current.count += 1;
    grouped.set(key, current);
  });
  const entries = [...grouped.entries()]
    .map(([label, item]) => ({ label, value: mode === "sum" ? item.sum : item.sum / item.count }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);
  if (entries.length < 2) return null;

  return {
    score: mode === "sum" ? 96 : 88,
    title: `${mode === "sum" ? "Total" : "Average"} ${number.name} by ${category.name}`,
    note: mode === "sum" ? "Σ numeric value grouped by category." : "Mean numeric value grouped by category.",
    type: "bar",
    data: {
      labels: entries.map((entry) => entry.label),
      datasets: [{ label: number.name, data: entries.map((entry) => entry.value), backgroundColor: mode === "sum" ? palette[1] : palette[4] }],
    },
  };
}

function timeSeries(rows, dateColumn, number) {
  const grouped = new Map();
  rows.forEach((row) => {
    const date = parseDate(row[dateColumn.name]);
    const value = parseNumber(row[number.name]);
    if (!date || !Number.isFinite(value)) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    grouped.set(key, (grouped.get(key) || 0) + value);
  });
  const entries = [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (entries.length < 2) return null;

  return {
    score: 99,
    title: `${number.name} Over ${dateColumn.name}`,
    note: "Monthly trend using summed numeric values.",
    type: "line",
    data: {
      labels: entries.map(([label]) => label),
      datasets: [{
        label: number.name,
        data: entries.map(([, value]) => value),
        borderColor: palette[0],
        backgroundColor: "rgba(15, 118, 110, 0.14)",
        fill: true,
        tension: 0.3,
      }],
    },
  };
}

function scatterPlot(rows, xColumn, yColumn) {
  const points = rows.map((row) => ({
    x: parseNumber(row[xColumn.name]),
    y: parseNumber(row[yColumn.name]),
  })).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (points.length < 3) return null;

  return {
    score: 82 + Math.abs(correlation(points.map((p) => p.x), points.map((p) => p.y))) * 10,
    title: `${xColumn.name} vs ${yColumn.name}`,
    note: `Correlation r = ${formatNumber(correlation(points.map((p) => p.x), points.map((p) => p.y)))}`,
    type: "scatter",
    data: {
      datasets: [{ label: `${xColumn.name} / ${yColumn.name}`, data: points, backgroundColor: palette[3] }],
    },
  };
}

function categoryOverTime(rows, dateColumn, category) {
  const grouped = new Map();
  rows.forEach((row) => {
    const date = parseDate(row[dateColumn.name]);
    const cat = cleanCell(row[category.name]);
    if (!date || !cat) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (!grouped.has(key)) grouped.set(key, new Map());
    const bucket = grouped.get(key);
    bucket.set(cat, (bucket.get(cat) || 0) + 1);
  });
  const labels = [...grouped.keys()].sort();
  const topCategories = category.topValues.slice(0, 4).map((item) => item.label);
  if (labels.length < 2 || topCategories.length < 2) return null;

  return {
    score: 80,
    title: `${category.name} Mix Over ${dateColumn.name}`,
    note: "Monthly row count split by top categories.",
    type: "line",
    data: {
      labels,
      datasets: topCategories.map((cat, index) => ({
        label: cat,
        data: labels.map((label) => grouped.get(label)?.get(cat) || 0),
        borderColor: palette[index],
        backgroundColor: palette[index],
        tension: 0.25,
      })),
    },
  };
}

function makeBins(values) {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const count = Math.max(3, Math.ceil(Math.sqrt(values.length)));
  const width = max === min ? 1 : (max - min) / count;
  const bins = Array.from({ length: count }, (_, index) => {
    const start = min + index * width;
    const end = index === count - 1 ? max : start + width;
    return { start, end, count: 0, label: `${formatNumber(start)}-${formatNumber(end)}` };
  });
  values.forEach((value) => {
    const index = Math.min(count - 1, Math.floor((value - min) / width));
    bins[index].count += 1;
  });
  return bins;
}

function correlation(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    numerator += dx * dy;
    denomX += dx ** 2;
    denomY += dy ** 2;
  }
  return denomX && denomY ? numerator / Math.sqrt(denomX * denomY) : 0;
}

function renderCharts(specs) {
  charts.forEach((chart) => chart.destroy());
  charts = [];
  document.getElementById("chartCount").textContent = `${specs.length} charts selected`;
  const chartGrid = document.getElementById("chartGrid");

  if (typeof Chart === "undefined") {
    chartGrid.innerHTML = `<div class="empty-state">The dashboard loaded, but Chart.js is unavailable. Connect to the internet or serve a local Chart.js build to render the chart gallery.</div>`;
    return;
  }

  if (!specs.length) {
    chartGrid.innerHTML = `<div class="empty-state">No chartable patterns found. Try a CSV with numeric, date, or repeated category columns.</div>`;
    return;
  }

  chartGrid.innerHTML = specs.map((spec, index) => `
    <article class="chart-card">
      <h3>${escapeHtml(spec.title)}</h3>
      <p>${escapeHtml(spec.note)}</p>
      <div class="chart-wrap"><canvas id="chart-${index}"></canvas></div>
    </article>
  `).join("");

  specs.forEach((spec, index) => {
    const context = document.getElementById(`chart-${index}`);
    charts.push(new Chart(context, {
      type: spec.type,
      data: spec.data,
      options: chartOptions(spec.type),
    }));
  });
}

function chartOptions(type) {
  const base = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: type !== "bar", position: "bottom", labels: { boxWidth: 10, usePointStyle: true } },
      tooltip: { mode: "index", intersect: false },
    },
  };

  if (type === "doughnut") return base;
  return {
    ...base,
    scales: {
      x: { ticks: { maxRotation: 45, minRotation: 0 }, grid: { display: false } },
      y: { beginAtZero: true, grid: { color: "rgba(104, 117, 140, 0.16)" } },
    },
  };
}

function renderError(message) {
  document.getElementById("chartGrid").innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
