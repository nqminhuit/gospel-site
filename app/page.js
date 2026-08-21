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
            <p className="text-neutral-600">Chưa có dữ liệu Lời Chúa cho ngày này.</p>
          ) : (
            <>
              <blockquote className="font-serif max-w-2xl mx-auto whitespace-pre-line text-neutral-800 leading-8 text-justify text-[0.95rem] sm:text-base">
                {reading.verses}
              </blockquote>
              <cite className="not-italic text-sm text-neutral-500 mt-3 block">({reading.ref})</cite>
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
