/**********************************************************************
 * LAOFE Cafe & Beer — ລະບົບຈອງຄິວ (Queue System) — Backend
 * Google Apps Script + Google Sheets
 *
 * ວິທີຕິດຕັ້ງ (ຫຍໍ້): ເປີດ Google Sheet ໃໝ່ → Extensions → Apps Script
 * → ວາງໂຄ້ດນີ້ → Deploy → New deployment → Web app
 * → Execute as: Me, Who has access: Anyone → Copy URL ໄປໃສ່ config.js
 * (ເບິ່ງຄູ່ມືເຕັມໃນ ຄູ່ມືຕິດຕັ້ງ.md)
 **********************************************************************/

// ====== ຕັ້ງຄ່າ (ແກ້ໄດ້) ======
var ADMIN_PIN   = '2468';   // ລະຫັດເຂົ້າໜ້າຫຼັງບ້ານ (admin) — ປ່ຽນເປັນເລກຂອງທ່ານ
var QUEUE_PREFIX = 'A';     // ໜ້າຄິວ ເຊັ່ນ A01, A02
var PAD          = 2;       // ຈຳນວນຫຼັກ (2 = 01, 3 = 001)
var AVG_MINUTES  = 6;       // ເວລາສະເລ່ຍຕໍ່ 1 ຄິວ (ນາທີ) ໃຊ້ຄິດເວລາລໍຖ້າ
var SHEET_NAME   = 'Queue';
// ==============================

function doGet(e)  { return handle(e, (e && e.parameter) ? e.parameter : {}); }
function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) { body = (e && e.parameter) ? e.parameter : {}; }
  return handle(e, body);
}

function handle(e, p) {
  var action = (p.action || 'status');
  var out;
  try {
    switch (action) {
      case 'book':    out = book(p); break;
      case 'status':  out = status(p); break;
      case 'board':   out = board(); break;
      case 'cancel':  out = cancelTicket(p); break;
      case 'list':    out = adminList(p); break;
      case 'history': out = adminHistory(p); break;
      case 'call':    out = adminCall(p); break;
      case 'next':    out = adminNext(p); break;
      case 'done':    out = adminSetStatus(p, 'done'); break;
      case 'skip':    out = adminSetStatus(p, 'skipped'); break;
      case 'recall':  out = adminRecall(p); break;
      case 'setauto': out = adminSetAuto(p); break;
      case 'reset':   out = adminReset(p); break;
      case 'ping':    out = { ok: true, msg: 'LAOFE queue online', now: new Date().toISOString() }; break;
      default:        out = { ok: false, error: 'unknown action: ' + action };
    }
  } catch (err) {
    out = { ok: false, error: String(err) };
  }
  return json(out);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- ຕົວຊ່ວຍ Sheet / State ----------
function sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.getRange(1, 1, 1, 8).setValues([[
      'Ticket', 'Name', 'Phone', 'People', 'Status', 'CreatedAt', 'CalledAt', 'ServedAt'
    ]]);
    sh.setFrozenRows(1);
    sh.getRange('B:C').setNumberFormat('@');  // ຊື່ + ເບີໂທ = text ສະເໝີ (ກັນ #ERROR!)
  }
  return sh;
}

function props() { return PropertiesService.getScriptProperties(); }

function todayKey() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/** ຮັບປະກັນວ່າ state ເປັນຂອງມື້ນີ້ (reset ອັດຕະໂນມັດຕອນຂຶ້ນມື້ໃໝ່) */
function ensureToday() {
  var pr = props();
  var today = todayKey();
  if (pr.getProperty('date') !== today) {
    pr.setProperty('date', today);
    pr.setProperty('lastNumber', '0');
    pr.setProperty('nowServing', '');   // ticket ທີ່ກຳລັງຮັບໃຊ້
  }
}

function fmtTicket(n) {
  var s = String(n);
  while (s.length < PAD) s = '0' + s;
  return QUEUE_PREFIX + s;
}

// ---------- ຈອງຄິວ ----------
function book(p) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    ensureToday();
    var pr = props();
    var next = parseInt(pr.getProperty('lastNumber') || '0', 10) + 1;
    pr.setProperty('lastNumber', String(next));
    var ticket = fmtTicket(next);

    var name   = String(p.name || '').trim().substring(0, 60) || 'ລູກຄ້າ';
    var phone  = String(p.phone || '').trim().substring(0, 30);
    var people = Math.max(1, parseInt(p.people || '1', 10) || 1);
    var nowIso = new Date().toISOString();

    var sh = sheet();
    var row = sh.getLastRow() + 1;
    // ບັງຄັບ ຊື່(B) + ເບີໂທ(C) ໃຫ້ເປັນ text ກ່ອນຂຽນ → ເບີທີ່ຂຶ້ນຕົ້ນ + = - @ ຈະບໍ່ກາຍເປັນສູດ (#ERROR!)
    sh.getRange(row, 2, 1, 2).setNumberFormat('@');
    sh.getRange(row, 1, 1, 8).setValues([[ticket, name, phone, people, 'waiting', nowIso, '', '']]);
    invalidateBoard();
    // ບໍ່ອ່ານ sheet ຊ້ຳ (statusFor) — ໃຫ້ໄວ; client ຈະ poll ສະຖານະເອງ
    return { ok: true, ticket: ticket };
  } finally {
    lock.releaseLock();
  }
}

/** ລ້າງ cache ຂອງກະດານຄິວ (ເອີ້ນທຸກຄັ້ງທີ່ມີການຂຽນ) */
function invalidateBoard() {
  try { CacheService.getScriptCache().remove('board_v1'); } catch (e) {}
}

// ---------- ອ່ານຂໍ້ມູນຄິວ ----------
function readRows() {
  ensureToday();
  var sh = sheet();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, 8).getValues();
  var today = todayKey();
  var rows = [];
  for (var i = 0; i < values.length; i++) {
    var v = values[i];
    if (!v[0]) continue;
    var created = v[5] ? new Date(v[5]) : null;
    var dkey = created ? Utilities.formatDate(created, Session.getScriptTimeZone(), 'yyyy-MM-dd') : today;
    rows.push({
      rowIndex: i + 2,
      ticket: v[0], name: v[1], phone: v[2], people: v[3],
      status: v[4] || 'waiting', createdAt: v[5], calledAt: v[6], servedAt: v[7],
      dateKey: dkey
    });
  }
  return rows.filter(function (r) { return r.dateKey === today; });
}

function num(ticket) {
  return parseInt(String(ticket).replace(/[^0-9]/g, ''), 10) || 0;
}

/** ອ່ານແຖວທັງໝົດ (ບໍ່ກັ່ນຕອງມື້) — ໃຊ້ສຳລັບປະຫວັດ */
function readAllRows() {
  var sh = sheet();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, 8).getValues();
  var rows = [];
  for (var i = 0; i < values.length; i++) {
    var v = values[i];
    if (!v[0]) continue;
    var created = v[5] ? new Date(v[5]) : null;
    var dkey = created ? Utilities.formatDate(created, Session.getScriptTimeZone(), 'yyyy-MM-dd') : '';
    rows.push({
      ticket: v[0], name: v[1], phone: v[2], people: v[3],
      status: v[4] || 'waiting', createdAt: v[5], calledAt: v[6], servedAt: v[7], dateKey: dkey
    });
  }
  return rows;
}

/** ປະຫວັດຍ້ອນຫຼັງ (admin) — ກັ່ນຕອງຕາມມື້ໄດ້ */
function adminHistory(p) {
  checkPin(p);
  var rows = readAllRows();
  // ລາຍການວັນທີ່ມີຂໍ້ມູນ (ໃໝ່ສຸດກ່ອນ, ສູງສຸດ 60 ວັນ)
  var dset = {};
  for (var i = 0; i < rows.length; i++) if (rows[i].dateKey) dset[rows[i].dateKey] = true;
  var dates = Object.keys(dset).sort().reverse().slice(0, 60);

  var day = p.date || (dates.length ? dates[0] : todayKey());
  var filtered = rows.filter(function (r) { return r.dateKey === day; })
                     .sort(function (a, b) { return num(b.ticket) - num(a.ticket); });

  var counts = { total: filtered.length, done: 0, cancelled: 0, skipped: 0, waiting: 0 };
  for (var j = 0; j < filtered.length; j++) {
    var s = filtered[j].status;
    if (s === 'done') counts.done++;
    else if (s === 'cancelled') counts.cancelled++;
    else if (s === 'skipped') counts.skipped++;
    else if (s === 'waiting' || s === 'called') counts.waiting++;
  }
  var slim = filtered.slice(0, 300).map(function (r) {
    return { ticket: r.ticket, name: r.name, phone: r.phone, people: r.people,
             status: r.status, createdAt: r.createdAt, servedAt: r.servedAt };
  });
  return { ok: true, date: day, dates: dates, rows: slim, counts: counts };
}

function nowServingTicket() {
  return props().getProperty('nowServing') || '';
}

/** ວິນາທີກ່ອນໜ້າຈໍລູກຄ້າກັບຄືນໜ້າຫຼັກ (ຕັ້ງໄດ້ໂດຍ admin) */
function getAutoReturn() {
  var v = parseInt(props().getProperty('autoReturnSec') || '8', 10);
  if (isNaN(v) || v < 0) v = 8;
  return v;
}

/** ຄິດສະຖານະຂອງ ticket ໜຶ່ງ (ສຳລັບໜ້າຈໍລູກຄ້າ) */
function statusFor(ticket) {
  var rows = readRows();
  var serving = nowServingTicket();
  var me = null;
  for (var i = 0; i < rows.length; i++) if (rows[i].ticket === ticket) { me = rows[i]; break; }

  var waiting = rows.filter(function (r) { return r.status === 'waiting'; })
                    .sort(function (a, b) { return num(a.ticket) - num(b.ticket); });
  var totalWaiting = waiting.length;

  var ahead = 0, position = 0;
  if (me) {
    for (var j = 0; j < waiting.length; j++) {
      if (waiting[j].ticket === ticket) { position = j + 1; break; }
      ahead++;
    }
  }

  var myStatus = me ? me.status : 'notfound';
  var isMyTurn = (serving && serving === ticket) || (me && me.status === 'called');

  return {
    ticket: ticket,
    myStatus: myStatus,          // waiting | called | done | skipped | cancelled | notfound
    nowServing: serving,
    ahead: me ? ahead : null,
    position: me ? position : null,
    totalWaiting: totalWaiting,
    estMinutes: me ? ahead * AVG_MINUTES : null,
    isMyTurn: !!isMyTurn,
    people: me ? me.people : null,
    name: me ? me.name : null,
    recallStamp: props().getProperty('recallStamp') || ''
  };
}

function status(p) {
  var t = String(p.ticket || '').trim();
  if (!t) return { ok: false, error: 'no ticket' };
  return Object.assign({ ok: true }, statusFor(t));
}

// ---------- ກະດານຄິວສາທາລະນະ (ບໍ່ມີຊື່/ເບີ — ໃຫ້ລູກຄ້າທົ່ວໄປເບິ່ງໄດ້) ----------
function board() {
  // cache 3 ວິ → ຫຼາຍຈໍທີ່ເປີດພ້ອມກັນ ບໍ່ຕ້ອງອ່ານ sheet ທຸກຄັ້ງ (ໄວ); ລ້າງ cache ທຸກຄັ້ງທີ່ຂຽນ
  var cache = CacheService.getScriptCache();
  var hit = cache.get('board_v1');
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }

  var rows = readRows();
  var serving = nowServingTicket();
  var waiting = rows.filter(function (r) { return r.status === 'waiting'; })
                    .sort(function (a, b) { return num(a.ticket) - num(b.ticket); });
  var called = rows.filter(function (r) { return r.status === 'called'; })
                   .sort(function (a, b) { return num(a.ticket) - num(b.ticket); });
  var result = {
    ok: true,
    nowServing: serving,
    called:  called.map(function (r) { return r.ticket; }),
    waiting: waiting.map(function (r) { return r.ticket; }),
    totalWaiting: waiting.length,
    autoReturnSec: getAutoReturn(),
    date: todayKey()
  };
  try { cache.put('board_v1', JSON.stringify(result), 1); } catch (e) {}  // cache ສັ້ນ (1 ວິ) → ສົດ, ຫຼຸດຄວາມຕ່າງລະຫວ່າງຈໍ
  return result;
}

// ---------- ຍົກເລີກຄິວ (ໂດຍລູກຄ້າ) ----------
function cancelTicket(p) {
  var t = String(p.ticket || '').trim();
  var rows = readRows();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].ticket === t) {
      sheet().getRange(rows[i].rowIndex, 5).setValue('cancelled');
      invalidateBoard();
      return { ok: true, ticket: t, myStatus: 'cancelled' };
    }
  }
  return { ok: false, error: 'not found' };
}

// ---------- ໜ້າຫຼັງບ້ານ (admin) ----------
function checkPin(p) {
  if (String(p.pin || '') !== String(ADMIN_PIN)) throw 'ລະຫັດບໍ່ຖືກຕ້ອງ';
}

function adminList(p) {
  checkPin(p);
  var rows = readRows();
  var serving = nowServingTicket();
  var waiting = rows.filter(function (r) { return r.status === 'waiting'; })
                    .sort(function (a, b) { return num(a.ticket) - num(b.ticket); });
  var doneCount = rows.filter(function (r) { return r.status === 'done'; }).length;
  var skipCount = rows.filter(function (r) { return r.status === 'skipped'; }).length;
  var slim = function (r) {
    return { ticket: r.ticket, name: r.name, phone: r.phone, people: r.people,
             status: r.status, createdAt: r.createdAt };
  };
  return {
    ok: true,
    nowServing: serving,
    waiting: waiting.map(slim),
    called: rows.filter(function (r) { return r.status === 'called'; }).map(slim),
    counts: { waiting: waiting.length, done: doneCount, skipped: skipCount, total: rows.length },
    autoReturnSec: getAutoReturn(),
    date: todayKey()
  };
}

/** ຕັ້ງເວລາກັບໜ້າຫຼັກ (ວິນາທີ) */
function adminSetAuto(p) {
  checkPin(p);
  var s = parseInt(p.seconds, 10);
  if (isNaN(s) || s < 0) s = 8;
  if (s > 600) s = 600;
  props().setProperty('autoReturnSec', String(s));
  return { ok: true, autoReturnSec: s };
}

/** ຕັ້ງສະຖານະ ticket — ຮັບ rowsOpt ເພື່ອບໍ່ອ່ານ sheet ຊ້ຳ */
function setStatusByTicket(ticket, st, col, val, rowsOpt) {
  var rows = rowsOpt || readRows();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].ticket === ticket) {
      var sh = sheet();
      sh.getRange(rows[i].rowIndex, 5).setValue(st);
      if (col) sh.getRange(rows[i].rowIndex, col).setValue(val);
      return true;
    }
  }
  return false;
}

/** ຮຽກຄິວທີ່ລະບຸ */
function adminCall(p) {
  checkPin(p);
  var t = String(p.ticket || '').trim();
  if (!t) return { ok: false, error: 'no ticket' };
  setStatusByTicket(t, 'called', 7, new Date().toISOString());
  props().setProperty('nowServing', t);
  invalidateBoard();
  return { ok: true, nowServing: t };
}

/** ຮຽກຄິວຕໍ່ໄປອັດຕະໂນມັດ — ອ່ານ sheet ຄັ້ງດຽວ (ໄວ) */
function adminNext(p) {
  checkPin(p);
  var rows = readRows();                       // ← ອ່ານຄັ້ງດຽວ
  var serving = nowServingTicket();
  var now = new Date().toISOString();
  if (serving) setStatusByTicket(serving, 'done', 8, now, rows);   // ໃຊ້ rows ເກົ່າ
  var waiting = rows.filter(function (r) { return r.status === 'waiting'; })
                    .sort(function (a, b) { return num(a.ticket) - num(b.ticket); });
  if (waiting.length === 0) {
    props().setProperty('nowServing', '');
    invalidateBoard();
    return { ok: true, nowServing: '', msg: 'ບໍ່ມີຄິວທີ່ລໍຖ້າ' };
  }
  var nextT = waiting[0].ticket;
  setStatusByTicket(nextT, 'called', 7, now, rows);               // ໃຊ້ rows ເກົ່າ
  props().setProperty('nowServing', nextT);
  invalidateBoard();
  return { ok: true, nowServing: nextT };
}

function adminSetStatus(p, st) {
  checkPin(p);
  var t = String(p.ticket || '').trim();
  if (!t) return { ok: false, error: 'no ticket' };
  var col = st === 'done' ? 8 : null;
  setStatusByTicket(t, st, col, st === 'done' ? new Date().toISOString() : '');
  if (nowServingTicket() === t) props().setProperty('nowServing', '');
  invalidateBoard();
  return { ok: true, ticket: t, status: st };
}

/** ຮຽກຄິວປັດຈຸບັນຊ້ຳ (ໃຫ້ສຽງເຕືອນລູກຄ້າອີກຄັ້ງ) */
function adminRecall(p) {
  checkPin(p);
  var t = nowServingTicket();
  if (!t) return { ok: false, error: 'ບໍ່ມີຄິວປັດຈຸບັນ' };
  props().setProperty('recallStamp', String(Date.now()));
  return { ok: true, nowServing: t };
}

/** ເລີ່ມມື້ໃໝ່ / ລ້າງຄິວ (ຂໍ້ມູນເກົ່າຍັງຢູ່ໃນ Sheet) */
function adminReset(p) {
  checkPin(p);
  var pr = props();
  pr.setProperty('date', todayKey());
  pr.setProperty('lastNumber', '0');
  pr.setProperty('nowServing', '');
  // ໝາຍຄິວ waiting/called ຂອງມື້ນີ້ທີ່ຄ້າງ ໃຫ້ເປັນ closed
  var rows = readRows();
  var sh = sheet();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].status === 'waiting' || rows[i].status === 'called') {
      sh.getRange(rows[i].rowIndex, 5).setValue('closed');
    }
  }
  invalidateBoard();
  return { ok: true, msg: 'ລ້າງຄິວແລ້ວ ເລີ່ມນັບໃໝ່ຈາກ ' + fmtTicket(1) };
}
