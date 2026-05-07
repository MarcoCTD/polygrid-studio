import { useMemo, useState } from 'react';
import {
  addWeeks,
  formatISODate,
  getWeekDates,
  getWeekNumber,
  getWeekStart,
  parseISODate,
} from '../utils/dateHelpers';

export function useWeekNavigation() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    formatISODate(getWeekStart(new Date())),
  );

  const weekStartDate = useMemo(() => parseISODate(currentWeekStart), [currentWeekStart]);
  const weekDates = useMemo(() => getWeekDates(weekStartDate), [weekStartDate]);
  const weekNumber = useMemo(() => getWeekNumber(weekStartDate), [weekStartDate]);
  const isCurrentWeek = currentWeekStart === formatISODate(getWeekStart(new Date()));

  return {
    currentWeekStart,
    weekDates,
    weekNumber,
    isCurrentWeek,
    goToPreviousWeek: () => setCurrentWeekStart(formatISODate(addWeeks(weekStartDate, -1))),
    goToNextWeek: () => setCurrentWeekStart(formatISODate(addWeeks(weekStartDate, 1))),
    goToToday: () => setCurrentWeekStart(formatISODate(getWeekStart(new Date()))),
  };
}
