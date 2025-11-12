/**
 * UltraHonk Proof Generator - Main Application
 *
 * This is the entry point for the browser-based proof generation UI.
 * It provides an interface for:
 * - Selecting from multiple Noir circuits
 * - Entering circuit inputs with auto-populated defaults
 * - Generating UltraHonk proofs client-side
 * - Submitting proofs to Stellar for on-chain verification
 * - Viewing verification results including fees and CPU usage
 */

import { NoirService } from './NoirService';
import { generateRandomSudoku } from './sudokuGenerator';

const noirService = new NoirService();

// ============================================================================
// Circuit Configuration
// ============================================================================

/** Default input values for each circuit to simplify testing */
const CIRCUIT_DEFAULTS: Record<string,Record<string,string>> = {
  simple_circuit: {
    x: '1',
    y: '2'
  },
  fib_chain: {
    a0: '10',
    a1: '10',
    out: '1440'
  },
  zkp_maze: {
    moves: '[1,1,1,1,1,1,1,1,2,2,1,1,2,2,1,1,0,0,0,0,1,1,1,1,1,1,1,1,2,2,2,2,1,1,1,1,0,0,1,1,2,2,2,2,1,1,2,2,2,2,3,3,2,2,1,1,2,2,1,1,0,0,0,0,1,1,0,0,3,3,0,0,0,0,3,3,0,0,0,0,1,1,1,1,2,2,2,2,1,1,2,2,2,2,1,1,2,2,1,1,2,2,3,3,3,3,2,2,3,3,2,2,3,3,3,3,3,3,2,2,3,3,2,2,3,3,0,0,3,3,0,0,3,3,2,2,3,3,3,3,0,0,3,3,0,0,3,3,3,3,3,3,2,2,3,3,3,3,2,2,1,1,1,1,2,2,1,1,0,0,1,1,1,1,2,2,3,3,2,2,2,2,1,1,2,2,3,3,2,2,2,2,3,3,0,0,0,0,3,3,3,3,3,3,2,2,1,1,1,1,2,2,2,2,3,3,0,0,3,3,2,2,3,3,2,2,2,2,1,1,1,1,2,2,1,1,0,0,0,0,1,1,2,2,1,1,0,0,0,0,1,1,0,0,1,1,2,2,1,1,1,1,1,1,2,2,2,2,1,1,2,2,1,1,0,0,0,0,1,1,1,1,1,1,2,2,1,1,1,1,0,0,1,1,2,2,1,1,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]',
    maze_seed: '3618934397'
  },
  sudoku: {
    puzzle: '[5,3,0,0,7,0,0,0,0,6,0,0,1,9,5,0,0,0,0,9,8,0,0,0,0,6,0,8,0,0,0,6,0,0,0,3,4,0,0,8,0,3,0,0,1,7,0,0,0,2,0,0,0,6,0,6,0,0,0,0,2,8,0,0,0,0,4,1,9,0,0,5,0,0,0,0,8,0,0,7,9]',
    solution: '[5,3,4,6,7,8,9,1,2,6,7,2,1,9,5,3,4,8,1,9,8,3,4,2,5,6,7,8,5,9,7,6,1,4,2,3,4,2,6,8,5,3,7,9,1,7,1,3,9,2,4,8,5,6,9,6,1,5,3,7,2,8,4,2,8,7,4,1,9,6,3,5,3,4,5,2,8,6,1,7,9]'
  },
};

// ============================================================================
// DOM Elements
// ============================================================================

const circuitSelect = document.getElementById('circuit') as HTMLSelectElement;
const inputsDiv = document.getElementById('inputs') as HTMLDivElement;
const generateBtn = document.getElementById('generate') as HTMLButtonElement;
const outputDiv = document.getElementById('output') as HTMLDivElement;

/** Stores circuit parameter metadata for input validation and type conversion */
let currentCircuitParams: any[] = [];

// ============================================================================
// Sudoku Grid State
// ============================================================================

/** Sudoku grid cells (only used when circuit is "sudoku") */
let sudokuGridCells: HTMLInputElement[] = [];
/** Set of indices that are given/locked in the puzzle */
let sudokuGivenIndices = new Set<number>();
/** Current difficulty setting (number of givens) */
let sudokuDifficulty = 30;

// ============================================================================
// Circuit Input Form Management
// ============================================================================

/**
 * Loads circuit metadata and dynamically generates input fields
 *
 * This function:
 * - Fetches circuit ABI from the circuit JSON file
 * - Clears existing input fields
 * - Creates appropriate input controls (text inputs for scalars, textareas for arrays)
 * - For Sudoku circuit: creates interactive grid UI
 * - Populates fields with default values from CIRCUIT_DEFAULTS
 */
async function loadCircuitInputs() {
  const circuitName = circuitSelect.value;

  // Special handling for Sudoku circuit
  if (circuitName === 'sudoku') {
    await loadSudokuUI();
    return;
  }

  // Standard handling for all other circuits
  try {
    const metadata = await noirService.getCircuitMetadata(circuitName);

    // Clear existing inputs
    inputsDiv.innerHTML = '';

    // Store parameter metadata for use during proof generation
    currentCircuitParams = metadata.parameters;

    // Get default values for this circuit
    const defaults = CIRCUIT_DEFAULTS[circuitName] || {};

    // Create input fields based on circuit parameters
    metadata.parameters.forEach((param: any) => {
      const formGroup = document.createElement('div');
      formGroup.className = 'form-group';

      const label = document.createElement('label');
      label.textContent = `${param.name} (${param.type}):`;

      // Get default value for this parameter
      const defaultValue = defaults[param.name] || '';

      if (param.type === 'array') {
        // Use textarea for arrays
        const textarea = document.createElement('textarea');
        textarea.id = param.name;
        textarea.rows = 4;
        textarea.placeholder = 'Enter array values,e.g.,[1,2,3] or comma-separated: 1,2,3';
        textarea.value = defaultValue;
        formGroup.appendChild(label);
        formGroup.appendChild(textarea);
      } else {
        // Use regular input for other types
        const input = document.createElement('input');
        input.type = 'text';
        input.id = param.name;
        input.placeholder = `Enter ${param.name}`;
        input.value = defaultValue;
        formGroup.appendChild(label);
        formGroup.appendChild(input);
      }

      inputsDiv.appendChild(formGroup);
    });
  } catch (error) {
    console.error('Error loading circuit metadata:',error);
    outputDiv.textContent = `Error: ${error}`;
  }
}

// ============================================================================
// Sudoku UI Functions
// ============================================================================

/**
 * Loads the Sudoku UI with grid and control buttons
 */
async function loadSudokuUI() {
  try {
    // Get circuit metadata (still needed for parameter info)
    const metadata = await noirService.getCircuitMetadata('sudoku');
    currentCircuitParams = metadata.parameters;

    // Clear existing inputs
    inputsDiv.innerHTML = '';

    // Create difficulty slider container
    const difficultyContainer = document.createElement('div');
    difficultyContainer.className = 'sudoku-difficulty';
    
    const difficultyLabel = document.createElement('label');
    difficultyLabel.textContent = 'Pre-filled numbers: ';
    difficultyLabel.setAttribute('for', 'difficulty-slider');
    
    const difficultySlider = document.createElement('input');
    difficultySlider.type = 'range';
    difficultySlider.id = 'difficulty-slider';
    difficultySlider.min = '17';
    difficultySlider.max = '60';
    difficultySlider.value = sudokuDifficulty.toString();
    difficultySlider.step = '1';
    
    const difficultyValue = document.createElement('span');
    difficultyValue.id = 'difficulty-value';
    difficultyValue.textContent = sudokuDifficulty.toString();
    difficultyValue.className = 'difficulty-value';
    
    difficultySlider.addEventListener('input', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      sudokuDifficulty = value;
      difficultyValue.textContent = value.toString();
      // Automatically generate a new grid when slider is adjusted
      generateRandomGame();
    });
    
    difficultyContainer.appendChild(difficultyLabel);
    difficultyContainer.appendChild(difficultySlider);
    difficultyContainer.appendChild(difficultyValue);

    // Create control buttons container
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'sudoku-controls';

    const generateRandomBtn = document.createElement('button');
    generateRandomBtn.id = 'generate-random';
    generateRandomBtn.textContent = 'Generate Random';
    generateRandomBtn.addEventListener('click', generateRandomGame);

    const loadExampleBtn = document.createElement('button');
    loadExampleBtn.id = 'load-example';
    loadExampleBtn.textContent = 'Load Example';
    loadExampleBtn.addEventListener('click', loadExample);

    const resetPuzzleBtn = document.createElement('button');
    resetPuzzleBtn.id = 'reset-puzzle';
    resetPuzzleBtn.textContent = 'Reset Puzzle';
    resetPuzzleBtn.addEventListener('click', resetPuzzle);

    const validateGridBtn = document.createElement('button');
    validateGridBtn.id = 'validate-grid';
    validateGridBtn.textContent = 'Validate Grid';
    validateGridBtn.addEventListener('click', validateSudokuGrid);

    controlsDiv.appendChild(generateRandomBtn);
    controlsDiv.appendChild(loadExampleBtn);
    controlsDiv.appendChild(resetPuzzleBtn);
    controlsDiv.appendChild(validateGridBtn);

    // Create container for grid
    const containerDiv = document.createElement('div');
    containerDiv.className = 'sudoku-container';

    const gridDiv = document.createElement('div');
    gridDiv.id = 'sudoku-grid';

    containerDiv.appendChild(gridDiv);

    inputsDiv.appendChild(difficultyContainer);
    inputsDiv.appendChild(controlsDiv);
    inputsDiv.appendChild(containerDiv);

    // Initialize the grid
    initSudokuGrid();

    // Load example by default
    loadExample();
  } catch (error) {
    console.error('Error loading Sudoku UI:', error);
    outputDiv.textContent = `Error: ${error}`;
  }
}

/**
 * Initializes the Sudoku grid with 81 input cells
 */
function initSudokuGrid() {
  const sudokuGrid = document.getElementById('sudoku-grid') as HTMLDivElement;
  if (!sudokuGrid) return;

  sudokuGrid.innerHTML = '';
  sudokuGridCells.length = 0;
  sudokuGivenIndices.clear();

  for (let i = 0; i < 81; i++) {
    const cell = document.createElement('input');
    cell.type = 'text';
    cell.className = 'sudoku-cell';
    cell.maxLength = 1;
    cell.value = '';
    
    cell.addEventListener('input', (e) => {
      const input = e.target as HTMLInputElement;
      const index = sudokuGridCells.indexOf(input);
      
      if (sudokuGivenIndices.has(index)) {
        input.value = '';
        return;
      }
      
      // Only allow digits 1-9
      input.value = input.value.replace(/[^1-9]/g, '');
      if (input.value.length > 1) {
        input.value = input.value.slice(-1);
      }
    });

    cell.addEventListener('keydown', (e) => {
      const index = sudokuGridCells.indexOf(e.target as HTMLInputElement);
      
      if (sudokuGivenIndices.has(index) && (e.key === 'Backspace' || e.key === 'Delete')) {
        e.preventDefault();
        return;
      }
      
      let newIndex = index;

      switch (e.key) {
        case 'ArrowUp':
          newIndex = index - 9;
          e.preventDefault();
          break;
        case 'ArrowDown':
          newIndex = index + 9;
          e.preventDefault();
          break;
        case 'ArrowLeft':
          newIndex = index - 1;
          e.preventDefault();
          break;
        case 'ArrowRight':
          newIndex = index + 1;
          e.preventDefault();
          break;
      }

      if (newIndex >= 0 && newIndex < 81) {
        sudokuGridCells[newIndex]?.focus();
      }
    });

    sudokuGridCells.push(cell);
    sudokuGrid.appendChild(cell);
  }
}

/**
 * Sets given cells from a puzzle array (marks them as locked)
 */
function setGivenCells(puzzle: number[]) {
  sudokuGivenIndices.clear();
  
  puzzle.forEach((value, index) => {
    if (value > 0) {
      sudokuGivenIndices.add(index);
      const cell = sudokuGridCells[index];
      if (cell) {
        cell.value = value.toString();
        cell.classList.add('locked');
        cell.readOnly = true;
      }
    }
  });
}

/**
 * Validates the Sudoku grid (only when grid is completely filled)
 */
function validateSudokuGrid() {
  // Clear previous validation
  sudokuGridCells.forEach((cell) => {
    cell.classList.remove('error', 'valid');
  });

  const values = sudokuGridCells.map((cell) => parseInt(cell.value) || 0);

  // Check if grid is full
  const emptyCells = values.filter(v => v === 0).length;
  if (emptyCells > 0) {
    outputDiv.textContent = `Grid is not complete! ${emptyCells} empty cells remaining. Please fill all cells before validating.`;
    return;
  }

  let hasErrors = false;
  const errorIndices = new Set<number>();

  // Check rows
  for (let row = 0; row < 9; row++) {
    const rowValues: Map<number, number[]> = new Map();
    for (let col = 0; col < 9; col++) {
      const index = row * 9 + col;
      const value = values[index];
      if (value !== undefined && value > 0) {
        if (!rowValues.has(value)) {
          rowValues.set(value, []);
        }
        const indices = rowValues.get(value);
        if (indices) {
          indices.push(index);
        }
      }
    }
    rowValues.forEach((indices) => {
      if (indices.length > 1) {
        indices.forEach((idx) => errorIndices.add(idx));
        hasErrors = true;
      }
    });
  }

  // Check columns
  for (let col = 0; col < 9; col++) {
    const colValues: Map<number, number[]> = new Map();
    for (let row = 0; row < 9; row++) {
      const index = row * 9 + col;
      const value = values[index];
      if (value !== undefined && value > 0) {
        if (!colValues.has(value)) {
          colValues.set(value, []);
        }
        const indices = colValues.get(value);
        if (indices) {
          indices.push(index);
        }
      }
    }
    colValues.forEach((indices) => {
      if (indices.length > 1) {
        indices.forEach((idx) => errorIndices.add(idx));
        hasErrors = true;
      }
    });
  }

  // Check 3x3 boxes
  for (let boxRow = 0; boxRow < 3; boxRow++) {
    for (let boxCol = 0; boxCol < 3; boxCol++) {
      const boxValues: Map<number, number[]> = new Map();
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const row = boxRow * 3 + i;
          const col = boxCol * 3 + j;
          const index = row * 9 + col;
          const value = values[index];
          if (value !== undefined && value > 0) {
            if (!boxValues.has(value)) {
              boxValues.set(value, []);
            }
            const indices = boxValues.get(value);
            if (indices) {
              indices.push(index);
            }
          }
        }
      }
      boxValues.forEach((indices) => {
        if (indices.length > 1) {
          indices.forEach((idx) => errorIndices.add(idx));
          hasErrors = true;
        }
      });
    }
  }

  // Apply visual feedback
  errorIndices.forEach((idx) => {
    const cell = sudokuGridCells[idx];
    if (cell) {
      cell.classList.add('error');
    }
  });

  if (!hasErrors) {
    sudokuGridCells.forEach((cell, idx) => {
      const value = values[idx];
      if (value !== undefined && value > 0 && cell) {
        cell.classList.add('valid');
      }
    });
    outputDiv.textContent = '✓ Validation passed! No duplicates found.';
  } else {
    outputDiv.textContent = '❌ Validation failed: Found duplicates in rows, columns, or 3x3 boxes.';
  }
}

/**
 * Collects puzzle and solution data from the grid
 */
function collectSudokuGridData(): { puzzle: number[], solution: number[] } {
  const solution = sudokuGridCells.map((cell) => {
    const value = parseInt(cell.value) || 0;
    return value;
  });

  const puzzle = sudokuGridCells.map((cell, index) => {
    if (sudokuGivenIndices.has(index)) {
      return parseInt(cell.value) || 0;
    }
    return 0;
  });

  return { puzzle, solution };
}

/**
 * Generates a random Sudoku game
 */
function generateRandomGame() {
  clearSudokuGrid();
  
  outputDiv.textContent = 'Generating random Sudoku...';
  
  // Generate a random puzzle with the current difficulty setting
  const { puzzle, solution } = generateRandomSudoku(sudokuDifficulty);
  
  setGivenCells(puzzle);
  
  outputDiv.textContent = `✓ Random game generated with ${puzzle.filter(v => v > 0).length} givens. Fill in the empty cells to complete the puzzle.`;
}

/**
 * Loads the example puzzle from CIRCUIT_DEFAULTS
 */
function loadExample() {
  clearSudokuGrid();
  
  const defaults = CIRCUIT_DEFAULTS['sudoku'] || {};
  const puzzleStr = defaults.puzzle || '';
  const solutionStr = defaults.solution || '';

  try {
    const puzzle = JSON.parse(puzzleStr);
    const solution = JSON.parse(solutionStr);
    
    setGivenCells(puzzle);
    
    // Fill in the complete solution (given cells are already set and locked)
    solution.forEach((value: number, index: number) => {
      const cell = sudokuGridCells[index];
      if (cell) {
        cell.value = value.toString();
      }
    });
    
    outputDiv.textContent = '✓ Example sudoku loaded. Base grid numbers are locked.';
  } catch (error) {
    console.error('Error loading example:', error);
    outputDiv.textContent = 'Error loading example puzzle.';
  }
}

/**
 * Resets the puzzle to its initial state (keeps pre-filled numbers, clears user entries)
 */
function resetPuzzle() {
  sudokuGridCells.forEach((cell, index) => {
    // Only clear cells that are not locked (user-filled cells)
    if (!sudokuGivenIndices.has(index)) {
      cell.value = '';
      cell.classList.remove('error', 'valid');
    } else {
      // Remove validation styling from locked cells too
      cell.classList.remove('error', 'valid');
    }
  });
  outputDiv.textContent = '';
}

/**
 * Clears the entire Sudoku grid (used internally)
 */
function clearSudokuGrid() {
  sudokuGridCells.forEach((cell, index) => {
    cell.value = '';
    cell.classList.remove('locked', 'error', 'valid');
    cell.readOnly = false;
  });
  sudokuGivenIndices.clear();
  outputDiv.textContent = '';
}

// ============================================================================
// Proof Generation
// ============================================================================

/**
 * Generates a proof for the selected circuit with user-provided inputs
 *
 * This function:
 * 1. Collects and validates inputs from the form (or Sudoku grid for sudoku circuit)
 * 2. Converts string inputs to appropriate types (integers, arrays, etc.)
 * 3. Calls NoirService to generate the proof
 * 4. Submits the proof to Stellar for on-chain verification
 * 5. Displays results including proof ID, size, fees, and CPU usage
 */
async function generateProof() {
  const circuitName = circuitSelect.value;

  // Collect inputs
  const inputs: Record<string,any> = {};

  // Special handling for Sudoku circuit
  if (circuitName === 'sudoku') {
    const { puzzle, solution } = collectSudokuGridData();

    // Validate that solution is complete
    const emptyCells = solution.filter((v) => v === 0).length;
    if (emptyCells > 0) {
      alert(`Solution is incomplete! ${emptyCells} empty cells remaining.`);
      return;
    }

    // Validate that all values are 1-9
    const invalidSolution = solution.some((v) => v < 1 || v > 9);
    if (invalidSolution) {
      alert('Solution contains invalid values! All cells must be 1-9.');
      return;
    }

    inputs.puzzle = puzzle;
    inputs.solution = solution;
  } else {
    // Standard handling for all other circuits
    const inputElements = inputsDiv.querySelectorAll('input,textarea');

    inputElements.forEach((element: any) => {
      const value = element.value.trim();
      const name = element.id;

      // Find the parameter metadata for this input
      const paramMeta = currentCircuitParams.find((p: any) => p.name === name);

      if (element.tagName === 'TEXTAREA') {
        // Parse array input
        try {
          if (value.startsWith('[')) {
            inputs[name] = JSON.parse(value);
          } else {
            // Assume comma-separated values
            inputs[name] = value.split(',').map((v: string) => v.trim());
          }
        } catch (error) {
          alert(`Invalid array format for ${name}`);
          throw error;
        }
      } else {
        // Check if this is an integer type
        if (paramMeta && paramMeta.type === 'integer') {
          inputs[name] = parseInt(value,10);
        } else {
          inputs[name] = value;
        }
      }
    });
  }

  generateBtn.disabled = true;
  generateBtn.textContent = 'Generating...';
  outputDiv.textContent = 'Generating proof...\n';

  try {
    const result = await noirService.generateAndVerifyProof(circuitName,inputs);

    let output = `
✓ Proof generated successfully!

Proof ID: ${result.proofId}
Proof Size: ${result.proof.length} bytes
Public Inputs: ${result.publicInputs.length} bytes
VK Size: ${result.vkJson.length} bytes
Time: ${result.proofTime}s

Proof Blob (first 100 bytes):
${Array.from(result.proofBlob.slice(0,100)).map(b => b.toString(16).padStart(2,'0')).join(' ')}...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STELLAR VERIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim();

    if (result.verification.success) {
      output += `\n\n✓ Proof verified on Stellar!

Verification Status: ${result.verification.isVerified ? '✓ VERIFIED' : '✗ NOT VERIFIED'}`;

      if (result.verification.txHash) {
        output += `\nTransaction Hash: ${result.verification.txHash}`;
      }
      if (result.verification.cpuInstructions) {
        output += `\nCPU Instructions: ${result.verification.cpuInstructions.toLocaleString()}`;
      }
      if (result.verification.fee) {
        const stroops = parseInt(result.verification.fee);
        const xlm = (stroops / 10_000_000).toFixed(7);
        output += `\nFee: ${stroops.toLocaleString()} stroops (${xlm} XLM)`;
      }
    } else {
      output += `\n\n✗ Verification failed: ${result.verification.error}`;
    }

    outputDiv.textContent = output;
  } catch (error: any) {
    console.error('Proof generation/verification error:',error);
    outputDiv.textContent = `Error: ${error.message}\n\n${error.stack}`;
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = 'Generate Proof';
  }
}

// ============================================================================
// Event Listeners & Initialization
// ============================================================================

// Update input fields when circuit selection changes
circuitSelect.addEventListener('change', loadCircuitInputs);

// Generate proof when button is clicked
generateBtn.addEventListener('click', generateProof);

// Load initial circuit inputs on page load
loadCircuitInputs();
