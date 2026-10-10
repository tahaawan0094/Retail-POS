// Rebuild the standalone HTML and PDF from the editable Markdown source.
// Run with the project's Electron executable; no application data is accessed.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const base = 'Vertexia-POS-Complete-Blueprint';
const markdown = fs.readFileSync(path.join(root, `${base}.md`), 'utf8');
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inline = value => {
  const tokens = [];
  let result = value.replace(/`([^`]+)`/g, (_, code) => `\u0000${tokens.push(`<code>${escape(code)}</code>`) - 1}\u0000`);
  result = escape(result).replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return result.replace(/\u0000(\d+)\u0000/g, (_, i) => tokens[Number(i)]);
};
const lines = markdown.split(/\r?\n/).slice(2);
const headings = [];
let body = '';
let index = 0;
let section = 0;
while (index < lines.length) {
  const line = lines[index];
  if (!line.trim()) { index++; continue; }
  if (line.startsWith('```')) {
    const language = line.slice(3);
    const block = [];
    index++;
    while (index < lines.length && !lines[index].startsWith('```')) block.push(lines[index++]);
    index++;
    body += `<pre class="${language === 'json' ? 'json' : 'flow'}"><code>${escape(block.join('\n'))}</code></pre>`;
    continue;
  }
  const heading = /^(#{2,4})\s+(.+)$/.exec(line);
  if (heading) {
    const level = heading[1].length;
    const id = `section-${++section}`;
    if (level === 2) headings.push({ title: heading[2], id });
    body += `<h${level} id="${id}">${inline(heading[2])}</h${level}>`;
    index++;
    continue;
  }
  if (line.startsWith('|') && /^\|[\s:|-]+\|$/.test(lines[index + 1] || '')) {
    const cells = row => row.trim().slice(1, -1).split('|').map(cell => inline(cell.trim()));
    body += `<div class="table-wrap"><table><thead><tr>${cells(line).map(cell => `<th>${cell}</th>`).join('')}</tr></thead><tbody>`;
    index += 2;
    while (index < lines.length && lines[index].startsWith('|')) {
      body += `<tr>${cells(lines[index++]).map(cell => `<td>${cell}</td>`).join('')}</tr>`;
    }
    body += '</tbody></table></div>';
    continue;
  }
  if (/^(- |\d+\. )/.test(line)) {
    const ordered = /^\d+\. /.test(line);
    const pattern = ordered ? /^\d+\. / : /^- /;
    const tag = ordered ? 'ol' : 'ul';
    body += `<${tag}>`;
    while (index < lines.length && pattern.test(lines[index])) body += `<li>${inline(lines[index++].replace(pattern, ''))}</li>`;
    body += `</${tag}>`;
    continue;
  }
  const paragraph = [];
  while (index < lines.length && lines[index].trim() && !/^(#{2,4} |```|\||- |\d+\. )/.test(lines[index])) paragraph.push(lines[index++]);
  if (!paragraph.length) paragraph.push(lines[index++]);
  body += `<p>${inline(paragraph.join(' '))}</p>`;
}
const toc = headings.map(item => `<li><a href="#${item.id}">${escape(item.title)}</a></li>`).join('');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vertexia Retail POS — Complete Blueprint</title><style>
:root{--ink:#182338;--muted:#5b687d;--brand:#4c2887;--line:#dde3ec;--soft:#f4f5fb}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:var(--ink);font:15px/1.65 'Segoe UI',Arial,sans-serif;background:#e9edf4}
main{max-width:1100px;margin:30px auto;background:white;padding:58px 66px;box-shadow:0 12px 40px #17223814}
.cover{padding:38px 0 50px;border-bottom:3px solid var(--brand)}.eyebrow{font-size:12px;letter-spacing:2px;color:var(--brand);font-weight:700;text-transform:uppercase}
h1{font-size:52px;line-height:1.1;letter-spacing:-2px;margin:20px 0 18px}.subtitle{font-size:24px;max-width:700px;line-height:1.4;color:var(--muted)}.meta{font-size:13px;color:var(--muted);margin-top:30px}
.pill{display:inline-block;border:1px solid var(--line);background:var(--soft);padding:7px 12px;border-radius:4px;margin:6px 5px 0 0;font-size:12px}
.intro{max-width:800px;color:var(--muted)}.toc{margin:32px 0 40px;padding:24px 28px;background:var(--soft);border:1px solid var(--line)}.toc h2{margin:0 0 14px;border:0;padding:0;font-size:22px}.toc ul{columns:2;column-gap:30px;list-style:none;padding:0;margin:0}.toc li{break-inside:avoid;margin:0 0 8px;font-size:13px}
h2{font-size:26px;line-height:1.35;color:var(--brand);margin:42px 0 16px;padding-top:15px;border-top:1px solid var(--line);scroll-margin-top:20px}h3{font-size:19px;margin:24px 0 10px}p{margin:10px 0 15px}a{color:var(--brand);text-decoration:none;overflow-wrap:anywhere}a:hover{text-decoration:underline}li{margin:6px 0}ul,ol{padding-left:24px}
code{font-family:Consolas,'Courier New',monospace;font-size:.87em;background:var(--soft);border-radius:3px;padding:1px 4px;overflow-wrap:anywhere}pre{padding:18px 20px;background:#f5f7fb;border-left:3px solid #8564af;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.55;font-size:12px}pre code{background:none;padding:0;overflow-wrap:anywhere}
table{width:100%;border-collapse:collapse;font-size:12px;line-height:1.5;margin:16px 0 23px}th{text-align:left;background:#eee8f6;color:#351b61;font-weight:700}th,td{border:1px solid var(--line);padding:9px 10px;vertical-align:top;overflow-wrap:anywhere}tbody tr:nth-child(even){background:#fafbfe}.table-wrap{overflow:auto}.end{font-size:12px;color:var(--muted);margin-top:35px;border-top:1px solid var(--line);padding-top:12px}
@page{size:A4;margin:17mm 14mm 20mm}@media print{html{scroll-behavior:auto}body{background:white;font-size:10pt;line-height:1.5}main{margin:0;padding:0;max-width:none;box-shadow:none}.cover{min-height:230mm;padding:28mm 0 14mm;break-after:page;border-bottom:0}h1{font-size:42pt}.subtitle{font-size:21pt}.meta{font-size:10pt}.pill{font-size:9pt}.toc{break-after:page;margin:0;background:white;padding:8mm 0;border:0}.toc ul{columns:1}.toc li{font-size:10pt;margin-bottom:3mm}.toc h2{font-size:20pt}h2{font-size:17pt;margin:9mm 0 4mm;padding-top:4mm;break-after:avoid}h3{font-size:12pt;break-after:avoid}p{orphans:3;widows:3;margin:3mm 0}li{margin:1.7mm 0}table{font-size:8.5pt;margin:4mm 0;table-layout:fixed}th,td{padding:2.1mm}thead{display:table-header-group}tr{break-inside:avoid}.table-wrap{overflow:visible}pre{font-size:8.5pt;padding:4mm;break-inside:avoid}.end{font-size:8pt}a{color:inherit}code{font-size:.86em}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
@media(max-width:760px){main{margin:0;padding:28px 20px}h1{font-size:40px}.subtitle{font-size:20px}.toc ul{columns:1}.table-wrap{overflow-x:auto}table{min-width:560px}}
</style></head><body><main><header class="cover"><div class="eyebrow">Vertexia / Product & Engineering</div><h1>Retail POS<br>Complete Blueprint</h1><div class="subtitle">Single shop, multiple counters aur multi-branch operation ke liye complete product aur implementation specification.</div><p class="intro">Offline-first operations · Online synchronization · Company licensing · Security · Inventory and ledgers · Windows distribution</p><div class="meta">Version 1.0 &nbsp; | &nbsp; 9 October 2026<br>Roman Urdu + Technical English</div><div><span class="pill">Business owner</span><span class="pill">Developer</span><span class="pill">QA & implementation</span><span class="pill">Support team</span></div><p class="intro" style="margin-top:32px">Proposed target design. Existing project findings, operational limits aur commercial release gates explicitly documented hain.</p></header><nav class="toc" aria-label="Contents"><h2>Contents</h2><ul>${toc}</ul></nav><article>${body}</article><footer class="end">Vertexia Retail POS · Complete Blueprint · Version 1.0 · 9 October 2026</footer></main></body></html>`;
fs.writeFileSync(path.join(root, `${base}.html`), html);

app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 1200, height: 1000, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  try {
    await window.loadFile(path.join(root, `${base}.html`));
    await window.webContents.executeJavaScript('document.fonts.ready');
    const pdf = await window.webContents.printToPDF({ printBackground: true, pageSize: 'A4', preferCSSPageSize: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: '<div style="font-size:8px;width:100%;padding:0 14mm;color:#657086;display:flex;justify-content:space-between"><span>VERTEXIA RETAIL POS · BLUEPRINT v1.0</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>' });
    fs.writeFileSync(path.join(root, `${base}.pdf`), pdf);
    const screenshot = await window.webContents.capturePage();
    fs.writeFileSync(path.join(root, `${base}.preview.png`), screenshot.toPNG());
    console.log(JSON.stringify({ sections: headings.length, words: markdown.split(/\s+/).length, pdfBytes: pdf.length, files: ['md', 'html', 'pdf'].map(ext => path.join(root, `${base}.${ext}`)) }));
    app.quit();
  } catch (error) { console.error(error); app.exit(1); }
});
