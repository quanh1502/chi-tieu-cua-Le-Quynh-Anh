
export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const formatDateTime = (date: Date): string => {
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const daysBetween = (date1: Date, date2: Date): number => {
  const oneDay = 1000 * 60 * 60 * 24;
  const diff = Math.abs(date1.getTime() - date2.getTime());
  return Math.round(diff / oneDay);
};

export const getWeekNumber = (d: Date): [number, number] => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
    return [d.getUTCFullYear(), weekNo];
}

export const getWeekRange = (year: number, weekNumber: number): { start: Date; end: Date } => {
    const d = new Date(year, 0, 1 + (weekNumber - 1) * 7);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(d.setDate(diff));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
};


export const weeksBetween = (d1: Date, d2: Date): number => {
  return Math.round((d2.getTime() - d1.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

export const isDateInFilter = (date: Date, filter: import('../types').FilterState): boolean => {
    const { type, year, month, week } = filter;

    switch (type) {
        case 'all':
            return true;
        case 'year':
            return date.getFullYear() === year;
        case 'month':
            return date.getFullYear() === year && date.getMonth() === month;
        case 'week':
            if (week) {
                const { start, end } = getWeekRange(year, week);
                end.setHours(23, 59, 59, 999);
                return date >= start && date <= end;
            }
            return false;
        default:
            return false;
    }
};

export const getWeeksInYear = (year: number) => {
    const weeks = [];
    let d = new Date(year, 0, 1);
    const isLeap = new Date(year, 1, 29).getMonth() === 1;
    const days = isLeap ? 366 : 365;
    const weekCount = Math.ceil(days / 7);

    for (let i = 1; i <= weekCount; i++) {
        const { start, end } = getWeekRange(year, i);
        if(start.getFullYear() > year) break;
        weeks.push({
            week: i,
            start,
            end,
        });
    }
    return weeks;
}

export const MONTH_NAMES = [
  "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
  "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
];

// --- Holiday Data ---
// Pre-calculated Solar dates for major Vietnamese Lunar holidays
const LUNAR_HOLIDAYS_MAP: Record<number, Record<string, string>> = {
    2025: {
        'tet': '2025-01-29', // Tet Nguyen Dan (Year of Snake)
        'hung_kings': '2025-04-07', // 10/3 Lunar
    },
    2026: {
        'tet': '2026-02-17', // Tet Nguyen Dan (Year of Horse)
        'hung_kings': '2026-04-26', // 10/3 Lunar
    },
    2027: {
        'tet': '2027-02-06', // Tet Nguyen Dan (Year of Goat)
        'hung_kings': '2027-04-16', // 10/3 Lunar
    }
};

export const getUpcomingHolidays = (): import('../types').Holiday[] => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const nextYear = currentYear + 1;
    
    const holidays: import('../types').Holiday[] = [];
    
    const addHoliday = (year: number) => {
        // Fixed Solar Holidays
        const solarEvents = [
            { name: `Tết Dương Lịch ${year}`, dateStr: `${year}-01-01` },
            { name: `Giải phóng miền Nam ${year}`, dateStr: `${year}-04-30` },
            { name: `Quốc tế Lao động ${year}`, dateStr: `${year}-05-01` },
            { name: `Quốc khánh ${year}`, dateStr: `${year}-09-02` },
        ];

        // Mapped Lunar Holidays
        if (LUNAR_HOLIDAYS_MAP[year]) {
            solarEvents.push({ name: `Tết Nguyên Đán ${year}`, dateStr: LUNAR_HOLIDAYS_MAP[year]['tet'] });
            solarEvents.push({ name: `Giỗ tổ Hùng Vương ${year}`, dateStr: LUNAR_HOLIDAYS_MAP[year]['hung_kings'] });
        }

        solarEvents.forEach(event => {
            const date = new Date(event.dateStr);
            // Only add if the date is today or in the future
            if (date >= new Date(today.setHours(0,0,0,0))) {
                holidays.push({
                    id: `holiday-${event.dateStr}`,
                    name: event.name,
                    date: date,
                    isTakingOff: false,
                    startDate: '',
                    endDate: '',
                    note: ''
                });
            }
        });
    };

    addHoliday(currentYear);
    addHoliday(nextYear);
    
    // Look ahead to year+2 only if list is short (e.g. end of year)
    if (holidays.length < 3) {
        addHoliday(nextYear + 1);
    }

    // Sort by date ascending
    return holidays.sort((a, b) => a.date.getTime() - b.date.getTime());
};
