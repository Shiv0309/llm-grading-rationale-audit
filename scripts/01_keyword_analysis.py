""" 
01_keyword_analysis.py
 
50 student essays from the Kaggle Persuade 2.0 dataset for the "Distance learning" prompt were selected.
This sample included the full student essay along with scores between 1-6 (with 1 being poor and 6 being exemplary) 
assinged by human grader for 25 students from economically disadvantaged students and 25 not economically disadvantaged
students. This analysis is a part of a larger study done to compare LLM scores when LLM is provided with a rubric 
similar to what the human graders were provided to human scores and how this differs for studnets of two different 
economic groups (economically disadvantaged and not economically disadvantged). ChatGPT-4.o mini in the free chat 
session (where log in is not required) was provided each of the 50 essays along with the rubric and asked to provide
two things: a score between 1 and 6 and a 2-3 sentence score rationale explaining why it gave each essay its specific
score.

In this file, I aim to analyze the LLM's grading rationales by counting how often it mentions different 
essay-evaluation categories (point of view, evidence, organization, etc.), then comparing those category counts 
between economically disadvantaged and non-disadvantaged student groups. """

# %% Importing libraries 
import pandas as pd
import re # built in Python library for clearning/normalizing text
from pathlib import Path # helps build file paths
import matplotlib.pyplot as plt 

# %% Establishing paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# building path to input csv
INPUT_PATH = PROJECT_ROOT / "data" / "raw" / "completed_llm_scoring.csv"

# building path to save outputs
OUTPUT_TABLE_PATH = PROJECT_ROOT / "outputs" / "category_counts_by_essay.csv"
OUTPUT_SUMMARY_PATH = PROJECT_ROOT / "outputs" / "category_summary_by_group.csv"
FIGURE_PATH = PROJECT_ROOT / "figures" / "category_mentions_by_group.png"

# %% Defining category-to-keyword dictionary

# This dictionary maps each essay-evaluation category (the "topics" we 
# care about) to a list of words/phrases that signal the LLM is talking 
# about that category. I built this by reading real examples of the 
# LLM's rationale text and noting which words it actually used.
category_keywords = {
    "point_of_view": ["point of view", "position", "stance", "preference"],
    "critical_thinking": ["critical thinking"],
    "development_evidence": [
        "reasons", "examples", "evidence", "development",
        "repetitive", "repetition", "underdeveloped", "supports"
    ],
    "organization": ["organized", "organization", "progression", "coherent", "coherence"],
    "language_vocabulary": ["word choice", "word-choice", "vocabulary", "phrasing", "language control"],
    "grammar_mechanics": [
        "grammar", "usage", "spelling", "punctuation", "sentence-structure",
        "sentence structure", "mechanics", "errors"
    ],
}


# %% Writing a function to normalize text
def normalize_text(text):
    text = text.lower() # converts all letters to lowercase
    text = re.sub(r"[^\w\s-]", "", text) # removes anything that is not a letter, digit, underscore, 
    # whitesapce or hyphen
    return text 

# trying this function on a short example to confirm it works
print(normalize_text("The essay has, clear GRAMMAR errors!"))

# %% Writing a function that counts cateogory matches in one rationale
def count_categories(rationale_text):
    normalized = normalize_text(rationale_text) # first normalizing the rationale text
    counts = {category: 0 for category in category_keywords} # starting with every category count at 0 
    for category, keywords in category_keywords.items(): # looping through each category and its list of keywords
        for keyword in keywords: # looping through each individual keyword for this category 
            counts[category] += normalized.count(keyword) # counting how many times this exact keyword phrase 
            # appears in the normalized text, and adding that to the running total for the category
    return counts 

# trying this function on a short example
test_text = "The essay frequent grammar, usage, and sentence-structure errors."
print(count_categories(test_text))

# %% Loading the llm rationale data
df = pd.read_csv(INPUT_PATH)
df.head()

# %% Applying the counting function to every essay's rationale 
category_results = df["llm_rationale"].apply(count_categories)
category_df = pd.DataFrame(list(category_results)) # creating a six columns for each of the six category counts
full_results = pd.concat([df, category_df], axis=1) # joining the original data with the new category count columns
full_results.head()

# %% Saving the per-essay breakdown of category counts
full_results.to_csv(OUTPUT_TABLE_PATH, index=False)
print(f"Saved per-essay category counts to {OUTPUT_TABLE_PATH}")

# %% Aggregating the counts of each category by economic status group
category_columns = list(category_keywords.keys())

 # Splitting the data into the 2 economic groups and then calculating the averge count of each categories mentions 
 # per essay within each of the 2 groups
group_summary = (
    full_results.groupby("economically_disadvantaged")[category_columns]
    .mean()
    .reset_index()  # turns the group labels back into a normal column
)
 
group_summary.to_csv(OUTPUT_SUMMARY_PATH, index=False)
print(f"Saved group summary to {OUTPUT_SUMMARY_PATH}")
group_summary

# %% Building a bar chart to compare the categories across groups
#  .set_index() makes "economically_disadvantaged" the row label 
# instead of a regular column, which makes the next line's 
# plotting easier.
# .T "transposes" the table (flips rows and columns), so categories 
# become the x-axis groups and economic status becomes the bars.
plot_data = group_summary.set_index("economically_disadvantaged")[category_columns].T
 
# .plot(kind="bar") draws a grouped bar chart directly from the data
ax = plot_data.plot(kind="bar", figsize=(10, 6))
 
ax.set_title("Average Category Mentions in LLM Rationale, by Economic Status")
ax.set_xlabel("Essay-Evaluation Category")
ax.set_ylabel("Average Mentions per Essay")
plt.xticks(rotation=45, ha="right")  # angles the category labels so they don't overlap
plt.tight_layout()  # adjusts spacing so labels aren't cut off
 
plt.savefig(FIGURE_PATH, dpi=300)
print(f"Saved chart to {FIGURE_PATH}")
 
plt.show()  # displays the chart right here in VS Code's interactive window

# %%
