// Perturbation functions for robustness testing

// Step 0: Remove symmetric contradictions (automatic preprocessing)
// Removes pairs where A>B and B>A gave different winners
function removeSymmetricContradictions(comps) {
    const pairMap = new Map();

    // Build map of forward comparisons
    for (const comp of comps) {
        const key1 = `${comp.essay1_id}_${comp.essay2_id}`;
        pairMap.set(key1, comp);
    }

    // Check for contradictions and mark for removal
    const toRemove = new Set();
    for (const comp of comps) {
        const key1 = `${comp.essay1_id}_${comp.essay2_id}`;
        const key2 = `${comp.essay2_id}_${comp.essay1_id}`;

        if (pairMap.has(key2) && !toRemove.has(key1) && !toRemove.has(key2)) {
            const forward = pairMap.get(key1);
            const backward = pairMap.get(key2);

            // Check if they contradict each other
            const forwardWinner = forward.decision === 'essay1' ? forward.essay1_id :
                                 forward.decision === 'essay2' ? forward.essay2_id : null;
            const backwardWinner = backward.decision === 'essay1' ? backward.essay1_id :
                                  backward.decision === 'essay2' ? backward.essay2_id : null;

            // If both picked winners and they're different, mark as contradiction
            if (forwardWinner && backwardWinner && forwardWinner !== backwardWinner) {
                toRemove.add(key1);
                toRemove.add(key2);
            }
        }
    }

    const result = comps.filter(comp => {
        const key = `${comp.essay1_id}_${comp.essay2_id}`;
        return !toRemove.has(key);
    });

    const removedCount = comps.length - result.length;
    if (removedCount > 0) {
        console.log(`Removed ${removedCount} contradictory comparisons (${(removedCount/2).toFixed(0)} symmetric pairs)`);
    }

    return result;
}

// Step 3: Random edge cutting
// Randomly remove x% of comparison edges
function cutEdges(comps, cutProbability) {
    if (cutProbability === 0) return comps;

    const result = comps.filter(() => Math.random() * 100 >= cutProbability);
    const cutCount = comps.length - result.length;
    const actualCutRate = (cutCount/comps.length*100).toFixed(1);

    console.log(`Edge cutting: ${cutProbability}% requested, ${cutCount}/${comps.length} (${actualCutRate}%) edges removed`);

    return result;
}

// Step 4: Apply random perturbation to comparison decisions
function perturbComparisons(comps, flipProbability) {
    if (flipProbability === 0) return comps;

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

    return result;
}

// Step 2: Generate problem nodes with random comparison outcomes
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
