// ============================================================
// This file contains ALL the interactive behavior for the page:
// computing summary statistics, drawing the bar chart, rendering
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
  point_of_view: "Point of View",
  critical_thinking: "Critical Thinking",
  development_evidence: "Development / Evidence",
  organization: "Organization",
  language_vocabulary: "Language / Vocabulary",
  grammar_mechanics: "Grammar / Mechanics"
};


// ------------------------------------------------------------
// STEP 2: A function that takes one rationale string and returns
// an HTML string with every matched keyword wrapped in a <mark>
// tag, colored by its category (via the CSS classes we wrote in
// style.css, like "kw-grammar_mechanics").
// ------------------------------------------------------------
function highlightRationale(rationaleText) {
  // We build up the result as we go, starting with the original text.
  // Each time we find a keyword, we'll insert <mark> tags around it.
  let highlighted = rationaleText;

  // Object.entries() turns our categoryKeywords dictionary into a list
  // of [categoryName, keywordList] pairs, so we can loop through it.
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    // Loop through every keyword in this category's list
    for (const keyword of keywords) {
      // We build a "regular expression" (a pattern-matching tool) that:
      // - escapes any special characters in the keyword (like the hyphen
      //   in "sentence-structure") so they're treated as literal text
      // - uses "gi" flags: g = find ALL matches, not just the first;
      //   i = case-insensitive, so "Grammar" and "grammar" both match
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(escapedKeyword, "gi");

      // .replace() swaps every match with a <mark> version of itself.
      // The "match" parameter inside the function is whatever text was
      // actually found (preserving its original capitalization).
      highlighted = highlighted.replace(pattern, (match) => {
        return `<mark class="kw-${category}">${match}</mark>`;
      });
    }
  }

  return highlighted;
}


// ------------------------------------------------------------
// STEP 3: Compute summary statistics (mean scores and score gap
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

  return {
    group,
    n: groupEssays.length,
    meanHuman,
    meanLLM,
    meanGap
  };
}

// Run that function once for each of our two groups, and store the results.
const disadvStats = computeGroupStats("Economically disadvantaged");
const notDisadvStats = computeGroupStats("Not economically disadvantaged");


// ------------------------------------------------------------
// STEP 4: Render the two summary index cards into the page.
// ------------------------------------------------------------
function renderSummaryCards() {
  // document.getElementById() finds the HTML element whose id matches
  // the string we pass in -- this is how JS and HTML "connect."
  const container = document.getElementById("summary-cards");

  // A small helper function so we don't repeat the same card-building
  // code twice (once per group) -- we just call this twice with
  // different stats objects.
  function buildCardHTML(stats, cssClass, label) {
    // .toFixed(2) rounds a number to 2 decimal places and returns it as text
    return `
      <div class="summary-card ${cssClass}">
        <h3>${label} (n=${stats.n})</h3>
        <div class="stat-row"><span>Mean human score</span><span class="value">${stats.meanHuman.toFixed(2)}</span></div>
        <div class="stat-row"><span>Mean LLM score</span><span class="value">${stats.meanLLM.toFixed(2)}</span></div>
        <div class="stat-row"><span>Score gap (LLM − human)</span><span class="gap-value">${stats.meanGap.toFixed(2)}</span></div>
      </div>
    `;
  }

  // Build both cards' HTML and insert them into the container at once.
  // innerHTML replaces everything inside an element with new HTML content.
  container.innerHTML =
    buildCardHTML(disadvStats, "disadvantaged", "Economically Disadvantaged") +
    buildCardHTML(notDisadvStats, "not-disadvantaged", "Not Economically Disadvantaged");
}


// ------------------------------------------------------------
// STEP 5: Render the hand-built bar chart comparing the two
// groups' score gaps. Since both gaps are negative (LLM scored
// lower than humans in both groups), we show bar WIDTH as the
// absolute size of the gap, and label the actual signed value.
// ------------------------------------------------------------
function renderGapChart() {
  const container = document.getElementById("gap-chart");

  // Find the larger of the two gap sizes (ignoring sign), so we can
  // scale both bars relative to whichever one is bigger -- this means
  // the biggest gap always fills 100% of the available bar width.
  const maxGap = Math.max(Math.abs(disadvStats.meanGap), Math.abs(notDisadvStats.meanGap));

  function buildBarHTML(stats, label, colorVar) {
    // Calculate this bar's width as a percentage of the largest gap
    const widthPercent = (Math.abs(stats.meanGap) / maxGap) * 100;
    return `
      <div class="gap-bar-row">
        <div class="gap-bar-label">
          <span>${label}</span>
          <span>${stats.meanGap.toFixed(2)}</span>
        </div>
        <div class="gap-bar-track">
          <div class="gap-bar-fill" style="width: ${widthPercent}%; background: ${colorVar};"></div>
        </div>
      </div>
    `;
  }

  container.innerHTML =
    buildBarHTML(disadvStats, "Economically disadvantaged", "var(--red-pen)") +
    buildBarHTML(notDisadvStats, "Not economically disadvantaged", "var(--line-blue)");
}


// ------------------------------------------------------------
// STEP 6: Render the grid of 50 sticky notes. Accepts a filter
// value ("all", or one of the two group names) so we can re-run
// this function whenever the user clicks a filter button.
// ------------------------------------------------------------
function renderEssayGrid(filter) {
  const container = document.getElementById("essay-grid");

  // If the filter is "all", keep every essay; otherwise keep only
  // essays whose economicStatus matches the chosen filter.
  const essaysToShow = filter === "all"
    ? essayData
    : essayData.filter(e => e.economicStatus === filter);

  // .map() transforms each essay object into an HTML string, and then
  // .join("") glues all those strings together into one big string.
  container.innerHTML = essaysToShow.map(essay => {
    // A short preview of the essay text (first ~120 characters) so the
    // sticky note gives a hint of content without showing the whole thing
    const preview = essay.text.slice(0, 120) + "...";

    // Pick which CSS class (and therefore which sticky-note color) to use,
    // based on this essay's group
    const colorClass = essay.economicStatus === "Economically disadvantaged"
      ? "disadvantaged"
      : "not-disadvantaged";

    // A small random rotation (-4 to 4 degrees) makes each note look
    // slightly hand-placed instead of perfectly aligned
    const rotation = (Math.random() * 8 - 4).toFixed(1);

    // data-id stores this essay's id directly on the HTML element, so
    // when it's clicked, we can look up which essay to show in the modal
    return `
      <div class="sticky-note ${colorClass}" data-id="${essay.id}" style="transform: rotate(${rotation}deg);">
        <div class="note-scores">Human: ${essay.humanScore} · LLM: ${essay.llmScore}</div>
        <div class="note-id">#${essay.id.slice(0, 6)}</div>
        <div class="note-preview">${preview}</div>
      </div>
    `;
  }).join("");

  // After rebuilding the grid, attach a click handler to every sticky note.
  // querySelectorAll finds ALL elements matching ".sticky-note" on the page.
  document.querySelectorAll(".sticky-note").forEach(note => {
    note.addEventListener("click", () => {
      // getAttribute reads the data-id we set above, so we know which
      // essay was clicked
      const essayId = note.getAttribute("data-id");
      openModal(essayId);
    });
  });
}


// ------------------------------------------------------------
// STEP 7: Open the modal for one specific essay, filling it with
// that essay's full text, scores, and highlighted rationale.
// ------------------------------------------------------------
function openModal(essayId) {
  // .find() returns the first item in the array where the given
  // condition is true -- here, the essay whose id matches what was clicked
  const essay = essayData.find(e => e.id === essayId);

  const modalContent = document.getElementById("modal-content");

  // Build the little colored legend showing what each highlight color means
  const legendHTML = Object.entries(categoryLabels).map(([key, label]) => `
    <div class="kw-legend-item">
      <span class="kw-legend-swatch kw-${key}"></span>
      <span>${label}</span>
    </div>
  `).join("");

  modalContent.innerHTML = `
    <h2>Essay #${essay.id.slice(0, 6)}</h2>
    <p>
      <strong>Group:</strong> ${essay.economicStatus} &nbsp;|&nbsp;
      <strong>Word count:</strong> ${essay.wordCount} &nbsp;|&nbsp;
      <strong>Human score:</strong> ${essay.humanScore} &nbsp;|&nbsp;
      <strong>LLM score:</strong> ${essay.llmScore} &nbsp;|&nbsp;
      <strong>Gap:</strong> ${essay.llmScore - essay.humanScore}
    </p>

    <div class="modal-columns">
      <div>
        <h3>Student Essay</h3>
        <div class="modal-essay-text">${essay.text}</div>
      </div>
      <div>
        <h3>LLM Rationale</h3>
        <div class="modal-rationale">${highlightRationale(essay.rationale)}</div>
        <div class="kw-legend">${legendHTML}</div>
      </div>
    </div>
  `;

  // Remove the "hidden" class so the modal's CSS display:flex rule takes over
  document.getElementById("modal-overlay").classList.remove("hidden");
}

function closeModal() {
  // Add the "hidden" class back, which hides the modal (see style.css)
  document.getElementById("modal-overlay").classList.add("hidden");
}


// ------------------------------------------------------------
// STEP 8: Wire up the filter buttons. When clicked, a button
// should (a) visually mark itself as the active filter, and
// (b) re-render the essay grid using only that group's essays.
// ------------------------------------------------------------
function setupFilterButtons() {
  const buttons = document.querySelectorAll(".filter-btn");

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      // Remove "active" from every button first...
      buttons.forEach(b => b.classList.remove("active"));
      // ...then add "active" back to just the one that was clicked
      button.classList.add("active");

      // data-filter was set in the HTML (e.g. data-filter="all") --
      // we read it here to know which essays to show
      const filterValue = button.getAttribute("data-filter");
      renderEssayGrid(filterValue);
    });
  });
}


// ------------------------------------------------------------
// STEP 9: Wire up the modal's close button, and also let users
// close the modal by clicking the dark overlay outside the paper.
// ------------------------------------------------------------
function setupModalClose() {
  document.getElementById("modal-close").addEventListener("click", closeModal);

  document.getElementById("modal-overlay").addEventListener("click", (event) => {
    // event.target is the EXACT element that was clicked. We only want
    // to close the modal if someone clicked the dark overlay itself,
    // not if they clicked inside the paper (which is a child element
    // sitting on top of the overlay).
    if (event.target.id === "modal-overlay") {
      closeModal();
    }
  });
}


// ------------------------------------------------------------
// STEP 10: Run everything once the page has finished loading.
// Wrapping our setup calls in this event listener ensures all
// the HTML elements above actually exist before our JavaScript
// tries to find and use them.
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  renderSummaryCards();
  renderGapChart();
  renderEssayGrid("all");
  setupFilterButtons();
  setupModalClose();
});
