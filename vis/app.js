// Comparison Benchmark Visualizer
// Fetches run data, aggregates rankings, and calculates accuracy

let currentRun = null;
let groundTruthGrades = {};
let feedbackData = {};
let comparisons = [];
let originalComparisons = []; // Keep original for perturbation
let baselineAccuracy = null; // Store 0% perturbation accuracy for comparison
let state = null;
let rankingChart = null;
let distributionChart = null;
let debounceTimer = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadRuns();

    document.getElementById('runSelector').addEventListener('change', (e) => {
        currentRun = e.target.value;
        document.getElementById('analyzeButton').disabled = !currentRun;
    });

    document.getElementById('analyzeButton').addEventListener('click', analyzeCurrentRun);
    document.getElementById('refreshButton').addEventListener('click', loadRuns);
    document.getElementById('aggregationMethod').addEventListener('change', async () => {
        if (comparisons.length > 0) {
            await performAnalysis();
        }
    });

    // Helper to trigger perturbation analysis with debouncing
    const triggerPerturbationAnalysis = () => {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
            if (originalComparisons.length > 0) {
                performAnalysis();
            }
        }, 300);
    };

    // Random flipping controls
    document.getElementById('flipProbability').addEventListener('input', (e) => {
        const value = e.target.value;
        document.getElementById('flipProbabilityValue').textContent = value + '%';
        triggerPerturbationAnalysis();
    });

    // Problem nodes controls
    document.getElementById('numProblemNodes').addEventListener('input', (e) => {
        const value = e.target.value;
        document.getElementById('numProblemNodesValue').textContent = value;
        triggerPerturbationAnalysis();
    });

    document.getElementById('problemNodeWinProb').addEventListener('input', (e) => {
        const value = e.target.value;
        document.getElementById('problemNodeWinProbValue').textContent = value + '%';
        triggerPerturbationAnalysis();
    });

    // Trials selector also triggers re-analysis
    document.getElementById('numTrials').addEventListener('change', () => {
        if (originalComparisons.length > 0) {
            performAnalysis();
        }
    });
});

// Load available runs
async function loadRuns() {
    try {
        const runs = ['before_tuning', 'after_tuning'];

        const selector = document.getElementById('runSelector');
        selector.innerHTML = '<option value="">-- Select a run --</option>';

        for (const run of runs) {
            const option = document.createElement('option');
            option.value = run;
            option.textContent = run;
            selector.appendChild(option);
        }
    } catch (error) {
        showError('Failed to load runs: ' + error.message);
    }
}

// Analyze selected run
async function analyzeCurrentRun() {
    if (!currentRun) return;

    showLoading(true);
    hideError();
    document.getElementById('results').style.display = 'none';

    try {
        // Load state
        state = await fetchJSON(`/runs/${currentRun}/state.json`);

        // Load config to determine test_set
        const config = await fetchYAML(`/runs/${currentRun}/config.yaml`);
        const testSet = config.test_set || 'train';

        // Load ground truth Criterion B marks and feedback data
        const groundTruth = await fetchJSON(`/data_splits/${testSet}_ids.json`);
        groundTruthGrades = {};
        feedbackData = {};

        // Load Criterion B marks and feedback from extracted_feedback
        const feedbackPromises = [];
        for (const entry of groundTruth) {
            feedbackPromises.push(
                fetchJSON(`/extracted_feedback/${testSet}/${entry.id}.json`)
                    .then(feedback => {
                        groundTruthGrades[entry.id] = feedback.marks_received;
                        feedbackData[entry.id] = feedback;
                    })
                    .catch(() => {
                        // Fallback to overall grade if feedback not found
                        groundTruthGrades[entry.id] = entry.grade;
                    })
            );
        }
        await Promise.all(feedbackPromises);

        // Load all comparison files
        const files = await fetch(`/runs/${currentRun}/out.txt`).then(r => r.text()).then(t => t.split("\n"));

        const comparisonFiles = files.filter(f =>
            f.endsWith('.json') &&
            !f.includes('state.json') &&
            !f.includes('config')
        );

        // Load comparisons (only completed ones based on state)
        comparisons = [];
        const loadPromises = [];

        // Limit to completed pairs to avoid loading too many
        const maxToLoad = Math.min(comparisonFiles.length, state.completed_pairs || Infinity);

        for (let i = 0; i < Math.min(comparisonFiles.length, maxToLoad); i++) {
            loadPromises.push(
                fetchJSON(`/runs/${currentRun}/${comparisonFiles[i]}`)
                    .then(comp => comparisons.push(comp))
                    .catch(() => {}) // Skip failed loads
            );
        }

        await Promise.all(loadPromises);

        // Store original comparisons for perturbation
        originalComparisons = [...comparisons];

        // Perform initial analysis (0% perturbation)
        performAnalysis();

    } catch (error) {
        showError('Analysis failed: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Generate problem nodes with random comparison outcomes
function addProblemNodes(comps, numProblemNodes, winProbability) {
    if (numProblemNodes === 0) return comps;

    console.log(`Adding ${numProblemNodes} problem nodes with ${winProbability}% win probability...`);

    // Get all unique essay IDs from comparisons
    const essayIds = new Set();
    for (const comp of comps) {
        essayIds.add(comp.essay1_id);
        essayIds.add(comp.essay2_id);
    }
    const realEssayIds = Array.from(essayIds);

    // Create problem node IDs
    const problemNodeIds = [];
    for (let i = 1; i <= numProblemNodes; i++) {
        problemNodeIds.push(`problem_${i}`);
    }

    // Start with original comparisons
    const result = [...comps];

    // Create comparisons between each problem node and all real essays
    for (const problemId of problemNodeIds) {
        for (const realId of realEssayIds) {
            // Forward comparison: problem vs real
            const forwardWinner = Math.random() * 100 < winProbability ? 'essay1' : 'essay2';
            result.push({
                essay1_id: problemId,
                essay2_id: realId,
                decision: forwardWinner,
                reasoning: `[Problem node: random outcome with ${winProbability}% win rate]`,
                metadata: { synthetic: true }
            });

            // Backward comparison: real vs problem
            const backwardWinner = Math.random() * 100 < winProbability ? 'essay2' : 'essay1';
            result.push({
                essay1_id: realId,
                essay2_id: problemId,
                decision: backwardWinner,
                reasoning: `[Problem node: random outcome with ${winProbability}% win rate]`,
                metadata: { synthetic: true }
            });
        }
    }

    // Also create comparisons between problem nodes themselves
    for (let i = 0; i < problemNodeIds.length; i++) {
        for (let j = i + 1; j < problemNodeIds.length; j++) {
            const winner = Math.random() < 0.5 ? 'essay1' : 'essay2';
            result.push({
                essay1_id: problemNodeIds[i],
                essay2_id: problemNodeIds[j],
                decision: winner,
                reasoning: '[Problem node: random outcome]',
                metadata: { synthetic: true }
            });

            // Reverse direction
            const reverseWinner = Math.random() < 0.5 ? 'essay1' : 'essay2';
            result.push({
                essay1_id: problemNodeIds[j],
                essay2_id: problemNodeIds[i],
                decision: reverseWinner,
                reasoning: '[Problem node: random outcome]',
                metadata: { synthetic: true }
            });
        }
    }

    console.log(`Added ${result.length - comps.length} synthetic comparisons (${problemNodeIds.length} problem nodes × ${realEssayIds.length} real essays × 2 directions + problem node pairs)`);

    return result;
}

// Apply random perturbation to comparison decisions
function perturbComparisons(comps, flipProbability) {
    let flippedCount = 0;
    const result = comps.map(comp => {
        // Randomly flip decision with given probability
        if (Math.random() * 100 < flipProbability) {
            const newComp = { ...comp };
            // Flip the decision
            if (newComp.decision === 'essay1') {
                newComp.decision = 'essay2';
                flippedCount++;
            } else if (newComp.decision === 'essay2') {
                newComp.decision = 'essay1';
                flippedCount++;
            }
            // Ties can't be flipped, keep as 'tie'
            return newComp;
        }
        return comp;
    });

    const actualFlipRate = (flippedCount/comps.length*100).toFixed(1);
    console.log(`Perturbation: ${flipProbability}% requested, ${flippedCount}/${comps.length} (${actualFlipRate}%) actually flipped`);

    // Sanity check - log some example flips
    if (flippedCount > 0 && flippedCount < 5) {
        console.log('  Example flips:', result.slice(0, 10).map((c, i) =>
            c !== comps[i] ? `[${i}] ${comps[i].decision} → ${c.decision}` : null
        ).filter(x => x));
    }

    return result;
}

// Calculate standard error of the mean
function calculateStandardError(values) {
    if (values.length <= 1) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    return stdDev / Math.sqrt(values.length);
}

// Extract overall accuracy from an accuracy object
function extractOverallAccuracy(accuracy) {
    let totalNonZero = 0, correctNonZero = 0;
    for (const [delta, stats] of Object.entries(accuracy)) {
        if (parseInt(delta) !== 0) {
            totalNonZero += stats.total;
            correctNonZero += stats.correct;
        }
    }
    return totalNonZero > 0 ? (correctNonZero / totalNonZero * 100) : 0;
}

// Dynamic perturbation - apply on-the-fly without full reanalysis
async function performDynamicPerturbation(flipProbability, numProblemNodes, problemNodeWinProb) {
    const method = document.getElementById('aggregationMethod').value;
    const numTrials = parseInt(document.getElementById('numTrials').value);

    console.log(`performDynamicPerturbation called: ${flipProbability}% flip rate, ${numProblemNodes} problem nodes (${problemNodeWinProb}% win), ${numTrials} trials, ${originalComparisons.length} original comparisons`);

    // If no perturbations, use original comparisons (single trial)
    if (flipProbability === 0 && numProblemNodes === 0) {
        comparisons = [...originalComparisons];

        const rankings = method === 'net-wins'
            ? aggregateNetWins(comparisons)
            : aggregateFeedbackArc(comparisons);

        const rankingAccuracy = calculateRankingAccuracy(rankings, groundTruthGrades);

        // Calculate and store baseline delta-grouped accuracy for later comparison
        const { contradictions } = findContradictions(comparisons);
        baselineAccuracy = await calculateAccuracyByDelta(comparisons, groundTruthGrades, contradictions, feedbackData);

        // Display results with no trials data
        // Pass rankingAccuracy for the old displayResults parameter (though we'll calculate delta accuracy inside)
        await displayResults(rankings, null, flipProbability, null);
        return;
    }

    // Run multiple trials
    const trialResults = [];
    const trialAccuracies = [];

    console.log(`Running ${numTrials} trials with perturbations...`);

    // Need contradictions and feedback data for delta calculation
    const { contradictions } = findContradictions(originalComparisons);

    for (let trial = 0; trial < numTrials; trial++) {
        // Apply perturbations in sequence: problem nodes first, then random flipping
        let perturbedComps = [...originalComparisons];

        // Add problem nodes if requested
        if (numProblemNodes > 0) {
            perturbedComps = addProblemNodes(perturbedComps, numProblemNodes, problemNodeWinProb);
        }

        // Apply random flipping if requested
        if (flipProbability > 0) {
            perturbedComps = perturbComparisons(perturbedComps, flipProbability);
        }

        // Verify perturbations
        if (trial === 0) {
            const flippedCount = perturbedComps.slice(0, originalComparisons.length)
                .filter((c, i) => c.decision !== originalComparisons[i].decision).length;
            console.log(`  Trial 1: ${flippedCount} flipped decisions, ${perturbedComps.length - originalComparisons.length} synthetic comparisons added`);
        }

        // Recompute rankings with perturbed data
        const rankings = method === 'net-wins'
            ? aggregateNetWins(perturbedComps)
            : aggregateFeedbackArc(perturbedComps);

        // Calculate accuracy (simple pairwise ranking accuracy, not delta-grouped)
        const rankingAccuracy = calculateRankingAccuracy(rankings, groundTruthGrades);
        const overallAcc = rankingAccuracy.accuracy; // Already a percentage

        // Calculate delta-grouped accuracy for this trial
        const deltaAccuracy = await calculateAccuracyByDelta(perturbedComps, groundTruthGrades, contradictions, feedbackData);

        trialResults.push({ rankings, rankingAccuracy, deltaAccuracy, comparisons: perturbedComps });
        trialAccuracies.push(overallAcc);

        console.log(`  Trial ${trial + 1}: ${overallAcc.toFixed(1)}% accuracy`);
    }

    console.log(`Mean: ${(trialAccuracies.reduce((a, b) => a + b, 0) / numTrials).toFixed(1)}%, SE: ${calculateStandardError(trialAccuracies).toFixed(1)}%`);

    // Calculate statistics across trials
    const meanAccuracy = trialAccuracies.reduce((a, b) => a + b, 0) / numTrials;
    const stdError = calculateStandardError(trialAccuracies);

    // Use the first trial's rankings for display (representative)
    const displayRankings = trialResults[0].rankings;

    // Store the first trial's comparisons for detailed analysis (contradictions, inaccurate predictions)
    comparisons = trialResults[0].comparisons;

    // Collect all delta accuracies for per-delta SE calculation
    const allDeltaAccuracies = trialResults.map(t => t.deltaAccuracy);

    // Pass trial statistics to display
    const trialStats = {
        numTrials,
        meanAccuracy,
        stdError,
        minAccuracy: Math.min(...trialAccuracies),
        maxAccuracy: Math.max(...trialAccuracies),
        allDeltaAccuracies // For calculating SE per delta bucket
    };

    // Display results with trial statistics
    await displayResults(displayRankings, null, flipProbability, trialStats);
}

// Perform ranking analysis (initial load only)
async function performAnalysis() {
    const flipProbability = parseFloat(document.getElementById('flipProbability').value);
    const numProblemNodes = parseInt(document.getElementById('numProblemNodes').value);
    const problemNodeWinProb = parseFloat(document.getElementById('problemNodeWinProb').value);
    await performDynamicPerturbation(flipProbability, numProblemNodes, problemNodeWinProb);
}

// Aggregation Method 1: Net Wins (wins - losses)
function aggregateNetWins(comps) {
    const compMap = {};
    for (const comp of comps) {
        const key = `${comp.essay1_id}-${comp.essay2_id}`;
        compMap[key] = comp;
    }

    // Build directed graph, excluding conflicting pairs
    const graph = {};
    const essayIds = new Set();
    const seen = new Set();
    const contradictionsByEssay = {};

    for (const comp of comps) {
        essayIds.add(comp.essay1_id);
        essayIds.add(comp.essay2_id);

        if (!graph[comp.essay1_id]) graph[comp.essay1_id] = {};
        if (!graph[comp.essay2_id]) graph[comp.essay2_id] = {};
        if (!contradictionsByEssay[comp.essay1_id]) contradictionsByEssay[comp.essay1_id] = 0;
        if (!contradictionsByEssay[comp.essay2_id]) contradictionsByEssay[comp.essay2_id] = 0;

        const pairKey = [comp.essay1_id, comp.essay2_id].sort().join('-');
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);

        const reverseKey = `${comp.essay2_id}-${comp.essay1_id}`;
        const reverse = compMap[reverseKey];

        if (reverse) {
            let forwardWinner = null;
            if (comp.decision === 'essay1') forwardWinner = comp.essay1_id;
            else if (comp.decision === 'essay2') forwardWinner = comp.essay2_id;

            let backwardWinner = null;
            if (reverse.decision === 'essay1') backwardWinner = reverse.essay1_id;
            else if (reverse.decision === 'essay2') backwardWinner = reverse.essay2_id;

            if (forwardWinner && backwardWinner && forwardWinner !== backwardWinner) {
                contradictionsByEssay[comp.essay1_id]++;
                contradictionsByEssay[comp.essay2_id]++;
                continue;
            }

            if (forwardWinner) {
                const loser = forwardWinner === comp.essay1_id ? comp.essay2_id : comp.essay1_id;
                graph[forwardWinner][loser] = (graph[forwardWinner][loser] || 0) + 1;
            }
        } else {
            if (comp.decision === 'essay1') {
                graph[comp.essay1_id][comp.essay2_id] = (graph[comp.essay1_id][comp.essay2_id] || 0) + 1;
            } else if (comp.decision === 'essay2') {
                graph[comp.essay2_id][comp.essay1_id] = (graph[comp.essay2_id][comp.essay1_id] || 0) + 1;
            }
        }
    }

    // Calculate net wins
    const netWins = {};
    for (const id of essayIds) {
        netWins[id] = 0;
        for (const target in graph[id] || {}) {
            netWins[id] += graph[id][target];
        }
        for (const source in graph) {
            if (graph[source][id]) {
                netWins[id] -= graph[source][id];
            }
        }
    }

    // Rank by net wins
    const rankings = Object.entries(netWins)
        .map(([id, score]) => ({
            id,
            score,
            groundTruth: groundTruthGrades[id]
        }))
        .sort((a, b) => b.score - a.score);

    // Assign ranks
    let rank = 1;
    for (let i = 0; i < rankings.length; i++) {
        if (i > 0 && rankings[i].score < rankings[i-1].score) {
            rank = i + 1;
        }
        rankings[i].rank = rank;
    }

    // Calculate FAS edges and contradictions
    for (let i = 0; i < rankings.length; i++) {
        const essay = rankings[i];
        let fasEdges = 0;
        for (let j = i + 1; j < rankings.length; j++) {
            const lowerRanked = rankings[j];
            if (graph[lowerRanked.id] && graph[lowerRanked.id][essay.id]) {
                fasEdges += graph[lowerRanked.id][essay.id];
            }
        }
        essay.contradictions = contradictionsByEssay[essay.id] || 0;
        essay.fasEdges = fasEdges;
    }

    return rankings;
}

// Aggregation Method 2: Feedback Arc Set (minimize backward edges)
function aggregateFeedbackArc(comps) {
    const compMap = {};
    for (const comp of comps) {
        const key = `${comp.essay1_id}-${comp.essay2_id}`;
        compMap[key] = comp;
    }

    // Build directed graph, excluding conflicting pairs
    const graph = {};
    const essayIds = new Set();
    const seen = new Set();
    const contradictionsByEssay = {};

    for (const comp of comps) {
        essayIds.add(comp.essay1_id);
        essayIds.add(comp.essay2_id);

        if (!graph[comp.essay1_id]) graph[comp.essay1_id] = {};
        if (!graph[comp.essay2_id]) graph[comp.essay2_id] = {};
        if (!contradictionsByEssay[comp.essay1_id]) contradictionsByEssay[comp.essay1_id] = 0;
        if (!contradictionsByEssay[comp.essay2_id]) contradictionsByEssay[comp.essay2_id] = 0;

        const pairKey = [comp.essay1_id, comp.essay2_id].sort().join('-');
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);

        const reverseKey = `${comp.essay2_id}-${comp.essay1_id}`;
        const reverse = compMap[reverseKey];

        if (reverse) {
            let forwardWinner = null;
            if (comp.decision === 'essay1') forwardWinner = comp.essay1_id;
            else if (comp.decision === 'essay2') forwardWinner = comp.essay2_id;

            let backwardWinner = null;
            if (reverse.decision === 'essay1') backwardWinner = reverse.essay1_id;
            else if (reverse.decision === 'essay2') backwardWinner = reverse.essay2_id;

            if (forwardWinner && backwardWinner && forwardWinner !== backwardWinner) {
                contradictionsByEssay[comp.essay1_id]++;
                contradictionsByEssay[comp.essay2_id]++;
                continue;
            }

            if (forwardWinner) {
                const loser = forwardWinner === comp.essay1_id ? comp.essay2_id : comp.essay1_id;
                graph[forwardWinner][loser] = (graph[forwardWinner][loser] || 0) + 1;
            }
        } else {
            if (comp.decision === 'essay1') {
                graph[comp.essay1_id][comp.essay2_id] = (graph[comp.essay1_id][comp.essay2_id] || 0) + 1;
            } else if (comp.decision === 'essay2') {
                graph[comp.essay2_id][comp.essay1_id] = (graph[comp.essay2_id][comp.essay1_id] || 0) + 1;
            }
        }
    }

    // Helper function to calculate FAS score for an ordering
    const calculateFAS = (ordering) => {
        const position = {};
        ordering.forEach((id, idx) => position[id] = idx);

        let fas = 0;
        for (const source in graph) {
            for (const target in graph[source]) {
                // If target comes before source in ordering, it's a backward edge
                if (position[target] < position[source]) {
                    fas += graph[source][target];
                }
            }
        }
        return fas;
    };

    // Start with net wins ordering as initial solution
    const netWins = {};
    for (const id of essayIds) {
        netWins[id] = 0;
        for (const target in graph[id] || {}) {
            netWins[id] += graph[id][target];
        }
        for (const source in graph) {
            if (graph[source][id]) {
                netWins[id] -= graph[source][id];
            }
        }
    }

    let ordering = Array.from(essayIds).sort((a, b) => netWins[b] - netWins[a]);
    let currentFAS = calculateFAS(ordering);

    console.log(`Initial FAS (from net wins): ${currentFAS}`);

    // Local search: iteratively try swaps to minimize FAS
    let improved = true;
    let iterations = 0;
    const maxIterations = 1000;

    while (improved && iterations < maxIterations) {
        improved = false;
        iterations++;

        // Try swapping adjacent pairs
        for (let i = 0; i < ordering.length - 1; i++) {
            const newOrdering = [...ordering];
            [newOrdering[i], newOrdering[i + 1]] = [newOrdering[i + 1], newOrdering[i]];

            const newFAS = calculateFAS(newOrdering);
            if (newFAS < currentFAS) {
                ordering = newOrdering;
                currentFAS = newFAS;
                improved = true;
            }
        }

        // Try swapping non-adjacent pairs (wider search)
        if (!improved && iterations % 10 === 0) {
            for (let i = 0; i < ordering.length; i++) {
                for (let j = i + 2; j < Math.min(i + 10, ordering.length); j++) {
                    const newOrdering = [...ordering];
                    [newOrdering[i], newOrdering[j]] = [newOrdering[j], newOrdering[i]];

                    const newFAS = calculateFAS(newOrdering);
                    if (newFAS < currentFAS) {
                        ordering = newOrdering;
                        currentFAS = newFAS;
                        improved = true;
                        break;
                    }
                }
                if (improved) break;
            }
        }
    }

    console.log(`Final FAS after ${iterations} iterations: ${currentFAS}`);

    // Create rankings from optimized ordering
    const rankings = ordering.map((id, index) => ({
        id,
        rank: index + 1,
        score: netWins[id], // Include net wins for reference
        groundTruth: groundTruthGrades[id]
    }));

    // Calculate FAS edges per essay
    for (let i = 0; i < rankings.length; i++) {
        const essay = rankings[i];
        let fasEdges = 0;
        for (let j = i + 1; j < rankings.length; j++) {
            const lowerRanked = rankings[j];
            if (graph[lowerRanked.id] && graph[lowerRanked.id][essay.id]) {
                fasEdges += graph[lowerRanked.id][essay.id];
            }
        }
        essay.contradictions = contradictionsByEssay[essay.id] || 0;
        essay.fasEdges = fasEdges;
    }

    return rankings;
}

// Calculate ranking accuracy
function calculateRankingAccuracy(rankings, groundTruth) {
    const pairs = [];

    // Find all pairs with different ground truth grades
    for (let i = 0; i < rankings.length; i++) {
        for (let j = i + 1; j < rankings.length; j++) {
            const essay1 = rankings[i];
            const essay2 = rankings[j];

            const grade1 = groundTruth[essay1.id];
            const grade2 = groundTruth[essay2.id];

            if (grade1 !== grade2 && grade1 != null && grade2 != null) {
                const groundTruthOrder = grade1 > grade2 ? 'essay1' : 'essay2';
                const predictedOrder = essay1.rank < essay2.rank ? 'essay1' :
                                      essay1.rank > essay2.rank ? 'essay2' : 'tie';

                pairs.push({
                    essay1: essay1.id,
                    essay2: essay2.id,
                    grade1,
                    grade2,
                    groundTruthOrder,
                    predictedOrder,
                    correct: groundTruthOrder === predictedOrder
                });
            }
        }
    }

    const correct = pairs.filter(p => p.correct).length;
    const accuracy = pairs.length > 0 ? (correct / pairs.length) * 100 : 0;

    return {
        accuracy,
        totalPairs: pairs.length,
        correctPairs: correct,
        incorrectPairs: pairs.length - correct,
        pairs
    };
}

// Find order-reversal inconsistencies
function findContradictions(comps) {
    const contradictions = [];
    const compMap = {};
    const seen = new Set();
    let bidirectionalPairs = 0;

    // Build lookup map
    for (const comp of comps) {
        const key = `${comp.essay1_id}-${comp.essay2_id}`;
        compMap[key] = comp;
    }

    // Find inconsistencies in bidirectional comparisons
    for (const comp of comps) {
        const pairKey = [comp.essay1_id, comp.essay2_id].sort().join('-');

        // Skip if we've already checked this pair
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);

        const reverseKey = `${comp.essay2_id}-${comp.essay1_id}`;
        const reverse = compMap[reverseKey];

        if (reverse) {
            bidirectionalPairs++;

            // Translate decisions to consistent winners
            // Forward: A vs B with decision
            // Backward: B vs A with decision

            let forwardWinner = null;
            if (comp.decision === 'essay1') forwardWinner = comp.essay1_id;
            else if (comp.decision === 'essay2') forwardWinner = comp.essay2_id;

            let backwardWinner = null;
            if (reverse.decision === 'essay1') backwardWinner = reverse.essay1_id;
            else if (reverse.decision === 'essay2') backwardWinner = reverse.essay2_id;

            // Check if winners are inconsistent
            if (forwardWinner && backwardWinner && forwardWinner !== backwardWinner) {
                contradictions.push({
                    essay1: comp.essay1_id,
                    essay2: comp.essay2_id,
                    forward: comp,
                    backward: reverse,
                    forwardWinner,
                    backwardWinner
                });
            }
        }
    }

    return {
        contradictions,
        bidirectionalPairs,
        totalUniquePairs: seen.size
    };
}

// Calculate accuracy by grade delta
async function calculateAccuracyByDelta(comps, groundTruth, contradictions, feedbackData) {
    const compMap = {};
    for (const comp of comps) {
        const key = `${comp.essay1_id}-${comp.essay2_id}`;
        compMap[key] = comp;
    }

    // Build set of contradictory pairs to exclude
    const contradictSet = new Set();
    for (const c of contradictions) {
        const pairKey = [c.essay1, c.essay2].sort().join('-');
        contradictSet.add(pairKey);
    }

    // Group pairs by delta
    const deltaStats = {};
    const seen = new Set();

    for (const comp of comps) {
        const pairKey = [comp.essay1_id, comp.essay2_id].sort().join('-');
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);

        // Skip if this pair is contradictory
        if (contradictSet.has(pairKey)) continue;

        const grade1 = groundTruth[comp.essay1_id];
        const grade2 = groundTruth[comp.essay2_id];

        // Skip if we don't have both grades
        if (grade1 == null || grade2 == null) continue;

        // Check for reverse comparison - only count bidirectional pairs
        const reverseKey = `${comp.essay2_id}-${comp.essay1_id}`;
        const reverse = compMap[reverseKey];
        if (!reverse) continue;

        const delta = Math.abs(grade1 - grade2);

        if (!deltaStats[delta]) {
            deltaStats[delta] = { total: 0, correct: 0, incorrect: 0 };
        }

        // Determine ground truth winner
        let truthWinner = null;

        if (delta === 0) {
            // Same grade - use subcriteria count if different
            const feedback1 = feedbackData[comp.essay1_id];
            const feedback2 = feedbackData[comp.essay2_id];

            if (feedback1 && feedback2 && feedback1.subcriteria && feedback2.subcriteria) {
                const count1 = feedback1.subcriteria.filter(s => s.correct === 'yes').length;
                const count2 = feedback2.subcriteria.filter(s => s.correct === 'yes').length;

                if (count1 !== count2) {
                    truthWinner = count1 > count2 ? comp.essay1_id : comp.essay2_id;
                }
            }

            // If still no truth winner (same subcriteria count), skip this pair
            if (!truthWinner) continue;
        } else {
            // Different grades
            truthWinner = grade1 > grade2 ? comp.essay1_id : comp.essay2_id;
        }

        // Determine predicted winner from forward comparison
        let forwardWinner = null;
        let isTie = false;
        if (comp.decision === 'essay1') forwardWinner = comp.essay1_id;
        else if (comp.decision === 'essay2') forwardWinner = comp.essay2_id;
        else if (comp.decision === 'tie') {
            isTie = true;
        }

        // Skip if no valid decision
        if (!forwardWinner && !isTie) continue;

        deltaStats[delta].total++;

        if (isTie) {
            // Treat tie as 50% random guess
            deltaStats[delta].correct += 0.5;
            deltaStats[delta].incorrect += 0.5;
        } else {
            // Check if prediction matches ground truth
            if (forwardWinner === truthWinner) {
                deltaStats[delta].correct++;
            } else {
                deltaStats[delta].incorrect++;
            }
        }
    }

    return deltaStats;
}

// Find inaccurate predictions (consistent but wrong)
function findInaccuratePredictions(comps, groundTruth) {
    const inaccurate = [];
    const compMap = {};
    const seen = new Set();

    // Build lookup map
    for (const comp of comps) {
        const key = `${comp.essay1_id}-${comp.essay2_id}`;
        compMap[key] = comp;
    }

    // Find consistent but inaccurate predictions
    for (const comp of comps) {
        const pairKey = [comp.essay1_id, comp.essay2_id].sort().join('-');

        // Skip if we've already checked this pair
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);

        const reverseKey = `${comp.essay2_id}-${comp.essay1_id}`;
        const reverse = compMap[reverseKey];

        if (reverse) {
            // Get ground truth grades
            const grade1 = groundTruth[comp.essay1_id];
            const grade2 = groundTruth[comp.essay2_id];

            // Skip if we don't have both grades or grades are equal
            if (grade1 == null || grade2 == null || grade1 === grade2) continue;

            // Determine ground truth winner
            const truthWinner = grade1 > grade2 ? comp.essay1_id : comp.essay2_id;

            // Translate decisions to consistent winners
            let forwardWinner = null;
            if (comp.decision === 'essay1') forwardWinner = comp.essay1_id;
            else if (comp.decision === 'essay2') forwardWinner = comp.essay2_id;

            let backwardWinner = null;
            if (reverse.decision === 'essay1') backwardWinner = reverse.essay1_id;
            else if (reverse.decision === 'essay2') backwardWinner = reverse.essay2_id;

            // Check if consistent (same winner) but wrong (doesn't match ground truth)
            if (forwardWinner && backwardWinner &&
                forwardWinner === backwardWinner &&
                forwardWinner !== truthWinner) {
                inaccurate.push({
                    essay1: comp.essay1_id,
                    essay2: comp.essay2_id,
                    grade1,
                    grade2,
                    forward: comp,
                    backward: reverse,
                    predictedWinner: forwardWinner,
                    truthWinner
                });
            }
        }
    }

    return inaccurate;
}

// Display results
async function displayResults(rankings, accuracy, flipProbability, trialStats) {
    document.getElementById('results').style.display = 'block';

    // Check for perturbations
    const numProblemNodes = parseInt(document.getElementById('numProblemNodes').value);
    const problemNodeWinProb = parseFloat(document.getElementById('problemNodeWinProb').value);
    const perturbationActive = flipProbability > 0 || numProblemNodes > 0;

    // Show/hide perturbation indicator
    const perturbationDiv = document.getElementById('perturbationComparison');
    if (perturbationDiv) {
        perturbationDiv.style.display = perturbationActive ? 'block' : 'none';
    }

    // Update perturbation status message
    if (perturbationActive) {
        const statusDiv = document.getElementById('perturbationStatus');
        if (statusDiv) {
            const statusParts = [];

            if (flipProbability > 0) {
                statusParts.push(`<strong>🎲 Random Flipping:</strong> ${flipProbability.toFixed(0)}% of decisions randomly flipped`);
            }

            if (numProblemNodes > 0) {
                statusParts.push(`<strong>⚠️ Problem Nodes:</strong> ${numProblemNodes} synthetic essays added with ${problemNodeWinProb.toFixed(0)}% win rate`);
            }

            if (trialStats) {
                statusParts.push(`<strong>📊 Statistics:</strong> Results averaged over ${trialStats.numTrials} trials (Mean ± SE shown below)`);
            }

            statusDiv.innerHTML = statusParts.map(p => `<p style="margin: 5px 0;">${p}</p>`).join('');
        }
    }

    // Hide Inaccurate Predictions and Order-Reversal sections when perturbation is active
    const showDetailedSections = !perturbationActive;
    const inaccuratePredictionsElem = document.querySelector('#inaccuratePredictions');
    const inaccuratePredictionsSection = inaccuratePredictionsElem ? inaccuratePredictionsElem.closest('.details-section') : null;
    const contradictionsElem = document.querySelector('#contradictions');
    const contradictionsSection = contradictionsElem ? contradictionsElem.closest('.details-section') : null;
    if (inaccuratePredictionsSection) inaccuratePredictionsSection.style.display = showDetailedSections ? 'block' : 'none';
    if (contradictionsSection) contradictionsSection.style.display = showDetailedSections ? 'block' : 'none';

    // Run Status
    document.getElementById('runStatus').innerHTML = `
        <div class="stat-row">
            <span>Complete:</span>
            <span class="${state.complete ? 'success' : 'warning'}">
                ${state.complete ? '✓ Yes' : '⚠ In Progress'}
            </span>
        </div>
        <div class="stat-row">
            <span>Progress:</span>
            <span>${state.completed_pairs} / ${state.total_pairs} pairs</span>
        </div>
        <div class="stat-row">
            <span>Failed:</span>
            <span>${state.failed_pairs} pairs</span>
        </div>
    `;

    // Comparison Stats
    const decisions = { essay1: 0, essay2: 0, tie: 0 };
    for (const comp of comparisons) {
        decisions[comp.decision] = (decisions[comp.decision] || 0) + 1;
    }

    document.getElementById('comparisonStats').innerHTML = `
        <div class="stat-row">
            <span>Total:</span>
            <span>${comparisons.length}</span>
        </div>
        <div class="stat-row">
            <span>Essay A Wins:</span>
            <span>${decisions.essay1 || 0}</span>
        </div>
        <div class="stat-row">
            <span>Essay B Wins:</span>
            <span>${decisions.essay2 || 0}</span>
        </div>
        <div class="stat-row">
            <span>Ties:</span>
            <span>${decisions.tie || 0}</span>
        </div>
    `;

    // Model Stats
    const avgLatency = state.stats.avg_latency_seconds;
    document.getElementById('modelStats').innerHTML = `
        <div class="stat-row">
            <span>API Calls:</span>
            <span>${state.stats.total_api_calls}</span>
        </div>
        <div class="stat-row">
            <span>Avg Latency:</span>
            <span>${avgLatency.toFixed(2)}s</span>
        </div>
        <div class="stat-row">
            <span>Total Time:</span>
            <span>${(state.stats.total_latency_seconds / 3600).toFixed(2)}h</span>
        </div>
    `;

    // Calculate current overall accuracy
    // If we have trial stats, use that; otherwise calculate from accuracy object
    let currentOverallAccuracy;
    if (trialStats && trialStats.meanAccuracy != null) {
        currentOverallAccuracy = trialStats.meanAccuracy.toFixed(1);
    } else if (accuracy) {
        // Calculate from delta-grouped accuracy object
        let currentTotalNonZero = 0, currentCorrectNonZero = 0;
        for (const [delta, stats] of Object.entries(accuracy)) {
            if (parseInt(delta) !== 0) {
                currentTotalNonZero += stats.total;
                currentCorrectNonZero += stats.correct;
            }
        }
        currentOverallAccuracy = currentTotalNonZero > 0 ?
            (currentCorrectNonZero / currentTotalNonZero * 100).toFixed(1) : 0;
    } else {
        // No accuracy data available yet
        currentOverallAccuracy = 0;
    }

    // Update Model Performance card title based on perturbation
    const modelStatsCard = document.getElementById('modelStats').closest('.metric-card');
    if (modelStatsCard) {
        const cardTitle = modelStatsCard.querySelector('h3');
        if (perturbationActive && trialStats) {
            cardTitle.textContent = `Performance (${flipProbability.toFixed(0)}% × ${trialStats.numTrials} trials)`;
            cardTitle.style.color = '#ca8a04';
        } else if (perturbationActive) {
            cardTitle.textContent = `Performance (${flipProbability.toFixed(0)}% Perturbed)`;
            cardTitle.style.color = '#ca8a04';
        } else {
            cardTitle.textContent = 'Model Performance';
            cardTitle.style.color = '';
        }
    }

    // Update main model stats to show accuracy with error bars
    const modelStatsContent = document.getElementById('modelStats').innerHTML;

    if (trialStats) {
        // Show mean ± SE
        const meanAccuracy = trialStats.meanAccuracy.toFixed(1);
        const seAccuracy = trialStats.stdError.toFixed(1);
        const colorMean = trialStats.meanAccuracy >= 80 ? '#16a34a' : trialStats.meanAccuracy >= 60 ? '#ca8a04' : '#dc2626';

        document.getElementById('modelStats').innerHTML = modelStatsContent + `
            <div class="stat-row" style="border-top: 1px solid #eee; margin-top: 8px; padding-top: 8px;">
                <span>Ranking Accuracy:</span>
                <span style="font-weight: 600; color: ${colorMean};">
                    ${meanAccuracy}% ± ${seAccuracy}%
                </span>
            </div>
            <div class="stat-row" style="font-size: 0.85em; color: #666;">
                <span>Range:</span>
                <span>${trialStats.minAccuracy.toFixed(1)}% - ${trialStats.maxAccuracy.toFixed(1)}%</span>
            </div>
        `;
    } else {
        // Show single value
        document.getElementById('modelStats').innerHTML = modelStatsContent + `
            <div class="stat-row" style="border-top: 1px solid #eee; margin-top: 8px; padding-top: 8px;">
                <span>Ranking Accuracy:</span>
                <span style="font-weight: 600; color: ${currentOverallAccuracy >= 80 ? '#16a34a' : currentOverallAccuracy >= 60 ? '#ca8a04' : '#dc2626'};">
                    ${currentOverallAccuracy}%
                </span>
            </div>
        `;
    }

    // Show comparison stats if perturbation is active and we have baseline
    if (perturbationActive && baselineAccuracy) {
        // Calculate baseline accuracy
        let baselineTotalNonZero = 0, baselineCorrectNonZero = 0;
        for (const [delta, stats] of Object.entries(baselineAccuracy)) {
            if (parseInt(delta) !== 0) {
                baselineTotalNonZero += stats.total;
                baselineCorrectNonZero += stats.correct;
            }
        }
        const baselineOverallAccuracy = baselineTotalNonZero > 0 ?
            (baselineCorrectNonZero / baselineTotalNonZero * 100) : 0;

        // Use mean accuracy if trials available
        const comparisonAccuracy = trialStats ? trialStats.meanAccuracy : parseFloat(currentOverallAccuracy);
        const accuracyDrop = baselineOverallAccuracy - comparisonAccuracy;

        // Format with SE if available
        const perturbedDisplay = trialStats && trialStats.stdError ?
            `${comparisonAccuracy.toFixed(1)}% ± ${trialStats.stdError.toFixed(1)}%` :
            `${comparisonAccuracy.toFixed(1)}%`;

        // Add comparison row
        document.getElementById('modelStats').innerHTML += `
            <div class="stat-row">
                <span>Perturbed Acc:</span>
                <span style="font-weight: 600;">${perturbedDisplay}</span>
            </div>
            <div class="stat-row">
                <span>vs Baseline:</span>
                <span style="color: ${Math.abs(accuracyDrop) < 5 ? '#16a34a' : Math.abs(accuracyDrop) < 15 ? '#ca8a04' : '#dc2626'};">
                    ${accuracyDrop > 0 ? '-' : '+'}${Math.abs(accuracyDrop).toFixed(1)}%
                </span>
            </div>
            <div class="stat-row" style="font-size: 0.85em; color: #666;">
                <span>Baseline (0%):</span>
                <span>${baselineOverallAccuracy.toFixed(1)}%</span>
            </div>
        `;
    }

    // Rankings Table
    const testSet = state.test_set || 'train';
    const tableHTML = `
        <table class="rankings-table">
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Essay ID</th>
                    <th>Criterion B Mark</th>
                    <th>Self-Contradictions</th>
                    <th>FAS Edges</th>
                </tr>
            </thead>
            <tbody>
                ${rankings.map(r => `
                    <tr>
                        <td>#${r.rank}</td>
                        <td class="essay-id">
                            <a href="/extracted_text/${testSet}/${r.id}.md" target="_blank" style="color: #2563eb; text-decoration: none;">
                                ${r.id}
                            </a>
                        </td>
                        <td>${r.groundTruth != null ? r.groundTruth : '?'}</td>
                        <td>${r.contradictions || 0}</td>
                        <td>${r.fasEdges || 0}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    document.getElementById('rankingsTable').innerHTML = tableHTML;

    // Only show detailed sections when perturbation is off
    if (showDetailedSections) {
        // Order-reversal consistency analysis
        const inconsistencyData = findContradictions(comparisons);
        const { contradictions, bidirectionalPairs, totalUniquePairs } = inconsistencyData;

        const consistencyRate = bidirectionalPairs > 0 ? ((bidirectionalPairs - contradictions.length) / bidirectionalPairs * 100).toFixed(1) : 100;
        const inconsistencyRate = bidirectionalPairs > 0 ? (contradictions.length / bidirectionalPairs * 100).toFixed(1) : 0;

        document.getElementById('contradictions').innerHTML = `
        <div style="background: #f5f5f5; padding: 12px; border-radius: 4px; margin-bottom: 15px;">
            <div class="stat-row">
                <span>Total comparisons:</span>
                <span>${comparisons.length}</span>
            </div>
            <div class="stat-row">
                <span>Unique pairs (bidirectional):</span>
                <span>${totalUniquePairs}</span>
            </div>
            <div class="stat-row">
                <span>Order-reversal consistency rate:</span>
                <span class="${contradictions.length === 0 ? 'success' : 'warning'}">${consistencyRate}% (${bidirectionalPairs - contradictions.length}/${bidirectionalPairs} consistent)</span>
            </div>
            <div class="stat-row">
                <span>Inconsistent pairs:</span>
                <span class="${contradictions.length > 0 ? 'error' : 'success'}">${contradictions.length} (${inconsistencyRate}%)</span>
            </div>
        </div>
        ${contradictions.length > 0 ? `
            <p class="warning">Found ${contradictions.length} pair(s) where the model gave different winners when order was reversed:</p>
            <table class="contradictions-table" style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                <thead>
                    <tr style="background: #f5f5f5; border-bottom: 2px solid #ddd;">
                        <th style="padding: 8px; text-align: left;">Essay A</th>
                        <th style="padding: 8px; text-align: left;">Essay B</th>
                        <th style="padding: 8px; text-align: left;">A→B Output</th>
                        <th style="padding: 8px; text-align: left;">B→A Output</th>
                        <th style="padding: 8px; text-align: left;">Reflection</th>
                    </tr>
                </thead>
                <tbody>
                    ${contradictions.map(c => {
                        const grade1 = groundTruthGrades[c.essay1] || '?';
                        const grade2 = groundTruthGrades[c.essay2] || '?';
                        const testSet = state.test_set || 'train';

                        return `
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 8px;">
                                <a href="/extracted_text/${testSet}/${c.essay1}.md" target="_blank" style="color: #2563eb; text-decoration: none;">
                                    ${c.essay1.substring(0, 8)}... (${grade1})
                                </a>
                            </td>
                            <td style="padding: 8px;">
                                <a href="/extracted_text/${testSet}/${c.essay2}.md" target="_blank" style="color: #2563eb; text-decoration: none;">
                                    ${c.essay2.substring(0, 8)}... (${grade2})
                                </a>
                            </td>
                            <td style="padding: 8px;">
                                <a href="/runs/${currentRun}/${c.essay1}-${c.essay2}.json" target="_blank" style="color: #2563eb; text-decoration: none;">
                                    ${c.forwardWinner === c.essay1 ? 'A wins' : 'B wins'}
                                </a>
                            </td>
                            <td style="padding: 8px;">
                                <a href="/runs/${currentRun}/${c.essay2}-${c.essay1}.json" target="_blank" style="color: #2563eb; text-decoration: none;">
                                    ${c.backwardWinner === c.essay2 ? 'B wins' : 'A wins'}
                                </a>
                            </td>
                            <td style="padding: 8px;">
                                <a href="/runs/${currentRun}/reflections/${c.essay1}-${c.essay2}.json" target="_blank" style="color: #2563eb; text-decoration: none;">
                                    View
                                </a>
                            </td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        ` : '<p class="success">✓ Perfect consistency: All pairs gave the same result regardless of order</p>'}
    `;

    // Inaccurate predictions
    const inaccuratePredictions = findInaccuratePredictions(comparisons, groundTruthGrades);

    // Sort by delta (descending), then essay1 id, then essay2 id
    inaccuratePredictions.sort((a, b) => {
        const deltaA = Math.abs(a.grade1 - a.grade2);
        const deltaB = Math.abs(b.grade1 - b.grade2);

        if (deltaB !== deltaA) return deltaB - deltaA; // Larger deltas first
        if (a.essay1 !== b.essay1) return a.essay1.localeCompare(b.essay1);
        return a.essay2.localeCompare(b.essay2);
    });

    const accuratePairs = bidirectionalPairs - contradictions.length - inaccuratePredictions.length;
    const accuracyRate = bidirectionalPairs > 0 ? (accuratePairs / bidirectionalPairs * 100).toFixed(1) : 100;

    // Calculate accuracy by grade delta (from current comparisons, which may be perturbed)
    const accuracyByDelta = await calculateAccuracyByDelta(comparisons, groundTruthGrades, contradictions, feedbackData);

    // Calculate mean ± SE for each delta bucket if we have trial data
    let deltaStats = {};
    const hasTrialData = trialStats && trialStats.allDeltaAccuracies && trialStats.allDeltaAccuracies.length > 1;

    if (hasTrialData) {
        // Get all unique deltas
        const allDeltas = new Set();
        for (const deltaAcc of trialStats.allDeltaAccuracies) {
            Object.keys(deltaAcc).forEach(d => allDeltas.add(parseInt(d)));
        }

        // Calculate mean ± SE for each delta
        for (const delta of allDeltas) {
            const accuracies = trialStats.allDeltaAccuracies.map(deltaAcc => {
                const stats = deltaAcc[delta];
                return stats && stats.total > 0 ? (stats.correct / stats.total * 100) : 0;
            });
            const mean = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
            const se = calculateStandardError(accuracies);

            // Use first trial's counts for display
            const firstTrialStats = trialStats.allDeltaAccuracies[0][delta] || { total: 0, correct: 0, incorrect: 0 };
            deltaStats[delta] = {
                total: firstTrialStats.total,
                correct: firstTrialStats.correct,
                incorrect: firstTrialStats.incorrect,
                meanAccuracy: mean,
                seAccuracy: se
            };
        }
    }

    // Calculate overall non-zero delta accuracy from the delta table
    let totalNonZero = 0, correctNonZero = 0, incorrectNonZero = 0;
    for (const [delta, stats] of Object.entries(accuracyByDelta)) {
        if (parseInt(delta) !== 0) {
            totalNonZero += stats.total;
            correctNonZero += stats.correct;
            incorrectNonZero += stats.incorrect;
        }
    }
    const deltaTableAccuracy = totalNonZero > 0 ? (correctNonZero / totalNonZero * 100) : 0;

    // For the overall row, use trial-averaged accuracy if available, otherwise use delta table accuracy
    const overallDisplay = trialStats && trialStats.meanAccuracy != null ?
        `${trialStats.meanAccuracy.toFixed(1)}% ± ${trialStats.stdError.toFixed(1)}%` :
        `${deltaTableAccuracy.toFixed(1)}%`;

    // Display accuracy by delta table
    const deltaKeys = Object.keys(accuracyByDelta).map(Number).sort((a, b) => a - b);

    document.getElementById('accuracyByDelta').innerHTML = `
        <table class="delta-table" style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="background: #f5f5f5; border-bottom: 2px solid #ddd;">
                    <th style="padding: 8px; text-align: left;">Grade Delta (Δ)</th>
                    <th style="padding: 8px; text-align: center;">Total Pairs</th>
                    <th style="padding: 8px; text-align: center;">Correct</th>
                    <th style="padding: 8px; text-align: center;">Incorrect</th>
                    <th style="padding: 8px; text-align: center;">Accuracy${hasTrialData ? ' (Mean ± SE)' : ''}</th>
                </tr>
            </thead>
            <tbody>
                ${deltaKeys.map(delta => {
                    const stats = accuracyByDelta[delta];
                    const singleAccuracy = stats.total > 0 ? (stats.correct / stats.total * 100).toFixed(1) : 0;

                    // Use trial stats if available
                    const displayAccuracy = hasTrialData && deltaStats[delta] ?
                        `${deltaStats[delta].meanAccuracy.toFixed(1)}% ± ${deltaStats[delta].seAccuracy.toFixed(1)}%` :
                        `${singleAccuracy}%`;

                    const numericAccuracy = hasTrialData && deltaStats[delta] ? deltaStats[delta].meanAccuracy : parseFloat(singleAccuracy);
                    const color = numericAccuracy >= 80 ? '#16a34a' : numericAccuracy >= 60 ? '#ca8a04' : '#dc2626';
                    const label = delta === 0 ? 'Δ = 0 (same grade, different subcriteria)' : `Δ = ${delta}`;

                    return `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 8px; font-weight: 500;">${label}</td>
                        <td style="padding: 8px; text-align: center;">${stats.total}</td>
                        <td style="padding: 8px; text-align: center; color: #16a34a;">${stats.correct}</td>
                        <td style="padding: 8px; text-align: center; color: #dc2626;">${stats.incorrect}</td>
                        <td style="padding: 8px; text-align: center;">
                            <span style="font-weight: 500; color: ${color};">${displayAccuracy}</span>
                        </td>
                    </tr>
                `}).join('')}
                <tr style="background: #f5f5f5; border-top: 2px solid #ddd; font-weight: 600;">
                    <td style="padding: 8px;">Overall (Δ > 0)${hasTrialData ? ' (Mean ± SE)' : ''}</td>
                    <td style="padding: 8px; text-align: center;">${totalNonZero}</td>
                    <td style="padding: 8px; text-align: center; color: #16a34a;">${correctNonZero}</td>
                    <td style="padding: 8px; text-align: center; color: #dc2626;">${incorrectNonZero}</td>
                    <td style="padding: 8px; text-align: center;">
                        <span style="font-weight: 600; color: ${trialStats && trialStats.meanAccuracy != null ? (trialStats.meanAccuracy >= 80 ? '#16a34a' : trialStats.meanAccuracy >= 60 ? '#ca8a04' : '#dc2626') : (deltaTableAccuracy >= 80 ? '#16a34a' : deltaTableAccuracy >= 60 ? '#ca8a04' : '#dc2626')};">${overallDisplay}</span>
                    </td>
                </tr>
            </tbody>
        </table>
    `;

    document.getElementById('inaccuratePredictions').innerHTML = `
        <div style="background: #f5f5f5; padding: 12px; border-radius: 4px; margin-bottom: 15px;">
            <div class="stat-row">
                <span>Consistent and accurate pairs:</span>
                <span class="success">${accuratePairs} (${accuracyRate}%)</span>
            </div>
            <div class="stat-row">
                <span>Consistent but inaccurate pairs:</span>
                <span class="${inaccuratePredictions.length > 0 ? 'error' : 'success'}">${inaccuratePredictions.length} (${bidirectionalPairs > 0 ? (inaccuratePredictions.length / bidirectionalPairs * 100).toFixed(1) : 0}%)</span>
            </div>
        </div>
        ${inaccuratePredictions.length > 0 ? `
            <p class="warning">Found ${inaccuratePredictions.length} pair(s) where the model was self-consistent but predicted the wrong winner:</p>
            <table class="inaccurate-table" style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                <thead>
                    <tr style="background: #f5f5f5; border-bottom: 2px solid #ddd;">
                        <th style="padding: 8px; text-align: left;">Essay A</th>
                        <th style="padding: 8px; text-align: left;">Essay B</th>
                        <th style="padding: 8px; text-align: left;">Predicted Winner</th>
                        <th style="padding: 8px; text-align: left;">Ground Truth</th>
                        <th style="padding: 8px; text-align: left;">Reflection</th>
                    </tr>
                </thead>
                <tbody>
                    ${inaccuratePredictions.map(p => {
                        const testSet = state.test_set || 'train';
                        const predWinnerLabel = p.predictedWinner === p.essay1 ? 'A' : 'B';
                        const truthWinnerLabel = p.truthWinner === p.essay1 ? 'A' : 'B';

                        return `
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 8px;">
                                <a href="/extracted_text/${testSet}/${p.essay1}.md" target="_blank" style="color: #2563eb; text-decoration: none;">
                                    ${p.essay1} (${p.grade1}/6)
                                </a>
                            </td>
                            <td style="padding: 8px;">
                                <a href="/extracted_text/${testSet}/${p.essay2}.md" target="_blank" style="color: #2563eb; text-decoration: none;">
                                    ${p.essay2} (${p.grade2}/6)
                                </a>
                            </td>
                            <td style="padding: 8px;">
                                <span style="color: #dc2626; font-weight: 500;">
                                    ${predWinnerLabel} (${p.predictedWinner === p.essay1 ? p.grade1 : p.grade2}/6)
                                </span>
                                <div style="font-size: 0.85em; color: #666;">
                                    <a href="/runs/${currentRun}/${p.essay1}-${p.essay2}.json" target="_blank" style="color: #2563eb; text-decoration: none;">A→B</a> |
                                    <a href="/runs/${currentRun}/${p.essay2}-${p.essay1}.json" target="_blank" style="color: #2563eb; text-decoration: none;">B→A</a>
                                </div>
                            </td>
                            <td style="padding: 8px;">
                                <span style="color: #16a34a; font-weight: 500;">
                                    ${truthWinnerLabel} wins (${p.grade1} - ${p.grade2})
                                </span>
                            </td>
                            <td style="padding: 8px;">
                                <a href="/runs/${currentRun}/reflections/${p.essay1}-${p.essay2}.json" target="_blank" style="color: #2563eb; text-decoration: none;">
                                    View
                                </a>
                            </td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        ` : '<p class="success">✓ All consistent predictions were accurate!</p>'}
    `;
    }  // End of showDetailedSections conditional

    // Charts (always shown)
    renderCharts(rankings, accuracy);
}

function renderCharts(rankings, accuracy) {
    // Destroy existing charts if they exist
    if (rankingChart) {
        rankingChart.destroy();
        rankingChart = null;
    }
    if (distributionChart) {
        distributionChart.destroy();
        distributionChart = null;
    }

    // Ranking Chart
    const ctx1 = document.getElementById('rankingChart').getContext('2d');
    rankingChart = new Chart(ctx1, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Essays',
                data: rankings.map(r => ({ x: r.groundTruth || 0, y: r.rank })),
                backgroundColor: 'rgba(54, 162, 235, 0.5)'
            }]
        },
        options: {
            scales: {
                x: { title: { display: true, text: 'Criterion B Mark (0-6)' } },
                y: { title: { display: true, text: 'Predicted Rank' }, reverse: true }
            }
        }
    });

    // Distribution Chart
    const gradeCounts = {};
    for (const r of rankings) {
        const grade = r.groundTruth || 'Unknown';
        gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
    }

    const ctx2 = document.getElementById('distributionChart').getContext('2d');
    distributionChart = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: Object.keys(gradeCounts).sort(),
            datasets: [{
                label: '# of Essays',
                data: Object.values(gradeCounts),
                backgroundColor: 'rgba(75, 192, 192, 0.5)'
            }]
        },
        options: {
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

// Utility functions
async function fetchJSON(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}`);
    return response.json();
}

async function fetchYAML(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}`);
    const text = await response.text();
    // Simple YAML parsing (assumes structure)
    const lines = text.split('\n');
    const config = {};
    for (const line of lines) {
        if (line.includes('test_set:')) {
            config.test_set = line.split(':')[1].trim().replace(/["']/g, '');
        }
    }
    return config;
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}

function showError(message) {
    const errorEl = document.getElementById('error');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
}

function hideError() {
    document.getElementById('error').style.display = 'none';
}
