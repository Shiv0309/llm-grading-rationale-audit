# Grading the Grader: Auditing an LLM's Essay-Scoring Rationales
 
**Live site:** https://shiv0309.github.io/llm-grading-rationale-audit/
 
Does an LLM grade student essays differently depending on the student's economic background, and if so, can its own written explanations tell us why?
 
This repository supports a two-part study:
 
- **DATA 709 (audit):** compares ChatGPT-4o mini's essay scores with human grader scores across economic groups.
- **DATA 703 (this project's focus):** analyzes the LLM's written *rationales* for patterns in which grading criteria it talks about, and for whom.
---
 
## The data
 
- **Source:** 50 student essays from the [PERSUADE 2.0 corpus](https://github.com/scrosseye/persuade_corpus_2.0) (The Learning Agency and Vanderbilt University), responding to the "Distance learning" prompt. Essays are shared under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).
- **Sample:** 25 essays from economically disadvantaged students and 25 from students who are not, each with a human holistic score from 1 to 6.
- **LLM scoring:** each essay was given to ChatGPT-4o mini (free chat session, default settings, October 4, 2026) along with the same rubric the human graders used. The model returned a score from 1 to 6 and a 2-3 sentence rationale explaining the score.
## Headline results
 
| Measure | Economically disadvantaged (n=25) | Not economically disadvantaged (n=25) |
|---|---|---|
| Mean human score | 3.84 | 3.56 |
| Mean LLM score | 3.32 | 3.44 |
| Gap (LLM − human) | −0.52 | −0.12 |
 
The LLM scored both groups lower than the human graders did, but the drop was larger for economically disadvantaged students (a 0.40-point difference between the groups).
 
In the rationale text, the disadvantaged group's rationales mention **grammar/mechanics** and **language/vocabulary** slightly more often per essay, while the other group's rationales mention **development/evidence**, **organization**, **point of view**, and **critical thinking** slightly more often (see `figures/category_mentions_by_group.png`).
 
> **Important caveat:** a keyword showing up in a rationale does not say whether the LLM was praising or criticizing that aspect of the essay. Counts alone can't distinguish "strong organization" from "weak organization." Reading the rationales closely is the next phase of this research, and the interactive site below was built to support that.
 
---
 
## What's in this repo
 
```
.
├── data/raw/completed_llm_scoring.csv     # Essays, human scores, LLM scores, LLM rationales
├── scripts/01_keyword_analysis.py         # Python keyword-counting pipeline
├── outputs/
│   ├── category_counts_by_essay.csv       # Category mention counts for each essay
│   └── category_summary_by_group.csv      # Average mentions per essay, by economic group
├── figures/category_mentions_by_group.png # Grouped bar chart of the results
├── index.html, style.css, app.js, data.js # Interactive essay and rationale explorer
├── requirements.txt                       # Python dependencies
└── .gitignore
```
 
## Part 1: Keyword analysis pipeline (Python)
 
`scripts/01_keyword_analysis.py` is the core analysis. It:
 
1. **Extracts** the LLM rationale text for all 50 essays from `data/raw/completed_llm_scoring.csv`.
2. **Defines** a dictionary mapping 6 rubric categories to keyword lists. The keywords were chosen by reading real examples of the LLM's rationales and noting which words it actually used.
   - `point_of_view`
   - `critical_thinking`
   - `development_evidence`
   - `organization`
   - `language_vocabulary`
   - `grammar_mechanics`
3. **Matches** keywords in each rationale after normalizing the text (lowercasing and stripping punctuation).
4. **Aggregates** the counts into an average number of mentions per essay for each economic group.
5. **Visualizes** the comparison as a grouped bar chart.
Built with `pandas`, `re`, and `matplotlib`.
 
### Running it
 
```bash
# 1. Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate
 
# 2. Install dependencies
pip install -r requirements.txt
 
# 3. Run the script (paths are resolved relative to the script's location)
python scripts/01_keyword_analysis.py
```
 
Outputs are written to `outputs/` and `figures/`.
 
> `requirements.txt` was exported from a macOS environment and includes `appnope`, which only installs on macOS. On Windows or Linux, remove that line before installing.
 
## Part 2: Interactive essay and rationale explorer (web)
 
Reading 50 essays and their rationales side by side in a spreadsheet was tedious and made it hard to match each rationale to its student. So I built a small website that:
 
- Summarizes the score gap between human and LLM graders for each group (report card and "pencil chart")
- Shows all 50 essays as sticky notes that can be filtered by economic group
- Opens any essay in full, next to the LLM's score and rationale
- **Highlights the keywords** from the Python dictionary in the rationale, color-coded by category, so you can see exactly what the keyword analysis is picking up and judge whether it is praise or criticism
It uses the same keyword dictionary as the Python script, so the highlighting matches the counted categories. The site is plain HTML, CSS, and JavaScript with no build step. To run it locally, open `index.html` in a browser.
 
- `data.js`: the 50 essays, scores, and rationales as a JavaScript array
- `app.js`: stats, chart, filtering, keyword highlighting, and the essay viewer
- `style.css`: the visual design
- `index.html`: page structure
The site is intended both as a research tool for the next phase of this project and as a way for readers of the paper (or an audience at a presentation) to understand the whole pipeline.
 
---
 
## Transparency: what I wrote vs. what AI wrote
 
- **Written by me:** the keyword analysis pipeline (`scripts/01_keyword_analysis.py`), including designing the category dictionary, the counting logic, the aggregation, and the chart.
- **Built with Claude (AI-assisted):** the interactive website (`index.html`, `style.css`, `app.js`). I directed the design and iterated on the look and behavior through prompting, and used this project to learn how AI-assisted ("vibe") coding works. I don't have a web development background, so the code in these files is AI-generated.
- **Also AI-generated:** the LLM scores and rationales being studied, from ChatGPT-4o mini.
## Limitations
 
- Small sample (50 essays, one prompt, one LLM, one scoring session).
- Keyword matching is a blunt instrument: it counts mentions but not sentiment or context, and keywords were derived from this same set of rationales.
- Differences in average mentions between groups are small and have not been tested for statistical significance.
- Economic status is a single binary label from the PERSUADE 2.0 metadata.
## Next steps
 
- Read the rationales closely to classify each category mention as positive or negative (strength vs. weakness).
- Check whether the *tone* of mentions, not just their frequency, differs between economic groups.
- Connect rationale patterns back to the score gaps found in the DATA 709 audit.
## Credits
 
- Essays and human scores: [PERSUADE 2.0 corpus](https://github.com/scrosseye/persuade_corpus_2.0), The Learning Agency and Vanderbilt University (CC BY-NC-SA 4.0).
- Kaggle version of the dataset: version 2, by Nicholas Broad.
- Author: Shiva Kruthi Palpanoori, UNC Chapel Hill.