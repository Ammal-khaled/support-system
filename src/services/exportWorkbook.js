export function normalizeExport(value, ancestors = new WeakSet()) {
  if (value == null) return "";
  if (typeof value !== "object") return value;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value.path === "string" && value.firestore) return value.path;
  if (ancestors.has(value)) return "[Circular reference]";
  ancestors.add(value);
  const result = Array.isArray(value)
    ? value.map((item) => normalizeExport(item, ancestors))
    : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeExport(item, ancestors)]));
  ancestors.delete(value);
  return result;
}

export function enrichExport(row, users) {
  const result = { ...row };
  for (const [idKey, nameKey] of [["agentId", "agentName"], ["createdById", "createdByName"], ["updatedById", "updatedByName"], ["reviewedById", "reviewedByName"]]) {
    const user = users.find((item) => item.id === row[idKey]);
    if (user) {
      result[nameKey] = row[nameKey] || user.name || user.displayName || user.email || "";
      result[idKey.replace(/Id$/, "Email")] = user.email || "";
    }
  }
  return normalizeExport(result);
}

export async function downloadWorkbook(fileName, datasets) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AquaDesk";
  // Long transcripts are split across continuation columns, never truncated.
  for (const { label, rows } of Object.values(datasets)) {
    const sheet = workbook.addWorksheet(label.slice(0, 31));
    const values = rows.map((row) => {
      const cells = {};
      for (const [key, value] of Object.entries(normalizeExport(row))) {
        const text = typeof value === "object" ? JSON.stringify(value) : String(value);
        for (let offset = 0; offset < Math.max(text.length, 1); offset += 30000) {
          cells[offset ? `${key} (part ${offset / 30000 + 1})` : key] = text.slice(offset, offset + 30000);
        }
      }
      return cells;
    });
    const headers = [...new Set(values.flatMap(Object.keys))];
    sheet.columns = (headers.length ? headers : ["No records"]).map((key) => ({ header: key, key, width: 28 }));
    sheet.addRows(values);
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.getRow(1).font = { bold: true };
    if (headers.length) sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  }
  const bytes = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
