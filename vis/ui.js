async function displayResults(rankings, accuracy, flipProbability, trialStats, accuracyByDelta, preAggAccuracyByDelta) {
    document.getElementById('results').style.display = 'block';

    // Check for perturbations
    const numProblemNodes = parseInt(document.getElementById('numProblemNodes').value);
    const problemNodeWinProb = parseFloat(document.getElementById('problemNodeWinProb').value);
    const edgeCutProbability = parseFloat(document.getElementById('edgeCutProbability').value);
    const perturbationActive = flipProbability > 0 || numProblemNodes > 0 || edgeCutProbability > 0;

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

            if (numProblemNodes > 0) {
                statusParts.push(`<strong>⚠️ Problem Nodes:</strong> ${numProblemNodes} synthetic essays added with ${problemNodeWinProb.toFixed(0)}% win rate`);
            }

            if (edgeCutProbability > 0) {
                statusParts.push(`<strong>✂️ Edge Cutting:</strong> ${edgeCutProbability.toFixed(0)}% of edges randomly removed`);
            }

            if (flipProbability > 0) {
                statusParts.push(`<strong>🎲 Random Flipping:</strong> ${flipProbability.toFixed(0)}% of decisions randomly flipped`);
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
    // If we have trial stats, use that; otherwise use the ranking accuracy
    let currentOverallAccuracy;
    if (trialStats && trialStats.meanAccuracy != null) {
        currentOverallAccuracy = trialStats.meanAccuracy.toFixed(1);
    } else if (accuracy && accuracy.accuracy != null) {
        // Use ranking accuracy (all pairs with different grades)
        currentOverallAccuracy = accuracy.accuracy.toFixed(1);
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
    if (perturbationActive && baselineRankingAccuracy != null) {
        // Use stored baseline ranking accuracy
        const baselineOverallAccuracy = baselineRankingAccuracy;

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

    // Calculate contradictions for all cases (needed for detailed sections)
    const inconsistencyData = findContradictions(comparisons);
    const { contradictions, bidirectionalPairs, totalUniquePairs } = inconsistencyData;

    // accuracyByDelta is now passed as a parameter (calculated from rankings, not comparisons)
    // This ensures delta counts don't change with perturbations

    // Only show detailed sections when perturbation is off
    if (showDetailedSections) {
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
                                <a href="/alssummary/runs/${currentRun}/${c.essay1}-${c.essay2}.json" target="_blank" style="color: #2563eb; text-decoration: none;">
                                    ${c.forwardWinner === c.essay1 ? 'A wins' : 'B wins'}
                                </a>
                            </td>
                            <td style="padding: 8px;">
                                <a href="/alssummary/runs/${currentRun}/${c.essay2}-${c.essay1}.json" target="_blank" style="color: #2563eb; text-decoration: none;">
                                    ${c.backwardWinner === c.essay2 ? 'B wins' : 'A wins'}
                                </a>
                            </td>
                            <td style="padding: 8px;">
                                <a href="/alssummary/runs/${currentRun}/reflections/${c.essay1}-${c.essay2}.json" target="_blank" style="color: #2563eb; text-decoration: none;">
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
    const inaccuratePredictions = findInaccuratePredictions(comparisons, groundTruthGrades, contradictions, feedbackData);

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

        // Render inaccurate predictions section
        renderInaccuratePredictionsSection(inaccuratePredictions, accuratePairs, accuracyRate, bidirectionalPairs);
    }  // End of showDetailedSections conditional

    // Calculate mean ± SE for each delta bucket if we have trial data (always needed for display)
    let deltaStats = {};
    let preAggDeltaStats = {};
    const hasTrialData = trialStats && trialStats.allDeltaAccuracies && trialStats.allDeltaAccuracies.length > 1;

    if (hasTrialData) {
        // Get all unique deltas
        const allDeltas = new Set();
        for (const deltaAcc of trialStats.allDeltaAccuracies) {
            Object.keys(deltaAcc).forEach(d => allDeltas.add(parseInt(d)));
        }

        // Calculate mean ± SE for each delta (post-aggregation)
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

        // Calculate mean ± SE for pre-aggregation delta accuracies
        if (trialStats.allPreAggDeltaAccuracies) {
            for (const delta of allDeltas) {
                const preAggAccuracies = trialStats.allPreAggDeltaAccuracies.map(deltaAcc => {
                    const stats = deltaAcc[delta];
                    return stats && stats.total > 0 ? (stats.correct / stats.total * 100) : 0;
                });
                const mean = preAggAccuracies.reduce((a, b) => a + b, 0) / preAggAccuracies.length;
                const se = calculateStandardError(preAggAccuracies);

                const firstTrialStats = trialStats.allPreAggDeltaAccuracies[0][delta] || { total: 0, correct: 0, incorrect: 0 };
                preAggDeltaStats[delta] = {
                    total: firstTrialStats.total,
                    correct: firstTrialStats.correct,
                    incorrect: firstTrialStats.incorrect,
                    meanAccuracy: mean,
                    seAccuracy: se
                };
            }
        }
    }

    // Overall row uses all-pairs ranking accuracy (not sum of delta rows)
    // With trials: average of ranking accuracy across trials
    // Without trials: single ranking accuracy calculation
    let overallAccuracy, overallTotal, overallCorrect, overallIncorrect, overallDisplay;

    if (trialStats && trialStats.meanAccuracy != null) {
        // With trials: use trial-averaged ranking accuracy
        overallAccuracy = trialStats.meanAccuracy;
        // Use first trial's pair counts for display (representative)
        overallTotal = trialStats.totalPairs || 0;
        overallCorrect = trialStats.correctPairs || 0;
        overallIncorrect = trialStats.incorrectPairs || 0;
        overallDisplay = `${trialStats.meanAccuracy.toFixed(1)}% ± ${trialStats.stdError.toFixed(1)}%`;
    } else if (accuracy && accuracy.accuracy != null) {
        // Without trials: use single ranking accuracy
        overallAccuracy = accuracy.accuracy;
        overallTotal = accuracy.totalPairs;
        overallCorrect = accuracy.correctPairs;
        overallIncorrect = accuracy.incorrectPairs;
        overallDisplay = `${accuracy.accuracy.toFixed(1)}%`;
    } else {
        overallAccuracy = 0;
        overallTotal = 0;
        overallCorrect = 0;
        overallIncorrect = 0;
        overallDisplay = '0%';
    }

    // Display accuracy by delta table
    const deltaKeys = Object.keys(accuracyByDelta).map(Number).sort((a, b) => a - b);

    document.getElementById('accuracyByDelta').innerHTML = `
        <table class="delta-table" style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="background: #e5e7eb; border-bottom: 2px solid #ddd;">
                    <th rowspan="2" style="padding: 8px; text-align: left; vertical-align: middle; border-right: 2px solid #ddd;">Grade Delta (Δ)</th>
                    <th rowspan="2" style="padding: 8px; text-align: center; vertical-align: middle; border-right: 2px solid #ddd;">Total Pairs</th>
                    <th colspan="3" style="padding: 8px; text-align: center; border-bottom: 1px solid #ddd; background: #dbeafe;">Pre-Aggregation Acc (Raw)</th>
                    <th colspan="3" style="padding: 8px; text-align: center; background: #fef3c7;">Post-Aggregation Acc (Ranking)</th>
                </tr>
                <tr style="background: #f5f5f5; border-bottom: 2px solid #ddd;">
                    <th style="padding: 6px; text-align: center; font-size: 0.9em; background: #dbeafe;">Correct</th>
                    <th style="padding: 6px; text-align: center; font-size: 0.9em; background: #dbeafe;">Incorrect</th>
                    <th style="padding: 6px; text-align: center; font-size: 0.9em; background: #dbeafe;">Accuracy${hasTrialData ? ' (± SE)' : ''}</th>
                    <th style="padding: 6px; text-align: center; font-size: 0.9em; background: #fef3c7;">Correct</th>
                    <th style="padding: 6px; text-align: center; font-size: 0.9em; background: #fef3c7;">Incorrect</th>
                    <th style="padding: 6px; text-align: center; font-size: 0.9em; background: #fef3c7;">Accuracy${hasTrialData ? ' (± SE)' : ''}</th>
                </tr>
            </thead>
            <tbody>
                ${deltaKeys.map(delta => {
                    // Post-aggregation stats
                    const postAggStats = accuracyByDelta[delta];
                    const postAggSingleAccuracy = postAggStats.total > 0 ? (postAggStats.correct / postAggStats.total * 100).toFixed(1) : 0;

                    const postAggDisplayAccuracy = hasTrialData && deltaStats[delta] ?
                        `${deltaStats[delta].meanAccuracy.toFixed(1)}% ± ${deltaStats[delta].seAccuracy.toFixed(1)}%` :
                        `${postAggSingleAccuracy}%`;

                    const postAggNumericAccuracy = hasTrialData && deltaStats[delta] ? deltaStats[delta].meanAccuracy : parseFloat(postAggSingleAccuracy);
                    const postAggColor = postAggNumericAccuracy >= 80 ? '#16a34a' : postAggNumericAccuracy >= 60 ? '#ca8a04' : '#dc2626';

                    // Pre-aggregation stats
                    const preAggStats = preAggAccuracyByDelta && preAggAccuracyByDelta[delta] ? preAggAccuracyByDelta[delta] : { total: 0, correct: 0, incorrect: 0 };
                    const preAggSingleAccuracy = preAggStats.total > 0 ? (preAggStats.correct / preAggStats.total * 100).toFixed(1) : 0;

                    const preAggDisplayAccuracy = hasTrialData && preAggDeltaStats[delta] ?
                        `${preAggDeltaStats[delta].meanAccuracy.toFixed(1)}% ± ${preAggDeltaStats[delta].seAccuracy.toFixed(1)}%` :
                        `${preAggSingleAccuracy}%`;

                    const preAggNumericAccuracy = hasTrialData && preAggDeltaStats[delta] ? preAggDeltaStats[delta].meanAccuracy : parseFloat(preAggSingleAccuracy);
                    const preAggColor = preAggNumericAccuracy >= 80 ? '#16a34a' : preAggNumericAccuracy >= 60 ? '#ca8a04' : '#dc2626';

                    const label = delta === 0 ? 'Δ = 0 (same grade, tiebreak by subcriteria count)' : `Δ = ${delta}`;

                    return `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 8px; font-weight: 500; border-right: 2px solid #ddd;">${label}</td>
                        <td style="padding: 8px; text-align: center; border-right: 2px solid #ddd;">${postAggStats.total}</td>
                        <td style="padding: 8px; text-align: center; color: #16a34a; background: #f0f9ff;">${preAggStats.correct.toFixed(1)}</td>
                        <td style="padding: 8px; text-align: center; color: #dc2626; background: #f0f9ff;">${preAggStats.incorrect.toFixed(1)}</td>
                        <td style="padding: 8px; text-align: center; background: #f0f9ff;">
                            <span style="font-weight: 500; color: ${preAggColor};">${preAggDisplayAccuracy}</span>
                        </td>
                        <td style="padding: 8px; text-align: center; color: #16a34a; background: #fffbeb;">${postAggStats.correct}</td>
                        <td style="padding: 8px; text-align: center; color: #dc2626; background: #fffbeb;">${postAggStats.incorrect}</td>
                        <td style="padding: 8px; text-align: center; background: #fffbeb;">
                            <span style="font-weight: 500; color: ${postAggColor};">${postAggDisplayAccuracy}</span>
                        </td>
                    </tr>
                `}).join('')}
                <tr style="background: #f5f5f5; border-top: 2px solid #ddd; font-weight: 600;">
                    <td style="padding: 8px; border-right: 2px solid #ddd;">Overall (Δ > 0)${hasTrialData ? ' (Mean ± SE)' : ''}</td>
                    <td style="padding: 8px; text-align: center; border-right: 2px solid #ddd;">${overallTotal}</td>
                    <td colspan="3" style="padding: 8px; text-align: center; background: #dbeafe; font-style: italic;">See raw comparisons</td>
                    <td style="padding: 8px; text-align: center; color: #16a34a; background: #fef3c7;">${overallCorrect}</td>
                    <td style="padding: 8px; text-align: center; color: #dc2626; background: #fef3c7;">${overallIncorrect}</td>
                    <td style="padding: 8px; text-align: center; background: #fef3c7;">
                        <span style="font-weight: 600; color: ${overallAccuracy >= 80 ? '#16a34a' : overallAccuracy >= 60 ? '#ca8a04' : '#dc2626'};">${overallDisplay}</span>
                    </td>
                </tr>
            </tbody>
        </table>
    `;

    // Charts (always shown)
    renderCharts(rankings, accuracy);
}

function renderInaccuratePredictionsSection(inaccuratePredictions, accuratePairs, accuracyRate, bidirectionalPairs) {
    const testSet = state.test_set || 'train';

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
                        const predWinnerLabel = p.predictedWinner === p.essay1 ? 'A' : 'B';
                        const truthWinnerLabel = p.groundTruthWinner === p.essay1 ? 'A' : 'B';

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
                                    <a href="/alssummary/runs/${currentRun}/${p.essay1}-${p.essay2}.json" target="_blank" style="color: #2563eb; text-decoration: none;">A→B</a> |
                                    <a href="/alssummary/runs/${currentRun}/${p.essay2}-${p.essay1}.json" target="_blank" style="color: #2563eb; text-decoration: none;">B→A</a>
                                </div>
                            </td>
                            <td style="padding: 8px;">
                                <span style="color: #16a34a; font-weight: 500;">
                                    ${truthWinnerLabel} wins (${p.grade1} - ${p.grade2})
                                </span>
                            </td>
                            <td style="padding: 8px;">
                                <a href="/alssummary/runs/${currentRun}/reflections/${p.essay1}-${p.essay2}.json" target="_blank" style="color: #2563eb; text-decoration: none;">
                                    View
                                </a>
                            </td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        ` : '<p class="success">✓ All consistent predictions were accurate!</p>'}
    `;
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

// Note: fetchJSON, fetchYAML, showLoading, showError, hideError are defined in utils.js
