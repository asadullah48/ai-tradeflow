/**
 * A tiny dependency-free PDF writer for the browser demo's khata statement
 * (the API renders the same statement with ReportLab). Text only, A4,
 * Helvetica/Courier, automatic page breaks.
 */
type Line = { text: string; font?: "F1" | "F2" | "F3"; size?: number; gap?: number };

const ascii = (s: string) =>
  s.replace(/[—–]/g, "-").replace(/[^\x20-\x7e]/g, "?").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

export function textPdf(lines: Line[], title: string): Blob {
  const pages: string[] = [];
  let ops: string[] = [];
  let y = 800;
  const flush = () => {
    pages.push(ops.join("\n"));
    ops = [];
    y = 800;
  };
  for (const l of lines) {
    const size = l.size ?? 10;
    const step = l.gap ?? size + 5;
    if (y - step < 40) flush();
    y -= step;
    ops.push(`BT /${l.font ?? "F1"} ${size} Tf 42 ${y} Td (${ascii(l.text)}) Tj ET`);
  }
  flush();

  const objects: string[] = [];
  const add = (body: string) => {
    objects.push(body);
    return objects.length;
  };
  const catalog = add("");
  const pagesObj = add("");
  const f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const f3 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");
  const kids: number[] = [];
  for (const content of pages) {
    const stream = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 595 842] ` +
      `/Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R /F3 ${f3} 0 R >> >> /Contents ${stream} 0 R >>`));
  }
  const info = add(`<< /Title (${ascii(title)}) /Producer (AI TradeFlow demo) >>`);
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objects[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([out], { type: "application/pdf" });
}
