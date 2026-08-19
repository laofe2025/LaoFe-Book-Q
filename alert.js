/* LAOFE Queue — ສຽງ & ການສັ່ນ ແຈ້ງເຕືອນ (ບໍ່ຕ້ອງໃຊ້ໄຟລ໌ສຽງ) */
(function () {
  var ctx = null;
  function ac() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }

  function beep(freq, start, dur, vol) {
    var c = ac(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    o.connect(g); g.connect(c.destination);
    var t = c.currentTime + start;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function vibrate(pat) { try { if (navigator.vibrate) navigator.vibrate(pat); } catch (e) {} }

  function speak(text) {
    try {
      if (!('speechSynthesis' in window)) return;
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'lo-LA'; u.rate = 0.95;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }

  window.LAOFE_ALERT = {
    // ເປີດໃຊ້ງານສຽງ (ຕ້ອງເອີ້ນຈາກການແຕະຂອງຜູ້ໃຊ້ ຄັ້ງທຳອິດ — iOS)
    prime: function () { var c = ac(); if (c) beep(0, 0, 0.01, 0.0001); },
    // ສຽງເບົາ (ໃກ້ຮອດຄິວ)
    soft: function () { beep(660, 0, 0.15, 0.18); vibrate(80); },
    // ສຽງດັງ + ສັ່ນ + ອ່ານເລກຄິວ (ຮອດຄິວ)
    ring: function (ticket) {
      // ໂນດ 3 ຄັ້ງ ໄລ່ຂຶ້ນ
      beep(784, 0.0, 0.18, 0.3);
      beep(988, 0.22, 0.18, 0.3);
      beep(1319, 0.44, 0.32, 0.32);
      // ຊ້ຳອີກຮອບ
      beep(784, 0.9, 0.18, 0.3);
      beep(988, 1.12, 0.18, 0.3);
      beep(1319, 1.34, 0.4, 0.32);
      vibrate([200, 100, 200, 100, 400]);
      if (ticket) speak('ຄິວ ' + String(ticket).split('').join(' ') + ' ເຊີນຮັບບໍລິການ');
    }
  };
})();
