// ============================================================
// This file contains ALL the interactive behavior for the page:
// computing summary statistics, drawing the pencil chart, rendering
// the 50 sticky notes, filtering them, highlighting keywords in
// the LLM's rationale text, and opening/closing the essay modal.
//
// It relies on `essayData`, a variable defined in data.js, which
// must be loaded before this file (see the <script> order in
// index.html).
// ============================================================


// ------------------------------------------------------------
// STEP 1: Define the same category-to-keyword dictionary used
// in the Python keyword analysis, so the highlighting shown here
// matches the categories counted in that separate analysis.
// Each category maps to a list of words/phrases that, if found
// in the LLM's rationale text, get highlighted in that category's color.
// ------------------------------------------------------------
const categoryKeywords = {
  point_of_view: ["point of view", "position", "stance", "preference"],
  critical_thinking: ["critical thinking"],
  development_evidence: [
    "reasons", "examples", "evidence", "development",
    "repetitive", "repetition", "underdeveloped", "supports"
  ],
  organization: ["organized", "organization", "progression", "coherent", "coherence"],
  language_vocabulary: ["word choice", "word-choice", "vocabulary", "phrasing", "language control"],
  grammar_mechanics: [
    "grammar", "usage", "spelling", "punctuation", "sentence-structure",
    "sentence structure", "mechanics", "errors"
  ]
};

// A human-readable label for each category key, used in the legend
// and anywhere else we display the category name to a person.
const categoryLabels = {
  point_of_view: "Point of view",
  critical_thinking: "Critical thinking",
  development_evidence: "Development / evidence",
  organization: "Organization",
  language_vocabulary: "Language / vocabulary",
  grammar_mechanics: "Grammar / mechanics"
};


// ------------------------------------------------------------
// STEP 2: Small safety helper. Essay and rationale text get
// inserted into the page as HTML, so any "<", ">" or "&" inside
// them must be converted to their HTML-safe versions first.
// Otherwise a student who typed "<3" could accidentally break
// the page layout.
// ------------------------------------------------------------
function escapeHTML(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}


// ------------------------------------------------------------
// STEP 3: Keyword highlighting.
//
// WHY THIS IS DONE IN ONE PASS:
// The old version looped through keywords one at a time, running
// a separate find-and-replace for each. That caused a bug: after
// "evidence" was wrapped as <mark class="kw-development_evidence">,
// a later search for "development" found that word INSIDE the
// class name and wrapped it again, tearing the HTML tag apart.
// That's where the stray `">` characters were coming from.
//
// THE FIX: build ONE regular expression that matches ANY keyword,
// and run it once over the original text. Each piece of text is
// only ever looked at a single time, so tags we insert are never
// searched again.
// ------------------------------------------------------------

// First, a lookup table from each keyword (lowercased) to its category,
// e.g. "grammar" -> "grammar_mechanics"
const keywordToCategory = {};
for (const [category, keywords] of Object.entries(categoryKeywords)) {
  for (const keyword of keywords) {
    keywordToCategory[keyword.toLowerCase()] = category;
  }
}

// Next, combine every keyword into one pattern like "sentence structure|grammar|...".
// Sorting longest-first matters: it makes "sentence structure" win over a
// shorter keyword that might start at the same spot.
// The .replace() call escapes special regex characters so they're treated
// as literal text. The "gi" flags mean: g = find ALL matches; i = ignore case.
const keywordPattern = new RegExp(
  Object.keys(keywordToCategory)
    .sort((a, b) => b.length - a.length)
    .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|"),
  "gi"
);

function highlightRationale(rationaleText) {
  // Escape the text first, then wrap each match in a <mark>.
  // "match" is the exact text found, keeping its original capitalization;
  // we lowercase it only to look up which category it belongs to.
  return escapeHTML(rationaleText).replace(keywordPattern, (match) => {
    const category = keywordToCategory[match.toLowerCase()];
    return `<mark class="kw-${category}">${match}</mark>`;
  });
}


// ------------------------------------------------------------
// STEP 4: Compute summary statistics (mean scores and score gap
// per group), the same numbers from the R analysis, but
// recalculated here directly from the data so the page is
// self-contained and always matches whatever is in data.js.
// ------------------------------------------------------------
function computeGroupStats(group) {
  // .filter() keeps only the essays matching this group's economicStatus
  const groupEssays = essayData.filter(e => e.economicStatus === group);

  // .reduce() walks through a list, combining items into a single value --
  // here, we're summing up all the human scores, then all the LLM scores.
  const totalHuman = groupEssays.reduce((sum, e) => sum + e.humanScore, 0);
  const totalLLM = groupEssays.reduce((sum, e) => sum + e.llmScore, 0);

  const meanHuman = totalHuman / groupEssays.length;
  const meanLLM = totalLLM / groupEssays.length;
  const meanGap = meanLLM - meanHuman;

  return { group, n: groupEssays.length, meanHuman, meanLLM, meanGap };
}

// Run that function once for each of our two groups, and store the results.
const disadvStats = computeGroupStats("Economically disadvantaged");
const notDisadvStats = computeGroupStats("Not economically disadvantaged");

// Formats a number with a real minus sign (−) instead of a hyphen (-),
// which looks better in big handwritten numbers.
function formatSigned(value) {
  const rounded = value.toFixed(2);
  return value < 0 ? "−" + rounded.slice(1) : rounded;
}


// ------------------------------------------------------------
// STEP 5: Render the two summary index cards pinned to the corkboard.
// ------------------------------------------------------------
function renderSummaryCards() {
  // document.getElementById() finds the HTML element whose id matches
  // the string we pass in -- this is how JS and HTML "connect."
  const container = document.getElementById("summary-cards");

  // A small helper so we don't repeat the same card-building code twice.
  function buildCardHTML(stats, cssClass, label) {
    // .toFixed(2) rounds a number to 2 decimal places and returns it as text
    return `
      <div class="summary-card ${cssClass}">
        <h3>${label} <span class="n">(${stats.n} essays)</span></h3>
        <div class="stat-row"><span>Mean human score</span><span class="value">${stats.meanHuman.toFixed(2)}</span></div>
        <div class="stat-row"><span>Mean AI score</span><span class="value">${stats.meanLLM.toFixed(2)}</span></div>
        <div class="stat-row gap-row"><span>Gap (AI − human)</span><span class="gap-value">${formatSigned(stats.meanGap)}</span></div>
      </div>
    `;
  }

  // innerHTML replaces everything inside an element with new HTML content.
  container.innerHTML =
    buildCardHTML(disadvStats, "disadvantaged", "Economically disadvantaged") +
    buildCardHTML(notDisadvStats, "not-disadvantaged", "Not economically disadvantaged");
}


// ------------------------------------------------------------
// STEP 6: Render the "pencil chart". Each bar is drawn as a pencil
// (eraser, metal band, painted body, sharpened tip). The pencil's
// LENGTH shows the size of the gap. Since both gaps are negative,
// length uses the absolute value, and the label shows the real
// signed number.
// ------------------------------------------------------------
function renderGapChart() {
  const container = document.getElementById("gap-chart");

  // The larger gap gets a full-length pencil; the other is scaled to match.
  const maxGap = Math.max(Math.abs(disadvStats.meanGap), Math.abs(notDisadvStats.meanGap));

  function buildPencilHTML(stats, label, pencilClass) {
    const widthPercent = (Math.abs(stats.meanGap) / maxGap) * 100;
    // data-width stores the final length. The pencil starts short and
    // grows to this length right after the page loads (see below).
    return `
      <div class="gap-row-chart">
        <div class="gap-bar-label">
          <span>${label}</span>
          <span class="gap-number">${formatSigned(stats.meanGap)}</span>
        </div>
        <div class="pencil-track">
          <div class="pencil ${pencilClass}" data-width="${widthPercent}" role="img"
               aria-label="${label}: average gap ${stats.meanGap.toFixed(2)} points">
            <span class="pencil-eraser"></span>
            <span class="pencil-ferrule"></span>
            <span class="pencil-body"></span>
            <span class="pencil-tip"></span>
          </div>
        </div>
      </div>
    `;
  }

  container.innerHTML =
    buildPencilHTML(disadvStats, "Economically disadvantaged", "pencil-yellow") +
    buildPencilHTML(notDisadvStats, "Not economically disadvantaged", "pencil-blue");

  // requestAnimationFrame waits until the browser has drawn the short
  // pencils once; THEN we set the real widths, so the CSS transition
  // animates them "rolling out" to full length.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      container.querySelectorAll(".pencil").forEach(pencil => {
        pencil.style.width = pencil.dataset.width + "%";
      });
    });
  });
}


// ------------------------------------------------------------
// STEP 7: Render the sticky notes. Accepts a filter value
// ("all", or one of the two group names) so we can re-run this
// function whenever the user clicks a filter button.
// ------------------------------------------------------------

// Turns an essay id into a small, repeatable tilt between -3 and 3 degrees.
// Using the id (instead of Math.random) means each note keeps the SAME
// tilt every time the grid is re-drawn, so notes don't jiggle when you filter.
function tiltFor(id) {
  let total = 0;
  for (const char of id) total += char.charCodeAt(0);
  return ((total % 13) - 6) / 2;
}

function renderEssayGrid(filter) {
  const container = document.getElementById("essay-grid");

  // If the filter is "all", keep every essay; otherwise keep only
  // essays whose economicStatus matches the chosen filter.
  const essaysToShow = filter === "all"
    ? essayData
    : essayData.filter(e => e.economicStatus === filter);

  // Update the board's heading so it says what's currently shown
  const heading = document.querySelector(".board-heading");
  heading.textContent = filter === "all"
    ? "All 50 essays"
    : `${essaysToShow.length} essays: ${filter.toLowerCase()}`;

  // .map() transforms each essay object into an HTML string, and then
  // .join("") glues all those strings together into one big string.
  container.innerHTML = essaysToShow.map(essay => {
    // A short preview of the essay text (first ~120 characters)
    const preview = escapeHTML(essay.text.slice(0, 120)) + "…";

    const colorClass = essay.economicStatus === "Economically disadvantaged"
      ? "disadvantaged"
      : "not-disadvantaged";

    const gap = essay.llmScore - essay.humanScore;
    const gapText = gap === 0 ? "same score" : (gap > 0 ? `+${gap}` : `−${Math.abs(gap)}`);

    // Each note is a <button>, so it can be reached with the Tab key and
    // opened with Enter, not just clicked with a mouse.
    // data-id stores this essay's id, so the click handler knows which essay to open.
    return `
      <button class="sticky-note ${colorClass}" data-id="${essay.id}" style="--tilt: ${tiltFor(essay.id)}deg;">
        <span class="note-id">#${essay.id.slice(0, 6)}</span>
        <span class="note-scores">
          Human <b>${essay.humanScore}</b> &nbsp; AI <b>${essay.llmScore}</b>
          <span class="note-gap ${gap < 0 ? "neg" : ""}">${gapText}</span>
        </span>
        <span class="note-preview">${preview}</span>
      </button>
    `;
  }).join("");

  // After rebuilding the grid, attach a click handler to every sticky note.
  container.querySelectorAll(".sticky-note").forEach(note => {
    note.addEventListener("click", () => openModal(note.getAttribute("data-id"), note));
  });
}


// ------------------------------------------------------------
// STEP 8: Open the modal for one specific essay, filling it with
// that essay's full text, scores, and highlighted rationale.
// ------------------------------------------------------------

// Remembers which sticky note opened the modal, so keyboard users
// land back on it when the modal closes.
let lastOpenedNote = null;

function openModal(essayId, noteElement) {
  // .find() returns the first item where the condition is true
  const essay = essayData.find(e => e.id === essayId);
  lastOpenedNote = noteElement || null;

  const modalContent = document.getElementById("modal-content");

  // Build the highlighter legend showing what each color means
  const legendHTML = Object.entries(categoryLabels).map(([key, label]) => `
    <span class="kw-legend-item">
      <span class="kw-legend-swatch kw-${key}"></span>${label}
    </span>
  `).join("");

  const gap = essay.llmScore - essay.humanScore;
  const colorClass = essay.economicStatus === "Economically disadvantaged"
    ? "disadvantaged" : "not-disadvantaged";

  modalContent.innerHTML = `
    <div class="modal-header">
      <h2 id="modal-title">Essay #${essay.id.slice(0, 6)}</h2>
      <span class="group-tag ${colorClass}">${essay.economicStatus}</span>
    </div>

    <div class="score-strip">
      <div class="score-item">
        <span class="grade-circle human">${essay.humanScore}</span>
        <span>Human score</span>
      </div>
      <div class="score-item">
        <span class="grade-circle ai">${essay.llmScore}</span>
        <span>AI score</span>
      </div>
      <div class="score-item">
        <span class="gap-scrawl">${gap > 0 ? "+" + gap : gap < 0 ? "−" + Math.abs(gap) : "0"}</span>
        <span>Gap</span>
      </div>
      <div class="score-item">
        <span class="word-count">${essay.wordCount}</span>
        <span>Words</span>
      </div>
    </div>

    <div class="modal-columns">
      <div>
        <h3>Student essay</h3>
        <div class="modal-essay-text">${escapeHTML(essay.text)}</div>
      </div>
      <aside class="comments-column">
        <h3>AI grader's comments</h3>
        <div class="modal-rationale">${highlightRationale(essay.rationale)}</div>
        <div class="kw-legend">${legendHTML}</div>
      </aside>
    </div>
  `;

  document.getElementById("modal-overlay").classList.remove("hidden");
  // Stop the page behind the modal from scrolling while it's open
  document.body.classList.add("modal-open");
  // Scroll the paper back to the top, and move keyboard focus into the modal
  document.querySelector(".modal-paper").scrollTop = 0;
  document.getElementById("modal-close").focus();
}

function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
  document.body.classList.remove("modal-open");
  if (lastOpenedNote) lastOpenedNote.focus();
}


// ------------------------------------------------------------
// STEP 9: Wire up the filter buttons. When clicked, a button
// should (a) visually mark itself as the active filter, and
// (b) re-render the essay grid using only that group's essays.
// ------------------------------------------------------------
function setupFilterButtons() {
  const buttons = document.querySelectorAll(".filter-btn");

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      // Remove "active" from every button first...
      buttons.forEach(b => {
        b.classList.remove("active");
        b.setAttribute("aria-pressed", "false");
      });
      // ...then add "active" back to just the one that was clicked
      button.classList.add("active");
      button.setAttribute("aria-pressed", "true");

      renderEssayGrid(button.getAttribute("data-filter"));
    });
  });
}


// ------------------------------------------------------------
// STEP 10: Ways to close the modal: the X button, clicking the
// dark area outside the paper, or pressing the Escape key.
// ------------------------------------------------------------
function setupModalClose() {
  document.getElementById("modal-close").addEventListener("click", closeModal);

  document.getElementById("modal-overlay").addEventListener("click", (event) => {
    // Only close if the dark overlay ITSELF was clicked, not the paper on top of it
    if (event.target.id === "modal-overlay") closeModal();
  });

  document.addEventListener("keydown", (event) => {
    const isOpen = !document.getElementById("modal-overlay").classList.contains("hidden");
    if (event.key === "Escape" && isOpen) closeModal();
  });
}


// ------------------------------------------------------------
// STEP 11: Run everything once the page has finished loading.
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  renderSummaryCards();
  renderGapChart();
  renderEssayGrid("all");
  setupFilterButtons();
  setupModalClose();
});
