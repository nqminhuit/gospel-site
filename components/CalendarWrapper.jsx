'use client';

import { useRouter } from 'next/navigation';
import CalendarSection from './CalendarSection';
import { formatVi } from '@/lib/date';

function parseDateOnly(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d); // local Y/M/D construction, no timezone round-trip
}

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function CalendarWrapper({ selectedDateStr, isTodaySelected }) {
  const router = useRouter();
  const selectedDate = parseDateOnly(selectedDateStr);

  const handleChange = (newDate) => {
    const newDateStr = toDateStr(newDate);
    router.replace(newDateStr === selectedDateStr ? '/' : `/?date=${newDateStr}`, { scroll: false });
  };

  return (
    <div className="max-w-xs sm:max-w-sm mx-auto space-y-3">
      <CalendarSection date={selectedDate} onChange={handleChange} />
      <div className="flex items-center justify-center gap-3 text-sm text-neutral-600">
        <span>
          Ngày được chọn: <strong className="text-neutral-800">{formatVi(selectedDateStr)}</strong>
        </span>
        {!isTodaySelected && (
          <button
            type="button"
            onClick={() => router.replace('/', { scroll: false })}
            className="text-emerald-700 font-semibold hover:text-emerald-900 hover:underline cursor-pointer"
          >
            Hôm nay
          </button>
        )}
      </div>
    </div>
  );
}
