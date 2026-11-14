(function () {
  const params = new URLSearchParams(location.search);
  const path = location.pathname.replace(/\/index\.html$/, "").replace(/\/$/, "") || "/";
  const parts = path.split("/").filter(Boolean);
  const last = parts[parts.length - 1] || "";
  const pathVenue = last === "stanford" || last === "berkeley" ? last : "";
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
  const ROOT = siteRoot();
  const boardJsonUrl = ROOT + "board.json";
  const CANONICAL_BASE = "https://harnessrouter.github.io/big-hack-game-live/";

  let filter = params.get("campus") || params.get("venue") || pathVenue || "all";
  if (filter !== "berkeley" && filter !== "stanford") filter = "all";

  const $ = (id) => document.getElementById(id);
  if (screen) document.body.classList.add("screen");

  let allCards = [];
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

  function livePhoneUrl() {
    return CANONICAL_BASE;
  }

  function renderQR() {
    const box = $("qr");
    if (!box || typeof QRCode === "undefined") return;
    box.innerHTML = "";
    new QRCode(box, {
      text: livePhoneUrl(),
      width: 148,
      height: 148,
      colorDark: "#0d0c0b",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M,
    });
    qrBuilt = true;
  }

  function setFilter(next, data) {
    filter = next;
    const url = new URL(location.href);
    if (pathVenue) {
      // Campus subpath already implies a venue; don't fight the path.
    } else if (next === "all") {
      url.searchParams.delete("campus");
      url.searchParams.delete("venue");
    } else {
      url.searchParams.set("campus", next);
    }
    history.replaceState(null, "", url);
    render(data || dataCache);
  }

  function visibleSet(data) {
    const pool = data.cards || [];
    const live = preview ? pool : pool.filter((c) => c.checked_in || c.always_on || isIndustry(c));
    const byCampus = (v) => live.filter((c) => (c.venues || []).includes(v));
    const counts = {
      all: live.length,
      berkeley: byCampus("berkeley").length,
      stanford: byCampus("stanford").length,
    };
    const shown = filter === "all" ? live : byCampus(filter);
    return { shown, counts, live };
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

  function emptyHTML(data, counts) {
    if (preview) {
      return `<div class="empty"><h2>No cards in this view</h2><p>Try another campus filter, or wait for the board to refresh.</p></div>`;
    }
    const ready = counts.all;
    return `<div class="empty">
      <h2>Cards appear when people check in at the door</h2>
      <p>Industry problems stay up the whole time. Checked-in guests are added within about a minute. ${ready ? ready + " cards are ready in preview." : ""}</p>
    </div>`;
  }

  function renderFilters(counts) {
    const nav = $("filters");
    if (!nav) return;
    if (pathVenue) {
      nav.innerHTML = "";
      nav.hidden = true;
      return;
    }
    nav.hidden = false;
    const items = [
      ["all", "All"],
      ["berkeley", "Berkeley"],
      ["stanford", "Stanford"],
    ];
    nav.innerHTML = items
      .map(([id, label]) => {
        const on = filter === id ? "on" : "";
        return `<button type="button" class="filter ${on}" data-campus="${id}">${label} <em>${counts[id] || 0}</em></button>`;
      })
      .join("");
    nav.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => setFilter(btn.getAttribute("data-campus"), dataCache));
    });
  }

  function render(data) {
    if (!data) return;
    dataCache = data;
    const name = data.public_name || "The Big Hack Game";
    const { shown, counts } = visibleSet(data);
    const venueMeta = filter !== "all" && data.venues && data.venues[filter] ? data.venues[filter] : null;
    $("title").textContent = name;
    document.title = name + " · Live Problem Board";
    const bits = [];
    if (venueMeta) bits.push([venueMeta.label, venueMeta.venue, venueMeta.when].filter(Boolean).join(" · "));
    else bits.push("Stanford vs Berkeley");
    if (data.generated_at_label) bits.push("Updated " + data.generated_at_label);
    $("meta").textContent = bits.join(" · ");
    const mode = $("mode");
    mode.textContent = preview ? "Preview" : "Live";
    mode.className = "badge " + (preview ? "preview" : "live");
    $("count").textContent = shown.length + (shown.length === 1 ? " card" : " cards");

    renderFilters(counts);

    const col = $("cards");
    col.innerHTML = shown.length ? shown.map(cardHTML).join("") : emptyHTML(data, counts);

    const dock = $("dock");
    const links = [];
    if (venueMeta && venueMeta.discord) links.push(`<a href="${venueMeta.discord}">Campus Discord</a>`);
    if (data.community) links.push(`<a href="${data.community}">Community</a>`);
    if (!preview) links.push(`<a href="${location.pathname}?${filter !== "all" && !pathVenue ? "campus=" + filter + "&" : ""}preview=1">Preview</a>`);
    else {
      const u = new URL(location.href);
      u.searchParams.delete("preview");
      links.push(`<a href="${u.pathname + u.search}">Live</a>`);
    }
    dock.innerHTML = links.join("");

    if (screen && !qrBuilt) renderQR();
  }

  async function load() {
    try {
      const res = await fetch(boardJsonUrl + "?t=" + Date.now(), { cache: "no-store" });
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
