/**********************************************************************
 * LAOFE Queue — ຕັ້ງຄ່າ (ແກ້ໄຂພຽງໄຟລ໌ນີ້ບ່ອນດຽວ)
 *
 * 1) API_URL = ລິ້ງ Web app ຈາກ Google Apps Script
 *    (Deploy → New deployment → Web app → Copy URL)
 * 2) ADMIN_PIN = ຕ້ອງກົງກັບ ADMIN_PIN ໃນ Code.gs
 **********************************************************************/
window.LAOFE_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbwMDcQgy8n6fyjMpl_OYoYhv278doF0T3o24_Uoc5oQPGDdVCmFPnSdHUKJqNdz4tyU/exec',   // ← ວາງລິ້ງທີ່ໄດ້ຈາກ Apps Script
  ADMIN_PIN: '1234',                          // ← ໃຫ້ກົງກັບ Code.gs
  SHOP_NAME: 'LAOFE',
  SHOP_SUB: 'CAFE & BEER',
  POLL_MS: 5000                               // ຮອບການອັບເດດ (ມິນລິວິນາທີ)
};
