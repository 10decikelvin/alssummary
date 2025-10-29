# Prompt Optimization Suggestions

**Run ID**: 20251028_041259_3ece
**Model**: claude-sonnet-4-5
**Conflicts Analyzed**: 30
**Agreements Analyzed**: 5
**Original Prompt**:
```
You are an expert IB examiner evaluating assignments. Decide which one is better. General notes on thinking: ALWAYS quote and think before making any statement.

Respond with:
- reasoning: Detailed explanation of your decision (6 sentences minimum), including your balanced assessment of strengths/weaknesses for both essays
- decision: "essay_a" or "essay_b" or "tie"

```

---

## Pattern Analysis

### Conflict Patterns

1. **Essay Content Misattribution (20+ cases)**: The LLM frequently confuses which essay contains which features, sometimes completely swapping essay identities between forward/backward comparisons. This appears in Cases 3, 4, 7, 9, 14, 15, 18, 19, 20, 21, 22, 26, 30 and severely undermines accuracy.

2. **Incomplete Safety/Ethical/Environmental Assessment (25+ cases)**: The LLM consistently fails to identify missing or incomplete ethical and environmental considerations, often praising essays that entirely omit these mandatory elements or misattributing their presence. This occurs in Cases 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 14-18, 20-22, 26-27, 30.

3. **Forward/Backward Comparison Inconsistency (18+ cases)**: The LLM produces contradictory decisions when comparing the same essays in different orders (A→B vs B→A), indicating unstable evaluation criteria. This appears in Cases 1-10, 12-14, 16-18, 21, 24, 29.

4. **Overvaluing Sophistication Over Foundational Completeness (12+ cases)**: The LLM prioritizes perceived theoretical depth or experimental complexity while overlooking fundamental deficiencies like missing research questions, unclear methodology, or absent ethical considerations. Cases 3, 5, 8, 9, 12, 14, 20, 23, 27, 29.

5. **Research Question Quality Misjudgment (15+ cases)**: The LLM praises vague/general research questions or fails to identify their absence, not applying sufficient rigor to assess focus, detail, and clarity. Cases 1, 2, 4, 5, 6, 7, 10, 11, 15, 22.

### Agreement Patterns

1. **Accurate Variable Control Assessment**: The LLM consistently recognizes and praises detailed controlled variable tables with justifications, especially when they explain "why" variables must be controlled and their potential effects on results.

2. **Detection of Variable Identification Errors**: The LLM successfully identifies when essays incorrectly label independent/dependent variables, showing strong understanding of fundamental experimental design principles.

3. **Recognition of Comprehensive Methodology**: The LLM effectively identifies thorough, step-by-step procedures with clear apparatus lists and replicable instructions.

4. **Appreciation for Scientific Depth**: When present correctly, the LLM recognizes well-explained chemistry with balanced equations, relevant calculations, and clear theoretical frameworks.

5. **Identification of Preliminary Planning**: The LLM values and identifies preliminary trials, justification of concentrations, and foresight in experimental design.

## Suggested Prompt Edits

### Edit 1: Add Systematic Evaluation Checklist
**Rationale**: The most critical failure pattern is inconsistency and missing elements. A structured checklist ensures all Criterion B components are evaluated systematically and equally for both essays, preventing omissions of ethical/environmental considerations and maintaining consistency across comparison orders.

**Change**: After "You are an expert IB examiner evaluating assignments.", add:
"Before making your decision, systematically evaluate BOTH essays against ALL Criterion B elements:
1. Research Question: Is it present, focused, detailed, and clearly states variables?
2. Background: Is it relevant, focused, well-organized, and includes necessary chemistry?
3. Methodology: Is it appropriate, detailed, and focused on answering the RQ?
4. Variables: Are ALL variables (independent, dependent, controlled) correctly identified with justifications?
5. Safety/Ethical/Environmental: Are ALL THREE explicitly addressed or justified as not applicable?"

### Edit 2: Prevent Content Misattribution
**Rationale**: Essay content misattribution appears in 20+ conflict cases, severely undermining accuracy. This edit forces explicit text verification before making claims.

**Change**: In "General notes on thinking:", change from "ALWAYS quote and think before making any statement" to:
"ALWAYS quote specific text from the correct essay before making any claim. Before attributing ANY feature to an essay, verify it appears in that essay's text. If comparing Essay A vs Essay B, Essay A is ALWAYS the first essay provided, Essay B is ALWAYS the second essay provided, regardless of comparison direction."

### Edit 3: Prioritize Foundational Elements Over Sophistication
**Rationale**: 12+ conflict cases show the LLM favoring theoretical complexity while overlooking fundamental deficiencies. This edit establishes a quality hierarchy aligned with IB marking.

**Change**: After the systematic evaluation checklist, add:
"PRIORITIZE foundational completeness: A clear research question, appropriate methodology, and comprehensive safety/ethical/environmental awareness are MORE important than theoretical sophistication. An essay with fundamental gaps cannot be rated higher than one that addresses all basic requirements, regardless of complexity."

### Edit 4: Enforce Minimum Reasoning Standards
**Rationale**: The current "6 sentences minimum" is too vague. More specific requirements ensure balanced assessment and prevent one-sided reasoning that overlooks critical weaknesses.

**Change**: Modify the "reasoning" requirement from "Detailed explanation of your decision (6 sentences minimum), including your balanced assessment of strengths/weaknesses for both essays" to:
"Detailed explanation (8+ sentences) that MUST include: (a) specific quoted strengths of each essay, (b) specific quoted weaknesses of each essay, (c) comparison of how each essay addresses research question, methodology, variables, and safety/ethical/environmental considerations, (d) justification for which essay better fulfills Criterion B overall"

### Edit 5: Add Cross-Verification Step
**Rationale**: Forward/backward inconsistency appears in 18+ cases. This edit adds a final consistency check without requiring full re-comparison.

**Change**: Add after the reasoning/decision format:
"Before finalizing your decision, verify: Does this decision align with which essay has (1) a clearer, more detailed research question, (2) more appropriate and complete methodology, (3) correctly identified variables, and (4) comprehensive safety/ethical/environmental considerations? If foundational elements are split, favor the essay with fewer fundamental gaps."

## Expected Impact

These five minimal edits should significantly reduce conflicts by addressing the root causes of systematic errors:

1. **The systematic checklist (Edit 1)** directly combats the incomplete assessment pattern, particularly for ethical/environmental considerations (25+ cases) and ensures all criterion elements are evaluated equally.

2. **The content verification requirement (Edit 2)** prevents essay misattribution (20+ cases) by forcing explicit text checking before claims.

3. **The prioritization hierarchy (Edit 3)** corrects the overvaluation of sophistication (12+ cases) by establishing that foundational completeness outweighs theoretical complexity.

4. **The enhanced reasoning requirements (Edit 4)** reduce inconsistency by forcing balanced evaluation of both essays' strengths and weaknesses against all criterion elements.

5. **The cross-verification step (Edit 5)** acts as a final consistency check to reduce forward/backward contradictions (18+ cases).

Expected outcome: Accuracy improvement of 20-30 percentage points, with particular gains in: (a) correctly identifying missing ethical/environmental considerations, (b) maintaining consistent decisions across comparison orders, (c) accurately attributing content to the correct essay, and (d) appropriately weighting foundational elements over mere sophistication.

## Revised Prompt

You are an expert IB examiner evaluating assignments. Before making your decision, systematically evaluate BOTH essays against ALL Criterion B elements:
1. Research Question: Is it present, focused, detailed, and clearly states variables?
2. Background: Is it relevant, focused, well-organized, and includes necessary chemistry?
3. Methodology: Is it appropriate, detailed, and focused on answering the RQ?
4. Variables: Are ALL variables (independent, dependent, controlled) correctly identified with justifications?
5. Safety/Ethical/Environmental: Are ALL THREE explicitly addressed or justified as not applicable?

PRIORITIZE foundational completeness: A clear research question, appropriate methodology, and comprehensive safety/ethical/environmental awareness are MORE important than theoretical sophistication. An essay with fundamental gaps cannot be rated higher than one that addresses all basic requirements, regardless of complexity.

Decide which one is better. General notes on thinking: ALWAYS quote specific text from the correct essay before making any claim. Before attributing ANY feature to an essay, verify it appears in that essay's text. If comparing Essay A vs Essay B, Essay A is ALWAYS the first essay provided, Essay B is ALWAYS the second essay provided, regardless of comparison direction.

Respond with:
- reasoning: Detailed explanation (8+ sentences) that MUST include: (a) specific quoted strengths of each essay, (b) specific quoted weaknesses of each essay, (c) comparison of how each essay addresses research question, methodology, variables, and safety/ethical/environmental considerations, (d) justification for which essay better fulfills Criterion B overall
- decision: "essay_a" or "essay_b" or "tie"

Before finalizing your decision, verify: Does this decision align with which essay has (1) a clearer, more detailed research question, (2) more appropriate and complete methodology, (3) correctly identified variables, and (4) comprehensive safety/ethical/environmental considerations? If foundational elements are split, favor the essay with fewer fundamental gaps.
