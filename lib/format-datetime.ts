// Every timestamp in this app is entered and read by India-based students/
// admins, but Server Components render on the server process, whose
// default timezone is whatever the host sets (often UTC, not IST). A bare
// `date.toLocaleString()` in a Server Component silently formats in that
// server timezone instead of IST, so a schedule saved as "6:11 AM" (IST)
// can render as "12:41 AM" for every visitor. Always pin the timezone
// explicitly so the displayed wall-clock time matches what was typed,
// regardless of where the component executes.
export const formatIST = (value: string | null | undefined, options?: Intl.DateTimeFormatOptions) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", ...options });
};

export const formatISTDate = (value: string | null | undefined, options?: Intl.DateTimeFormatOptions) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", ...options });
};

export const formatISTTime = (value: string | null | undefined, options?: Intl.DateTimeFormatOptions) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", ...options });
};
