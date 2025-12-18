#!/usr/bin/env node

/**
 * Test real proof generation and contract verification using NoirService
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { Contract, Keypair, nativeToScVal, Networks, TransactionBuilder } from '@stellar/stellar-sdk';
import { Server } from '@stellar/stellar-sdk/rpc';
import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend } from '@aztec/bb.js';
import { keccak_256 } from '@noble/hashes/sha3.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const ULTRAHONK_CONTRACT = 'CBJR2EC4CW5TEDOZE7VQITPP3JWIR6J3C77ZR7KDDZLQQJ4RPHWB5EQI';
const NETWORK_PASSPHRASE = Networks.FUTURENET;
const RPC_URL = 'https://rpc-futurenet.stellar.org:443';

// Use a hardcoded funded account (user must provide)
const FUNDED_ACCOUNT_SECRET = process.env.STELLAR_SECRET || 'SBRYTNW5EY4FKCLBFJXBLCJLM2D5D7UTRP2OGOFEUDB4GD4RSE3VE7FB'; // Default to previous

console.log('=== Real Proof Generation & Contract Test ===');
console.log('Contract:', ULTRAHONK_CONTRACT);
console.log('Network:', NETWORK_PASSPHRASE);
console.log('');

class TestNoirService {
  async generateProof(circuitName, inputs) {
    console.log(`[NoirService] Starting proof generation for ${circuitName}`);

    // Load the compiled circuit
    console.log(`[1/6] Loading circuit...`);
    const circuitPath = path.join(__dirname, 'public', 'circuits', `${circuitName}.json`);
    if (!fs.existsSync(circuitPath)) {
      throw new Error(`Circuit file not found: ${circuitPath}`);
    }
    const circuit = JSON.parse(fs.readFileSync(circuitPath, 'utf8'));
    console.log(`[1/6] Circuit loaded`);

    // Initialize Noir with the circuit
    console.log(`[2/6] Initializing Noir...`);
    const noir = new Noir(circuit);
    console.log(`[2/6] Noir initialized`);

    // Generate witness
    console.log(`[3/6] Generating witness...`);
    const { witness } = await noir.execute(inputs);
    console.log(`[3/6] Witness generated`);

    // Generate proof using UltraHonk backend
    console.log(`[4/6] Generating UltraHonk proof...`);
    const backend = new UltraHonkBackend(circuit.bytecode);
    const proof = await backend.generateProof(witness, { keccak: true });
    console.log(`[4/6] Proof generated`);

    // Extract proof bytes
    const proofBytes = proof.proof;

    // Build public inputs from circuit inputs
    const publicInputsBytes = this.encodePublicInputs(circuit, inputs);
    console.log(`[DEBUG] Total public inputs: ${publicInputsBytes.length} bytes (${publicInputsBytes.length / 32} fields)`);

    // Build proof blob
    console.log(`[5/6] Building proof blob...`);
    const { proofBlob, proofId } = this.buildProofBlob(publicInputsBytes, proofBytes);
    console.log(`[5/6] Proof blob built`);

    // Load verification key
    console.log(`[6/6] Loading verification key...`);
    const vkJson = await this.loadVk(circuitName);
    console.log(`[6/6] Complete! Proof ID: ${proofId}`);

    return {
      proof: proofBytes, // Raw proof bytes from bb.js
      publicInputs: publicInputsBytes, // Encoded public inputs
      proofBlob: proofBlob, // Combined blob for reference
      vkJson: vkJson,
      proofId: proofId
    };
  }

  async loadVk(circuitName) {
    // Use the preprocessed VK binary (1824 bytes as expected by contract)
    const vkPreprocessedPath = path.join(__dirname, 'public', 'circuits', `${circuitName}_vk_preprocessed.bin`);
    if (fs.existsSync(vkPreprocessedPath)) {
      console.log(`✅ Loading preprocessed VK: ${vkPreprocessedPath}`);
      return fs.readFileSync(vkPreprocessedPath);
    }

    throw new Error(`Preprocessed VK file not found: ${vkPreprocessedPath}. Run preprocess_vk_cli first.`);
  }

  encodePublicInputs(circuit, inputs) {
    const publicParams = circuit.abi.parameters.filter((p) => p.visibility === 'public');
    const publicInputFields = [];

    if (publicParams.length > 0) {
      publicParams.forEach((p) => {
        const inputValue = inputs[p.name];

        // Helper function to encode a single value as a 32-byte field element
        const encodeField = (value, elementType, width) => {
          const field = new Uint8Array(32);
          const bigIntValue = BigInt(value);

          if (elementType === 'integer' && width) {
            const numBytes = width / 8;
            let val = bigIntValue;
            for (let i = 0; i < numBytes; i++) {
              field[32 - 1 - i] = Number(val & BigInt(0xff));
              val = val >> BigInt(8);
            }
          } else {
            let val = bigIntValue;
            for (let i = 0; i < 32; i++) {
              field[32 - 1 - i] = Number(val & BigInt(0xff));
              val = val >> BigInt(8);
            }
          }
          return field;
        };

        // Handle array types (e.g., puzzle: pub [Field; 81])
        if (p.type.kind === 'array') {
          const arrayLength = p.type.length;
          const elementType = p.type.type.kind;
          const elementWidth = p.type.type.width;

          if (!Array.isArray(inputValue)) {
            throw new Error(`Expected array for public parameter ${p.name}, got ${typeof inputValue}`);
          }
          if (inputValue.length !== arrayLength) {
            throw new Error(`Array length mismatch for ${p.name}: expected ${arrayLength}, got ${inputValue.length}`);
          }

          inputValue.forEach((element) => {
            const field = encodeField(element, elementType, elementWidth);
            publicInputFields.push(field);
          });
        }
        // Handle scalar integer types
        else if (p.type.kind === 'integer') {
          const field = encodeField(inputValue, 'integer', p.type.width);
          publicInputFields.push(field);
        }
        // Handle scalar field types
        else if (p.type.kind === 'field') {
          const field = encodeField(inputValue, 'field');
          publicInputFields.push(field);
        }
        else {
          throw new Error(`Unsupported public parameter type: ${p.type.kind} for parameter ${p.name}`);
        }
      });
    }

    // Concatenate all fields
    const totalBytes = publicInputFields.length * 32;
    const publicInputsBytes = new Uint8Array(totalBytes);
    publicInputFields.forEach((field, i) => {
      publicInputsBytes.set(field, i * 32);
    });

    return publicInputsBytes;
  }

  buildProofBlob(publicInputs, proof) {
    const proofFieldCount = proof.length / 32;
    const publicInputFieldCount = publicInputs.length / 32;
    const totalFields = proofFieldCount + publicInputFieldCount;

    const header = new Uint8Array(4);
    const view = new DataView(header.buffer);
    view.setUint32(0, totalFields, false); // false = big-endian

    const proofBlob = new Uint8Array(
      header.length + publicInputs.length + proof.length
    );
    proofBlob.set(header, 0);
    proofBlob.set(publicInputs, header.length);
    proofBlob.set(proof, header.length + publicInputs.length);

    const proofIdBytes = keccak_256(proofBlob);
    const proofId = Array.from(proofIdBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return { proofBlob, proofId };
  }
}

async function testRealProofGeneration() {
  console.log('Testing real proof generation with NoirService...\n');

  const noirService = new TestNoirService();

  // Test sudoku puzzle and solution
  const puzzle = [5,3,0,0,7,0,0,0,0,6,0,0,1,9,5,0,0,0,0,9,8,0,0,0,0,6,0,8,0,0,0,6,0,0,0,3,4,0,0,8,0,3,0,0,1,7,0,0,0,2,0,0,0,6,0,6,0,0,0,0,2,8,0,0,0,0,4,1,9,0,0,5,0,0,0,0,8,0,0,7,9];
  const solution = [5,3,4,6,7,8,9,1,2,6,7,2,1,9,5,3,4,8,1,9,8,3,4,2,5,6,7,8,5,9,7,6,1,4,2,3,4,2,6,8,5,3,7,9,1,7,1,3,9,2,4,8,5,6,9,6,1,5,3,7,2,8,4,2,8,7,4,1,9,6,3,5,3,4,5,2,8,6,1,7,9];

  try {
    console.log('Generating proof for valid sudoku solution...');
    const proofResult = await noirService.generateProof('sudoku', {
      puzzle: puzzle,
      solution: solution
    });

    console.log('\n✅ Proof generation successful!');
    console.log('Proof blob size:', proofResult.proof.length, 'bytes');
    console.log('VK size:', proofResult.vkJson.length, 'bytes');
    console.log('Public inputs size:', proofResult.publicInputs.length, 'bytes');
    console.log('Proof ID:', proofResult.proofId.slice(0, 16) + '...');

    return proofResult;

  } catch (error) {
    console.error('\n❌ Proof generation failed:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

async function testUltrahonkContract(proofData) {
  console.log('\nTesting ultrahonk contract with real proof...\n');

  // Use hardcoded funded account
  console.log('🔍 Setting up funded account...');
  const keypair = Keypair.fromSecret(FUNDED_ACCOUNT_SECRET);
  const accountAddress = keypair.publicKey();
  console.log('🔑 Account address:', accountAddress);

  // Try to get account from RPC
  let account;
  try {
    console.log('🔍 Checking account on network...');
    const server = new Server(RPC_URL, { allowHttp: true });
    account = await server.getAccount(accountAddress);
    console.log('✅ Account found, sequence:', account.sequenceNumber());
  } catch (error) {
    console.log('❌ Account not found on network. Please fund it at:');
    console.log(`https://lab.stellar.org/account/${accountAddress}/add-trustline`);
    console.log('');
    console.log('Or set STELLAR_SECRET environment variable to a funded account:');
    console.log('STELLAR_SECRET=your_secret_key node test_real_proof.js');
    return;
  }

  // Set up contract and server
  const server = new Server(RPC_URL, { allowHttp: true });
  const contract = new Contract(ULTRAHONK_CONTRACT);

  // Prepare ScVals - ensure they're proper Uint8Arrays
  console.log('🔧 Preparing ScVals...');
  const vkBuffer = Buffer.from(proofData.vkJson);
  const publicInputsBuffer = Buffer.from(proofData.publicInputs);
  const proofBuffer = Buffer.from(proofData.proof);

  console.log('VK buffer length:', vkBuffer.length);
  console.log('Public inputs buffer length:', publicInputsBuffer.length);
  console.log('Proof buffer length:', proofBuffer.length);

  const vkScVal = nativeToScVal(vkBuffer, { type: 'bytes' });
  const publicInputsScVal = nativeToScVal(publicInputsBuffer, { type: 'bytes' });
  const proofBytesScVal = nativeToScVal(proofBuffer, { type: 'bytes' });

  console.log('ScVals created successfully');
  console.log('VK ScVal type:', vkScVal?._attributes?.val?._switch?.name || 'unknown');
  console.log('Public inputs ScVal type:', publicInputsScVal?._attributes?.val?._switch?.name || 'unknown');
  console.log('Proof ScVal type:', proofBytesScVal?._attributes?.val?._switch?.name || 'unknown');

  console.log('🚀 Calling verify_proof with real proof data...');
  console.log('- VK bytes:', proofData.vkJson.length);
  console.log('- Public inputs:', proofData.publicInputs.length);
  console.log('- Proof bytes:', proofData.proof.length);
  console.log('');

  try {
    const account = await server.getAccount(accountAddress);

    // Build the transaction
    const rawTx = new TransactionBuilder(account, {
      fee: '100000', // 0.1 XLM fee
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('verify_proof', vkScVal, publicInputsScVal, proofBytesScVal))
      .setTimeout(30)
      .build();

    // Prepare the Soroban transaction
    console.log('🔧 Preparing Soroban transaction...');
    const tx = await server.prepareTransaction(rawTx);
    tx.sign(keypair);
    console.log('✅ Transaction prepared and signed');

    console.log('📤 Submitting transaction directly...');

    // Try simulation first to validate
    try {
      console.log('🎭 Quick simulation check...');
      const simulation = await server.simulateTransaction(tx);
      if (simulation.error) {
        console.log('❌ Simulation failed:', simulation.error);
        return;
      }
      console.log('✅ Simulation successful');
    } catch (simError) {
      console.log('⚠️ Simulation error, but trying submission anyway:', simError.message);
    }

    let result;
    try {
      result = await server.sendTransaction(tx);
      console.log('Raw result object:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.log('❌ Transaction submission failed:', error.message);
      console.log('Error object:', error);
      if (error.response?.data) {
        console.log('Response data:', JSON.stringify(error.response.data, null, 2));
      }
      return;
    }

    if (result.status === 'PENDING') {
      console.log('⏳ Transaction submitted, hash:', result.hash);

      // Wait for confirmation - reduced to 20 seconds total
      let status = 'PENDING';
      let attempts = 0;
      const maxAttempts = 4; // 20 seconds total

      while (status === 'PENDING' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds
        attempts++;

        try {
          const response = await server.getTransaction(result.hash);
          status = response.status;
          console.log(`📊 Attempt ${attempts}/${maxAttempts}: ${status}`);
        } catch (error) {
          console.log(`📊 Attempt ${attempts}/${maxAttempts}: still pending`);
        }
      }

      if (status === 'SUCCESS') {
        console.log('');
        console.log('🎉 SUCCESS! Real proof verification completed!');
        console.log('✅ Contract accepts properly formatted proof');
        console.log('✅ Noir + bb.js + ultrahonk pipeline works');
        console.log('✅ App proof generation is functional');

      } else if (status === 'FAILED') {
        console.log('');
        console.log('❌ FAILED: Transaction failed');

        // Try to get more details
        try {
          const response = await server.getTransaction(result.hash);
          console.log('Failure details:', response.resultXdr);
        } catch (error) {
          console.log('Could not get failure details');
        }

      } else {
        console.log('');
        console.log('⏰ TIMEOUT: Transaction still pending after 20s');
        console.log('Check the transaction on Stellar Lab:', `https://lab.stellar.org/tx/${result.hash}`);
      }
    } else {
      console.log('❌ Transaction failed immediately, status:', result.status);
      if (result.errorResultXdr) {
        console.log('Error details:', result.errorResultXdr);
      }
      if (result.errorResult) {
        console.log('Error result object:', JSON.stringify(result.errorResult, null, 2));
      }
      if (result.resultXdr) {
        console.log('Result XDR:', result.resultXdr);
      }
      if (result.diagnosticEventsXdr) {
        console.log('Diagnostic events:', result.diagnosticEventsXdr);
      }

      // Try to decode the error
      try {
        if (result.resultXdr) {
          const parsed = result.resultXdr;
          console.log('Parsed result:', parsed);
        }
      } catch (e) {
        console.log('Could not parse result XDR');
      }
    }
  } catch (error) {
    console.error('❌ Contract call failed:', error.message);
  }
}

async function main() {
  try {
    // Generate real proof
    const proofData = await testRealProofGeneration();

    // Test contract with real proof
    await testUltrahonkContract(proofData);

  } catch (error) {
    console.error('\n💥 Test failed:', error.message);
    process.exit(1);
  }
}

main();
