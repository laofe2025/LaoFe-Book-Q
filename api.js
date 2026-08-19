/* LAOFE Queue — API helper (ໂທຫາ Google Apps Script) */
(function () {
  var C = window.LAOFE_CONFIG || {};
  var URL = C.API_URL || '';

  function configured() {
    return URL && URL.indexOf('http') === 0;
  }

  // POST ແບບ text/plain ເພື່ອຫຼີກ CORS preflight ຂອງ Apps Script
  async function post(payload) {
    if (!configured()) throw new Error('ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ API_URL ໃນ config.js');
    var res = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      cache: 'no-store'
    });
    return res.json();
  }

  async function get(params) {
    if (!configured()) throw new Error('ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ API_URL ໃນ config.js');
    params._t = String(Date.now());   // ກັນ browser cache ຄ່າເກົ່າ
    var q = Object.keys(params).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    }).join('&');
    var res = await fetch(URL + '?' + q, { method: 'GET', redirect: 'follow', cache: 'no-store' });
    return res.json();
  }

  window.LAOFE_API = {
    configured: configured,
    book: function (name, phone, people) { return post({ action: 'book', name: name, phone: phone, people: people }); },
    status: function (ticket) { return get({ action: 'status', ticket: ticket }); },
    board: function () { return get({ action: 'board' }); },
    cancel: function (ticket) { return post({ action: 'cancel', ticket: ticket }); },
    list: function (pin) { return get({ action: 'list', pin: pin }); },
    history: function (pin, date) { return get({ action: 'history', pin: pin, date: date || '' }); },
    call: function (pin, ticket) { return post({ action: 'call', pin: pin, ticket: ticket }); },
    next: function (pin) { return post({ action: 'next', pin: pin }); },
    done: function (pin, ticket) { return post({ action: 'done', pin: pin, ticket: ticket }); },
    skip: function (pin, ticket) { return post({ action: 'skip', pin: pin, ticket: ticket }); },
    recall: function (pin) { return post({ action: 'recall', pin: pin }); },
    setAuto: function (pin, seconds) { return post({ action: 'setauto', pin: pin, seconds: seconds }); },
    reset: function (pin) { return post({ action: 'reset', pin: pin }); },
    ping: function () { return get({ action: 'ping' }); }
  };
})();
