/**
 * Cart total preview in integer paise (no float drift), mirroring the server's exclusive
 * GST rounded half-up. The server's figures on the returned bill are the authoritative ones.
 */
export function previewTotals(
  lines: { price: number; quantity: number }[],
  gstPercent: number,
  gstEnabled: boolean,
): { subtotal: number; gst: number; total: number } {
  const subtotalPaise = lines.reduce((sum, l) => sum + Math.round(l.price * 100) * l.quantity, 0);
  const pctHundredths = gstEnabled ? Math.round(gstPercent * 100) : 0;
  const gstPaise = Math.floor((subtotalPaise * pctHundredths + 5000) / 10000);
  return { subtotal: subtotalPaise / 100, gst: gstPaise / 100, total: (subtotalPaise + gstPaise) / 100 };
}
