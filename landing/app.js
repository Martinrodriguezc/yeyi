// Fill these in before publishing. The anon key is public by design; RLS only allows inserts.
const CONFIG = {
  SUPABASE_URL: "https://qzwobsvxryuteguyorcn.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_26BkxnwbJXWB_Y6tFtLQSA_TAqQFiOh", // publishable key, safe in the browser
  META_PIXEL_ID: "29036682759305427", // dataset "Yeyi landing"
};

// Meta pixel: loads only when an id is set.
if (CONFIG.META_PIXEL_ID) {
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,"script","https://connect.facebook.net/en_US/fbevents.js");
  fbq("init", CONFIG.META_PIXEL_ID);
  fbq("track", "PageView");
}

const form = document.getElementById("waitlist");
const errorBox = document.getElementById("error");
const params = new URLSearchParams(location.search);

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = form.email.value.trim().toLowerCase();
  const curso = Number(form.curso.value);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showError("Revisa tu correo.");
  if (!curso) return showError("Elige el curso de tu hijo o hija.");

  const button = form.querySelector("button");
  button.disabled = true;
  showError("");

  try {
    await save({
      email,
      curso,
      utm_source: params.get("utm_source"),
      utm_campaign: params.get("utm_campaign"),
      utm_content: params.get("utm_content"),
    });
    if (window.fbq) fbq("track", "Lead", { content_category: `curso_${curso}` });
    form.hidden = true;
    document.getElementById("done").hidden = false;
  } catch {
    showError("No pudimos guardar tu correo. Inténtalo de nuevo en un momento.");
    button.disabled = false;
  }
});

async function save(row) {
  if (!CONFIG.SUPABASE_URL) {
    console.warn("Supabase not configured; signup not saved", row); // ponytail: local preview only
    return;
  }
  const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/waitlist`, {
    method: "POST",
    headers: {
      apikey: CONFIG.SUPABASE_ANON_KEY, // new sb_publishable keys go only here, not as a Bearer token
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });
  // 409 = already on the list; that's a success for the parent.
  if (!res.ok && res.status !== 409) throw new Error(`waitlist ${res.status}`);
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.hidden = !msg;
}
