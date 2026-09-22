// ============================================================
// Review video cards: hover-to-preview (with sound), click to commit,
// tap-to-play on touch. Adapted from the WealthLink Media funnel site.
// ============================================================

const ICON_PLAY = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7-11-7Z"/></svg>`;

function reviewCardHTML(r) {
  return `
    <div class="review-item">
      <div class="video-card" data-video-src="${r.videoSrc || ""}" data-poster="${r.poster || ""}">
        ${r.poster ? `<img src="${r.poster}" alt="${r.name} review" loading="lazy">` : ""}
        <div class="play-btn">${ICON_PLAY}</div>
        <div class="sound-hint">Click for sound</div>
      </div>
      <p class="review-quote">"${r.quote}"</p>
      <p class="review-attribution">${r.name} — ${r.company}</p>
    </div>
  `;
}

// Only ever show full rows of 3 (the desktop grid width) - a trailing
// partial row (e.g. 10 or 11 reviews leaving 1-2 left over) is dropped
// rather than shown short, so the grid always ends on a clean row.
const REVIEWS_PER_ROW = 3;

function renderReviews(containerId, reviews) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const fullRowCount = Math.floor(reviews.length / REVIEWS_PER_ROW) * REVIEWS_PER_ROW;
  const toShow = reviews.slice(0, fullRowCount);
  el.innerHTML = toShow.map(reviewCardHTML).join("");
  el.classList.add("review-grid");
  wireVideoCards(el);
}

// ---------- Video playback: hover to preview, click to commit ----------
// Autoplay policy: Chrome/Safari refuse play() with sound until the visitor
// has produced a qualifying gesture on the page - and hovering is NOT one.
// We attempt sound on every play anyway (a returning visitor with a high
// Media Engagement Index is allowed it outright) and fall back to muted +
// a "click for sound" badge if the browser rejects it.
function canHoverPlay() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

// The <video> is built once per card on first use and then kept, layered
// over the poster <img> rather than replacing it - so leaving and
// re-entering the card doesn't re-download the file.
function buildCardVideo(card) {
  if (card._video) return card._video;
  const src = card.dataset.videoSrc;
  if (!src) return null;
  const v = document.createElement("video");
  v.src = src;
  v.className = "hover-video";
  v.playsInline = true;
  v.preload = "metadata";
  v.addEventListener("ended", () => releaseCard(card));
  v.addEventListener("volumechange", () => {
    card.classList.toggle("is-muted", v.muted);
  });
  card.appendChild(v);
  card._video = v;
  return v;
}

// Stop a preview and fade the poster back in. A card the user actually
// clicked ("committed") is left alone - that one keeps playing.
function releaseCard(card) {
  const v = card._video;
  if (!v) return;
  v.pause();
  try { v.currentTime = 0; } catch (e) {}
  v.controls = false;
  card.classList.remove("is-previewing", "is-committed", "is-muted");
}

function stopOtherVideos(except) {
  document.querySelectorAll(".video-card.is-previewing").forEach((c) => {
    if (c !== except) releaseCard(c);
  });
}

function playCard(card, committed) {
  const v = buildCardVideo(card);
  if (!v) return;
  stopOtherVideos(card); // only ever one playing at a time
  card.classList.add("is-previewing");
  card.classList.toggle("is-committed", !!committed);
  v.controls = !!committed;
  v.muted = false;
  v.volume = 1;
  card.classList.remove("is-muted");

  const p = v.play();
  if (p && p.catch) {
    p.catch(() => {
      // Blocked for sound - retry muted so the visitor still sees something.
      v.muted = true;
      card.classList.add("is-muted");
      v.play().catch(() => {});
    });
  }
}

// Turns the sound on for a card already committed and playing muted.
function unmuteCard(card) {
  const v = card._video;
  if (!v) return;
  const wasPaused = v.paused;
  v.muted = false;
  v.volume = 1;
  card.classList.remove("is-muted");
  if (!wasPaused) {
    const p = v.play();
    if (p && p.catch) p.catch(() => {});
  }
}

function wireVideoCards(scopeEl) {
  (scopeEl || document).querySelectorAll(".video-card").forEach((card) => {
    if (card.dataset.wiredVideo) return;
    card.dataset.wiredVideo = "1";

    // Small delay so dragging the cursor across the row doesn't fire off
    // three downloads and three bursts of audio.
    card.addEventListener("mouseenter", () => {
      if (!canHoverPlay()) return;
      if (card.classList.contains("is-committed")) return;
      clearTimeout(card._hoverT);
      card._hoverT = setTimeout(() => playCard(card, false), 140);
    });
    card.addEventListener("mouseleave", () => {
      clearTimeout(card._hoverT);
      if (card.classList.contains("is-committed")) return;
      releaseCard(card);
    });

    card.addEventListener("click", function () {
      clearTimeout(card._hoverT);
      // Once committed, native controls live inside this element and their
      // clicks bubble up here - bail out except when still muted, where a
      // click means "turn the sound on", not "restart playback".
      if (card.classList.contains("is-committed")) {
        if (card.classList.contains("is-muted")) unmuteCard(card);
        return;
      }
      playCard(card, true);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderReviews("reviews", window.REVIEWS);
});
