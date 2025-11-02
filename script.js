// إعدادات عامة
const MAX_KM = 5.0; // أقصى مسافة للفرع الأقرب
const BRANCHES_URL = "branches.json"; // ملف بيانات الفروع

// عناصر الواجهة
const $welcome = document.getElementById("welcome");
const $status  = document.getElementById("status");
const $nearest = document.getElementById("nearest");
const $noNear  = document.getElementById("noNear");
const $btnLocate = document.getElementById("btnLocate");
const $btnRequest = document.getElementById("btnRequest");
const $nearestInfo = document.getElementById("nearestInfo");
const $waFallback = document.getElementById("waFallback");
const $waLink = document.getElementById("waLink");

let branches = [];
let nearest = null;

function show(el){
  [$welcome,$status,$nearest,$noNear].forEach(e => e && (e.hidden = true));
  el.hidden = false;
}
function setStatus(html, isError=false){
  $status.className = "card" + (isError ? " error" : "");
  $status.innerHTML = html;
}

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

function buildWhatsAppLink(base, text){
  try{
    const url = new URL(base);
    const params = new URLSearchParams(url.search);
    if(!params.has("text")) params.set("text", text);
    const src = qs("src"); if(src) params.set("src", src);
    url.search = params.toString();
    return url.toString();
  }catch{
    const sep = base.includes("?") ? "&" : "?";
    const parts = [`text=${encodeURIComponent(text)}`];
    const src = qs("src"); if(src) parts.push(`src=${encodeURIComponent(src)}`);
    return base + sep + parts.join("&");
  }
}

async function ensureBranches(){
  if(branches.length) return;
  const res = await fetch(BRANCHES_URL, { cache: "no-store" });
  if(!res.ok) throw new Error("تعذر تحميل بيانات الفروع");
  branches = await res.json();
}

async function startLocate(){
  show($status);
  setStatus('جارِ تحميل بيانات الفروع…');
  await ensureBranches();

  setStatus('جارِ تحديد موقعك…');
  if(!navigator.geolocation){
    setStatus('المتصفح لا يدعم تحديد الموقع. من فضلك فعّل إذن الموقع أو استخدم جهاز آخر.', true);
    return;
  }

  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude, longitude } = pos.coords;
    const enriched = branches.map(b => ({...b, dist: haversine(latitude, longitude, b.lat, b.lon)}))
                             .sort((a,b)=>a.dist-b.dist);
    nearest = enriched.find(b => b.dist <= MAX_KM);
    if(nearest){
      $nearestInfo.innerHTML = `
        <div><b>${nearest.branch}</b></div>
        <div>المسافة: ${nearest.dist.toFixed(2)} كم</div>
        ${nearest.address ? `<div class="muted">${nearest.address}</div>` : ""}
      `;
      show($nearest);
    }else{
      show($noNear);
    }
  }, err => {
    setStatus('يجب السماح بالوصول للموقع لاستخدام الخدمة. افتح إعدادات المتصفح واسمح بالموقع ثم أعد التحميل.', true);
  }, { enableHighAccuracy:true, timeout:15000, maximumAge:0 });
}

$btnLocate?.addEventListener("click", startLocate);

$btnRequest?.addEventListener("click", () => {
  if(!nearest){
    setStatus("لم يتم تحديد فرع بعد.", true);
    show($status);
    return;
  }
  if(!nearest.whatsapp && nearest.maps_url){
    window.open(nearest.maps_url, "_blank", "noopener");
    $waLink.href = nearest.maps_url;
    $waFallback.hidden = false;
    return;
  }
  if(!nearest.whatsapp){
    setStatus("لا تتوفر بيانات تواصل للفرع المحدد.", true);
    show($status);
    return;
  }
  const svc = document.querySelector('input[name="service"]:checked')?.value || "استلام من الفرع";
  const txt = `السلام عليكم، عايز أصرف وصفتي.\\nالخدمة: ${svc}\\n(تم التحويل من صفحة وصفتي - صيدليات شمس)`;

  const wa = buildWhatsAppLink(nearest.whatsapp, txt);
  const win = window.open(wa, "_blank", "noopener");
  $waLink.href = wa;
  $waFallback.hidden = false;
  if(!win){ /* المستخدم هيضغط الرابط يدوي */ }
});

if(qs("autostart") === "1"){
  startLocate().catch(e => {
    setStatus("خطأ غير متوقع. حاول مجددًا.", true);
    show($status);
    console.error(e);
  });
}
