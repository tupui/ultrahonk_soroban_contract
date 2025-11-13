/**
 * StellarContractService - Handles interaction with Stellar blockchain for proof verification
 *
 * This service provides methods to submit UltraHonk proofs to a Stellar/Soroban smart contract
 * for on-chain verification. It uses contract bindings and wallet integration.
 */

import { Buffer } from 'buffer';
import game from '../contracts/guess_the_puzzle';

/**
 * Result of a proof verification transaction on Stellar
 */
export interface VerificationResult {
  /** Whether the verification transaction succeeded */
  success: boolean;
  /** Hex-encoded Keccak-256 hash of the proof blob */
  proofId: string;
  /** Stellar transaction hash */
  txHash?: string;
  /** Whether the proof is verified on-chain (from is_verified query) */
  isVerified: boolean;
  /** CPU instructions consumed by the verification (from simulation) */
  cpuInstructions?: number;
  /** Transaction fee in stroops */
  fee?: string;
  /** Error message if verification failed */
  error?: string;
}

/**
 * Service for interacting with Stellar blockchain to verify UltraHonk proofs
 */
export class StellarContractService {
  /**
   * Submits an UltraHonk proof to Stellar for on-chain verification
   *
   * This method:
   * 1. Calls the verify_puzzle contract method with the guesser, VK and proof blob
   * 2. Extracts CPU instructions from the simulation data
   * 3. Signs and submits the transaction using wallet
   * 4. Extracts the fee from the transaction result
   * 5. Queries is_verified to confirm the proof was stored correctly
   *
   * @param vkJson - Verification key as raw bytes (from bb write_vk --oracle_hash keccak)
   * @param proofBlob - Proof blob containing: u32_be(total_fields) || public_inputs || proof
   * @param proofId - Hex-encoded Keccak-256 hash of the proof blob
   * @param signTransaction - Wallet signTransaction function from useWallet hook
   * @param address - Wallet address for setting publicKey on contract client
   * @returns Verification result including transaction hash, fee, CPU instructions, and verification status
   */
  async verifyProof(
    vkJson: Uint8Array,
    proofBlob: Uint8Array,
    proofId: string,
    signTransaction: (xdr: string) => Promise<{ signedTxXdr: string; signerAddress: string }>,
    address: string
  ): Promise<VerificationResult> {
    try {
      console.log('[StellarContractService] Calling verify_puzzle...');
      console.log(`[StellarContractService] VK size: ${vkJson.length} bytes`);
      console.log(`[StellarContractService] Proof blob size: ${proofBlob.length} bytes`);

      // Convert Uint8Array to Buffer
      const vkBuffer = Buffer.from(vkJson);
      const proofBuffer = Buffer.from(proofBlob);

      // Initialize variables for result data
      let cpuInstructions: number | undefined;
      let fee: string | undefined;

      // Update contract client with current address
      game.options.publicKey = address;

      // Call verify_puzzle with guesser parameter
      const tx = await game.verify_puzzle({
        guesser: address,
        vk_json: vkBuffer,
        proof_blob: proofBuffer,
      });

      console.log('[StellarContractService] Transaction assembled, signing and sending...');

      // Extract CPU instructions from simulation
      const simulation = (tx as any).simulation;
      if (simulation && 'transactionData' in simulation) {
        const txData = simulation.transactionData as any;
        if (txData && txData._data && txData._data._attributes && txData._data._attributes.resources) {
          const resources = txData._data._attributes.resources;
          if (resources._attributes && 'instructions' in resources._attributes) {
            cpuInstructions = parseInt(resources._attributes.instructions.toString());
            console.log('[StellarContractService] CPU Instructions from simulation:', cpuInstructions);
          }
        }
      }

      // Sign and send transaction using wallet
      const result = await tx.signAndSend({
        signTransaction,
      });

      console.log('[StellarContractService] Transaction sent');

      // Get transaction hash from result
      const txHash = (result as any).hash || '';

      // Extract fee charged from transaction response
      const txResponse = result.getTransactionResponse;
      if (txResponse && txResponse.status === 'SUCCESS') {
        fee = txResponse.resultXdr.feeCharged().toString();
        console.log('[StellarContractService] Fee charged:', fee, 'stroops');
      }

      console.log('[StellarContractService] verify_puzzle succeeded');
      if (cpuInstructions) {
        console.log(`[StellarContractService] CPU Instructions: ${cpuInstructions.toLocaleString()}`);
      }
      if (fee) {
        const stroops = parseInt(fee);
        const xlm = (stroops / 10_000_000).toFixed(7);
        console.log(`[StellarContractService] Fee: ${stroops.toLocaleString()} stroops (${xlm} XLM)`);
      }

      // Check if verification was successful from transaction result
      const isVerified = !!(txResponse && txResponse.status === 'SUCCESS');

      return {
        success: true,
        proofId,
        txHash,
        isVerified,
        cpuInstructions,
        fee,
      };
    } catch (error: any) {
      console.error('[StellarContractService] Error:', error);
      return {
        success: false,
        proofId,
        isVerified: false,
        error: error.message || String(error),
      };
    }
  }
}

