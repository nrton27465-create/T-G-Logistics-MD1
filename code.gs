const SPREADSHEET_ID = "1JIq4Arpwu-k7bl1C0dm9HsrL7hpDc0HvxgqvV6KiEN0"; // **ใส่ ID Google Sheet ของคุณที่นี่**

function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('T&G LOGISTICS-MD 1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ฟังก์ชันดึงข้อมูลจาก Sheet "DDL" เพื่อไปสร้างเมนูและตาราง
function getInitialData() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("DDL");
  const data = sheet.getDataRange().getValues();
  
  // ตัดหัวตารางออก (แถวที่ 1)
  const rows = data.slice(1);
  
  return {
    companies: rows.map(r => r[0]).filter(String), // Col A
    todoItems: rows.map(r => r[1]).filter(String),  // Col B
    round1Heads: rows.map(r => r[2]).filter(String), // Col C
    round2Heads: rows.map(r => r[3]).filter(String)  // Col D
  };
}

// ฟังก์ชันบันทึกข้อมูล
function saveData(page, company, details) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheetName = "";
  
  if (page === 'todo') sheetName = "DB-list";
  else if (page === '1st') sheetName = "DB-1st";
  else if (page === '2nd') sheetName = "DB-2nd";
  
  const sheet = ss.getSheetByName(sheetName);
  const timestamp = new Date();
  
  // เตรียมแถวข้อมูล
  const rowData = [timestamp, company, JSON.stringify(details)];
  
  // กรณีเป็นคะแนน (1st, 2nd) จะบันทึกผลรวมเพิ่มด้วย
  if (page !== 'todo') {
    const total = details.reduce((sum, item) => sum + parseInt(item.score), 0);
    rowData.push(total);
  }
  
  sheet.appendRow(rowData);
  return "บันทึกข้อมูลสำเร็จ";
}
