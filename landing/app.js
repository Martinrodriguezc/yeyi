// Fill these in before publishing. The anon key is public by design; RLS only allows inserts.
const CONFIG = {
  SUPABASE_URL: "https://qzwobsvxryuteguyorcn.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_26BkxnwbJXWB_Y6tFtLQSA_TAqQFiOh", // publishable key, safe in the browser
  META_PIXEL_ID: "29036682759305427", // dataset "Yeyi landing"
  POSTHOG_KEY: "phc_qhC7DmUjptGrHVCPNiALFqYx35rxUxaxLpAX3wm83s3k", // same project as the app: ad → landing → app in one funnel
  APP_STORE_PT: "", // App Store Connect provider token (Analytics → Campaigns); empty = links stay untagged
};

// Meta pixel: loads only when an id is set.
// A local preview never reaches the real pixel or the real waitlist.
const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

if (CONFIG.META_PIXEL_ID && !LOCAL) {
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,"script","https://connect.facebook.net/en_US/fbevents.js");
  fbq("init", CONFIG.META_PIXEL_ID);
  fbq("track", "PageView");
}

// PostHog (US cloud): page views with their utm_*, how far down people read ($pageleave), store taps.
// No autocapture and no session recording; anonymous visitors don't get person profiles.
if (CONFIG.POSTHOG_KEY && !LOCAL) {
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
  posthog.init(CONFIG.POSTHOG_KEY, { api_host: "https://us.i.posthog.com", person_profiles: "identified_only", autocapture: false, disable_session_recording: true });
  posthog.register({ source: "landing", android: document.documentElement.classList.contains("android") });
}
const params = new URLSearchParams(location.search);
const ph = (event, props) => window.posthog && posthog.capture(event, props);


// App Store badge: the campaign optimizes for this tap (custom conversion on "DescargarApp").
// ct = the ad (utm_content) so App Store Connect shows downloads per ad.
const ct = ("landing-" + (params.get("utm_content") || "directo")).replace(/[^\w-]/g, "").slice(0, 40);
document.querySelectorAll(".appstore").forEach((a) => {
  if (CONFIG.APP_STORE_PT) a.href += `?pt=${CONFIG.APP_STORE_PT}&ct=${ct}&mt=8`;
  a.addEventListener("click", (e) => {
    if (window.fbq) fbq("trackCustom", "DescargarApp", { placement: a.dataset.place });
    if (!window.posthog?.__loaded) return;
    // iOS leaves for the App Store at once and the batched event never went out: beacon it, then go.
    posthog.capture("store_tapped", { placement: a.dataset.place, ad: params.get("utm_content") }, { transport: "sendBeacon", send_instantly: true });
    e.preventDefault();
    setTimeout(() => { location.href = a.href; }, 250);
  });
});

// Mobile bar: only while neither the hero nor the closing section (each with its own badge) is on screen.
const sticky = document.getElementById("sticky");
const onScreen = new Map();
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => onScreen.set(e.target, e.isIntersecting));
  const show = ![...onScreen.values()].some(Boolean);
  sticky.classList.toggle("visible", show);
  document.body.classList.toggle("con-barra", show);
});
[document.querySelector(".hero"), document.getElementById("descargar")].forEach((el) => io.observe(el));

// Android visitors join the waitlist for the Android app (same table as before launch).
document.querySelectorAll("form.waitlist").forEach((form) => {
  const errorBox = form.querySelector(".error");
  const showError = (msg) => { errorBox.textContent = msg; errorBox.hidden = !msg; };
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
      await save({ email, curso, utm_source: params.get("utm_source"), utm_campaign: params.get("utm_campaign"), utm_content: params.get("utm_content") });
      if (window.fbq) fbq("track", "Lead", { content_category: `curso_${curso}` });
      ph("android_waitlist_joined", { curso });
      form.hidden = true;
      form.nextElementSibling.hidden = false;
    } catch {
      showError("No pudimos guardar tu correo. Inténtalo de nuevo en un momento.");
      button.disabled = false;
    }
  });
});

async function save(row) {
  if (!CONFIG.SUPABASE_URL || LOCAL) {
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

