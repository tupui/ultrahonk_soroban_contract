/**
 * NoirService - Handles Noir circuit execution and UltraHonk proof generation
 *
 * This service provides methods to:
 * - Load compiled Noir circuits
 * - Execute circuits with user inputs to generate witnesses
 * - Generate UltraHonk proofs using the bb.js backend
 * - Build proof blobs compatible with the Stellar verifier contract
 * - Optionally submit proofs to Stellar for on-chain verification
 */

import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend } from '@aztec/bb.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { StellarService } from './StellarService';

/**
 * Service for generating and verifying UltraHonk proofs from Noir circuits
 */
export class NoirService {
  private stellarService?: StellarService;

  /**
   * Creates a new NoirService instance
   *
   * @param enableStellar - Whether to enable Stellar integration for on-chain verification
   */
  constructor(enableStellar: boolean = true) {
    if (enableStellar) {
      this.stellarService = new StellarService();
    }
  }

  /**
   * Generates an UltraHonk proof for a given circuit and inputs
   *
   * The proof generation process:
   * 1. Loads the compiled circuit from /circuits/{circuitName}.json
   * 2. Executes the circuit with provided inputs to generate a witness
   * 3. Generates an UltraHonk proof using bb.js with keccak oracle hash
   * 4. Extracts public inputs from circuit parameters (not from bb.js compact format)
   * 5. Builds a proof blob: u32_be(total_fields) || public_inputs || proof
   * 6. Computes proof ID as Keccak-256 hash of the proof blob
   * 7. Loads the pre-generated verification key
   *
   * @param circuitName - Name of the circuit (e.g., 'simple_circuit', 'zkp_maze')
   * @param inputs - Circuit input values as key-value pairs
   * @returns Proof data including proof bytes, public inputs, proof blob, VK, and proof ID
   */
  async generateProof(circuitName: string, inputs: Record<string, any>) {
    console.log(`[NoirService] Starting proof generation for ${circuitName}`);

    // Load the compiled circuit
    console.log(`[1/6] Loading circuit...`);
    const response = await fetch(`/circuits/${circuitName}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load circuit: ${circuitName}`);
    }
    const circuit = await response.json();
    console.log(`[1/6] Circuit loaded`);

    // Initialize Noir with the circuit
    console.log(`[2/6] Initializing Noir...`);
    const noir = new Noir(circuit);
    console.log(`[2/6] Noir initialized`);

    // Execute the circuit to generate witness
    console.log(`[3/6] Executing circuit with inputs:`, inputs);
    const { witness } = await noir.execute(inputs);
    console.log(`[3/6] Witness generated, length:`, witness.length);

    // Debug: Check circuit public parameters
    const publicParams = circuit.abi.parameters.filter((p: any) => p.visibility === 'public');
    console.log(`[DEBUG] Circuit has ${publicParams.length} public parameter(s):`, publicParams.map((p: any) => `${p.name} (${p.type.kind})`));

    // Initialize UltraHonk backend
    console.log(`[4/6] Initializing UltraHonkBackend...`);
    const backend = new UltraHonkBackend(circuit.bytecode);
    console.log(`[4/6] Backend initialized`);

    // Generate proof (use keccak oracle hash for Stellar verification)
    console.log(`[5/6] Generating proof (this may take 30-60 seconds)...`);
    const proofStart = performance.now();
    const proof = await backend.generateProof(witness, { keccak: true });
    const proofTime = ((performance.now() - proofStart) / 1000).toFixed(2);
    console.log(`[5/6] Proof generated in ${proofTime}s`);

    // Extract proof bytes
    const proofBytes = proof.proof;

    // Build public inputs from circuit inputs (don't use bb.js compact format - it strips leading zeros)
    // Each public parameter becomes a 32-byte big-endian field element
    const publicInputFields: Uint8Array[] = [];

    if (publicParams.length > 0) {
      console.log(`[DEBUG] Building ${publicParams.length} public input(s) from circuit parameters`);

      publicParams.forEach((p: any) => {
        const inputValue = inputs[p.name];
        console.log(`[DEBUG] Public input ${p.name} = ${inputValue} (0x${inputValue.toString(16)})`);

        // Create 32-byte field element
        const field = new Uint8Array(32);

        // For integer types, encode as big-endian bytes
        if (p.type.kind === 'integer') {
          const width = p.type.width; // 8, 16, 32, 64, etc.
          const numBytes = width / 8;

          // Convert number to big-endian bytes
          let value = BigInt(inputValue);
          for (let i = 0; i < numBytes; i++) {
            field[32 - 1 - i] = Number(value & BigInt(0xff));
            value = value >> BigInt(8);
          }
        } else if (p.type.kind === 'field') {
          // Field elements are already in the right format
          // For now, assume small field values fit in a number
          let value = BigInt(inputValue);
          for (let i = 0; i < 32; i++) {
            field[32 - 1 - i] = Number(value & BigInt(0xff));
            value = value >> BigInt(8);
          }
        }

        console.log(`[DEBUG] Encoded ${p.name} as: ${Array.from(field).map(b => b.toString(16).padStart(2, '0')).join('')}`);
        publicInputFields.push(field);
      });
    }

    // Concatenate all public input fields
    const totalPublicInputBytes = publicInputFields.length * 32;
    const publicInputsBytes = new Uint8Array(totalPublicInputBytes);
    publicInputFields.forEach((field, i) => {
      publicInputsBytes.set(field, i * 32);
    });

    console.log(`[DEBUG] Total public inputs: ${publicInputsBytes.length} bytes (${publicInputFields.length} fields)`);

    // Build proof blob (u32_be total_fields || public_inputs || proof)
    const proofFieldCount = proofBytes.length / 32;
    const publicInputFieldCount = publicInputsBytes.length / 32;
    const totalFields = proofFieldCount + publicInputFieldCount;

    // Create header (4 bytes, big-endian u32)
    const header = new Uint8Array(4);
    const view = new DataView(header.buffer);
    view.setUint32(0, totalFields, false); // false = big-endian

    // Concatenate: header || publicInputs || proof
    const proofBlob = new Uint8Array(
      header.length + publicInputsBytes.length + proofBytes.length
    );
    proofBlob.set(header, 0);
    proofBlob.set(publicInputsBytes, header.length);
    proofBlob.set(proofBytes, header.length + publicInputsBytes.length);

    // Compute proof ID (Keccak-256 hash of proof blob)
    const proofIdBytes = keccak_256(proofBlob);
    const proofId = Array.from(proofIdBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Load pre-generated VK (generated with: bb write_vk --oracle_hash keccak --output_format fields)
    console.log(`[6/6] Loading verification key...`);
    const vkResponse = await fetch(`/circuits/${circuitName}_vk.json`);
    if (!vkResponse.ok) {
      throw new Error(`Failed to load VK for circuit: ${circuitName}`);
    }
    // Load VK as raw bytes (same as Python script does with read_bytes())
    const vkArrayBuffer = await vkResponse.arrayBuffer();
    const vkJson = new Uint8Array(vkArrayBuffer);

    console.log(`[6/6] Complete! Proof ID: ${proofId}`);

    return {
      proof: proofBytes,
      publicInputs: publicInputsBytes,
      proofBlob,
      vkJson,
      proofId,
      proofTime
    };
  }

  /**
   * Generates a proof and submits it to Stellar for on-chain verification
   *
   * This is a convenience method that combines generateProof() and StellarService.verifyProof()
   *
   * @param circuitName - Name of the circuit to prove
   * @param inputs - Circuit input values
   * @returns Combined proof generation and verification results
   */
  async generateAndVerifyProof(circuitName: string, inputs: Record<string, any>) {
    console.log(`[NoirService] Starting proof generation and verification for ${circuitName}`);

    // Generate proof
    const proofResult = await this.generateProof(circuitName, inputs);

    // Verify on Stellar
    if (!this.stellarService) {
      throw new Error('StellarService not initialized. Create NoirService with enableStellar=true');
    }

    console.log(`[NoirService] Submitting proof to Stellar...`);
    const verificationResult = await this.stellarService.verifyProof(
      proofResult.vkJson,
      proofResult.proofBlob,
      proofResult.proofId
    );

    return {
      ...proofResult,
      verification: verificationResult,
    };
  }

  /**
   * Retrieves circuit metadata including parameter definitions
   *
   * Useful for dynamically generating input forms or validating inputs
   *
   * @param circuitName - Name of the circuit
   * @returns Circuit metadata with parameter names, types, and visibility
   */
  async getCircuitMetadata(circuitName: string) {
    const response = await fetch(`/circuits/${circuitName}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load circuit: ${circuitName}`);
    }
    const circuit = await response.json();

    // Extract parameters from ABI
    const parameters = circuit.abi.parameters.map((param: any) => {
      let type = param.type.kind;
      // Check if it's an array type
      if (param.type.kind === 'array') {
        type = 'array';
      }
      return {
        name: param.name,
        type,
        visibility: param.visibility,
      };
    });

    return {
      name: circuitName,
      parameters,
    };
  }
}
