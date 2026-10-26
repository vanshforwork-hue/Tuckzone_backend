import type { Bill } from '../api/billing';

const money = (cur: string, n: number) => `${cur}${n.toFixed(2)}`;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Plain-text receipt, used for native share and as the fallback when printing is unavailable. */
export function receiptText(b: Bill): string {
  const c = b.currencySymbol;
  const when = new Date(b.createdAt).toLocaleString('en-IN');
  const out = [b.businessName, b.address, b.phone && `Ph: ${b.phone}`, b.gstin && `GSTIN: ${b.gstin}`]
    .filter(Boolean) as string[];
  out.push('-'.repeat(32), `Bill: ${b.invoiceNumber}`, when);
  if (b.status === 'VOID') out.push('*** VOID ***');
  out.push('-'.repeat(32));
  b.lines.forEach((l) => out.push(`${l.itemName} x${l.quantity}  ${money(c, l.lineTotal)}`));
  out.push('-'.repeat(32), `Subtotal  ${money(c, b.subtotal)}`);
  if (b.gstAmount > 0) out.push(`GST ${b.gstPercent}%  ${money(c, b.gstAmount)}`);
  out.push(`TOTAL  ${money(c, b.total)}`);
  if (b.paymentMethod) out.push(`Paid by: ${b.paymentMethod} (recorded manually)`);
  if (b.footerMessage) out.push('', b.footerMessage);
  return out.join('\n');
}

/** Print-ready HTML sized for a thermal-width roll; every field is escaped. */
export function receiptHtml(b: Bill): string {
  const c = b.currencySymbol;
  const rows = b.lines
    .map((l) => `<tr><td>${esc(l.itemName)} x${l.quantity}</td><td class="r">${esc(money(c, l.lineTotal))}</td></tr>`)
    .join('');
  const line = (label: string, v: number) => `<tr><td>${label}</td><td class="r">${esc(money(c, v))}</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(b.invoiceNumber)}</title>
<style>@page{size:80mm auto;margin:4mm}body{font:12px monospace;width:72mm;margin:0}
h1{font-size:16px;text-align:center;margin:0}.c{text-align:center}table{width:100%;border-collapse:collapse}
.r{text-align:right}hr{border:0;border-top:1px dashed #000}.v{text-align:center;font-weight:bold;font-size:16px}</style></head><body>
<h1>${esc(b.businessName)}</h1>
${b.address ? `<div class="c">${esc(b.address)}</div>` : ''}${b.phone ? `<div class="c">Ph: ${esc(b.phone)}</div>` : ''}${b.gstin ? `<div class="c">GSTIN: ${esc(b.gstin)}</div>` : ''}
<hr><div>Bill: ${esc(b.invoiceNumber)}</div><div>${esc(new Date(b.createdAt).toLocaleString('en-IN'))}</div>
${b.status === 'VOID' ? '<div class="v">*** VOID ***</div>' : ''}<hr>
<table>${rows}</table><hr><table>${line('Subtotal', b.subtotal)}${b.gstAmount > 0 ? line(`GST ${b.gstPercent}%`, b.gstAmount) : ''}
<tr><td><b>TOTAL</b></td><td class="r"><b>${esc(money(c, b.total))}</b></td></tr></table>
${b.paymentMethod ? `<div>Paid by: ${esc(b.paymentMethod)} (recorded manually)</div>` : ''}
${b.footerMessage ? `<hr><div class="c">${esc(b.footerMessage)}</div>` : ''}</body></html>`;
}
