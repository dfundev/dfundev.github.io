// ===== config =====
const ENDPOINT = "https://aged-scene-5776.daniel-fundin.workers.dev/"; // din Worker
const SITE_KEY = "0x4AAAAAABq8RpZpVNLsWv8j";                             // NY site key

// ===== DOM =====
const form = document.getElementById("contactForm");
const statusEl = document.getElementById("status");
document.getElementById("y").textContent = new Date().getFullYear();

// ===== UI helpers =====
function iconOk(){ return '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-width="2" d="M20 6L9 17l-5-5"/></svg>'; }
function iconErr(){ return '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke-width="2"/><path stroke-width="2" d="M12 8v5M12 16h.01"/></svg>'; }
function setStatusOk(msg){ statusEl.className="status ok";  statusEl.innerHTML=iconOk()+" "+msg; }
function setStatusErr(msg){ statusEl.className="status err"; statusEl.innerHTML=iconErr()+" "+msg; }

// ===== Turnstile =====
let widgetId = null;
let lastToken = "";

// undvik dubbelrender om onload triggas flera gånger
window.__tsRendered = false;

function onToken(token){
  lastToken = token || "";
  console.log("[turnstile] token:", !!lastToken);
}

function renderTurnstile(){
  if (!window.turnstile || window.__tsRendered) return;
  window.__tsRendered = true;
  widgetId = turnstile.render("#cf-turnstile", {
    sitekey: SITE_KEY,
    appearance: "always",   // synlig widget = minst krångel
    theme: "auto",
    callback: onToken,
    "refresh-expired": "auto",
    "error-callback": (e)=>console.warn("[turnstile] error", e),
    "timeout-callback": ()=>console.warn("[turnstile] timeout")
  });
  console.log("[turnstile] rendered:", typeof widgetId !== "undefined");
}

window.cfOnload = () => renderTurnstile();

// ===== Submit =====
form.setAttribute("novalidate", "novalidate");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  e.stopPropagation();

  const btn = e.submitter || form.querySelector('button[type="submit"]');
  if (btn) btn.disabled = true;

  setStatusOk("Sending…");

  const name    = document.getElementById("name").value.trim();
  const email   = document.getElementById("email").value.trim();
  const message = document.getElementById("message").value.trim();

  if (!name || !email || !message) {
    setStatusErr("Please fill in all fields.");
    if (btn) btn.disabled = false;
    return;
  }
  if (form.website && form.website.value) {
    setStatusErr("Spam detected.");
    if (btn) btn.disabled = false;
    return;
  }

  // färsk token – återanvänd aldrig
  let token = lastToken;
  if (!token && window.turnstile && widgetId !== null) {
    token = turnstile.getResponse(widgetId) || "";
  }
  if (!token) {
    setStatusErr("Please complete the challenge.");
    if (window.turnstile && widgetId !== null) turnstile.reset(widgetId);
    if (btn) btn.disabled = false;
    return;
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, message, "cf-turnstile-response": token })
    });

    const j = await res.json().catch(() => ({}));

    if (res.ok && j.ok) {
      setStatusOk("Thanks! I will get back to you soon.");
      form.reset();
      lastToken = "";
    } else if (j && j.where === "turnstile") {
      // typiskt: timeout-or-duplicate
      setStatusErr("Challenge expired. Please try again.");
    } else {
      setStatusErr("Send failed. Please try again later.");
      console.error("server error", res.status, j);
    }
  } catch (err) {
    setStatusErr("Network error. Please try again later.");
    console.error("fetch failed", err);
  } finally {
    if (window.turnstile && widgetId !== null) {
      turnstile.reset(widgetId); // skaffa ny token inför nästa försök
      lastToken = "";
    }
    if (btn) btn.disabled = false;
  }
});
