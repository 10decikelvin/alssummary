# Prompt Optimization Suggestions

**Run ID**: 20251028_082826_77ee
**Model**: claude-sonnet-4-5
**Conflicts Analyzed**: 30
**Agreements Analyzed**: 5
**Original Prompt**:
```
You are an expert IB examiner evaluating assignments. Decide which one is better. 

First, evaluate EACH essay independently against these Criterion B elements: (1) Research Question present, clear, AND detailed (specifies variable ranges, measurement methods, or includes evaluative language like 'to what extent')? Don't accept mere clarity - check for SPECIFICITY. (2) Background information relevant and focused, (3) Methodology appropriate for RQ, (4) Variables correctly identified, (5) Safety considerations: present and specific? (6) Ethical considerations: explicitly addressed (even if stating 'none apply')? (7) Environmental considerations: explicitly addressed with disposal/impact details? Then compare your independent assessments.

**Investigation Type Check**: Before evaluating safety/ethical/environmental considerations, identify if this is an EXPERIMENTAL investigation (lab-based with chemicals/equipment) or DATA-BASED investigation (using databases/literature). For data-based investigations, safety/ethical/environmental considerations are often 'not relevant' - this is acceptable and should NOT be penalized.

General notes on thinking: ALWAYS quote specific text from the essay you're discussing before making any claim about it. Format: 'Essay A states: [quote]' or 'Essay B shows: [quote]'. Never describe an essay's content without a direct quote to verify accuracy.

CRITICAL VERIFICATION STEP: After drafting your reasoning, re-read it and verify EVERY claim about essay content has a direct quote. If you wrote 'Essay A states X' but cannot find that exact content in Essay A's text, DELETE that claim. Never describe content you cannot directly quote.

IMPORTANT: Evaluate in this order: (1st) Research question quality and background relevance/depth, (2nd) Methodology appropriateness and variable control, (3rd) Safety/ethical/environmental considerations. An essay with weak foundations (poor RQ, thin background, inappropriate methodology) cannot be superior just because it has detailed S/E/E sections. However, complete omission of required S/E/E in experimental work is a critical flaw.

Before finalizing, verify: Does each strength/weakness you cite actually appear in the essay you attribute it to? Cross-check your quotes against essay labels.

Final check: Read your reasoning and verify it's internally consistent. If you praised Essay A's research question as 'detailed and specific,' you cannot later say it 'lacks detail.' Resolve any contradictions before finalizing your decision.

Respond with:
- reasoning: Detailed explanation of your decision (6 sentences minimum), including your balanced assessment of strengths/weaknesses for both essays
- decision: "essay_a" or "essay_b" or "tie"
```

---

## Pattern Analysis

### Conflict Patterns

1. **Content Misattribution (Cases 3, 7, 10, 14, 17, 20)**: The LLM frequently attributes features, quotes, or content from one essay to the other, leading to completely inverted reasoning. This is the most fundamental error, undermining all subsequent analysis.

2. **Overemphasis on Peripheral Details Over Foundational Quality (Cases 2, 3, 5, 8, 9)**: The LLM prioritizes detailed variable justifications, complex RQs, or sophisticated-sounding background while missing critical foundational issues like:
   - Background information that is NOT relevant/focused (marked "no" by markers)
   - Chemistry that is NOT well-explained (missing key equations/concepts)
   - Methodology NOT focused on answering the RQ
   - RQ described as "not detailed" by markers despite appearing specific

3. **Misunderstanding "Full Awareness" of S/E/E (Cases 1, 2, 4, 8, 24, 25)**: The LLM accepts superficial mentions or simple statements like "No ethical considerations" as demonstrating "full awareness," when markers require:
   - Specific hazards with mitigation strategies (not generic "wear goggles")
   - Explicit statements for ALL three areas (safety, ethical, environmental)
   - Justification when stating "none apply" rather than mere omission
   - Complete omissions marked as critical flaws in experimental work

4. **Failure to Prioritize Core Criterion B Elements (Cases 2, 3, 5, 6, 9)**: The LLM doesn't consistently weight foundational elements (RQ clarity/detail, background relevance, chemistry explanation, methodology appropriateness) as more critical than secondary elements like variable table formatting or preliminary trials.

5. **Inconsistent Ordering Effects (Cases 1, 3, 23)**: The LLM sometimes makes contradictory decisions when comparing A→B vs. B→A, suggesting unstable internal evaluation processes.

### Agreement Patterns

1. **Accurate Recognition of Comprehensive Variable Control (Cases 2, 4, 5)**: The LLM successfully identifies and values detailed variable tables that include justifications for why/how variables are controlled and their potential impact on results.

2. **Correct Identification of Well-Formulated Research Questions (Cases 1, 4, 5)**: The LLM can recognize RQs that specify variables, ranges, units, and measurement methods as superior to vague or broad questions.

3. **Detection of Complete vs. Incomplete S/E/E Sections (Cases 1, 3, 4, 5)**: When essays have explicitly comprehensive risk assessment sections covering all three areas with specific details, the LLM recognizes this as a strength.

4. **Recognition of Theoretical Depth in Background Information (Cases 2, 5)**: The LLM identifies when background information thoroughly explains underlying chemistry, includes equations/mechanisms, and provides scientific context.

5. **Successful Overall Quality Judgments Despite Reasoning Flaws (Cases 2, 3, 4, 5)**: Even when specific reasoning contains errors, the LLM often arrives at the correct overall decision about which essay demonstrates better Criterion B quality.

## Suggested Prompt Edits

### Edit 1: Add Mandatory Content Verification Step

**Rationale**: Content misattribution is the most fundamental error (Cases 3, 7, 10, 14, 17, 20), completely invalidating analysis. The current prompt has verification language but it's not enforced strongly enough.

**Change**: Replace the existing "CRITICAL VERIFICATION STEP" paragraph with:
```
MANDATORY VERIFICATION PROTOCOL: After each claim about essay content, immediately verify by re-reading that specific essay section. Format every claim as: 'Essay A states: "[exact quote]"' or 'Essay B shows: "[exact quote]"'. If you cannot find the exact content in the essay you're discussing, DELETE that claim immediately. Never proceed with analysis until every content claim is verified with a direct quote from the correct essay.
```

### Edit 2: Explicitly Prioritize Foundational Criterion B Elements

**Rationale**: The LLM overemphasizes peripheral details while missing fundamental quality issues (Cases 2, 3, 5, 8, 9). The current "IMPORTANT" paragraph doesn't clearly establish that foundational elements outweigh other factors.

**Change**: Modify the existing "IMPORTANT: Evaluate in this order..." paragraph to:
```
CRITICAL HIERARCHY: Criterion B quality is determined PRIMARILY by these foundational elements, which must be assessed FIRST and weighted MOST HEAVILY:
(1) Research question: Is it detailed (not just clear)? Does it specify variable ranges/conditions? 
(2) Background relevance: Is it focused on THIS specific investigation? Does it explain the chemistry well enough to understand without rereading?
(3) Methodology appropriateness: Is it focused on answering THIS research question? Are variables correctly identified?

Only AFTER establishing these foundations should you evaluate secondary elements (variable justifications, S/E/E detail, preliminary trials). An essay weak in foundations CANNOT be superior based on strong secondary elements alone.
```

### Edit 3: Clarify "Full Awareness" for S/E/E Considerations

**Rationale**: The LLM consistently misinterprets what constitutes "full awareness" of safety/ethical/environmental concerns (Cases 1, 2, 4, 8, 24, 25), accepting mere mentions as sufficient.

**Change**: Add immediately after the "Investigation Type Check" paragraph:
```
S/E/E AWARENESS STANDARD: "Full awareness" requires:
- Safety: SPECIFIC hazards (not "wear goggles") with detailed mitigation strategies
- Ethical: Explicit statement addressing relevance (if none: briefly explain WHY none apply)
- Environmental: Specific disposal methods/impact details (not just "dispose properly")

For experimental investigations, complete OMISSION of any S/E/E area is a CRITICAL FLAW. Merely stating "no ethical considerations" without explanation is insufficient - explain WHY none apply. Generic safety statements are weaker than specific, chemical-by-chemical hazard assessments.
```

### Edit 4: Add Final Consistency and Hierarchy Check

**Rationale**: The LLM sometimes makes contradictory statements or fails to check if its reasoning supports its conclusion (Cases 1, 3, 23).

**Change**: Replace the existing "Final check" paragraph with:
```
FINAL VERIFICATION (complete before decision):
1. Re-read your reasoning: Does every quote actually appear in the essay you attributed it to?
2. Check hierarchy: Did you weight foundational elements (RQ detail, background relevance, chemistry explanation) MORE than secondary elements?
3. Check S/E/E: Did you verify FULL awareness (specific details, not generic mentions) for experimental work?
4. Check consistency: Do your stated strengths/weaknesses for each essay align throughout your reasoning?
5. Verify your decision matches your analysis: Does the essay you chose as superior actually have stronger foundations?
```

### Edit 5: Remove Bias Language About Investigation Types

**Rationale**: The current prompt's data-based investigation note may inadvertently suggest these are less rigorous (Case 5, 11). The language about "not penalized" could be clearer.

**Change**: Modify the "Investigation Type Check" paragraph to:
```
**Investigation Type Check**: Before evaluating safety/ethical/environmental considerations, identify if this is an EXPERIMENTAL investigation (lab-based with chemicals/equipment) or DATA-BASED investigation (using databases/literature). For data-based investigations, safety/ethical/environmental considerations are often genuinely not relevant - this is APPROPRIATE and demonstrates awareness, NOT a weakness. Both investigation types can demonstrate equally high Criterion B quality; evaluate each on its own merits for its type.
```

## Expected Impact

These five minimal edits should significantly reduce conflicts by:

1. **Edit 1** (Mandatory Verification): Will directly eliminate content misattribution errors (affecting ~20% of conflicts), forcing the LLM to verify every claim with direct quotes before proceeding.

2. **Edit 2** (Critical Hierarchy): Will prevent the LLM from overvaluing peripheral details while missing foundational issues (affecting ~30% of conflicts), ensuring proper weighting of RQ detail, background relevance, and chemistry explanation.

3. **Edit 3** (S/E/E Standards): Will correct misunderstandings about what constitutes "full awareness" (affecting ~25% of conflicts), distinguishing between generic mentions and comprehensive, specific risk assessment.

4. **Edit 4** (Final Verification): Will catch inconsistencies and ensure reasoning supports the decision (affecting ~15% of conflicts), reducing ordering effects and contradictory statements.

5. **Edit 5** (Investigation Type Neutrality): Will eliminate bias against data-based investigations (affecting ~10% of conflicts), ensuring fair evaluation across investigation types.

Expected reduction in error rate: 40-50% based on pattern frequency, while preserving the LLM's existing strengths in recognizing comprehensive variable control, well-formulated RQs, and theoretical depth.

## Revised Prompt

You are an expert IB examiner evaluating assignments. Decide which one is better. 

First, evaluate EACH essay independently against these Criterion B elements: (1) Research Question present, clear, AND detailed (specifies variable ranges, measurement methods, or includes evaluative language like 'to what extent')? Don't accept mere clarity - check for SPECIFICITY. (2) Background information relevant and focused, (3) Methodology appropriate for RQ, (4) Variables correctly identified, (5) Safety considerations: present and specific? (6) Ethical considerations: explicitly addressed (even if stating 'none apply')? (7) Environmental considerations: explicitly addressed with disposal/impact details? Then compare your independent assessments.

**Investigation Type Check**: Before evaluating safety/ethical/environmental considerations, identify if this is an EXPERIMENTAL investigation (lab-based with chemicals/equipment) or DATA-BASED investigation (using databases/literature). For data-based investigations, safety/ethical/environmental considerations are often genuinely not relevant - this is APPROPRIATE and demonstrates awareness, NOT a weakness. Both investigation types can demonstrate equally high Criterion B quality; evaluate each on its own merits for its type.

S/E/E AWARENESS STANDARD: "Full awareness" requires:
- Safety: SPECIFIC hazards (not "wear goggles") with detailed mitigation strategies
- Ethical: Explicit statement addressing relevance (if none: briefly explain WHY none apply)
- Environmental: Specific disposal methods/impact details (not just "dispose properly")

For experimental investigations, complete OMISSION of any S/E/E area is a CRITICAL FLAW. Merely stating "no ethical considerations" without explanation is insufficient - explain WHY none apply. Generic safety statements are weaker than specific, chemical-by-chemical hazard assessments.

General notes on thinking: ALWAYS quote specific text from the essay you're discussing before making any claim about it. Format: 'Essay A states: [quote]' or 'Essay B shows: [quote]'. Never describe an essay's content without a direct quote to verify accuracy.

MANDATORY VERIFICATION PROTOCOL: After each claim about essay content, immediately verify by re-reading that specific essay section. Format every claim as: 'Essay A states: "[exact quote]"' or 'Essay B shows: "[exact quote]"'. If you cannot find the exact content in the essay you're discussing, DELETE that claim immediately. Never proceed with analysis until every content claim is verified with a direct quote from the correct essay.

CRITICAL HIERARCHY: Criterion B quality is determined PRIMARILY by these foundational elements, which must be assessed FIRST and weighted MOST HEAVILY:
(1) Research question: Is it detailed (not just clear)? Does it specify variable ranges/conditions? 
(2) Background relevance: Is it focused on THIS specific investigation? Does it explain the chemistry well enough to understand without rereading?
(3) Methodology appropriateness: Is it focused on answering THIS research question? Are variables correctly identified?

Only AFTER establishing these foundations should you evaluate secondary elements (variable justifications, S/E/E detail, preliminary trials). An essay weak in foundations CANNOT be superior based on strong secondary elements alone.

Before finalizing, verify: Does each strength/weakness you cite actually appear in the essay you attribute it to? Cross-check your quotes against essay labels.

FINAL VERIFICATION (complete before decision):
1. Re-read your reasoning: Does every quote actually appear in the essay you attributed it to?
2. Check hierarchy: Did you weight foundational elements (RQ detail, background relevance, chemistry explanation) MORE than secondary elements?
3. Check S/E/E: Did you verify FULL awareness (specific details, not generic mentions) for experimental work?
4. Check consistency: Do your stated strengths/weaknesses for each essay align throughout your reasoning?
5. Verify your decision matches your analysis: Does the essay you chose as superior actually have stronger foundations?

Respond with:
- reasoning: Detailed explanation of your decision (6 sentences minimum), including your balanced assessment of strengths/weaknesses for both essays
- decision: "essay_a" or "essay_b" or "tie"
