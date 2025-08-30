export type CSVHeader = { key: string; label: string };

function downloadBlob(filename: string, content: Blob) {
  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportToCSV(filename: string, rows: any[], headers: CSVHeader[]) {
  const headerLine = headers.map((h) => '"' + h.label.replaceAll('"', '""') + '"').join(",");
  const lines = rows.map((row) =>
    headers
      .map((h) => {
        const v = row[h.key];
        const s = v === undefined || v === null ? "" : String(v);
        return '"' + s.replaceAll('"', '""') + '"';
      })
      .join(","),
  );
  const csv = [headerLine, ...lines].join("\n");
  downloadBlob(filename, new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
}

export function exportHTMLTableAsPDF(filename: string, title: string, tableHTML: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>body{font-family: Inter, Arial, sans-serif; padding:16px} table{width:100%; border-collapse:collapse} th,td{border:1px solid #ddd; padding:8px; font-size:12px} th{background:#f3f4f6;}</style>
  </head><body><h2>${title}</h2>${tableHTML}</body></html>`);
  w.document.close();
  w.focus();
  w.print();
}
