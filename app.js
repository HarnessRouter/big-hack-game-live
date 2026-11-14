(function () {
  const params = new URLSearchParams(location.search);
  const preview = params.has("preview");
  const screen = params.has("screen");

  function siteRoot() {
    const p = location.pathname.replace(/\/index\.html$/, "");
    const m = p.match(/^(.*?)\/(?:stanford|berkeley)(?:-[a-z0-9]+)?\/?$/);
    if (m) {
      const prefix = m[1] || "";
      return (prefix.endsWith("/") ? prefix : prefix + "/") || "/";
    }
    const dir = p.replace(/\/[^/]*$/, "/");
    return dir || "/";
  }

  // Page folder: "berkeley" / "stanford" (public, industry-only) or
  // "berkeley-<random>" / "stanford-<random>" (unlisted campus board).
  function pageFolder() {
    const p = location.pathname.replace(/\/index\.html$/, "").replace(/\/$/, "");
    const m = p.match(/\/((stanford|berkeley)(?:-[a-z0-9]+)?)$/);
    return m ? { folder: m[1], campus: m[2], secret: m[1] !== m[2] } : null;
  }

  function pageCampus() {
    const f = pageFolder();
    return f ? f.campus : null;
  }

  const ROOT = siteRoot();
  const FOLDER = pageFolder();
  const CAMPUS = pageCampus();
  const PAGE_DIR = FOLDER ? FOLDER.folder : "";
  const DATA_URL = FOLDER ? (FOLDER.secret ? FOLDER.folder + "/data.json" : FOLDER.campus + ".json") : "";
  const CANONICAL_BASE = "https://harnessrouter.github.io/big-hack-game-live/";
  // Official Discord Clyde mark from discord.com/branding (Symbol.svg).
  const DISCORD_MARK = '<svg class="dock-logo discord-logo" viewBox="0 0 59 44" width="18" height="13" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M37.1937 0C36.6265 1.0071 36.1172 2.04893 35.6541 3.11392C31.2553 2.45409 26.7754 2.45409 22.365 3.11392C21.9136 2.04893 21.3926 1.0071 20.8254 0C16.6928 0.70613 12.6644 1.94475 8.84436 3.69271C1.27372 14.9098 -0.775214 25.8374 0.243466 36.6146C4.67704 39.8906 9.6431 42.391 14.9333 43.9884C16.1256 42.391 17.179 40.6893 18.0819 38.9182C16.3687 38.2815 14.7133 37.4828 13.1274 36.5567C13.5442 36.2557 13.9493 35.9432 14.3429 35.6422C23.6384 40.0179 34.4039 40.0179 43.711 35.6422C44.1046 35.9663 44.5097 36.2789 44.9264 36.5567C43.3405 37.4943 41.6852 38.2815 39.9604 38.9298C40.8633 40.7009 41.9167 42.4025 43.109 44C48.3992 42.4025 53.3653 39.9137 57.7988 36.6377C59.0027 24.1358 55.7383 13.3007 49.1748 3.70429C45.3663 1.95633 41.3379 0.717706 37.2053 0.0231518L37.1937 0ZM19.3784 29.9816C16.5192 29.9816 14.1461 27.3886 14.1461 24.1821C14.1461 20.9755 16.4266 18.371 19.3669 18.371C22.3071 18.371 24.6455 20.9871 24.5992 24.1821C24.5529 27.377 22.2956 29.9816 19.3784 29.9816ZM38.6639 29.9816C35.7931 29.9816 33.4431 27.3886 33.4431 24.1821C33.4431 20.9755 35.7236 18.371 38.6639 18.371C41.6042 18.371 43.9309 20.9871 43.8846 24.1821C43.8383 27.377 41.581 29.9816 38.6639 29.9816Z"/></svg>';
  const HR_LOGO = '<img class="dock-logo hr-logo" src="' + (typeof ROOT !== "undefined" ? ROOT : "") + 'vendor/harnessrouter-logo.png" width="18" height="18" alt="">';

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
    return CANONICAL_BASE + PAGE_DIR + "/";
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
        <button type="button" class="more-hint" hidden>more</button>
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
    const addr = $("address");
    if (addr) {
      const parts = [];
      if (venueMeta.address) parts.push(`<span>${escapeHtml(venueMeta.address)}</span>`);
      if (venueMeta.map) parts.push(`<a href="${escapeHtml(venueMeta.map)}" target="_blank" rel="noopener">Map</a>`);
      addr.innerHTML = parts.join(" · ");
      addr.hidden = !parts.length;
    }
    const liveInd = $("live-indicator");
    const frozenNote = $("frozen-note");
    if (frozenNote) {
      frozenNote.textContent = data.frozen ? (data.frozen_note || "List frozen") : "";
      frozenNote.hidden = !data.frozen;
    }
    if (liveInd) liveInd.hidden = !!data.frozen;
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

    const here = ROOT + (PAGE_DIR ? PAGE_DIR + "/" : "");
    const dock = $("dock");
    const links = [];
    if (venueMeta && venueMeta.discord) {
      links.push(`<a class="dock-link" href="${escapeHtml(venueMeta.discord)}">${DISCORD_MARK}<span>Campus Discord</span></a>`);
    }
    if (data.community) {
      links.push(`<a class="dock-link" href="${escapeHtml(data.community)}">${HR_LOGO}<span>Community</span></a>`);
    }
    if (!preview) links.push(`<a class="dock-link dock-action" href="${here}?preview=1">Preview</a>`);
    else links.push(`<a class="dock-link dock-action" href="${here}">Live</a>`);
    dock.innerHTML = links.join("");

    enhanceCards();
    if (screen && !qrBuilt) renderQR();
  }

  const expandedIds = new Set();

  function enhanceCards() {
    document.querySelectorAll("#cards .row").forEach((row) => {
      const idea = row.querySelector(".idea");
      const title = row.querySelector("h2");
      const hint = row.querySelector(".more-hint");
      const titleTruncated = !!(title && (/…$/.test((title.textContent || "").trim()) || title.scrollHeight > title.clientHeight + 1));
      const ideaTruncated = !!(idea && idea.scrollHeight > idea.clientHeight + 1);
      if (!titleTruncated && !ideaTruncated) {
        if (hint) hint.hidden = true;
        return;
      }
      row.classList.add("is-truncatable");
      if (hint) {
        hint.hidden = false;
        hint.textContent = "more";
      }
      const apply = (open) => {
        row.classList.toggle("is-expanded", open);
        row.setAttribute("aria-expanded", open ? "true" : "false");
        if (hint) hint.textContent = open ? "less" : "more";
        const id = row.getAttribute("data-id");
        if (id) {
          if (open) expandedIds.add(id);
          else expandedIds.delete(id);
        }
      };
      if (expandedIds.has(row.getAttribute("data-id"))) apply(true);
      const toggle = (e) => {
        e.preventDefault();
        apply(!row.classList.contains("is-expanded"));
      };
      row.addEventListener("click", toggle);
      if (hint) hint.addEventListener("click", (e) => { e.stopPropagation(); toggle(e); });
    });
  }

  async function load() {
    if (!CAMPUS) {
      $("meta").textContent = "Choose a campus to open its board.";
      return;
    }
    try {
      const res = await fetch(ROOT + DATA_URL + "?t=" + Date.now(), { cache: "no-store" });
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
