/* ═══════════════════════════════════════════════
   Driver App - JavaScript (COMPLETE FIXED VERSION)
   ═══════════════════════════════════════════════ */

// 👉 ใส่ URL /exec ของ Apps Script ตรงนี้
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxjBoT-fST-zL4RF_cem_7wxR4IrmMSOn4XHFiUgxiDZMCyNu6ln_dzNZOQumdTLl5KgQ/exec";

let CURRENT_DRIVER = "";
let ACT_OPTIONS = { items: [], actions: [], topics: [] };

function switchPage(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));

  const pageMap = {
    home: { el: "pageHome", navIdx: 0 },
    history: { el: "pageHistory", navIdx: 1 },
    summary: { el: "pageSummary", navIdx: 2 },
    pm: { el: "pagePM", navIdx: 3 },
    act: { el: "pageACT", navIdx: 4 },
    repair: { el: "pageRepair", navIdx: 5 }
  };

  if (!pageMap[page]) return;

  document.getElementById(pageMap[page].el).classList.add("active");
  document.querySelectorAll(".nav-item")[pageMap[page].navIdx].classList.add("active");

  if (page === "history") loadHistory();
  if (page === "summary") loadSummary();
  if (page === "pm") loadPM();
}

function jsonp(action, params = {}) {
  return new Promise((resolve, reject) => {
    const cb = "cb_" + Math.random().toString(36).slice(2);
    const url = new URL(SCRIPT_URL);
    url.searchParams.set("action", action);
    url.searchParams.set("callback", cb);
    
    Object.keys(params).forEach(k => {
      const val = params[k];
      if (val !== null && val !== undefined) {
        url.searchParams.set(k, String(val));
      }
    });

    const script = document.createElement("script");
    script.src = url.toString();
    script.onerror = () => { cleanup(); reject(new Error("โหลดข้อมูลไม่ได้")); };

    window[cb] = (data) => { cleanup(); resolve(data); };
    function cleanup() { delete window[cb]; script.remove(); }

    document.body.appendChild(script);
  });
}

async function uploadFileToDrive(file, tripId) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result.split(',')[1];
        
        showToast("กำลังอัปโหลด...");
        
        const data = await jsonp("uploadPhotoBase64", {
          tripId: tripId,
          base64: base64,
          filename: file.name
        });
        
        resolve(data);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("ไม่สามารถอ่านไฟล์ได้"));
    reader.readAsDataURL(file);
  });
}

function h(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => (
    { "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m]
  ));
}

function showToast(msg, type = "default") {
  const el = document.createElement("div");
  el.className = "toast" + (type === "success" ? " toast-success" : type === "error" ? " toast-error" : "");
  el.textContent = msg;
  const container = document.getElementById("toastContainer");
  container.appendChild(el);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add("show"));
  });
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 400);
  }, 3000);
}

function setLoading(boxId, msg = "กำลังโหลด...") {
  document.getElementById(boxId).innerHTML = `
    <div class="loading-wrap">
      <div class="spinner"></div>
      <div class="loading-text">${h(msg)}</div>
    </div>`;
}

async function bootstrap() {
  if (!SCRIPT_URL || SCRIPT_URL.includes("YOUR_SCRIPT")) {
    document.getElementById("configAlert").style.display = "flex";
    return;
  }

  try {
    const actRes = await jsonp("getACTOptions");
    if (actRes.ok) {
      ACT_OPTIONS = actRes;
      document.getElementById("actItemList").innerHTML = actRes.items.map(i => `<option value="${h(i)}">`).join("");
      document.getElementById("actActionList").innerHTML = actRes.actions.map(a => `<option value="${h(a)}">`).join("");
      document.getElementById("repairTopicList").innerHTML = actRes.topics.map(t => `<option value="${h(t)}">`).join("");
    }
  } catch (err) {
    console.error("Bootstrap error:", err);
  }
}

function refreshApp() {
  document.getElementById("listBox").innerHTML = "";
  document.getElementById("historyBox").innerHTML = "";
  document.getElementById("summaryBox").innerHTML = "";
  document.getElementById("pmBox").innerHTML = "";
  bootstrap();
  showToast("รีเฟรชแล้ว ✓");
}

async function loadMyTrips() {
  const driverCodeInput = document.getElementById("driverCode").value.trim().toUpperCase();
  if (!driverCodeInput) { 
    showToast("กรุณากรอกรหัสพนักงานขับ", "error"); 
    return; 
  }

  setLoading("listBox", "กำลังตรวจสอบรหัส...");

  try {
    const validateRes = await jsonp("validateDriverCode", { code: driverCodeInput });
    if (!validateRes.ok) {
      document.getElementById("listBox").innerHTML = "";
      showToast(validateRes.error || "รหัสพนักงานไม่ถูกต้อง", "error");
      return;
    }

    const driver = validateRes.driver;
    CURRENT_DRIVER = driver.id;

    const nameDisplay = document.getElementById("driverNameDisplay");
    nameDisplay.textContent = `✓ ${driver.name} (${driver.code})`;
    nameDisplay.style.display = "block";

    setLoading("listBox", "กำลังโหลดงาน...");
    const res = await jsonp("driverListMyTrips", { driverId: driver.id });
    renderTrips(res);

  } catch (err) {
    document.getElementById("listBox").innerHTML = `
      <div class="alert alert-danger">
        <div class="alert-icon">❌</div>
        <div>โหลดงานไม่สำเร็จ: ${h(err.message)}</div>
      </div>`;
  }
}

function renderTrips(res) {
  const box = document.getElementById("listBox");

  if (!res.ok) {
    box.innerHTML = `<div class="alert alert-danger"><div class="alert-icon">❌</div><div>${h(res.error || "เกิดข้อผิดพลาด")}</div></div>`;
    return;
  }

  if (!res.trips || !res.trips.length) {
    box.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-title">ยังไม่มีงาน</div>
        <div class="empty-desc">ยังไม่มีงานที่ได้รับมอบหมาย<br>กรุณาติดต่อเจ้าหน้าที่ออฟฟิศ</div>
      </div>`;
    return;
  }

  const count = res.trips.length;
  let html = `<div class="section-head"><div class="section-head-title">งานของฉัน</div><span class="trip-count">${count}</span></div>`;

  res.trips.forEach(t => {
    const st = (t.status || "").toUpperCase();
    const badgeClass = st === "ASSIGNED" ? "badge-assigned" : st === "IN_PROGRESS" ? "badge-progress" : "badge-delivered";
    const badgeLabel = st === "ASSIGNED" ? "รอรับงาน" : st === "IN_PROGRESS" ? "กำลังวิ่งงาน" : "ส่งแล้ว";
    const dateStr = t.tripDate ? String(t.tripDate).slice(0, 10) : "—";

    html += `
      <div class="trip-card" id="card_${h(t.tripId)}">
        <div class="trip-header">
          <div>
            <div class="trip-id">${h(t.tripId)}</div>
            <div class="trip-meta">
              <div class="trip-meta-item"><span class="trip-meta-icon">📦</span> Order: ${h(t.orderId)}</div>
              <div class="trip-meta-item"><span class="trip-meta-icon">📅</span> ${h(dateStr)}</div>
              <div class="trip-meta-item"><span class="trip-meta-icon">🚛</span> ${h(t.truckName || t.truckId)}</div>
            </div>
          </div>
          <span class="status-badge ${badgeClass}">${badgeLabel}</span>
        </div>

        <div class="trip-body">
          ${st === "ASSIGNED" ? `
          <div class="odo-field" style="margin-bottom:20px;">
            <label class="form-label">📍 เลขไมล์เริ่ม</label>
            <input id="startOdo_${h(t.tripId)}" class="form-control"
                   type="number" inputmode="numeric" step="1" placeholder="กม."
                   value="${h(t.startOdo || "")}">
          </div>
          ` : st === "IN_PROGRESS" ? `
          <div class="note-field">
            <label class="form-label">📝 หมายเหตุ</label>
            <input id="note_${h(t.tripId)}" class="form-control"
                   type="text" placeholder="เช่น รถติด / จุดลงของ..."
                   value="">
          </div>

          <div class="file-input-wrap">
            <input type="file" accept="image/*" capture="environment" 
                   class="file-input" id="photo_${h(t.tripId)}"
                   onchange="previewPhoto('${h(t.tripId)}')">
            <label for="photo_${h(t.tripId)}" class="file-label">
              📷 ถ่ายรูปหน้างาน
            </label>
            <div id="preview_${h(t.tripId)}" class="file-preview"></div>
          </div>
          ` : `
          <div class="odo-field" style="margin-bottom:20px;">
            <label class="form-label">🏁 เลขไมล์จบ</label>
            <input id="endOdo_${h(t.tripId)}" class="form-control"
                   type="number" inputmode="numeric" step="1" placeholder="กม."
                   value="${h(t.endOdo || "")}">
          </div>
          `}

          <hr class="divider">

          ${st === "ASSIGNED" ? `
            <button class="btn btn-progress" onclick="setInProgress('${h(t.tripId)}')">
              ▶️ รับงาน / ออกวิ่ง
            </button>` : ""}
          ${st === "IN_PROGRESS" ? `
            <button class="btn btn-success" onclick="setDelivered('${h(t.tripId)}')">
              ✅ ถึงที่หมาย / ส่งแล้ว
            </button>` : ""}
          ${st === "DELIVERED" ? `
            <button class="btn btn-primary" onclick="saveEndOdo('${h(t.tripId)}')">
              💾 บันทึกเลขไมล์จบ
            </button>` : ""}
        </div>
      </div>`;
  });

  box.innerHTML = html;
}

function previewPhoto(tripId) {
  const input = document.getElementById("photo_" + tripId);
  const preview = document.getElementById("preview_" + tripId);
  
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
      preview.classList.add("show");
    };
    reader.readAsDataURL(input.files[0]);
  }
}

async function setInProgress(tripId) {
  const startOdo = document.getElementById("startOdo_" + tripId)?.value || "";
  if (!startOdo) { showToast("กรุณากรอกเลขไมล์เริ่ม", "error"); return; }

  const card = document.getElementById("card_" + tripId);
  const btn = card?.querySelector("button");
  if (!btn) return;

  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "⏳ กำลังบันทึก...";

  try {
    const res = await jsonp("driverUpdateStatus", { 
      tripId: tripId, 
      status: "IN_PROGRESS", 
      startOdo: startOdo 
    });
    if (!res.ok) throw new Error(res.error || "อัปเดตไม่สำเร็จ");
    showToast("รับงานแล้ว 🚀 กำลังออกวิ่ง", "success");
    await loadMyTrips();
  } catch (err) {
    showToast("เกิดข้อผิดพลาด: " + err.message, "error");
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function setDelivered(tripId) {
  const note = document.getElementById("note_" + tripId)?.value || "";
  const photoInput = document.getElementById("photo_" + tripId);

  const card = document.getElementById("card_" + tripId);
  const btn = card?.querySelector("button");
  if (!btn) return;

  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "⏳ กำลังบันทึก...";

  try {
    // Try to upload photo if selected (but don't fail if upload fails)
    if (photoInput?.files?.[0]) {
      try {
        const uploadRes = await uploadFileToDrive(photoInput.files[0], tripId);
        if (uploadRes.ok) {
          showToast("อัปโหลดรูปสำเร็จ ✓");
        }
      } catch (uploadErr) {
        console.log("Photo upload failed but continuing:", uploadErr);
      }
    }

    // Update status (this should always succeed)
    const res = await jsonp("driverUpdateStatus", { 
      tripId: tripId, 
      status: "DELIVERED", 
      note: note 
    });
    if (!res.ok) throw new Error(res.error || "อัปเดตไม่สำเร็จ");

    showToast("ส่งงานเรียบร้อย ✅ กรุณากลับมาบันทึกไมล์จบที่บริษัท", "success");
    await loadMyTrips();
  } catch (err) {
    showToast("เกิดข้อผิดพลาด: " + err.message, "error");
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function saveEndOdo(tripId) {
  const endOdo = document.getElementById("endOdo_" + tripId)?.value || "";
  if (!endOdo) { showToast("กรุณากรอกเลขไมล์จบ", "error"); return; }

  const card = document.getElementById("card_" + tripId);
  const btn = card?.querySelector("button");
  if (!btn) return;

  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "⏳ กำลังบันทึก...";

  try {
    const res = await jsonp("driverSaveEndOdo", { tripId: tripId, endOdo: endOdo });
    if (!res.ok) throw new Error(res.error || "บันทึกไม่สำเร็จ");
    showToast("บันทึกเลขไมล์จบสำเร็จ 💾", "success");
    await loadMyTrips();
  } catch (err) {
    showToast("เกิดข้อผิดพลาด: " + err.message, "error");
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

function setCardBusy(tripId, busy) {
  const card = document.getElementById("card_" + tripId);
  if (!card) return;
  const btn = card.querySelector("button");
  if (!btn) return;
  if (busy) {
    btn.disabled = true;
    btn.textContent = "⏳ กำลังอัปเดต...";
  }
}

async function loadHistory() {
  const driverId = CURRENT_DRIVER;
  if (!driverId) {
    document.getElementById("historyBox").innerHTML = `
      <div class="alert alert-info">
        <div class="alert-icon">ℹ️</div>
        <div>กรุณากรอกรหัสพนักงานที่หน้า "งานปัจจุบัน" ก่อน</div>
      </div>`;
    return;
  }

  setLoading("historyBox", "กำลังโหลดประวัติ...");

  try {
    const res = await jsonp("driverTripHistory", { driverId });
    renderHistory(res);
  } catch (err) {
    document.getElementById("historyBox").innerHTML = `
      <div class="alert alert-danger">
        <div class="alert-icon">❌</div>
        <div>โหลดประวัติไม่สำเร็จ: ${h(err.message)}</div>
      </div>`;
  }
}

function renderHistory(res) {
  const box = document.getElementById("historyBox");

  if (!res.ok) {
    box.innerHTML = `<div class="alert alert-danger"><div class="alert-icon">❌</div><div>${h(res.error || "เกิดข้อผิดพลาด")}</div></div>`;
    return;
  }

  if (!res.trips || !res.trips.length) {
    box.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-title">ไม่มีประวัติงาน</div>
        <div class="empty-desc">ยังไม่มีงานในระบบ</div>
      </div>`;
    return;
  }

  let html = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Trip ID</th>
            <th>วันที่</th>
            <th>Order</th>
            <th>รถ</th>
            <th>สถานะ</th>
            <th>ไมล์เริ่ม</th>
            <th>ไมล์จบ</th>
            <th>รูปภาพ</th>
          </tr>
        </thead>
        <tbody>`;

  res.trips.forEach(t => {
    const st = (t.status || "").toUpperCase();
    const badgeClass = st === "ASSIGNED" ? "badge-assigned" : st === "IN_PROGRESS" ? "badge-progress" : st === "DELIVERED" ? "badge-delivered" : "badge-assigned";
    const badgeLabel = st === "ASSIGNED" ? "รอรับงาน" : st === "IN_PROGRESS" ? "กำลังวิ่ง" : st === "DELIVERED" ? "ส่งแล้ว" : st;

    const photoUrls = String(t.photoUrl || "").split("|").map(s => s.trim()).filter(Boolean);
    const photoLinks = photoUrls.length ? photoUrls.map((url, i) => `<a href="${h(url)}" target="_blank" class="table-photo-link">รูป${i+1}</a>`).join(" ") : "—";

    html += `
      <tr>
        <td class="table-tripid">${h(t.tripId)}</td>
        <td>${h(t.tripDate || "—")}</td>
        <td>${h(t.orderId)}</td>
        <td>${h(t.truckName || t.truckId)}</td>
        <td><span class="table-badge ${badgeClass}">${badgeLabel}</span></td>
        <td>${h(t.startOdo || "—")}</td>
        <td>${h(t.endOdo || "—")}</td>
        <td>${photoLinks}</td>
      </tr>`;
  });

  html += `</tbody></table></div>`;
  box.innerHTML = html;
}

async function loadSummary() {
  const driverId = CURRENT_DRIVER;
  if (!driverId) {
    document.getElementById("summaryBox").innerHTML = `
      <div class="alert alert-info">
        <div class="alert-icon">ℹ️</div>
        <div>กรุณากรอกรหัสพนักงานที่หน้า "งานปัจจุบัน" ก่อน</div>
      </div>`;
    return;
  }

  setLoading("summaryBox", "กำลังโหลดสรุป...");

  try {
    const res = await jsonp("driverSummary", { driverId });
    renderSummary(res);
  } catch (err) {
    document.getElementById("summaryBox").innerHTML = `
      <div class="alert alert-danger">
        <div class="alert-icon">❌</div>
        <div>โหลดสรุปไม่สำเร็จ: ${h(err.message)}</div>
      </div>`;
  }
}

function renderSummary(res) {
  const box = document.getElementById("summaryBox");

  if (!res.ok) {
    box.innerHTML = `<div class="alert alert-danger"><div class="alert-icon">❌</div><div>${h(res.error || "เกิดข้อผิดพลาด")}</div></div>`;
    return;
  }

  if (!res.records || !res.records.length) {
    box.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-title">ไม่มีข้อมูล</div>
        <div class="empty-desc">ยังไม่มีข้อมูลสรุปในระบบ</div>
      </div>`;
    return;
  }

  const total = res.total || { allowance: 0, other: 0, sum: 0 };

  let html = `
    <div class="total-box">
      <div class="total-label">รวมทั้งหมด</div>
      <div class="total-amount">${total.sum.toLocaleString()} ฿</div>
      <div class="total-grid">
        <div class="total-item">
          <div class="total-item-label">เบี้ยเลี้ยง</div>
          <div class="total-item-value">${total.allowance.toLocaleString()} ฿</div>
        </div>
        <div class="total-item">
          <div class="total-item-label">อื่นๆ</div>
          <div class="total-item-value">${total.other.toLocaleString()} ฿</div>
        </div>
      </div>
    </div>

    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>วันที่</th>
            <th>งาน</th>
            <th>เบี้ยเลี้ยง (฿)</th>
            <th>อื่นๆ (฿)</th>
          </tr>
        </thead>
        <tbody>`;

  res.records.forEach(r => {
    html += `
      <tr>
        <td>${h(r.date)}</td>
        <td>${h(r.trips)}</td>
        <td>${r.allowance.toLocaleString()}</td>
        <td>${r.other.toLocaleString()}</td>
      </tr>`;
  });

  html += `</tbody></table></div>`;
  box.innerHTML = html;
}

async function loadPM() {
  const driverId = CURRENT_DRIVER;
  if (!driverId) {
    document.getElementById("pmBox").innerHTML = `
      <div class="alert alert-info">
        <div class="alert-icon">ℹ️</div>
        <div>กรุณากรอกรหัสพนักงานที่หน้า "งานปัจจุบัน" ก่อน</div>
      </div>`;
    return;
  }

  setLoading("pmBox", "กำลังโหลด PM Plan...");

  try {
    const res = await jsonp("driverPMPlan", { driverId });
    renderPM(res);
  } catch (err) {
    document.getElementById("pmBox").innerHTML = `
      <div class="alert alert-danger">
        <div class="alert-icon">❌</div>
        <div>โหลด PM Plan ไม่สำเร็จ: ${h(err.message)}</div>
      </div>`;
  }
}

function renderPM(res) {
  const box = document.getElementById("pmBox");

  if (!res.ok) {
    box.innerHTML = `<div class="alert alert-danger"><div class="alert-icon">❌</div><div>${h(res.error || "เกิดข้อผิดพลาด")}</div></div>`;
    return;
  }

  if (!res.records || !res.records.length) {
    box.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-title">ไม่มีข้อมูล</div>
        <div class="empty-desc">ยังไม่มีข้อมูล PM Plan ในระบบ</div>
      </div>`;
    return;
  }

  let html = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>รายการ</th>
            <th>ล่าสุด</th>
            <th>Plan</th>
          </tr>
        </thead>
        <tbody>`;

  res.records.forEach(r => {
    html += `
      <tr>
        <td>${h(r.item)}</td>
        <td>${h(r.latest)}</td>
        <td>${h(r.plan)}</td>
      </tr>`;
  });

  html += `</tbody></table></div>`;
  box.innerHTML = html;
}

async function saveACTPlan() {
  const driverId = CURRENT_DRIVER;
  if (!driverId) {
    showToast("กรุณาเข้าสู่ระบบที่หน้างานปัจจุบันก่อน", "error");
    return;
  }

  // Get all form values
  const date = document.getElementById("actDate").value;
  const odo = document.getElementById("actOdo").value;
  const item = document.getElementById("actItem").value.trim();
  const actAction = document.getElementById("actAction").value.trim();
  const additional = document.getElementById("actAdditional").value.trim();
  const cost = document.getElementById("actCost").value;

  // Show loading state
  const btn = document.querySelector('#pageACT .btn-primary');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "⏳ กำลังบันทึก...";

  try {
    // Save to sheet - ใช้ actAction แทน action เพื่อไม่ให้ชนกับ API action
    console.log("Sending ACT Plan data:", { driverId, date, odo, item, actAction, additional, cost });
    
    const res = await jsonp("saveACTPlan", { 
      driverId: driverId,
      date: date,
      odo: odo,
      item: item,
      actAction: actAction,
      additional: additional,
      cost: cost
    });

    console.log("Backend response:", res);

    // Check if really successful
    if (res.ok) {
      showToast("บันทึกข้อมูลสำเร็จ ✅", "success");
      
      // Clear form
      document.getElementById("actDate").value = "";
      document.getElementById("actOdo").value = "";
      document.getElementById("actItem").value = "";
      document.getElementById("actAction").value = "";
      document.getElementById("actAdditional").value = "";
      document.getElementById("actCost").value = "";
    } else {
      showToast("เกิดข้อผิดพลาด: " + (res.error || "ไม่ทราบสาเหตุ"), "error");
    }

  } catch (err) {
    console.error("ACT Plan save error:", err);
    showToast("เกิดข้อผิดพลาด: " + err.message, "error");
  } finally {
    // Restore button
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

function previewRepairFile() {
  const input = document.getElementById("repairFile");
  const preview = document.getElementById("repairPreview");
  
  if (input.files && input.files[0]) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      if (file.type.startsWith('image/')) {
        preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
      } else if (file.type.startsWith('video/')) {
        preview.innerHTML = `<video src="${e.target.result}" controls style="width:100%;"></video>`;
      }
      preview.classList.add("show");
    };
    reader.readAsDataURL(file);
  }
}

async function saveRepairReport() {
  const driverId = CURRENT_DRIVER;
  if (!driverId) {
    showToast("กรุณาเข้าสู่ระบบที่หน้างานปัจจุบันก่อน", "error");
    return;
  }

  const odo = document.getElementById("repairOdo").value;
  const topic = document.getElementById("repairTopic").value.trim();
  const detail = document.getElementById("repairDetail").value.trim();
  const fileInput = document.getElementById("repairFile");

  if (!odo || !topic) {
    showToast("กรุณากรอกเลขไมล์และหัวข้อแจ้งซ่อม", "error");
    return;
  }

  // Show loading state
  const btn = document.querySelector('#pageRepair .btn-primary');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "⏳ กำลังบันทึก...";

  try {
    let fileUrl = "";
    
    // Try to upload file if selected (but don't fail if upload fails)
    if (fileInput?.files?.[0]) {
      try {
        const repairTripId = `repair_${driverId}_${Date.now()}`;
        const uploadRes = await uploadFileToDrive(fileInput.files[0], repairTripId);
        if (uploadRes.ok) {
          fileUrl = uploadRes.fileUrl || "";
          showToast("อัปโหลดไฟล์สำเร็จ ✓");
        }
      } catch (uploadErr) {
        console.log("File upload failed but continuing:", uploadErr);
      }
    }

    const res = await jsonp("saveRepairReport", { driverId, odo, topic, detail, fileUrl });
    if (!res.ok) throw new Error(res.error || "แจ้งซ่อมไม่สำเร็จ");

    showToast("แจ้งซ่อมสำเร็จ ✅", "success");
    
    document.getElementById("repairOdo").value = "";
    document.getElementById("repairTopic").value = "";
    document.getElementById("repairDetail").value = "";
    document.getElementById("repairFile").value = "";
    document.getElementById("repairPreview").classList.remove("show");
    document.getElementById("repairPreview").innerHTML = "";
  } catch (err) {
    showToast("เกิดข้อผิดพลาด: " + err.message, "error");
  } finally {
    // Restore button
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

window.addEventListener("load", bootstrap);
