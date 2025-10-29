// Ranking aggregation methods

// Aggregation Method 1: Net Wins (wins - losses)
function aggregateNetWins(comps) {
    const compMap = {};
    for (const comp of comps) {
        const id1 = comp.essay1_id;
        const id2 = comp.essay2_id;

        if (!compMap[id1]) compMap[id1] = { wins: 0, losses: 0, ties: 0 };
        if (!compMap[id2]) compMap[id2] = { wins: 0, losses: 0, ties: 0 };

        if (comp.decision === 'essay1') {
            compMap[id1].wins++;
            compMap[id2].losses++;
        } else if (comp.decision === 'essay2') {
            compMap[id2].wins++;
            compMap[id1].losses++;
        } else {
            compMap[id1].ties++;
            compMap[id2].ties++;
        }
    }

    const rankings = Object.entries(compMap).map(([id, stats]) => ({
        id,
        netWins: stats.wins - stats.losses,
        wins: stats.wins,
        losses: stats.losses,
        ties: stats.ties,
        groundTruth: null
    }));

    rankings.sort((a, b) => b.netWins - a.netWins || b.wins - a.wins);

    for (let i = 0; i < rankings.length; i++) {
        rankings[i].rank = i + 1;
    }

    return rankings;
}

// Aggregation Method 2: Feedback Arc Set (minimize contradictions)
function aggregateFeedbackArc(comps) {
    console.log('Starting FAS aggregation...');

    // Build directed graph from comparisons
    const graph = {};
    const essays = new Set();

    for (const comp of comps) {
        essays.add(comp.essay1_id);
        essays.add(comp.essay2_id);

        if (!graph[comp.essay1_id]) graph[comp.essay1_id] = {};
        if (!graph[comp.essay2_id]) graph[comp.essay2_id] = {};

        // Add directed edge based on decision
        if (comp.decision === 'essay1') {
            graph[comp.essay1_id][comp.essay2_id] = (graph[comp.essay1_id][comp.essay2_id] || 0) + 1;
        } else if (comp.decision === 'essay2') {
            graph[comp.essay2_id][comp.essay1_id] = (graph[comp.essay2_id][comp.essay1_id] || 0) + 1;
        }
    }

    // Start with net wins ordering
    const netWinsRanking = aggregateNetWins(comps);
    let currentOrdering = netWinsRanking.map(r => r.id);

    console.log(`Initial FAS (from net wins): ${calculateFASScore(currentOrdering, graph)}`);

    // Iteratively improve ordering to minimize feedback arc set
    let improved = true;
    let iterations = 0;
    const maxIterations = 100;

    while (improved && iterations < maxIterations) {
        improved = false;
        iterations++;

        // Try swapping adjacent pairs
        for (let i = 0; i < currentOrdering.length - 1; i++) {
            const newOrdering = [...currentOrdering];
            [newOrdering[i], newOrdering[i + 1]] = [newOrdering[i + 1], newOrdering[i]];

            const currentScore = calculateFASScore(currentOrdering, graph);
            const newScore = calculateFASScore(newOrdering, graph);

            if (newScore < currentScore) {
                currentOrdering = newOrdering;
                improved = true;
            }
        }
    }

    console.log(`Final FAS after ${iterations} iterations: ${calculateFASScore(currentOrdering, graph)}`);

    // Convert ordering to rankings
    const rankings = currentOrdering.map((id, index) => {
        const stats = netWinsRanking.find(r => r.id === id) || { wins: 0, losses: 0, ties: 0, netWins: 0 };
        return {
            id,
            rank: index + 1,
            wins: stats.wins,
            losses: stats.losses,
            ties: stats.ties,
            netWins: stats.netWins,
            fasEdges: 0, // Will be calculated below
            groundTruth: null
        };
    });

    // Calculate FAS edges for each essay
    for (let i = 0; i < rankings.length; i++) {
        const essay = rankings[i].id;
        let fasEdges = 0;

        // Count edges pointing backwards in the ordering
        for (let j = i + 1; j < rankings.length; j++) {
            const other = rankings[j].id;
            if (graph[other] && graph[other][essay]) {
                fasEdges += graph[other][essay];
            }
        }

        rankings[i].fasEdges = fasEdges;
    }

    return rankings;
}

function calculateFASScore(ordering, graph) {
    let score = 0;
    const position = {};

    for (let i = 0; i < ordering.length; i++) {
        position[ordering[i]] = i;
    }

    for (const from in graph) {
        for (const to in graph[from]) {
            const weight = graph[from][to];
            if (position[from] > position[to]) {
                score += weight;
            }
        }
    }

    return score;
}
