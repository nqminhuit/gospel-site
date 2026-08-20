'use client';

import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

export default function CalendarSection({date, onChange}) {
  return (
    <div>
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
          ? '!bg-green-500 !text-white !rounded-full'
          : '!rounded-full'}
        className="rounded-md shadow-lg p-1" />
    </div>
  );
}
