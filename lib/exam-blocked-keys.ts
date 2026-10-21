// Keys that leave, reload or cover the test page. A student's stray finger on one of these used to end
// the attempt with no result: Back went to another page (the "leave page?" warning does not cover moves
// inside the site), and a browser OK/Cancel box -- whose OK button has the focus -- was accepted by the
// next Space or Enter the student typed. While a test is running these keys do nothing except show a
// short warning, and every question is asked on the page, answered only by clicking.
export function blockedKeyName(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">): string | null {
  const key = event.key;
  const ctrl = event.ctrlKey || event.metaKey;
  if (["BrowserBack", "BrowserForward", "BrowserRefresh", "BrowserHome", "BrowserSearch", "BrowserFavorites"].includes(key)) return key.replace("Browser", "Browser ");
  if (key === "F5" || (ctrl && (key === "r" || key === "R"))) return "Refresh (F5 / Ctrl+R)";
  if (event.altKey && (key === "ArrowLeft" || key === "ArrowRight" || key === "Home")) return `Alt+${key.replace("Arrow", "")}`;
  // F12 / Ctrl+Shift+I, J, C, K open the browser's Developer Tools -- a "coding page" that covered half
  // the test when a student hit one by accident. Every other Ctrl+Shift+letter is a browser command too
  // (bookmarks, clear browsing data, history, task manager ...); none of them is ever typed.
  if (key === "F12") return "F12 (Developer Tools)";
  if (ctrl && event.shiftKey && !event.altKey && (/^[a-zA-Z]$/.test(key) || key === "Delete")) return `Ctrl+Shift+${key.length === 1 ? key.toUpperCase() : key}`;
  // Function keys only reach the browser (help, find, caret browsing, menu bar ...). F11 (full screen)
  // does not harm the test, so it still works.
  if (/^F([1-9]|10)$/.test(key) || key === "ContextMenu") return key;
  if (ctrl && !event.altKey && ["p", "P", "s", "S", "o", "O", "u", "U", "l", "L", "f", "F", "g", "G", "h", "H", "j", "J", "d", "D", "e", "E", "k", "K"].includes(key)) return `Ctrl+${key.toUpperCase()}`;
  if (ctrl && (key === "PageUp" || key === "PageDown")) return `Ctrl+${key}`;
  // Alt+letter opens the browser's menus / address bar. Alt with number-pad digits (Alt codes used for
  // Hindi special characters) and AltGr (Ctrl+Alt) still work.
  if (event.altKey && !ctrl && /^[a-zA-Z]$/.test(key)) return `Alt+${key.toUpperCase()}`;
  return null;
}
