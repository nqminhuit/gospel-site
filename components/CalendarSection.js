'use client';

import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

export default function CalendarSection({date, onChange}) {
  return (
    <div className="rounded-2xl border border-emerald-200/70 bg-stone-50 shadow-lg shadow-emerald-900/5 p-2">
      <Calendar
        onChange={onChange}
        value={date}
        calendarType='gregory'
        formatMonthYear={(_, date) => `${date.toLocaleDateString('en-GB', {
          timeZone: 'Asia/Ho_Chi_Minh',
          month: '2-digit',
          year: 'numeric',
        })}`}
        tileClassName={({ date: tileDate }) => tileDate.toDateString() === date.toDateString()
          ? '!bg-emerald-600 !text-white !rounded-full !font-semibold'
          : '!rounded-full'}
        className="!w-full !border-0 !bg-transparent !text-sm sm:!text-base" />
    </div>
  );
}
