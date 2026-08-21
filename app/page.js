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

  // Compute Gospel of the Day (used for calendar-picked dates other than today)
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

  const selectedDateStr = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  const isTodaySelected = gospelToday && gospelToday.date === selectedDateStr;
  const dayInfo = vnLiturgicalCalendar?.[selectedDateStr] || liturgicalCalendar?.[selectedDateStr];
  const todaySundayLabel = isTodaySelected && dayInfo ? getSundayLabel(dayInfo) : null;

  const openGospelModal = async () => {
    setGospelModalOpen(true);
    setGospelModalLoading(true);
    setGospelModalError(null);
    setGospelModalContent(null);
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
  };

  return (
    <div className="space-y-6 sm:space-y-10">
      <section
        key={selectedDateStr}
        className="relative max-w-3xl mx-auto overflow-hidden rounded-2xl border border-emerald-200/70 bg-stone-50 shadow-lg shadow-emerald-900/5 animate-[fadeIn_0.5s_ease-out_forwards] min-h-[14em]"
      >
        <div className="h-1.5 bg-gradient-to-r from-emerald-700 via-amber-500 to-emerald-700" />

        <div className="px-5 py-7 sm:px-10 sm:py-10 text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-emerald-900 mb-5 flex items-center justify-center gap-2">
            <span aria-hidden="true">📖</span>
            {
              isTodaySelected
                ? "Lời Chúa hôm nay"
                : gospelOfTheDay
                  ? `Lời Chúa ${date.toLocaleDateString('vi-VN')}`
                  : "Lời Chúa"
            }
          </h2>

          {isTodaySelected
            ? (<>
              <blockquote className="font-serif max-w-2xl mx-auto whitespace-pre-line text-neutral-800 leading-8 text-justify text-[0.95rem] sm:text-base">
                {gospelToday.verses}
              </blockquote>
              <cite className="not-italic text-sm text-neutral-500 mt-3 block">({gospelToday.ref})</cite>
              {todaySundayLabel && (
                <p className="inline-block text-sm text-emerald-800 font-semibold mt-3 px-3 py-1 rounded-full bg-emerald-100/70">{todaySundayLabel}</p>
              )}
            </>)
            : gospelOfTheDay
              ? (<>
                <blockquote className="font-serif max-w-xl mx-auto text-lg text-neutral-800 italic font-medium leading-relaxed">
                  <q
                    className="cursor-pointer underline decoration-amber-400 decoration-2 underline-offset-4 transition hover:text-emerald-800 active:scale-[0.99]"
                    onClick={openGospelModal}
                  >
                    {gospelOfTheDay.quote}
                  </q>
                </blockquote>
                <button
                  type="button"
                  onClick={openGospelModal}
                  className="mt-4 text-sm font-semibold text-amber-700 hover:text-amber-800 cursor-pointer"
                >
                  Đọc trọn bài Tin Mừng →
                </button>
                <cite className="not-italic text-sm text-neutral-500 mt-3 block">({gospelOfTheDay.reference})</cite>
                <p className="inline-block text-sm text-emerald-800 font-semibold mt-3 px-3 py-1 rounded-full bg-emerald-100/70">{gospelOfTheDay.sunday}</p>
              </>)
              : (<>
                <blockquote className="font-serif max-w-xl mx-auto text-lg text-neutral-800 italic font-medium leading-relaxed">
                  <q>Đây là điều răn của Thầy: anh em hãy yêu thương nhau như Thầy đã yêu thương anh em.</q>
                </blockquote>
                <cite className="not-italic text-sm text-neutral-500 mt-3 block">(Ga 15,12)</cite>
              </>)}

          {!isTodaySelected && (
            <GospelModal
              citation={gospelOfTheDay ? gospelOfTheDay.reference : null}
              open={gospelModalOpen}
              onClose={() => setGospelModalOpen(false)}
              content={gospelModalContent}
              loading={gospelModalLoading}
              error={gospelModalError} />
          )}
        </div>
      </section>

      <div className="max-w-xs sm:max-w-sm mx-auto space-y-3">
        <CalendarSection date={date} onChange={setDate} />
        <div className="flex items-center justify-center gap-3 text-sm text-neutral-600">
          <span>Ngày được chọn: <strong className="text-neutral-800">{date.toLocaleDateString('vi-VN')}</strong></span>
          {!isTodaySelected && (
            <button
              type="button"
              onClick={() => setDate(new Date())}
              className="text-emerald-700 font-semibold hover:text-emerald-900 hover:underline cursor-pointer"
            >
              Hôm nay
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
