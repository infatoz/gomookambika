import React, { useRef } from 'react';
import { Modal, Button, Tag, Space, Divider } from 'antd';
import {
  PrinterOutlined,
  DownloadOutlined,
  CheckCircleFilled,
  CarOutlined,
  UserOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  SafetyCertificateOutlined,
  BarcodeOutlined,
  CloseOutlined,
} from '@ant-design/icons';

export interface BookingTicketData {
  _id: string;
  bookingNumber: string;
  status: string;
  tripType: string;
  createdAt: string;
  scheduledAt?: string;
  completedAt?: string;
  customerId?: {
    name: string;
    phone: string;
    email?: string;
  };
  pickupLocation: {
    address: string;
    coordinates?: [number, number];
  };
  dropLocation?: {
    address: string;
    coordinates?: [number, number];
  };
  originTaxiStandId?: {
    _id: string;
    name: string;
  };
  destinationTaxiStandId?: {
    _id: string;
    name: string;
  };
  vehicleCategoryId?: {
    _id: string;
    name: string;
    code: string;
    icon?: string;
    baseFare?: number;
    ratePerKm?: number;
  };
  assignedDriverId?: {
    _id?: string;
    name: string;
    phone: string;
    driverCode?: string;
    rating?: number;
  };
  assignedVehicleId?: {
    _id?: string;
    registrationNumber: string;
    brand: string;
    vehicleModel: string;
    color?: string;
    manufacturingYear?: number;
  };
  fareSnapshot?: {
    baseFare?: number;
    distanceKm?: number;
    distanceFare?: number;
    waitingFare?: number;
    nightMultiplierApplied?: boolean;
    nightCharges?: number;
    subtotal?: number;
    taxes?: number;
    total: number;
    currency?: string;
  };
  paymentStatus: string;
  paymentOption: string;
  passengers?: number;
  notes?: string;
}

interface ETicketModalProps {
  open: boolean;
  onClose: () => void;
  booking: BookingTicketData | null;
}

export function ETicketModal({ open, onClose, booking }: ETicketModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!booking) return null;

  const fare = booking.fareSnapshot ?? { total: 0 };
  const totalAmount = fare.total || 0;
  // Estimate or calculate taxes and subtotal if not explicit
  const subtotal = fare.subtotal || Math.round((totalAmount / 1.05) * 100) / 100;
  const totalTax = fare.taxes || Math.round((totalAmount - subtotal) * 100) / 100;
  const cgst = Math.round((totalTax / 2) * 100) / 100;
  const sgst = Math.round((totalTax - cgst) * 100) / 100;

  const formatDate = (d?: string) => {
    if (!d) return 'Immediate Dispatch';
    const date = new Date(d);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }) + ', ' + date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=900,height=750');
    if (!printWindow) {
      alert('Please allow popups to print ticket');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>E-Ticket_${booking.bookingNumber}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');
            
            @page {
              size: A4 portrait;
              margin: 12mm 15mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: 'Inter', -apple-system, sans-serif;
              color: #1e293b;
              background: #ffffff;
              padding: 10px;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .ticket-container {
              max-width: 780px;
              margin: 0 auto;
              border: 2px solid #0f172a;
              border-radius: 16px;
              overflow: hidden;
              background: #ffffff;
              box-shadow: none;
            }
            .ticket-header {
              background: linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4338ca 100%);
              color: #ffffff;
              padding: 24px 28px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #0f172a;
            }
            .brand-title {
              font-size: 20px;
              font-weight: 800;
              letter-spacing: 0.5px;
              text-transform: uppercase;
              color: #ffffff;
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .brand-subtitle {
              font-size: 11px;
              color: #c7d2fe;
              font-weight: 500;
              margin-top: 3px;
              letter-spacing: 0.3px;
            }
            .pnr-box {
              text-align: right;
            }
            .pnr-label {
              font-size: 10px;
              font-weight: 600;
              text-transform: uppercase;
              color: #a5b4fc;
              letter-spacing: 1px;
            }
            .pnr-value {
              font-family: 'JetBrains Mono', monospace;
              font-size: 22px;
              font-weight: 800;
              color: #fbbf24;
              letter-spacing: 1px;
            }
            .route-banner {
              background: #f8fafc;
              padding: 20px 28px;
              border-bottom: 1px solid #e2e8f0;
              display: grid;
              grid-template-columns: 1fr auto 1fr;
              gap: 20px;
              align-items: center;
            }
            .route-point h4 {
              font-size: 11px;
              text-transform: uppercase;
              color: #64748b;
              font-weight: 700;
              letter-spacing: 0.8px;
              margin-bottom: 4px;
            }
            .route-point p {
              font-size: 14px;
              font-weight: 700;
              color: #0f172a;
              line-height: 1.3;
            }
            .route-divider {
              text-align: center;
              padding: 0 10px;
            }
            .trip-type-tag {
              display: inline-block;
              background: #e0e7ff;
              color: #3730a3;
              font-size: 10px;
              font-weight: 700;
              padding: 4px 10px;
              border-radius: 20px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .ticket-body {
              padding: 24px 28px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 16px;
              margin-bottom: 24px;
            }
            .info-item h5 {
              font-size: 10px;
              text-transform: uppercase;
              color: #64748b;
              font-weight: 600;
              letter-spacing: 0.5px;
              margin-bottom: 4px;
            }
            .info-item p {
              font-size: 13px;
              font-weight: 600;
              color: #0f172a;
            }
            .vehicle-card {
              background: #f1f5f9;
              border: 1px solid #cbd5e1;
              border-radius: 12px;
              padding: 16px 20px;
              display: grid;
              grid-template-columns: 1.2fr 1fr;
              gap: 16px;
              margin-bottom: 24px;
            }
            .license-plate {
              display: inline-block;
              background: #fef08a;
              color: #1e293b;
              border: 2px solid #854d0e;
              border-radius: 6px;
              padding: 4px 12px;
              font-family: 'JetBrains Mono', monospace;
              font-size: 15px;
              font-weight: 800;
              letter-spacing: 1.5px;
              margin-top: 4px;
            }
            .perforation {
              position: relative;
              border-top: 2px dashed #94a3b8;
              margin: 20px -28px;
            }
            .perforation::before, .perforation::after {
              content: '';
              position: absolute;
              top: -12px;
              width: 24px;
              height: 24px;
              background: #ffffff;
              border-radius: 50%;
              border: 2px solid #0f172a;
            }
            .perforation::before { left: -14px; }
            .perforation::after { right: -14px; }
            .invoice-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
              font-size: 12px;
            }
            .invoice-table th {
              text-align: left;
              padding: 8px 12px;
              background: #f8fafc;
              border-bottom: 2px solid #e2e8f0;
              color: #475569;
              font-weight: 700;
              text-transform: uppercase;
              font-size: 10px;
              letter-spacing: 0.5px;
            }
            .invoice-table td {
              padding: 8px 12px;
              border-bottom: 1px solid #e2e8f0;
              color: #1e293b;
            }
            .invoice-table td.text-right {
              text-align: right;
            }
            .total-row td {
              font-size: 15px;
              font-weight: 800;
              color: #1e1b4b;
              background: #eef2ff;
              border-top: 2px solid #c7d2fe;
              border-bottom: 2px solid #c7d2fe;
            }
            .ticket-footer {
              background: #0f172a;
              color: #94a3b8;
              padding: 16px 28px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 11px;
            }
            .barcode-svg {
              height: 38px;
            }
            .stamp {
              border: 2px solid #16a34a;
              color: #16a34a;
              border-radius: 6px;
              padding: 4px 10px;
              font-weight: 800;
              text-transform: uppercase;
              font-size: 11px;
              letter-spacing: 1px;
              display: inline-block;
              transform: rotate(-3deg);
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={820}
      footer={null}
      centered
      closeIcon={<CloseOutlined className="text-gray-400 hover:text-gray-700" />}
      styles={{
        body: {
          padding: 0,
          borderRadius: 20,
          overflow: 'hidden',
        },
      }}
    >
      {/* Action Header in Modal */}
      <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
            <SafetyCertificateOutlined className="text-lg" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-wide">
              Official Passenger E-Ticket
            </h3>
            <p className="text-xs text-indigo-300">
              Go Mookambika Tourist Taxi Co-Operative Permit & Invoice
            </p>
          </div>
        </div>
        <Space>
          <Button
            type="primary"
            icon={<PrinterOutlined />}
            onClick={handlePrint}
            style={{
              background: '#4f46e5',
              borderColor: '#4338ca',
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.35)',
            }}
          >
            Print / Save PDF
          </Button>
          <Button onClick={onClose} style={{ borderColor: '#475569', color: '#cbd5e1' }}>
            Close
          </Button>
        </Space>
      </div>

      {/* Printable Ticket Area */}
      <div className="p-6 bg-slate-100 max-h-[80vh] overflow-y-auto">
        <div
          ref={printRef}
          className="ticket-container bg-white rounded-2xl border-2 border-slate-900 shadow-xl overflow-hidden mx-auto text-slate-800"
          style={{ maxWidth: 740 }}
        >
          {/* Header */}
          <div
            className="ticket-header p-6 flex items-center justify-between"
            style={{
              background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4338ca 100%)',
              color: '#ffffff',
            }}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">🚕</span>
                <span className="text-xl font-extrabold uppercase tracking-wide text-white">
                  GO MOOKAMBIKA TAXI
                </span>
                <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 px-2 py-0.5 rounded-full font-bold">
                  VERIFIED PASS
                </span>
              </div>
              <div className="text-xs text-indigo-200 mt-1 font-medium">
                Kollur Temple & Regional Tourist Taxi Permit Service • 24x7 Helpline
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">
                BOOKING REFERENCE / PNR
              </div>
              <div className="font-mono text-2xl font-black text-amber-400 tracking-wider">
                {booking.bookingNumber}
              </div>
              <div className="text-[11px] text-slate-300">
                Issued: {new Date(booking.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>

          {/* Route Section */}
          <div className="route-banner bg-slate-50 border-b border-slate-200 p-5 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="route-point">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                <EnvironmentOutlined className="text-emerald-600" /> PICKUP LOCATION
              </div>
              <p className="text-sm font-bold text-slate-900 leading-snug">
                {booking.originTaxiStandId?.name ? `${booking.originTaxiStandId.name} Taxi Stand` : booking.pickupLocation.address}
              </p>
              {booking.originTaxiStandId?.name && booking.pickupLocation.address !== booking.originTaxiStandId.name && (
                <div className="text-xs text-slate-500 mt-0.5 truncate">{booking.pickupLocation.address}</div>
              )}
            </div>

            <div className="text-center flex flex-col items-center justify-center">
              <span className="inline-block bg-indigo-100 text-indigo-800 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider mb-2">
                {booking.tripType?.replace(/_/g, ' ') || 'ONE WAY TRIP'}
              </span>
              <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
                <span>━━━━━</span>
                <CarOutlined className="text-base" />
                <span>━━━━━</span>
              </div>
              {fare.distanceKm ? (
                <div className="text-xs font-semibold text-slate-600 mt-1">
                  Est. Distance: {fare.distanceKm} KM
                </div>
              ) : null}
            </div>

            <div className="route-point md:text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center md:justify-end gap-1">
                <EnvironmentOutlined className="text-red-500" /> DROP DESTINATION
              </div>
              <p className="text-sm font-bold text-slate-900 leading-snug">
                {booking.destinationTaxiStandId?.name ? `${booking.destinationTaxiStandId.name} Taxi Stand` : (booking.dropLocation?.address || 'As Directed By Passenger')}
              </p>
              {booking.dropLocation?.address && booking.destinationTaxiStandId?.name && (
                <div className="text-xs text-slate-500 mt-0.5 truncate">{booking.dropLocation.address}</div>
              )}
            </div>
          </div>

          {/* Details Body */}
          <div className="ticket-body p-6">
            {/* Passenger & Schedule Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-5 border-b border-slate-100">
              <div>
                <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  PRIMARY PASSENGER
                </div>
                <div className="text-sm font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
                  <UserOutlined className="text-slate-400" />
                  {booking.customerId?.name || 'Guest Passenger'}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 font-medium">
                  {booking.customerId?.phone || '—'}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  SCHEDULED TIME
                </div>
                <div className="text-sm font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
                  <CalendarOutlined className="text-slate-400" />
                  {formatDate(booking.scheduledAt || booking.createdAt)}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 font-medium">
                  {booking.scheduledAt ? 'Advance Reservation' : 'Instant Dispatch'}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  VEHICLE CATEGORY
                </div>
                <div className="text-sm font-bold text-indigo-700 mt-0.5">
                  {booking.vehicleCategoryId?.name || 'Standard Taxi'}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 font-mono">
                  {booking.vehicleCategoryId?.code || 'CAB'}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  BOOKING STATUS
                </div>
                <div className="mt-1">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      booking.status === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                        : booking.status === 'CANCELLED'
                        ? 'bg-red-100 text-red-700 border border-red-300'
                        : 'bg-blue-100 text-blue-700 border border-blue-300'
                    }`}
                  >
                    {booking.status?.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            </div>

            {/* Chauffeur & Vehicle Credentials Card */}
            <div className="my-5 p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                  <CarOutlined className="text-indigo-600" /> ALLOCATED VEHICLE
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <div className="license-plate bg-amber-200 border-2 border-amber-800 rounded px-2.5 py-1 font-mono font-black text-slate-900 text-sm tracking-wider">
                    {booking.assignedVehicleId?.registrationNumber || 'PENDING ALLOCATION'}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      {booking.assignedVehicleId ? `${booking.assignedVehicleId.brand} ${booking.assignedVehicleId.vehicleModel}` : 'Vehicle Being Assigned'}
                    </div>
                    {booking.assignedVehicleId?.color && (
                      <div className="text-xs text-slate-500">Color: {booking.assignedVehicleId.color}</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t md:border-t-0 md:border-l md:pl-4 border-slate-200">
                <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                  <UserOutlined className="text-emerald-600" /> CHAUFFEUR CREDENTIALS
                </div>
                <div className="mt-1.5">
                  <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    {booking.assignedDriverId?.name || 'Driver Allocation In Progress'}
                    {booking.assignedDriverId?.driverCode && (
                      <span className="text-[10px] font-mono bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                        {booking.assignedDriverId.driverCode}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5 flex items-center gap-1.5 font-medium">
                    <PhoneOutlined className="text-slate-400" />
                    {booking.assignedDriverId?.phone || 'Stand Dispatch Office: +91 94812 00000'}
                  </div>
                </div>
              </div>
            </div>

            {/* Perforation Line */}
            <div className="relative my-6">
              <div className="border-t-2 border-dashed border-slate-300" />
              <div className="absolute -left-9 -top-3 w-6 h-6 bg-slate-100 rounded-full border-r-2 border-slate-900" />
              <div className="absolute -right-9 -top-3 w-6 h-6 bg-slate-100 rounded-full border-l-2 border-slate-900" />
            </div>

            {/* Itemized Fare & Tax Invoice Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Fare Breakdown & Tax Invoice (GST Registered)
                </span>
                <span className="text-xs text-slate-400">SAC: 996412 (Taxi Transport Services)</span>
              </div>

              <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-2.5 text-left">Description</th>
                    <th className="p-2.5 text-center">Unit / Metric</th>
                    <th className="p-2.5 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  <tr>
                    <td className="p-2.5">Base Fare (Inclusive of Minimum Distance)</td>
                    <td className="p-2.5 text-center text-slate-500">Standard Base</td>
                    <td className="p-2.5 text-right font-semibold">
                      ₹{(fare.baseFare || Math.round(subtotal * 0.4)).toFixed(2)}
                    </td>
                  </tr>
                  {fare.distanceKm ? (
                    <tr>
                      <td className="p-2.5">Distance Travel Charges</td>
                      <td className="p-2.5 text-center text-slate-500">{fare.distanceKm} KM</td>
                      <td className="p-2.5 text-right font-semibold">
                        ₹{(fare.distanceFare || Math.round(subtotal * 0.6)).toFixed(2)}
                      </td>
                    </tr>
                  ) : null}
                  {fare.nightMultiplierApplied && (
                    <tr>
                      <td className="p-2.5">Night Surcharge / Driver Night Allowance</td>
                      <td className="p-2.5 text-center text-slate-500">Night Slot</td>
                      <td className="p-2.5 text-right font-semibold">
                        ₹{(fare.nightCharges || 0).toFixed(2)}
                      </td>
                    </tr>
                  )}
                  {fare.waitingFare ? (
                    <tr>
                      <td className="p-2.5">Waiting Charges</td>
                      <td className="p-2.5 text-center text-slate-500">Waiting Time</td>
                      <td className="p-2.5 text-right font-semibold">₹{fare.waitingFare.toFixed(2)}</td>
                    </tr>
                  ) : null}
                  <tr className="bg-slate-50/70 text-slate-500">
                    <td className="p-2">CGST (2.5%)</td>
                    <td className="p-2 text-center">2.5%</td>
                    <td className="p-2 text-right">₹{cgst.toFixed(2)}</td>
                  </tr>
                  <tr className="bg-slate-50/70 text-slate-500">
                    <td className="p-2">SGST (2.5%)</td>
                    <td className="p-2 text-center">2.5%</td>
                    <td className="p-2 text-right">₹{sgst.toFixed(2)}</td>
                  </tr>
                  <tr className="bg-indigo-50 font-bold text-slate-900 border-t-2 border-indigo-200">
                    <td className="p-3 text-sm font-extrabold text-indigo-900">
                      TOTAL FARE PAID / PAYABLE
                    </td>
                    <td className="p-3 text-center">
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase">
                        {booking.paymentStatus || 'PAID'} • {booking.paymentOption || 'CASH'}
                      </span>
                    </td>
                    <td className="p-3 text-right text-base font-extrabold text-indigo-900">
                      ₹{totalAmount.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Barcode & Safety Strip */}
            <div className="mt-5 pt-4 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-900 rounded-lg flex items-center justify-center text-white text-2xl font-mono">
                  #
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    SECURITY CODE
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-800">
                    SEC-{booking._id.slice(-8).toUpperCase()}-{booking.bookingNumber}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Scan or quote code for trip validation and toll reimbursement
                  </div>
                </div>
              </div>

              <div className="text-center md:text-right">
                <span className="inline-block border-2 border-emerald-600 text-emerald-600 font-extrabold text-[11px] px-3 py-1 rounded-md uppercase tracking-wider -rotate-2">
                  ✓ VERIFIED BY GO MOOKAMBIKA
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="ticket-footer bg-slate-900 text-slate-400 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-2 text-[11px] border-t-2 border-slate-900">
            <div>
              <span className="font-bold text-slate-200">Go Mookambika Taxi Association Control Room:</span> +91 94812 00000 • Kollur, Udupi District, KA
            </div>
            <div className="text-slate-400 text-[10px]">
              Computer generated e-ticket. No physical signature required.
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
