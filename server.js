const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;

// 啟動時把字型讀進記憶體，嵌入 HTML 避免 Chromium 網路請求失敗
const fontDir = path.join(__dirname, 'node_modules/@fontsource/noto-sans-tc/files');
function fontB64(weight) {
  return fs.readFileSync(path.join(fontDir, `noto-sans-tc-chinese-traditional-${weight}-normal.woff2`)).toString('base64');
}
const FONTS = { 300: fontB64(300), 400: fontB64(400), 600: fontB64(600), 700: fontB64(700) };

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function buildHtml({ type, client, address, date, items, notes, fonts }) {
  const isInvoice = type === 'invoice';
  const subtotal = items.reduce((s, it) => s + it.qty * it.unit_price, 0);
  const tax = Math.round(subtotal * 0.05);
  const total = subtotal + tax;
  const fmt = n => Number(n).toLocaleString('en-US');

  const rows = items.map(it => {
    const amt = it.qty * it.unit_price;
    return `<tr>
      <td class="tl">${it.name}</td>
      <td class="tr">${fmt(it.qty)}</td>
      <td class="tr">${fmt(it.unit_price)}</td>
      <td class="tr">${fmt(amt)}</td>
    </tr>`;
  }).join('');

  const noteLi = notes.map(n => `<li>${n}</li>`).join('');
  const addrRow = address ? `<div class="addr">施作地址：${address}</div>` : '';
  const bankSection = isInvoice ? `
    <div class="bank-section">
      <div class="bank-title">匯款資訊</div>
      <div class="bank-row">
        <div><span class="bank-label">銀行&emsp;</span><span class="bank-value">101 瑞興商業銀行 松山簡易型分行</span></div>
        <div><span class="bank-label">帳號&emsp;</span><span class="bank-value">0190-2107-2936-0</span></div>
        <div><span class="bank-label">戶名&emsp;</span><span class="bank-value">精盛清潔有限公司</span></div>
      </div>
    </div>` : '';

  const docTitle  = isInvoice ? '請 款 單' : '報 價 單';
  const docSub    = isInvoice ? 'INVOICE'   : 'QUOTATION';
  const dateLabel = isInvoice ? '請款日期'  : '報價日期';
  const intro     = isInvoice
    ? '茲就下列工程項目提出請款，敬請核撥，謝謝。'
    : '感謝您的洽詢，針對本次專案內容，以下為初步估價詳情：';
  const grandLabel = isInvoice ? '請款合計 Amount Due' : '總計 Grand Total';
  const signLabel  = isInvoice ? '核准付款簽章：' : '接受上述報價簽章：';

  return `<!DOCTYPE html>
<html lang="zh-TW"><head><meta charset="utf-8">
<style>
@font-face{font-family:"Noto Sans TC";font-weight:300;src:url('data:font/woff2;base64,${fonts[300]}') format('woff2')}
@font-face{font-family:"Noto Sans TC";font-weight:400;src:url('data:font/woff2;base64,${fonts[400]}') format('woff2')}
@font-face{font-family:"Noto Sans TC";font-weight:600;src:url('data:font/woff2;base64,${fonts[600]}') format('woff2')}
@font-face{font-family:"Noto Sans TC";font-weight:700;src:url('data:font/woff2;base64,${fonts[700]}') format('woff2')}
@page{size:A4;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:"Noto Sans TC",sans-serif;background:#f5ede3;color:#3a2d24;font-size:10pt;padding:52px 60px;min-height:297mm}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px}
.co-name{font-size:26pt;letter-spacing:.16em;font-weight:300;margin-bottom:10px}
.co-info{font-size:9pt;color:#7a6a5e;line-height:1.9}
.doc-right{text-align:right}
.doc-main{font-size:22pt;font-weight:700;letter-spacing:.12em}
.doc-sub{font-size:8pt;letter-spacing:.22em;color:#a09080;margin-top:3px}
.doc-meta{font-size:9pt;color:#7a6a5e;margin-top:10px;line-height:1.9}
hr{border:none;border-top:1px solid #c8b9aa;margin:18px 0}
.client-sec{margin:24px 0 20px}
.client-to{font-size:11pt;font-weight:600;margin-bottom:5px}
.addr{font-size:9pt;color:#7a6a5e;margin-bottom:8px}
.intro{font-size:9.5pt;color:#7a6a5e}
table{width:100%;border-collapse:collapse;margin:18px 0}
thead tr{background:#e4d9ce;border-bottom:2px solid #3a2d24}
thead th{padding:10px 12px;font-size:9pt;font-weight:600;letter-spacing:.05em}
th.tl{text-align:left}th.tr{text-align:right}
tbody tr{border-bottom:1px solid #ddd0c4}
tbody tr:last-child{border-bottom:none}
tbody td{padding:12px;font-size:10pt}
td.tl{text-align:left}td.tr{text-align:right}
.totals{margin-left:auto;width:52%;margin-top:6px}
.t-row{display:flex;justify-content:space-between;padding:8px 12px;border-bottom:1px solid #ddd0c4;font-size:10pt}
.t-row.grand{background:#6b5a4e;color:#fff;font-weight:700;font-size:11pt;border-bottom:none;margin-top:3px;border-radius:2px}
.bank-section{margin-top:28px;background:#ede4d8;border-radius:4px;padding:16px 20px;border:1.5px solid #8a7a6e;border-left:4px solid #6b5a4e}
.bank-title{font-size:9.5pt;font-weight:700;margin-bottom:10px}
.bank-row{display:flex;gap:28px;font-size:9.5pt;line-height:2;flex-wrap:wrap}
.bank-label{color:#7a6a5e;white-space:nowrap}
.bank-value{font-weight:600}
.notes{margin-top:28px;border-top:1px solid #c8b9aa;padding-top:18px}
.notes-title{font-size:9.5pt;font-weight:700;margin-bottom:10px}
.notes ol{padding-left:18px}
.notes li{font-size:9pt;color:#7a6a5e;margin-bottom:6px;line-height:1.6}
.sign-section{margin-top:36px}
.sign-label{font-size:9pt;color:#7a6a5e;margin-bottom:10px}
.sign-box{border:1.5px solid #c8b9aa;border-radius:3px;height:110px;display:flex;align-items:center;justify-content:center}
.sign-box-inner{text-align:center;color:#c8b9aa}
.sign-box-main{font-size:12pt;font-weight:600;letter-spacing:.08em}
.sign-box-sub{font-size:8pt;letter-spacing:.12em;margin-top:4px}
</style>
</head><body>
<div class="hdr">
  <div>
    <div class="co-name">精 盛 清 潔 有 限 公 司</div>
    <div class="co-info">台北市中山區松江路 76 號 7 樓之 1<br>聯絡方式：0931-211-552</div>
  </div>
  <div class="doc-right">
    <div class="doc-main">${docTitle}</div>
    <div class="doc-sub">${docSub}</div>
    <div class="doc-meta">顧問：鄭美龍<br>${dateLabel}：${date}</div>
  </div>
</div>
<hr>
<div class="client-sec">
  <div class="client-to">致：${client}</div>
  ${addrRow}
  <div class="intro">${intro}</div>
</div>
<table>
  <thead><tr>
    <th class="tl">項目名稱 Description</th>
    <th class="tr">數量 Qty</th>
    <th class="tr">單價 Unit</th>
    <th class="tr">金額 Total</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="totals">
  <div class="t-row"><span>小計 Subtotal</span><span>NT$ ${fmt(subtotal)}</span></div>
  <div class="t-row"><span>稅額 Tax (5%)</span><span>NT$ ${fmt(tax)}</span></div>
  <div class="t-row grand"><span>${grandLabel}</span><span>NT$ ${fmt(total)}</span></div>
</div>
${bankSection}
<div class="notes">
  <div class="notes-title">備註說明：</div>
  <ol>${noteLi}</ol>
</div>
<div class="sign-section">
  <div class="sign-label">${signLabel}</div>
  <div class="sign-box">
    <div class="sign-box-inner">
      <div class="sign-box-main">簽章／蓋印</div>
      <div class="sign-box-sub">AUTHORIZED SIGNATURE &amp; STAMP</div>
    </div>
  </div>
</div>
</body></html>`;
}

function twToday() {
  return new Date().toLocaleDateString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

app.post('/api/generate', async (req, res) => {
  const { type = 'quote', client = '', address = '', date, items = [], notes } = req.body;
  const isInvoice = type === 'invoice';

  const defaultNotes = isInvoice
    ? ['請於請款單開立後 60 日內完成付款。', '匯款後請來電或來訊確認，謝謝。']
    : ['本報價單有效期為 30 天。', '確認接受報價後請簽署回傳。'];

  const data = {
    type, client, address,
    date: date || twToday(),
    items,
    notes: notes || defaultNotes,
    fonts: FONTS,
  };

  const html = buildHtml(data);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.evaluateHandle('document.fonts.ready');
  const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();

  const dateCompact = data.date.replace(/\//g, '').slice(2);
  const suffix = isInvoice ? '_請款' : '_報價';
  const filename = `${dateCompact}_${client}${suffix}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.send(Buffer.from(pdfBuffer));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

