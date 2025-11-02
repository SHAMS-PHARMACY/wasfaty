// إعدادات عامة
const MAX_KM = 1.0; // أقصى مسافة للفرع الأقرب
const BRANCHES_URL = "branches.json"; // ملف بيانات الفروع

const elStatus = document.getElementById("status");

function setStatus(html, type){
  elStatus.className = "card " + (type || "");
  elStatus.innerHTML = html;
}

// دالة هافرسين لحساب المسافة (كم)
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// احتفاظ بأي تتبّع حملات (src) ثم تمريره لواتساب
function buildWhatsAppLink(base, defaultText){
  try{
    const url = new URL(base);
    const params = new URLSearchParams(url.search);
    const qp = new URLSearchParams(window.location.search);
    if(!params.has("text")){
      params.set("text", defaultText);
    }
    if(qp.has("src")){
      params.set("src", qp.get("src"));
    }
    url.search = params.toString();
    return url.toString();
  }catch{
    // base قد يكون بدون كويري
    const sep = base.includes("?") ? "&" : "?";
    const qp = new URLSearchParams(window.location.search);
    const parts = [`text=${encodeURIComponent(defaultText)}`];
    if(qp.has("src")) parts.push(`src=${encodeURIComponent(qp.get("src"))}`);
    return base + sep + parts.join("&");
  }
}

async function main(){
  try{
    setStatus('جارِ تحميل بيانات الفروع… <span class="loading"></span>');
    const res = await fetch(BRANCHES_URL, { cache: "no-store" });
    if(!res.ok) throw new Error("تعذر تحميل بيانات الفروع");
    const branches = await res.json();

    setStatus("جارِ تحديد موقعك… <span class=\"loading\"></span>");
    if(!navigator.geolocation){
      setStatus("المتصفح لا يدعم تحديد الموقع. من فضلك فعّل إذن الموقع أو استخدم جهاز آخر.", "error");
      return;
    }

    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude, longitude } = pos.coords;
      const enriched = branches.map(b => ({...b, dist: haversine(latitude, longitude, b.lat, b.lon)}))
                               .sort((a,b)=>a.dist-b.dist);

      const nearest = enriched.find(b => b.dist <= MAX_KM);

      if(nearest){
        if(nearest.whatsapp){
          const link = buildWhatsAppLink(nearest.whatsapp, "السلام عليكم، عايز أصرف وصفتي.");
          setStatus(`أقرب فرع: <b>${nearest.branch}</b> — ${nearest.dist.toFixed(2)} كم. جارِ فتح واتساب الفرع…`);
          window.location.href = link;
        }else if(nearest.maps_url){
          setStatus(`أقرب فرع: <b>${nearest.branch}</b> — ${nearest.dist.toFixed(2)} كم. لا يوجد رقم واتساب، سيتم فتح الموقع على الخريطة…`);
          window.location.href = nearest.maps_url;
        }else{
          setStatus(`أقرب فرع: <b>${nearest.branch}</b> — ${nearest.dist.toFixed(2)} كم. لا توجد بيانات تواصل محفوظة لهذا الفرع.`, "error");
        }
      }else{
        // لا يوجد فرع داخل 1 كم → أعرض أقرب 3
        const top3 = enriched.slice(0,3);
        const html = [
          "<b>لا يوجد فرع في نطاق 1 كم.</b>",
          "أقرب 3 فروع لك:",
          "<ul class='list'>" + top3.map(b => {
            const wa = b.whatsapp ? `<a class="btn" href="${buildWhatsAppLink(b.whatsapp, "السلام عليكم، عايز أصرف وصفتي.")}" target="_blank" rel="noopener">واتساب</a>` : "";
            const map = b.maps_url ? `<a class="btn" href="${b.maps_url}" target="_blank" rel="noopener">الخريطة</a>` : "";
            return `<li><b>${b.branch}</b> — ${b.dist.toFixed(2)} كم<br/>${wa} ${map}</li>`;
          }).join("") + "</ul>"
        ].join("<br/>");
        setStatus(html);
      }
    }, err => {
      setStatus("يجب السماح بالوصول للموقع لاستخدام الخدمة. افتح إعدادات المتصفح واسمح بالموقع ثم أعد تحميل الصفحة.", "error");
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });

  }catch(e){
    console.error(e);
    setStatus("حدث خطأ أثناء التحميل. جرّب إعادة تحميل الصفحة.", "error");
  }
}

main();
