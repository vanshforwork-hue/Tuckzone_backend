import React, { useState } from 'react';
import { Calendar, FileSpreadsheet, FileText, Download } from 'lucide-react';
import { exportOrdersExcel, exportOrdersPdf } from '../../api/admin';
import toast from 'react-hot-toast';
import './ExportOrdersPage.css';

const STATUS_OPTIONS = ['ALL', 'PLACED', 'DELIVERED', 'REJECTED', 'CANCELLED'];

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function ExportOrdersPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState('ALL');
  const [exporting, setExporting] = useState(null);

  const statusParam = status === 'ALL' ? undefined : status;

  const handleExport = async (format) => {
    setExporting(format);
    try {
      if (format === 'excel') {
        const blob = await exportOrdersExcel(date, statusParam);
        downloadBlob(blob, `orders-${date}.xlsx`);
      } else {
        const blob = await exportOrdersPdf(date, statusParam);
        downloadBlob(blob, `orders-${date}.pdf`);
      }
      toast.success(`Exported orders as ${format === 'excel' ? 'Excel' : 'PDF'}`);
    } catch (err) {
      toast.error('Export failed — try a different date or status');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="admin-container">
      <div className="page-header">
        <h1>Export Orders</h1>
        <p>Download a student-safe order report — name, class/roll, items and totals only.</p>
      </div>

      <div className="card export-card">
        <div className="export-filters">
          <div className="date-picker-wrapper">
            <Calendar size={20} className="text-amber" />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="date-input" />
          </div>

          <select value={status} onChange={(e) => setStatus(e.target.value)} className="status-select">
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>{option.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        <div className="export-buttons">
          <button className="export-btn excel" onClick={() => handleExport('excel')} disabled={exporting !== null}>
            <FileSpreadsheet size={22} />
            <div>
              <strong>Export as Excel</strong>
              <span>.xlsx spreadsheet</span>
            </div>
            <Download size={16} className={exporting === 'excel' ? 'spinner' : ''} />
          </button>

          <button className="export-btn pdf" onClick={() => handleExport('pdf')} disabled={exporting !== null}>
            <FileText size={22} />
            <div>
              <strong>Export as PDF</strong>
              <span>Printable report</span>
            </div>
            <Download size={16} className={exporting === 'pdf' ? 'spinner' : ''} />
          </button>
        </div>

        <p className="export-note">
          Includes: Student Name, Class/Section, Roll Number, Ordered Items, Quantity, Order Total,
          Order Status, Payment Status, Order Date &amp; Time. No phone, email, wallet or address data.
        </p>
      </div>
    </div>
  );
}
