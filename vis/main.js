// Main application logic

let currentRun = null;
let groundTruthGrades = {};
let feedbackData = {};
let comparisons = [];
let originalComparisons = [];
let baselineAccuracy = null;
let baselineRankingAccuracy = null;
let state = null;
let debounceTimer = null;
let rankingChart = null;
let distributionChart = null;

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

    // Edge cutting controls
    document.getElementById('edgeCutProbability').addEventListener('input', (e) => {
        const value = e.target.value;
        document.getElementById('edgeCutProbabilityValue').textContent = value + '%';
        triggerPerturbationAnalysis();
    });

    // Random flipping controls
    document.getElementById('flipProbability').addEventListener('input', (e) => {
        const value = e.target.value;
        document.getElementById('flipProbabilityValue').textContent = value + '%';
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
        const runDirs = ['before_tuning', 'after_tuning'];

        const runSelector = document.getElementById('runSelector');
        runSelector.innerHTML = runDirs.map(run =>
            `<option value="${run}">${run}</option>`
        ).join('');

        if (runDirs.length > 0) {
            currentRun = runDirs[0];
            runSelector.value = currentRun;
            document.getElementById('analyzeButton').disabled = false;
        }
    } catch (error) {
        showError('Failed to load runs: ' + error.message);
    }
}

// Analyze current run
async function analyzeCurrentRun() {
    if (!currentRun) return;

    showLoading(true);
    hideError();
    document.getElementById('results').style.display = 'none';

    try {
        // Load state
        state = await fetchJSON(`/alssummary/runs/${currentRun}/state.json`);

        // Load config to determine test_set
        const config = await fetchYAML(`/alssummary/runs/${currentRun}/config.yaml`);
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
        const files = await fetch(`/alssummary/runs/${currentRun}/out.txt`).then(r => r.text()).then(t => t.split("\n"));

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
                fetchJSON(`/alssummary/runs/${currentRun}/${comparisonFiles[i]}`)
                    .then(comp => comparisons.push(comp))
                    .catch(() => {}) // Skip failed loads
            );
        }

        await Promise.all(loadPromises);

        console.log(`Loaded ${comparisons.length} comparisons`);

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

// Perform ranking analysis
async function performAnalysis() {
    const flipProbability = parseFloat(document.getElementById('flipProbability').value);
    const edgeCutProbability = parseFloat(document.getElementById('edgeCutProbability').value);
    const numProblemNodes = parseInt(document.getElementById('numProblemNodes').value);
    const problemNodeWinProb = parseFloat(document.getElementById('problemNodeWinProb').value);
    const method = document.getElementById('aggregationMethod').value;
    const numTrials = parseInt(document.getElementById('numTrials').value);

    console.log(`\n=== ANALYSIS START ===`);
    console.log(`Problem Nodes: ${numProblemNodes} (${problemNodeWinProb}% win), Edge Cut: ${edgeCutProbability}%, Flip: ${flipProbability}%, Trials: ${numTrials}`);
    console.log(`Original comparisons: ${originalComparisons.length}`);

    // If no perturbations, just use original data (single run, no trials)
    if (flipProbability === 0 && edgeCutProbability === 0 && numProblemNodes === 0) {
        console.log('No perturbations - using original data');
        // Still apply Step 0: Remove symmetric contradictions (automatic preprocessing)
        comparisons = removeSymmetricContradictions([...originalComparisons]);

        const rankings = method === 'net-wins'
            ? aggregateNetWins(comparisons)
            : aggregateFeedbackArc(comparisons);

        // Populate ground truth grades in rankings
        for (const ranking of rankings) {
            ranking.groundTruth = groundTruthGrades[ranking.id];
        }

        const rankingAccuracy = calculateRankingAccuracy(rankings, groundTruthGrades);
        console.log(`Baseline ranking accuracy (post-aggregation): ${rankingAccuracy.accuracy.toFixed(1)}% (${rankingAccuracy.correctPairs}/${rankingAccuracy.totalPairs} pairs correctly ordered)`);

        // Calculate pre-aggregation accuracy (raw comparison accuracy) by delta
        const preAggAccuracyByDelta = calculatePreAggregationAccuracyByDelta(comparisons, groundTruthGrades, feedbackData);
        const preAggAccuracy = calculatePreAggregationAccuracy(comparisons, groundTruthGrades, feedbackData);
        console.log(`Baseline pre-aggregation accuracy: ${preAggAccuracy.accuracy.toFixed(1)}% (${preAggAccuracy.correctPairs.toFixed(1)}/${preAggAccuracy.totalPairs} raw comparisons correct)`);

        // Store baseline ranking accuracy for later comparison
        baselineRankingAccuracy = rankingAccuracy.accuracy;

        // Calculate delta-grouped accuracy from rankings (counts won't change with perturbations)
        const accuracyByDelta = calculateAccuracyByDeltaFromRankings(rankings, groundTruthGrades, feedbackData);

        // Store baseline for old comparison-based metrics (for detailed sections)
        const { contradictions } = findContradictions(comparisons);
        baselineAccuracy = await calculateAccuracyByDelta(comparisons, groundTruthGrades, contradictions, feedbackData);

        // Display results with no trials data
        await displayResults(rankings, rankingAccuracy, flipProbability, null, accuracyByDelta, preAggAccuracyByDelta);
        return;
    }

    // Run multiple trials with perturbations
    console.log(`Running ${numTrials} trials with perturbations...`);

    const { contradictions } = findContradictions(originalComparisons);
    const trialResults = [];
    const trialAccuracies = [];

    for (let trial = 0; trial < numTrials; trial++) {
        // IMPORTANT: Start fresh from original comparisons each trial
        let perturbedComps = [...originalComparisons];

        // Apply intervention pipeline in order:
        // Step 0: Remove symmetric contradictions (automatic)
        perturbedComps = removeSymmetricContradictions(perturbedComps);

        // Step 1: Add problem nodes
        if (numProblemNodes > 0) {
            perturbedComps = addProblemNodes(perturbedComps, numProblemNodes, problemNodeWinProb);
        }

        // Step 2: Random edge cutting
        if (edgeCutProbability > 0) {
            perturbedComps = cutEdges(perturbedComps, edgeCutProbability);
        }

        // Step 3: Random decision flipping
        if (flipProbability > 0) {
            perturbedComps = perturbComparisons(perturbedComps, flipProbability);
        }

        if (trial === 0) {
            const flippedCount = perturbedComps.slice(0, originalComparisons.length)
                .filter((c, i) => c.decision !== originalComparisons[i].decision).length;
            console.log(`Trial 1: ${flippedCount} flipped, ${perturbedComps.length - originalComparisons.length} synthetic added, total: ${perturbedComps.length}`);
        }

        // Recompute rankings with perturbed data
        const rankings = method === 'net-wins'
            ? aggregateNetWins(perturbedComps)
            : aggregateFeedbackArc(perturbedComps);

        // Populate ground truth grades in rankings
        for (const ranking of rankings) {
            ranking.groundTruth = groundTruthGrades[ranking.id];
        }

        // Calculate ranking accuracy (all pairs with different grades)
        const rankingAccuracy = calculateRankingAccuracy(rankings, groundTruthGrades);
        const overallAcc = rankingAccuracy.accuracy;

        // Calculate delta-grouped accuracy from rankings (consistent counts across trials)
        const deltaAccuracy = calculateAccuracyByDeltaFromRankings(rankings, groundTruthGrades, feedbackData);

        // Calculate pre-aggregation accuracy by delta
        const preAggDeltaAccuracy = calculatePreAggregationAccuracyByDelta(perturbedComps, groundTruthGrades, feedbackData);

        trialResults.push({ rankings, rankingAccuracy, deltaAccuracy, preAggDeltaAccuracy, comparisons: perturbedComps });
        trialAccuracies.push(overallAcc);

        console.log(`Trial ${trial + 1}: ${overallAcc.toFixed(1)}% accuracy (${rankingAccuracy.correctPairs}/${rankingAccuracy.totalPairs} pairs correctly ordered)`);
    }

    const meanAccuracy = trialAccuracies.reduce((a, b) => a + b, 0) / numTrials;
    const stdError = calculateStandardError(trialAccuracies);

    console.log(`Mean: ${meanAccuracy.toFixed(1)}%, SE: ${stdError.toFixed(1)}%`);
    console.log(`Range: ${Math.min(...trialAccuracies).toFixed(1)}% - ${Math.max(...trialAccuracies).toFixed(1)}%`);

    // Use the first trial's results for display
    const displayRankings = trialResults[0].rankings;
    comparisons = trialResults[0].comparisons;
    const firstTrialDeltaAccuracy = trialResults[0].deltaAccuracy;
    const firstTrialPreAggDeltaAccuracy = trialResults[0].preAggDeltaAccuracy;

    const allDeltaAccuracies = trialResults.map(t => t.deltaAccuracy);
    const allPreAggDeltaAccuracies = trialResults.map(t => t.preAggDeltaAccuracy);

    // Use first trial's ranking accuracy for pair counts (representative)
    const firstTrialRankingAcc = trialResults[0].rankingAccuracy;

    const trialStats = {
        numTrials,
        meanAccuracy,
        stdError,
        minAccuracy: Math.min(...trialAccuracies),
        maxAccuracy: Math.max(...trialAccuracies),
        totalPairs: firstTrialRankingAcc.totalPairs,
        correctPairs: firstTrialRankingAcc.correctPairs,
        incorrectPairs: firstTrialRankingAcc.incorrectPairs,
        allDeltaAccuracies,
        allPreAggDeltaAccuracies
    };

    await displayResults(displayRankings, null, flipProbability, trialStats, firstTrialDeltaAccuracy, firstTrialPreAggDeltaAccuracy);
}
