# Comparison Benchmark Visualizer

Interactive dashboard for analyzing pairwise essay comparison results.

## Prerequisites

A static file server running on port 5500 serving the project root directory.

## Features

### Run Selection
- Auto-loads all available runs from `runs/` directory
- Shows run ID and timestamp
- Handles incomplete runs gracefully

### Ranking Aggregation Methods

#### 1. Win/Loss Count (Default)
- Simple win counting: +1 for each win, +0.5 for ties
- Sorts essays by total wins descending
- Fast and intuitive

#### 2. Feedback Arc Set
- Calculates net wins (wins - losses) for each essay
- Minimizes contradictory edges in the comparison graph
- Better handles cyclic preferences (A > B > C > A)

### Metrics Displayed

**Ranking Accuracy**
- Primary metric: % of essay pairs with different grades correctly ranked
- Compares aggregated ranking vs ground truth Criterion B grades
- Shows correct/incorrect pair counts

**Run Status**
- Completion status (complete or in progress)
- Progress (completed pairs / total pairs)
- Failed pair count

**Comparison Statistics**
- Total comparisons loaded
- Essay A wins, Essay B wins, Ties
- Decision distribution

**Model Performance**
- Total API calls made
- Average latency per comparison
- Total processing time

### Visualizations

**Predicted vs Ground Truth Ranking**
- Scatter plot: X-axis = ground truth grade, Y-axis = predicted rank
- Lower predicted rank = better essay
- Ideal: clear correlation between grade and rank

**Essay Score Distribution**
- Bar chart showing count of essays by ground truth grade
- Helps understand dataset composition

**Detailed Rankings Table**
- Complete essay ranking list
- Shows: rank, essay ID, score, ground truth grade
- Color-coded accuracy badges

**Contradictions Analysis**
- Lists contradictory comparisons (A > B and B > A)
- Helps identify model inconsistencies
- Shows up to 10 examples

## Usage

1. Ensure static server is running on port 5500
2. Open `http://localhost:5500/vis/` in browser
3. Select a run from dropdown
4. Choose ranking aggregation method
5. Click "Analyze Run"
6. Explore metrics, charts, and detailed rankings

## Robustness

- Handles incomplete runs (only loads completed comparisons)
- Graceful error handling for missing files
- Shows loading states during data fetch
- Responsive design for different screen sizes

## API Endpoints Used

- `GET /runs/` - List all run directories
- `GET /runs/{run_id}/state.json` - Run metadata and progress
- `GET /runs/{run_id}/config.yaml` - Run configuration
- `GET /runs/{run_id}/` - List comparison files
- `GET /runs/{run_id}/{essay1_id}-{essay2_id}.json` - Individual comparisons
- `GET /alssummary/data_splits/{test_set}_ids.json` - Ground truth grades

All requests use `Accept: application/json` header.
