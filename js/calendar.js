// カレンダーへの追加：Googleカレンダーのリンクと、iPhone・Outlookでも使える .ics ファイル

const ymd = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

export function googleCalendarUrl(title, details, date = new Date()) {
  const next = new Date(date); next.setDate(next.getDate() + 1);
  const q = new URLSearchParams({ action: "TEMPLATE", text: title, details, dates: `${ymd(date)}/${ymd(next)}` });
  return `https://calendar.google.com/calendar/render?${q}`;
}

// ICSの文字列で特別な意味を持つ記号をエスケープ
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

export function downloadIcs(title, details, date = new Date()) {
  const next = new Date(date); next.setDate(next.getDate() + 1);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//wasurenashi//JA", "BEGIN:VEVENT",
    `UID:${Date.now()}@wasurenashi`, `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd(date)}`, `DTEND;VALUE=DATE:${ymd(next)}`,
    `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(details)}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url; a.download = `mochimono-${ymd(date)}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
