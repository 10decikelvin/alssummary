// Accuracy calculation functions

// Calculate pre-aggregation accuracy by delta (raw comparison accuracy)
// For ties, count as 0.5 correct and 0.5 incorrect
function calculatePreAggregationAccuracyByDelta(comparisons, groundTruth, feedbackData) {
    const deltaStats = {};

    const compMap = {};
    for (const comp of comparisons) {
        const key = `${comp.essay1_id}-${comp.essay2_id}`;
        compMap[key] = comp;
    }

    // Process each unique pair (considering both directions)
    const seenPairs = new Set();

    for (const comp of comparisons) {
        const pairKey = [comp.essay1_id, comp.essay2_id].sort().join('-');
        if (seenPairs.has(pairKey)) continue;
        seenPairs.add(pairKey);

        const essay1_id = comp.essay1_id;
        const essay2_id = comp.essay2_id;
        const grade1 = groundTruth[essay1_id];
        const grade2 = groundTruth[essay2_id];

        if (grade1 == null || grade2 == null) continue;

        const delta = Math.abs(grade1 - grade2);

        // Determine ground truth winner
        let gtWinner = null;
        if (grade1 > grade2) {
            gtWinner = 'essay1';
        } else if (grade2 > grade1) {
            gtWinner = 'essay2';
        } else {
            // Tiebreak by subcriteria
            const feedback1 = feedbackData[essay1_id];
            const feedback2 = feedbackData[essay2_id];

            if (feedback1 && feedback2 && feedback1.subcriteria && feedback2.subcriteria) {
                const count1 = feedback1.subcriteria.filter(sc => sc.correct === 'yes').length;
                const count2 = feedback2.subcriteria.filter(sc => sc.correct === 'yes').length;

                if (count1 > count2) {
                    gtWinner = 'essay1';
                } else if (count2 > count1) {
                    gtWinner = 'essay2';
                }
            }
        }

        if (!gtWinner) continue; // Skip if no clear winner

        // Get LLM decisions from both directions
        const forward = compMap[`${essay1_id}-${essay2_id}`];
        const reverse = compMap[`${essay2_id}-${essay1_id}`];

        // Use forward comparison if available, otherwise try reverse
        let llmDecision = null;
        if (forward) {
            llmDecision = forward.decision;
        } else if (reverse) {
            // Translate reverse decision to forward perspective
            if (reverse.decision === 'essay1') llmDecision = 'essay2';
            else if (reverse.decision === 'essay2') llmDecision = 'essay1';
            else llmDecision = 'tie';
        }

        if (!llmDecision) continue;

        if (!deltaStats[delta]) {
            deltaStats[delta] = { total: 0, correct: 0, incorrect: 0 };
        }

        deltaStats[delta].total++;

        // Compare LLM decision with ground truth
        if (llmDecision === gtWinner) {
            deltaStats[delta].correct += 1;
        } else if (llmDecision === 'tie') {
            // Ties count as 0.5 correct and 0.5 incorrect
            deltaStats[delta].correct += 0.5;
            deltaStats[delta].incorrect += 0.5;
        } else {
            deltaStats[delta].incorrect += 1;
        }
    }

    return deltaStats;
}

// Calculate overall pre-aggregation accuracy (for summary display)
function calculatePreAggregationAccuracy(comparisons, groundTruth, feedbackData) {
    const deltaStats = calculatePreAggregationAccuracyByDelta(comparisons, groundTruth, feedbackData);

    let totalCorrect = 0;
    let totalIncorrect = 0;
    let totalPairs = 0;

    for (const stats of Object.values(deltaStats)) {
        totalPairs += stats.total;
        totalCorrect += stats.correct;
        totalIncorrect += stats.incorrect;
    }

    const accuracy = totalPairs > 0 ? (totalCorrect / totalPairs * 100) : 0;

    return {
        accuracy,
        totalPairs,
        correctPairs: totalCorrect,
        incorrectPairs: totalIncorrect
    };
}

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

// Calculate accuracy by delta from rankings (not comparisons)
// This ensures delta counts don't change with perturbations
function calculateAccuracyByDeltaFromRankings(rankings, groundTruth, feedbackData) {
    const deltaStats = {};

    // Find all pairs with different ground truth grades
    for (let i = 0; i < rankings.length; i++) {
        for (let j = i + 1; j < rankings.length; j++) {
            const essay1 = rankings[i];
            const essay2 = rankings[j];

            const grade1 = groundTruth[essay1.id];
            const grade2 = groundTruth[essay2.id];

            if (grade1 == null || grade2 == null) continue;

            const delta = Math.abs(grade1 - grade2);

            // Determine ground truth winner
            let groundTruthWinner = null;
            if (grade1 > grade2) {
                groundTruthWinner = essay1.id;
            } else if (grade2 > grade1) {
                groundTruthWinner = essay2.id;
            } else {
                // Tiebreak by subcriteria count when grades are equal
                const feedback1 = feedbackData[essay1.id];
                const feedback2 = feedbackData[essay2.id];

                if (feedback1 && feedback2 && feedback1.subcriteria && feedback2.subcriteria) {
                    const count1 = feedback1.subcriteria.filter(sc => sc.correct === 'yes').length;
                    const count2 = feedback2.subcriteria.filter(sc => sc.correct === 'yes').length;

                    if (count1 > count2) {
                        groundTruthWinner = essay1.id;
                    } else if (count2 > count1) {
                        groundTruthWinner = essay2.id;
                    }
                }
            }

            // Skip if no clear winner (same grade and same subcriteria count)
            if (!groundTruthWinner) continue;

            if (!deltaStats[delta]) {
                deltaStats[delta] = { total: 0, correct: 0, incorrect: 0 };
            }

            // Determine predicted winner from ranking
            const predictedWinner = essay1.rank < essay2.rank ? essay1.id :
                                   essay1.rank > essay2.rank ? essay2.id : null;

            // Count the prediction
            deltaStats[delta].total++;
            if (predictedWinner === groundTruthWinner) {
                deltaStats[delta].correct++;
            } else {
                deltaStats[delta].incorrect++;
            }
        }
    }

    return deltaStats;
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

        const grade1 = groundTruth[comp.essay1_id];
        const grade2 = groundTruth[comp.essay2_id];

        // Skip if no ground truth or if this pair is contradictory
        if (grade1 == null || grade2 == null || contradictSet.has(pairKey)) continue;

        const delta = Math.abs(grade1 - grade2);

        if (!deltaStats[delta]) {
            deltaStats[delta] = { total: 0, correct: 0, incorrect: 0 };
        }

        // Determine ground truth winner
        let groundTruthWinner = null;
        if (grade1 > grade2) {
            groundTruthWinner = comp.essay1_id;
        } else if (grade2 > grade1) {
            groundTruthWinner = comp.essay2_id;
        } else {
            // Tiebreak by subcriteria count when grades are equal
            const feedback1 = feedbackData[comp.essay1_id];
            const feedback2 = feedbackData[comp.essay2_id];

            if (feedback1 && feedback2 && feedback1.subcriteria && feedback2.subcriteria) {
                const count1 = feedback1.subcriteria.filter(sc => sc.correct === 'yes').length;
                const count2 = feedback2.subcriteria.filter(sc => sc.correct === 'yes').length;

                if (count1 > count2) {
                    groundTruthWinner = comp.essay1_id;
                } else if (count2 > count1) {
                    groundTruthWinner = comp.essay2_id;
                }
                // If still tied, groundTruthWinner remains null
            }
        }

        // Check forward comparison
        const forward = compMap[`${comp.essay1_id}-${comp.essay2_id}`];
        const reverse = compMap[`${comp.essay2_id}-${comp.essay1_id}`];

        let predictedWinner = null;
        if (forward && reverse) {
            // We have both directions - check if they agree
            let forwardWinner = null;
            if (forward.decision === 'essay1') forwardWinner = comp.essay1_id;
            else if (forward.decision === 'essay2') forwardWinner = comp.essay2_id;

            let reverseWinner = null;
            if (reverse.decision === 'essay1') reverseWinner = comp.essay2_id;
            else if (reverse.decision === 'essay2') reverseWinner = comp.essay1_id;

            // Only count if both directions agree
            if (forwardWinner === reverseWinner) {
                predictedWinner = forwardWinner;
            }
        }

        if (predictedWinner && groundTruthWinner) {
            deltaStats[delta].total++;
            if (predictedWinner === groundTruthWinner) {
                deltaStats[delta].correct++;
            } else {
                deltaStats[delta].incorrect++;
            }
        }
    }

    return deltaStats;
}

// Find inaccurate predictions
function findInaccuratePredictions(comps, groundTruth, contradictions, feedbackData) {
    const compMap = {};
    for (const comp of comps) {
        const key = `${comp.essay1_id}-${comp.essay2_id}`;
        compMap[key] = comp;
    }

    // Build set of contradictory pairs
    const contradictSet = new Set();
    for (const c of contradictions) {
        const pairKey = [c.essay1, c.essay2].sort().join('-');
        contradictSet.add(pairKey);
    }

    const inaccurate = [];
    const seen = new Set();

    for (const comp of comps) {
        const pairKey = [comp.essay1_id, comp.essay2_id].sort().join('-');
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);

        // Skip contradictory pairs
        if (contradictSet.has(pairKey)) continue;

        const grade1 = groundTruth[comp.essay1_id];
        const grade2 = groundTruth[comp.essay2_id];

        if (grade1 == null || grade2 == null || grade1 === grade2) continue;

        const groundTruthWinner = grade1 > grade2 ? comp.essay1_id : comp.essay2_id;

        // Check if both directions exist and agree
        const forward = compMap[`${comp.essay1_id}-${comp.essay2_id}`];
        const reverse = compMap[`${comp.essay2_id}-${comp.essay1_id}`];

        if (forward && reverse) {
            let forwardWinner = null;
            if (forward.decision === 'essay1') forwardWinner = comp.essay1_id;
            else if (forward.decision === 'essay2') forwardWinner = comp.essay2_id;

            let reverseWinner = null;
            if (reverse.decision === 'essay1') reverseWinner = comp.essay2_id;
            else if (reverse.decision === 'essay2') reverseWinner = comp.essay1_id;

            // Check if self-consistent but wrong
            if (forwardWinner === reverseWinner && forwardWinner !== groundTruthWinner) {
                inaccurate.push({
                    essay1: comp.essay1_id,
                    essay2: comp.essay2_id,
                    grade1,
                    grade2,
                    predictedWinner: forwardWinner,
                    groundTruthWinner,
                    forward,
                    reverse
                });
            }
        }
    }

    return inaccurate;
}
