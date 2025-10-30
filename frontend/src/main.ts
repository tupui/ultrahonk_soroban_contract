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
  }
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
// Circuit Input Form Management
// ============================================================================

/**
 * Loads circuit metadata and dynamically generates input fields
 *
 * This function:
 * - Fetches circuit ABI from the circuit JSON file
 * - Clears existing input fields
 * - Creates appropriate input controls (text inputs for scalars, textareas for arrays)
 * - Populates fields with default values from CIRCUIT_DEFAULTS
 */
async function loadCircuitInputs() {
  const circuitName = circuitSelect.value;

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
// Proof Generation
// ============================================================================

/**
 * Generates a proof for the selected circuit with user-provided inputs
 *
 * This function:
 * 1. Collects and validates inputs from the form
 * 2. Converts string inputs to appropriate types (integers, arrays, etc.)
 * 3. Calls NoirService to generate the proof
 * 4. Submits the proof to Stellar for on-chain verification
 * 5. Displays results including proof ID, size, fees, and CPU usage
 */
async function generateProof() {
  const circuitName = circuitSelect.value;

  // Collect inputs
  const inputs: Record<string,any> = {};
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
