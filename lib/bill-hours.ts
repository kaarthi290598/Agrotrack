/** Parse "HH:mm" into minutes from midnight, or null if invalid. */
export function parseTimeToMinutes(time: string): number | null {
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

/**
 * Hours between start and end datetimes (YYYY-MM-DD + HH:mm).
 * Same calendar day with end before start returns null (invalid — no overnight wrap).
 */
export function calculateBillHours(args: {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
}): number | null {
  const { startDate, endDate, startTime, endTime } = args;
  if (!startDate || !endDate || !startTime || !endTime) return null;

  const startMins = parseTimeToMinutes(startTime);
  const endMins = parseTimeToMinutes(endTime);
  if (startMins === null || endMins === null) return null;

  if (endDate < startDate) return null;
  if (endDate === startDate && endMins < startMins) return null;

  const startMs = Date.parse(`${startDate}T${startTime}:00`);
  const endMs = Date.parse(`${endDate}T${endTime}:00`);
  if (isNaN(startMs) || isNaN(endMs) || endMs < startMs) return null;

  return Number(((endMs - startMs) / (1000 * 60 * 60)).toFixed(2));
}

export function isSameDayEndBeforeStart(
  startDate: string,
  endDate: string,
  startTime: string,
  endTime: string
): boolean {
  if (!startDate || !endDate || startDate !== endDate) return false;
  if (!startTime || !endTime) return false;
  const startMins = parseTimeToMinutes(startTime);
  const endMins = parseTimeToMinutes(endTime);
  if (startMins === null || endMins === null) return false;
  return endMins < startMins;
}
