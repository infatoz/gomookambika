import { useState } from 'react';
import { Calendar, Clock, X, Check, Car, Sparkles, ShieldCheck } from 'lucide-react';

interface UberScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string; // YYYY-MM-DD
  selectedTime: string; // HH:mm
  onSaveSchedule: (date: string, time: string) => void;
  onResetToNow: () => void;
  isCurrentlyScheduled: boolean;
}

export function UberScheduleModal({
  isOpen,
  onClose,
  selectedDate,
  selectedTime,
  onSaveSchedule,
  onResetToNow,
  isCurrentlyScheduled,
}: UberScheduleModalProps) {
  const [date, setDate] = useState(selectedDate);
  const [time, setTime] = useState(selectedTime);

  if (!isOpen) return null;

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const dayAfter = new Date(now);
  dayAfter.setDate(dayAfter.getDate() + 2);
  const dayAfterStr = dayAfter.toISOString().split('T')[0];

  // Maximum schedule 30 days ahead
  const maxDate = new Date(now);
  maxDate.setDate(maxDate.getDate() + 30);
  const maxDateStr = maxDate.toISOString().split('T')[0];

  const formatPreviewDate = () => {
    try {
      const [y, m, d] = date.split('-').map(Number);
      const [hrs, mins] = time.split(':').map(Number);
      const target = new Date(y, m - 1, d, hrs, mins);
      if (isNaN(target.getTime())) return `${date} at ${time}`;
      return target.toLocaleString('en-IN', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return `${date} at ${time}`;
    }
  };

  const handleConfirm = () => {
    onSaveSchedule(date, time);
    onClose();
  };

  const handleResetNow = () => {
    onResetToNow();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in text-black">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 animate-slide-up border border-neutral-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-neutral-900">Schedule Your Ride</h3>
              <p className="text-xs text-neutral-500">Pick date and start time for your trip</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Date Selectors */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-neutral-500" />
            <span>Select Date</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setDate(todayStr)}
              className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all ${
                date === todayStr
                  ? 'bg-black text-white border-black shadow-xs'
                  : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border-neutral-200'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setDate(tomorrowStr)}
              className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all ${
                date === tomorrowStr
                  ? 'bg-black text-white border-black shadow-xs'
                  : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border-neutral-200'
              }`}
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={() => setDate(dayAfterStr)}
              className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all ${
                date === dayAfterStr
                  ? 'bg-black text-white border-black shadow-xs'
                  : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border-neutral-200'
              }`}
            >
              In 2 Days
            </button>
          </div>

          <div className="pt-1.5">
            <input
              type="date"
              value={date}
              min={todayStr}
              max={maxDateStr}
              onChange={e => setDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-sm font-semibold text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-black"
            />
          </div>
        </div>

        {/* Time Selector */}
        <div className="space-y-1.5 pt-1">
          <label className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-neutral-500" />
            <span>Select Pickup Time</span>
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: '06:00 AM', val: '06:00' },
              { label: '08:30 AM', val: '08:30' },
              { label: '11:00 AM', val: '11:00' },
              { label: '04:30 PM', val: '16:30' },
            ].map(slot => (
              <button
                key={slot.val}
                type="button"
                onClick={() => setTime(slot.val)}
                className={`py-1.5 px-1 rounded-xl text-[11px] font-semibold border transition-all ${
                  time === slot.val
                    ? 'bg-black text-white border-black shadow-xs'
                    : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border-neutral-200'
                }`}
              >
                {slot.label}
              </button>
            ))}
          </div>

          <div className="pt-1.5">
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-sm font-semibold text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-black"
            />
          </div>
        </div>

        {/* Selected Summary Card */}
        <div className="p-3 rounded-2xl bg-indigo-50/80 border border-indigo-200 text-xs text-indigo-950 space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-indigo-900">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Scheduled Pickup Time:</span>
          </div>
          <div className="text-sm font-black text-indigo-900 pl-5">
            {formatPreviewDate()}
          </div>
          <p className="text-[11px] text-indigo-700 pl-5 pt-0.5 leading-tight">
            On the trip start date, the taxi stand queue system will automatically dispatch the next eligible driver to you.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full py-3.5 bg-black hover:bg-neutral-800 text-white font-bold rounded-2xl text-sm transition-all active:scale-[0.98] shadow-md flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>Confirm Schedule Time</span>
          </button>

          {isCurrentlyScheduled && (
            <button
              type="button"
              onClick={handleResetNow}
              className="w-full py-2.5 text-xs font-semibold text-neutral-600 hover:text-black rounded-xl hover:bg-neutral-100 transition-colors"
            >
              Switch back to Ride Now (Immediate)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
