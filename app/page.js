import CalendarWrapper from '@/components/CalendarWrapper';
import { getReadingForDate, BibleDbUnavailableError } from '@/lib/reading';
import { isValidDateStr, formatVi } from '@/lib/date';
import 'react-calendar/dist/Calendar.css';

export const dynamic = 'force-dynamic';

function todayInVietnam() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

export default async function HomePage({ searchParams }) {
  const params = await searchParams;
  const todayStr = todayInVietnam();
  const selectedDateStr =
    typeof params?.date === 'string' && isValidDateStr(params.date) ? params.date : todayStr;
  const isTodaySelected = selectedDateStr === todayStr;

  let reading = { date: selectedDateStr, notFound: true };
  let dbUnavailable = false;
  try {
    reading = await getReadingForDate(selectedDateStr);
  } catch (e) {
    if (e instanceof BibleDbUnavailableError) {
      dbUnavailable = true;
    } else {
      throw e;
    }
  }

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
            {isTodaySelected ? 'Lời Chúa hôm nay' : `Lời Chúa ${formatVi(selectedDateStr)}`}
          </h2>

          {dbUnavailable ? (
            <p className="text-neutral-600">Không thể tải Lời Chúa lúc này. Vui lòng thử lại sau.</p>
          ) : reading.notFound ? (
            <p className="text-neutral-600">Chưa có bài Tin Mừng được xác minh cho ngày này.</p>
          ) : (
            <>
              <blockquote className="font-serif max-w-2xl mx-auto whitespace-pre-line text-neutral-800 leading-8 text-justify text-[0.95rem] sm:text-base">
                {reading.verses}
              </blockquote>
              <cite className="not-italic text-sm text-neutral-500 mt-3 block">({reading.ref})</cite>
              <a
                href={reading.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-emerald-700 mt-2 underline"
              >
                {reading.calendarId === 'vatican-vi' ? 'Nguồn: Vatican News' : reading.resolutionMethod === 'source_checked' ? 'Nguồn đối chiếu theo ngày' : 'Nguồn tham chiếu của bài đọc'}
                {reading.evidenceDate ? ` · ${formatVi(reading.evidenceDate)}` : ''}
              </a>
              <p className="text-xs text-neutral-500 mt-2">
                {reading.resolutionMethod === 'calendar_resolved'
                  ? `Bài đọc được tra theo lịch ${reading.calendarId === 'roman-general' ? 'Rô-ma chung' : reading.calendarId === 'vietnam' ? 'Việt Nam (Romcal)' : reading.calendarId}, từ mục đã được đối chiếu.`
                  : reading.calendarId === 'vatican-vi' ? 'Bài đọc theo Vatican News (tiếng Việt).' : 'Bài đọc được đối chiếu riêng theo ngày và lịch đã chọn.'}
                {' '}Lễ riêng và các lựa chọn trong Thánh lễ có thể khác.
              </p>
              {reading.label && (
                <p className="inline-block text-sm text-emerald-800 font-semibold mt-3 px-3 py-1 rounded-full bg-emerald-100/70">
                  {reading.label}
                </p>
              )}
            </>
          )}
        </div>
      </section>

      <CalendarWrapper selectedDateStr={selectedDateStr} isTodaySelected={isTodaySelected} />
    </div>
  );
}
