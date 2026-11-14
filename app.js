(function () {
  const params = new URLSearchParams(location.search);
  const preview = params.has("preview");
  const screen = params.has("screen");

  function siteRoot() {
    const p = location.pathname.replace(/\/index\.html$/, "");
    const m = p.match(/^(.*?)\/(?:stanford|berkeley)\/?$/);
    if (m) {
      const prefix = m[1] || "";
      return (prefix.endsWith("/") ? prefix : prefix + "/") || "/";
    }
    const dir = p.replace(/\/[^/]*$/, "/");
    return dir || "/";
  }

  function pageCampus() {
    const p = location.pathname.replace(/\/index\.html$/, "").replace(/\/$/, "");
    const m = p.match(/\/(stanford|berkeley)$/);
    return m ? m[1] : null;
  }

  const ROOT = siteRoot();
  const CAMPUS = pageCampus();
  const CANONICAL_BASE = "https://harnessrouter.github.io/big-hack-game-live/";

  const $ = (id) => document.getElementById(id);
  if (screen) document.body.classList.add("screen");

  let dataCache = null;
  let qrBuilt = false;

  function prettyVenue(v) {
    return v === "stanford" ? "Stanford" : v === "berkeley" ? "Berkeley" : v;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isIndustry(c) {
    return c.kind === "industry" || c.always_on || c.status === "Open";
  }

  function cardBadge(c) {
    if (isIndustry(c)) return "Industry problem";
    return c.badge || "Student · looking for teammates";
  }

  function badgeClass(label) {
    return (label || "").toLowerCase() === "industry problem" ? "industry" : "looking";
  }

  function campusUrl() {
    if (!CAMPUS) return CANONICAL_BASE;
    return CANONICAL_BASE + CAMPUS + "/";
  }

  function renderQR() {
    const box = $("qr");
    if (!box || typeof QRCode === "undefined") return;
    box.innerHTML = "";
    new QRCode(box, {
      text: campusUrl(),
      width: 148,
      height: 148,
      colorDark: "#0d0c0b",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M,
    });
    qrBuilt = true;
  }

  function visibleSet(data) {
    const pool = data.cards || [];
    const shown = preview ? pool : pool.filter((c) => c.checked_in || c.always_on || isIndustry(c));
    return { shown, previewCount: pool.length };
  }

  function cardHTML(c) {
    const badge = cardBadge(c);
    const lead = (c.lead || c.owner_first_name || "").trim();
    const idea = c.idea || c.one_line || "";
    const school = c.school || "";
    const campuses = (c.venues || []).map(prettyVenue).join(" · ");
    const showSeats = !isIndustry(c) && c.seats_left > 0;
    const leadBlock = isIndustry(c)
      ? `<div class="lead muted">Industry problem</div>`
      : lead
        ? `<div class="lead"><span>Lead</span> ${escapeHtml(lead)}</div>`
        : "";
    const seats = showSeats
      ? `<div class="seats">${c.seats_left} ${c.seats_left === 1 ? "seat" : "seats"}</div>`
      : "";
    return `<article class="row" data-id="${escapeHtml(c.id)}" data-kind="${isIndustry(c) ? "industry" : "student"}">
      <div class="row-main">
        <div class="row-top">
          <span class="card-tag ${badgeClass(badge)}">${escapeHtml(badge)}</span>
          <span class="campus-line">${escapeHtml(campuses)}</span>
        </div>
        <h2>${escapeHtml(c.title)}</h2>
        ${idea ? `<p class="idea">${escapeHtml(idea)}</p>` : ""}
        <div class="row-meta">
          ${leadBlock}
          ${school ? `<div class="school">${escapeHtml(school)}</div>` : ""}
          ${seats}
        </div>
      </div>
    </article>`;
  }

  function emptyHTML(previewCount) {
    if (preview) {
      return `<div class="empty"><h2>No cards in this view</h2><p>The board will refresh automatically.</p></div>`;
    }
    return `<div class="empty">
      <h2>Cards appear when people check in at the door</h2>
      <p>Industry problems stay up the whole time. Checked-in guests are added within about a minute.${previewCount ? " " + previewCount + " cards are ready in preview." : ""}</p>
    </div>`;
  }

  function render(data) {
    if (!data) return;
    dataCache = data;
    const name = data.public_name || "The Big Hack Game";
    const { shown, previewCount } = visibleSet(data);
    const campus = CAMPUS || data.campus || "berkeley";
    const venueMeta = (data.venues && data.venues[campus]) || {};
    const campusLabel = venueMeta.label || prettyVenue(campus);
    $("title").textContent = name + " · " + campusLabel;
    document.title = name + " · " + campusLabel + " · Live Problem Board";
    const bits = [campusLabel, venueMeta.venue, venueMeta.when].filter(Boolean);
    $("meta").textContent = bits.join(" · ");
    const updated = $("updated");
    if (updated) {
      updated.textContent = data.generated_at_label ? "Updated " + data.generated_at_label : "";
    }
    const mode = $("mode");
    mode.textContent = preview ? "Preview" : "Live";
    mode.className = "badge " + (preview ? "preview" : "live");
    $("count").textContent = shown.length + (shown.length === 1 ? " card" : " cards");

    const col = $("cards");
    col.innerHTML = shown.length ? shown.map(cardHTML).join("") : emptyHTML(previewCount);

    const here = ROOT + (CAMPUS ? CAMPUS + "/" : "");
    const dock = $("dock");
    const links = [];
    if (venueMeta && venueMeta.discord) links.push(`<a href="${venueMeta.discord}">Campus Discord</a>`);
    if (data.community) links.push(`<a href="${data.community}">Community</a>`);
    if (!preview) links.push(`<a href="${here}?preview=1">Preview</a>`);
    else links.push(`<a href="${here}">Live</a>`);
    dock.innerHTML = links.join("");

    if (screen && !qrBuilt) renderQR();
  }

  async function load() {
    if (!CAMPUS) {
      $("meta").textContent = "Choose a campus to open its board.";
      return;
    }
    try {
      const res = await fetch(ROOT + CAMPUS + ".json?t=" + Date.now(), { cache: "no-store" });
      if (!res.ok) throw new Error("bad status " + res.status);
      const data = await res.json();
      render(data);
    } catch (err) {
      $("meta").textContent = "Could not load the board. Retrying…";
    }
  }

  load();
  setInterval(load, 30000);
})();
