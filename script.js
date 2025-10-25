/* =======================
   Telegram + Глобальное состояние
======================= */
const TG = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
try { TG?.ready(); TG?.expand(); } catch(_) {}

const State = {
  pool: [],
  byTicket: new Map(),
  topics: new Map(),
  duel: null,
  lock: false,
  lastTouchTs: 0,
  markup: null,
  penalties: null,
  tap: null,
  ignoreClickUntil: 0,
};

const MANIFEST_URL = "questions/index.json";
const MARKUP_URL = "markup/markup.json";
const PENALTIES_URL = "penalties/penalties.json";
const FALLBACK_MANIFEST = {
  tickets: [
    "A_B/tickets/Билет 1.json",
    ...
