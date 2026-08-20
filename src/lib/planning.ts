export function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatLocalDateTime(date: Date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${formatLocalDate(date)}T${hours}:${minutes}`;
}

export function getPlanningDateContext(date: Date) {
  const today = formatLocalDate(date);
  const monthKey = today.slice(0, 7);
  const nextMonth = formatLocalDate(new Date(date.getFullYear(), date.getMonth() + 1, 1));
  return {
    today,
    month: `${monthKey}-01`,
    monthKey,
    nextMonth,
  };
}
