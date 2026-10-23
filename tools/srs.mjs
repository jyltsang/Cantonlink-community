// A five-box Leitner schedule for review. A missed item goes into box 1 and
// is due at once; each correct review moves it up a box and pushes the next
// review further away. A correct answer in box 5 means it is learnt and it
// leaves the schedule. A miss at any point sends it back to box 1.

export const BOX_DAYS = [0, 1, 3, 7, 14];
const DAY = 24 * 60 * 60 * 1000;

export function schedule(entry, isCorrect, now = Date.now()) {
  if (!isCorrect) return { box: 1, due: now };
  if (!entry) return null;
  if (entry.box >= BOX_DAYS.length) return null;
  const box = entry.box + 1;
  return { box, due: now + BOX_DAYS[box - 1] * DAY };
}

// Older saves stored a timestamp per missed item; treat each as box 1.
export const migrate = (items) => Object.fromEntries(Object.entries(items ?? {})
  .map(([key, value]) => [key, typeof value === 'number' ? { box: 1, due: value } : value]));

export const dueKeys = (items, now = Date.now()) => Object.keys(items)
  .filter((key) => items[key].due <= now)
  .sort((a, b) => items[a].due - items[b].due);

export function endOfDay(now = Date.now()) {
  const date = new Date(now);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

export function nextDue(items, now = Date.now()) {
  const later = Object.values(items).map((item) => item.due).filter((due) => due > now);
  return later.length ? Math.min(...later) : null;
}
