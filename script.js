// إعدادات عامة
const MAX_KM = 5.0; // أقصى مسافة للفرع الأقرب
const BRANCHES_URL = "branches.json"; // ملف بيانات الفروع

// عناصر الواجهة
const $welcome = document.getElementById("welcome");
const $status  = document.getElementById("status");
const $nearest = document.getElementById("nearest");
const $noNear  = document.getElementById("noNear");
const $btnLocate = document.getElementById("btnLocate");
const $btnContinue = document.getElementById("btnContinue");
const $nearestInfo = document.getElementById("nearestInfo");
const $waFallbackNear = document.getElementById("waFallbackNear");
const $waLinkNear = document.getElementById("waLinkNear");

// عناصر حالة "لا يوجد فرع قريب"
const $fallbackInfo = document.getElementById("fallbackInfo");
const $btnNoNearContinue = document.getElementById("btnNoNearContinue");

// نموذج
const $formCard = document.getElementById("formCard");
const modeSeg = document.getElementById("modeSeg");
const deliveryBlock = document.getElementById("deliveryBlock");
const idEl = document.getElementById("id_number");
const rxEl = document.getElementById("rx_number");
const mobileEl = document.getElementById("mobile");
const addrEl = document.getElementById("addr");
const consentEl = document.getElementById("consent");
const locStatus = document.getElementById("locStatus");
const errorMsg = document.getElementById("errorMsg");
const formView = document.getElementById("formView");
const doneView = document.getElementById("doneView");
const waLink = document.getElementById("waLink");
const toast = document.getElementById("toast");
const sendBtn = document.getElementById("sendBtn");
const newReqBtn = document.getElementById("newReq");

// دعم Chips في شاشة أقرب فرع (للتناسق الشكلي فقط)
const chipsNear = document.getElementById("chipsNear");

let branches = [];
let nearest = null;          // أقرب فرع داخل 5 كم
let fallbackNearest = null;  // أقرب فرع مطلقًا (لو مفيش داخل 5 كم)
let mode = "pickup";
let gpsLink = "";

// واجهة
function show(el){
  [$welcome,$status,$nearest,$noNear,$formCard].forEach(e => e && (e.hidden = true));
  el.hidden = false;
}
function setStatus(html, isError=false){
  $status.className = "card" + (isError ? " error" : "");
  $status.innerHTML = html;
}

// مسافة
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function qs(name) {
  const p = new URLSearchParams(window.location.search);
  return p.get(name);
}

// بناء روابط واتساب (أساسي api.whatsapp + بديل wa.me)
function buildWhatsAppLink(intlPhone, text){
  const encoded = encodeURIComponent(text || "السلام عليكم، عايز أصرف وصفتتي.");
  const src = qs("src");
  const tail = src ? `&src=${encodeURIComponent(src)}` : "";
  return {
    primary: `https://api.whatsapp.com/send?phone=${intlPhone}&text=${encoded}${tail}`,
    fallback: `https://wa.me/${intlPhone}?text=${encoded}${tail}`
  };
}

// كسر الكاش + فحص الشكل
async function ensureBranches(){
  if (branches.length) return;
  const bust = Date.now();
  let res = await fetch(`${BRANCHES_URL}?v=${bust}`, { cache: "no-store" });
  if (!res.ok) {
    // Fallback لاسم آخر لو مستخدمه
    res = await fetch(`branches_generated.json?v=${bust}`, { cache: "no-store" });
  }
  if (!res.ok) throw new Error("تعذر تحميل بيانات الفروع.");
  branches = await res.json();
  if (!Array.isArray(branches)) throw new Error("صيغة بيانات الفروع غير صحيحة.");
}

async function startLocate(){
  show($status);
  setStatus('جارِ تحميل بيانات الفروع…');
  try { await ensureBranches(); }
  catch(e){
    setStatus(`تعذر تحميل بيانات الفروع. <small>${e.message}</small>`, true);
    return;
  }

  setStatus('جارِ تحديد موقعك…');
  if(!navigator.geolocation){
    setStatus('المتصفح لا يدعم تحديد الموقع. فعّل إذن الموقع أو استخدم جهاز آخر.', true);
    return;
  }

  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude, longitude } = pos.coords;
    const enriched = branches.map(b => ({...b, dist: haversine(latitude, longitude, b.lat, b.lon)}))
                             .sort((a,b)=>a.dist-b.dist);

    fallbackNearest = enriched[0] || null;
    nearest = enriched.find(b => b.dist <= MAX_KM) || null;

    if(nearest){
      $nearestInfo.innerHTML = `
        <div><b>${nearest.branch}</b></div>
        <div>المسافة: ${nearest.dist.toFixed(2)} كم</div>
        ${nearest.address ? `<div class="muted">${nearest.address}</div>` : ""}
      `;
      show($nearest);
    }else{
      if (fallbackNearest){
        $fallbackInfo.innerHTML = `
          <div><b>${fallbackNearest.branch}</b></div>
          <div>المسافة التقريبية: ${fallbackNearest.dist.toFixed(2)} كم</div>
          ${fallbackNearest.address ? `<div class="muted">${fallbackNearest.address}</div>` : ""}
        `;
      } else {
        $fallbackInfo.innerHTML = `<div class="muted">لا توجد بيانات فروع متاحة حاليًا.</div>`;
      }
      show($noNear);
    }
  }, err => {
    let msg = 'تعذر تحديد الموقع.';
    if (err && err.code === err.PERMISSION_DENIED) msg = 'لم يتم السماح بالوصول للموقع. اسمح بالموقع ثم أعد التحميل.';
    else if (err && err.code === err.POSITION_UNAVAILABLE) msg = 'خدمة تحديد الموقع غير متاحة مؤقتًا.';
    else if (err && err.code === err.TIMEOUT) msg = 'انتهى الوقت قبل الحصول على الموقع. جرّب مرة أخرى.';
    setStatus(`${msg}<br><br><button class="btn btn-primary" onclick="startLocate()">جرّب مرة أخرى</button>`, true);
  }, { enableHighAccuracy:true, timeout:15000, maximumAge:0 });
}

$btnLocate?.addEventListener("click", startLocate);

// متابعة من شاشة أقرب فرع → النموذج
$btnContinue?.addEventListener("click", () => {
  if(!nearest){
    setStatus("لم يتم تحديد فرع بعد.", true);
    show($status);
    return;
  }
  forceFormFor(nearest, /*pickup*/ true);
});

// متابعة من شاشة "لا يوجد فرع قريب" → النموذج (أقرب فرع مطلقًا)
$btnNoNearContinue?.addEventListener("click", () => {
  if(!fallbackNearest){
    setStatus("لا تتوفر بيانات فرع حاليًا.", true);
    show($status);
    return;
  }
  nearest = fallbackNearest; // عيّن الأقرب كهدف
  forceFormFor(nearest, /*pickup*/ true);
});

// إعداد النموذج للحالة المطلوبة
function forceFormFor(targetBranch, pickupDefault){
  mode = pickupDefault ? "pickup" : "delivery";

  // فعّل الChip المناسبة في المجموعتين (لو موجودة)
  [document.getElementById("chipsNear"), modeSeg].forEach(group=>{
    if(!group) return;
    [...group.querySelectorAll(".chip")].forEach(x=>x.classList.remove("active"));
    const btn = group.querySelector(`[data-mode="${mode}"]`);
    if(btn) btn.classList.add("active");
  });

  deliveryBlock.style.display = (mode==="delivery") ? "block" : "none";
  show($formCard);
}

// سويتش الخدمة داخل أي مجموعة Chips
function attachChipsToggle(group){
  if(!group) return;
  group.addEventListener("click",(e)=>{
    const b=e.target.closest("button[data-mode]");
    if(!b) return;
    mode=b.dataset.mode;
    [...group.querySelectorAll(".chip")].forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    deliveryBlock.style.display=(mode==="delivery")?"block":"none";
  });
}
attachChipsToggle(document.getElementById("chipsNear"));
attachChipsToggle(modeSeg);

// تحديد موقع للتوصيل
document.getElementById("locBtn")?.addEventListener("click", ()=>{
  locStatus.textContent="⏳ جارِ تحديد الموقع...";
  if(!navigator.geolocation){locStatus.textContent="⚠ المتصفح لا يدعم تحديد الموقع";return;}
  navigator.geolocation.getCurrentPosition(pos=>{
    gpsLink=`https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`;
    locStatus.textContent="✅ تم التقاط موقعك";
  },()=>{locStatus.textContent="⚠ تعذر تحديد الموقع";},
  {enableHighAccuracy:true,timeout:12000,maximumAge:0});
});

// بناء الرسالة
function buildMessage(){
  const EMO_PICKUP="🚶‍♂️", EMO_DELIVERY="🏠", EMO_PIN="📍";
  let m=(mode==="pickup"?`${EMO_PICKUP} استلام من الفرع`:`${EMO_DELIVERY} توصيل للمنزل`)+"\n";
  m+=`رقم الهوية: ${idEl.value}\n`;
  m+=`رقم الوصفة: ${rxEl.value}\n`;
  if(mode==="delivery"){
    m+=`الجوال: ${mobileEl.value}\n`;
    m+=`العنوان: ${addrEl.value}\n`;
    m+=`${EMO_PIN} الموقع: ${gpsLink||"غير محدد"}\n`;
  }
  m+=`\n*تمت موافقة العميل على مشاركة البيانات*`;
  return m;
}

// فتح واتساب لأقرب فرع
sendBtn?.addEventListener("click", ()=>{
  errorMsg.textContent="";
  // تحقق بسيط
  if(!idEl.value || !rxEl.value){errorMsg.textContent="⚠ أدخل رقم الهوية والوصفة";return;}
  if(!consentEl.checked){errorMsg.textContent="⚠ برجاء الموافقة لإرسال الطلب";return;}
  if(mode==="delivery"){
    if(!mobileEl.value){errorMsg.textContent="⚠ أدخل رقم الجوال";return;}
    if(!gpsLink){errorMsg.textContent="⚠ يجب تحديد الموقع للتوصيل";return;}
  }
  if(!nearest){
    errorMsg.textContent="⚠ لم يتم تحديد فرع بعد.";
    return;
  }
  if(!nearest.whatsapp && nearest.maps_url){
    window.open(nearest.maps_url, "_blank", "noopener");
    waLink.href = nearest.maps_url;
    formView.style.display="none";
    doneView.style.display="block";
    showToast("تم فتح الخريطة لأن رقم الواتساب غير متاح.");
    return;
  }
  if(!nearest.whatsapp){
    errorMsg.textContent="⚠ لا تتوفر بيانات تواصل للفرع المحدد.";
    return;
  }

  // استخرج الرقم الدولي من رابط branches.json (wa.me أو api.whatsapp)
  let intl = null;
  try{
    const u = new URL(nearest.whatsapp);
    if (u.hostname.includes("wa.me")) {
      intl = u.pathname.replace(/^\//, "");
    } else {
      intl = new URLSearchParams(u.search).get("phone");
    }
  }catch{
    intl = (nearest.whatsapp || "").replace(/\D/g, "");
  }
  if(!intl){ errorMsg.textContent="⚠ رقم واتساب غير صالح."; return; }

  const msg = buildMessage();
  const links = buildWhatsAppLink(intl, msg);

  // افتح تبويب جديد + رابط بديل
  let w = null;
  try { w = window.open(links.primary, "_blank", "noopener"); } catch{}
  if(!w || w.closed){
    try { window.location.href = links.primary; } catch{}
  }

  // انتقال لواجهة “تم الإرسال”
  waLink.href = links.fallback;
  formView.style.display="none";
  doneView.style.display="block";
  showToast("تم فتح واتساب لإرسال طلبك ✅");
});

// Toast
function showToast(msg){
  if(!toast) return;
  toast.textContent = msg || "تم التنفيذ";
  toast.classList.add("show");
  setTimeout(()=>toast.classList.remove("show"),2200);
}

// طلب جديد
newReqBtn?.addEventListener("click", ()=>{
  location.href = location.pathname; // رجوع لبداية الفلو
});

// تشغيل تلقائي لو فيه ?autostart=1
if(qs("autostart") === "1"){
  startLocate().catch(e => {
    setStatus("خطأ غير متوقع. حاول مجددًا.", true);
    show($status);
    console.error(e);
  });
}
