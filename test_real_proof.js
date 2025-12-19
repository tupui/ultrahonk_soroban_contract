#!/usr/bin/env node

/**
 * Test real proof generation and contract verification using NoirService
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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
    const circuitPath = path.join(__dirname, 'public', 'circuits', `${circuitName}.json`);
    if (!fs.existsSync(circuitPath)) {
      throw new Error(`Circuit file not found: ${circuitPath}`);
    }

    const circuit = JSON.parse(fs.readFileSync(circuitPath, 'utf8'));
    const noir = new Noir(circuit);
    const { witness } = await noir.execute(inputs);

    const backend = new UltraHonkBackend(circuit.bytecode);
    const proof = await backend.generateProof(witness, { keccak: true });

    const publicInputsBytes = this.encodePublicInputs(circuit, inputs);
    const { proofBlob, proofId } = this.buildProofBlob(publicInputsBytes, proof.proof);
    const vkJson = await this.loadVk(circuitName);

    return {
      proof: proof.proof,
      publicInputs: publicInputsBytes,
      proofBlob,
      vkJson,
      proofId
    };
  }

  async loadVk(circuitName) {
    const vkPath = path.join(__dirname, 'public', 'circuits', `${circuitName}_vk_preprocessed.bin`);
    if (!fs.existsSync(vkPath)) {
      throw new Error(`VK file not found: ${vkPath}. Run preprocess_vk_cli first.`);
    }
    return fs.readFileSync(vkPath);
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
  console.log('🧪 Testing valid proof generation...');

  const noirService = new TestNoirService();
  const puzzle = [5,3,0,0,7,0,0,0,0,6,0,0,1,9,5,0,0,0,0,9,8,0,0,0,0,6,0,8,0,0,0,6,0,0,0,3,4,0,0,8,0,3,0,0,1,7,0,0,0,2,0,0,0,6,0,6,0,0,0,0,2,8,0,0,0,0,4,1,9,0,0,5,0,0,0,0,8,0,0,7,9];
  const solution = [5,3,4,6,7,8,9,1,2,6,7,2,1,9,5,3,4,8,1,9,8,3,4,2,5,6,7,8,5,9,7,6,1,4,2,3,4,2,6,8,5,3,7,9,1,7,1,3,9,2,4,8,5,6,9,6,1,5,3,7,2,8,4,2,8,7,4,1,9,6,3,5,3,4,5,2,8,6,1,7,9];

  const proofResult = await noirService.generateProof('sudoku', { puzzle, solution });
  console.log('✅ Valid proof generated successfully');
  return proofResult;
}

async function testInvalidProofGeneration() {
  console.log('\n🧪 Testing invalid proof generation...');

  const noirService = new TestNoirService();
  const puzzle = [5,3,0,0,7,0,0,0,0,6,0,0,1,9,5,0,0,0,0,9,8,0,0,0,0,6,0,8,0,0,0,6,0,0,0,3,4,0,0,8,0,3,0,0,1,7,0,0,0,2,0,0,0,6,0,6,0,0,0,0,2,8,0,0,0,0,4,1,9,0,0,5,0,0,0,0,8,0,0,7,9];

  // Invalid solution: position [0][2] should be 4 but we put 9 (violates puzzle constraint)
  const invalidSolution = [5,3,9,6,7,8,9,1,2,6,7,2,1,9,5,3,4,8,1,9,8,3,4,2,5,6,7,8,5,9,7,6,1,4,2,3,4,2,6,8,5,3,7,9,1,7,1,3,9,2,4,8,5,6,9,6,1,5,3,7,2,8,4,2,8,7,4,1,9,6,3,5,3,4,5,2,8,6,1,7,9];

  try {
    const invalidProofResult = await noirService.generateProof('sudoku', {
      puzzle: puzzle,
      solution: invalidSolution
    });

    console.log('✅ Invalid proof generated (Noir allows it)');
    return invalidProofResult;

  } catch (error) {
    console.log('ℹ️  Noir rejected invalid solution (expected behavior)');
    return null;
  }
}
async function testUltrahonkContract(proofData, testName = 'proof') {
  console.log(`\n🧪 Testing contract with ${testName}...`);

  const keypair = Keypair.fromSecret(FUNDED_ACCOUNT_SECRET);
  const server = new Server(RPC_URL, { allowHttp: true });

  try {
    await server.getAccount(keypair.publicKey());
  } catch (error) {
    console.log('❌ Account not funded. Fund at:', `https://lab.stellar.org/account/${keypair.publicKey()}/add-trustline`);
    return false;
  }

  if (!proofData) {
    const vkBuffer = Buffer.alloc(1824, 0);
    const publicInputsBuffer = Buffer.alloc(81 * 32, 0);
    const proofBuffer = Buffer.alloc(32, 0);
    return await testContractWithData(server, keypair, vkBuffer, publicInputsBuffer, proofBuffer, 'dummy data');
  }

  const vkBuffer = Buffer.from(proofData.vkJson);
  const publicInputsBuffer = Buffer.from(proofData.publicInputs);
  const proofBuffer = Buffer.from(proofData.proof);

  return await testContractWithData(server, keypair, vkBuffer, publicInputsBuffer, proofBuffer, testName);
}

async function testContractWithData(server, keypair, vkBuffer, publicInputsBuffer, proofBuffer, testName) {
  const contract = new Contract(ULTRAHONK_CONTRACT);

  const vkScVal = nativeToScVal(vkBuffer, { type: 'bytes' });
  const publicInputsScVal = nativeToScVal(publicInputsBuffer, { type: 'bytes' });
  const proofBytesScVal = nativeToScVal(proofBuffer, { type: 'bytes' });

  const isValidTest = !testName.includes('dummy') && !testName.includes('invalid');
  console.log(`📤 Submitting ${testName}...`);

  try {
    const account = await server.getAccount(keypair.publicKey());

    const rawTx = new TransactionBuilder(account, {
      fee: '100000',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('verify_proof', vkScVal, publicInputsScVal, proofBytesScVal))
      .setTimeout(30)
      .build();

    const tx = await server.prepareTransaction(rawTx);
    tx.sign(keypair);

    const result = await server.sendTransaction(tx);

    if (result.status === 'PENDING') {
      console.log('⏳ Transaction pending, hash:', result.hash);

      // Wait for confirmation
      let status = 'PENDING';
      for (let attempts = 0; status === 'PENDING' && attempts < 4; attempts++) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        try {
          status = (await server.getTransaction(result.hash)).status;
        } catch (e) {
          // Still pending
        }
      }

      if (status === 'SUCCESS') {
        console.log(isValidTest ? '✅ Valid proof accepted' : '⚠️  Invalid proof accepted (unexpected)');
        return isValidTest;
      } else if (status === 'FAILED') {
        console.log(isValidTest ? '❌ Valid proof rejected (unexpected)' : '✅ Invalid proof rejected (expected)');
        return !isValidTest;
      } else {
        console.log('⏰ Transaction timeout');
        return false;
      }
    } else {
      console.log('❌ Transaction failed immediately');
      return false;
    }
  } catch (error) {
    console.error('❌ Contract call failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('=== Testing Noir + UltraHonk Pipeline ===\n');

  // Test 1: Valid proof
  console.log('🧪 TEST 1: Valid Proof');
  const validProof = await testRealProofGeneration();
  const validResult = await testUltrahonkContract(validProof, 'valid proof');

  // Test 2: Invalid proof
  console.log('\n🧪 TEST 2: Invalid Proof');
  const invalidProof = await testInvalidProofGeneration();
  const invalidResult = await testUltrahonkContract(invalidProof, 'invalid proof');

  // Summary
  const exitCode = (validResult && !invalidResult) ? 0 : 1;
  console.log(`\n📊 Result: ${exitCode === 0 ? 'PASS' : 'FAIL'}`);
  process.exit(exitCode);
}

main();
