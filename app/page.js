'use client'

import CalendarSection from '@/components/CalendarSection';
import GospelModal from '@/components/GospelModal';
import { fetchGospelsCached, fetchGospelToday } from '@/utils/fetchIndex';
import { useEffect, useState } from 'react';
import 'react-calendar/dist/Calendar.css';

const seasons = {
  advent: 'Mùa Vọng',
  christmas: 'Mùa Giáng Sinh',
  ordinary: 'Mùa Thường Niên',
  lent: 'Mùa Chay',
  easter: 'Mùa Phục Sinh'
};

const weekdays = {
  sun: 'Chúa Nhật',
  mon: 'Thứ Hai',
  tue: 'Thứ Ba',
  wed: 'Thứ Tư',
  thu: 'Thứ Năm',
  fri: 'Thứ Sáu',
  sat: 'Thứ Bảy'
};

export default function HomePage() {
  const [date, setDate] = useState(new Date());
  const [gospelOfTheDay, setGospelOfTheDay] = useState(null);
  const [gospelModalOpen, setGospelModalOpen] = useState(false);
  const [gospelModalLoading, setGospelModalLoading] = useState(false);
  const [gospelModalContent, setGospelModalContent] = useState(null);
  const [gospelModalError, setGospelModalError] = useState(null);
  const [liturgicalCalendar, setLiturgicalCalendar] = useState(null);
  const [vnLiturgicalCalendar, setVnLiturgicalCalendar] = useState(null);
  const [lectionary, setLectionary] = useState(null);
  const [gospelToday, setGospelToday] = useState(null);

  const getSundayLabel = (dayInfo) => {
    if (dayInfo.name) {
      return dayInfo.name;
    }
    let label = weekdays[dayInfo.weekday];
    if (dayInfo.week_of_season !== 0) {
      label += ` tuần ${dayInfo.week_of_season}`;
    }
    label += ` ${seasons[dayInfo.season]}`;
    if (dayInfo.weekday === 'sun' || dayInfo.season === 'ordinary') {
      label += ` năm ${dayInfo.weekday === 'sun' ? dayInfo.sunday_cycle : dayInfo.weekday_cycle}`;
    }
    return label;
  };

  useEffect(() => {
    fetchGospelToday().then(setGospelToday).catch(console.error);
  }, []);

  useEffect(() => {
    const currentYear = date.getFullYear();
    Promise.all([
      fetch(`https://raw.githubusercontent.com/nqminhuit/liturgical-calendar/refs/heads/master/resources/liturgical-calendar-${currentYear}-vietnam.json`),
      fetch(`https://raw.githubusercontent.com/nqminhuit/liturgical-calendar/refs/heads/master/resources/liturgical-calendar-${currentYear}.json`),
      fetch('https://raw.githubusercontent.com/nqminhuit/liturgical-calendar/refs/heads/master/resources/lectionary.json')
    ])
      .then(([vnCal, calRes, lecRes]) => Promise.all([vnCal.json(), calRes.json(), lecRes.json()]))
      .then(([vnData, calData, lecData]) => {
        setVnLiturgicalCalendar(vnData);
        setLiturgicalCalendar(calData);
        setLectionary(lecData);
      })
      .catch(console.error);
  }, [date]);

  // Compute Gospel of the Day
  useEffect(() => {
    if (liturgicalCalendar && lectionary) {
      const selectedDate = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
      const dayInfo = vnLiturgicalCalendar[selectedDate] || liturgicalCalendar[selectedDate];
      if (dayInfo) {
        const reading = lectionary.readings[dayInfo.lectionary_key];
        if (reading && reading.gospel) {
          const sunday = getSundayLabel(dayInfo);
          setGospelOfTheDay({
            quote: reading.gospelQuote,
            reference: reading.gospel,
            sunday: sunday
          });
        } else {
          setGospelOfTheDay(null);
        }
      } else {
        setGospelOfTheDay(null);
      }
    }
  }, [vnLiturgicalCalendar, liturgicalCalendar, lectionary, date]);

  return (
    <div className="space-y-8">
      <section className="max-w-4xl mx-auto text-center py-6 bg-gradient-to-r from-green-50 to-green-200 border border-green-300 rounded-lg shadow-lg animate-[fadeIn_1s_ease-out_forwards] min-h-[14em]">
        <h2 className="text-2xl font-bold text-green-900 mb-4">
          {
            gospelOfTheDay
              ? date.toDateString() === new Date().toDateString()
                ? "📖 Lời Chúa hôm nay"
                : `📖 Lời Chúa ${date.toLocaleDateString('vi-VN')}`
              : "📖 Lời Chúa"
          }
        </h2>
        {gospelOfTheDay
          ? (<>
            <blockquote className="text-lg text-gray-800 italic font-medium mx-4 hover:scale-107 transition-all duration-300">
              <q className="cursor-pointer" onClick={async () => {
                // open modal and fetch content
                setGospelModalOpen(true);
                setGospelModalLoading(true);
                setGospelModalError(null);
                setGospelModalContent(null);

                const selectedDate = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
                if (gospelToday && gospelToday.date === selectedDate && gospelToday.verses) {
                  setGospelModalContent(gospelToday.verses);
                  setGospelModalLoading(false);
                  return;
                }

                try {
                  const data = await fetchGospelsCached();
                  // normalize citation: exact string as shown is used
                  const key = (gospelOfTheDay.reference || '').trim();
                  if (key && data[key]) {
                    setGospelModalContent(data[key]);
                  } else {
                    setGospelModalError('Không tìm thấy đoạn Tin Mừng cho trích dẫn: ' + key);
                  }
                } catch (e) {
                  console.error(e);
                  setGospelModalError('Không thể tải nội dung Lời Chúa. Vui lòng thử lại sau.');
                } finally {
                  setGospelModalLoading(false);
                }
              }}>{gospelOfTheDay.quote}</q>
            </blockquote>
            <cite className="text-sm text-gray-600 mt-2 block">({gospelOfTheDay.reference})</cite>
            <p className="text-sm text-green-700 font-semibold mt-2">{gospelOfTheDay.sunday}</p>
          </>)
          : (<>
            <blockquote className="text-lg text-gray-800 italic font-medium mx-4">
              <q>Đây là điều răn của Thầy: anh em hãy yêu thương nhau như Thầy đã yêu thương anh em.</q>
            </blockquote>
            <cite className="text-sm text-gray-600 mt-2 block">(Ga 15,12)</cite>
          </>)}

        <GospelModal
          citation={gospelOfTheDay ? gospelOfTheDay.reference : null}
          open={gospelModalOpen}
          onClose={() => setGospelModalOpen(false)}
          content={gospelModalContent}
          loading={gospelModalLoading}
          error={gospelModalError} />
      </section>

      <div className="max-w-sm mx-auto space-y-4">
        <CalendarSection date={date} onChange={setDate} />
        <p className="text-sm text-gray-600 text-center">Ngày được chọn: <strong>{date.toLocaleDateString('vi-VN')}</strong></p>
      </div>
    </div>
  );
}
