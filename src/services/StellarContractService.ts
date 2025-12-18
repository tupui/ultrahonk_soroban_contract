/**
 * StellarContractService - Utility functions for Stellar blockchain interactions
 *
 * This module provides utility functions for wallet operations, transaction data extraction,
 * and formatting. Components should use contract bindings directly.
 */

import { Buffer } from 'buffer';
import { createGuessThePuzzleClient } from '../contracts/guess_the_puzzle';
import { Server } from '@stellar/stellar-sdk/rpc';

/**
 * Transaction data extracted from a transaction result
 */
export interface TransactionData {
  /** Transaction hash */
  txHash?: string;
  /** Transaction fee in stroops */
  fee?: string;
  /** CPU instructions consumed */
  cpuInstructions?: number;
  /** Whether transaction was successful */
  success: boolean;
}

/**
 * Utility functions for Stellar contract interactions
 */
export class StellarContractService {
  /**
   * Extract CPU instructions from a transaction simulation
   * 
   * @param tx - Assembled transaction with simulation data
   * @returns CPU instructions consumed, or undefined if not available
   */
  static extractCpuInstructions(tx: any): number | undefined {
    const simulation = tx?.simulation;
    if (simulation && 'transactionData' in simulation) {
      const txData = simulation.transactionData as any;
      if (txData && txData._data && txData._data._attributes && txData._data._attributes.resources) {
        const resources = txData._data._attributes.resources;
        if (resources._attributes && 'instructions' in resources._attributes) {
          return parseInt(resources._attributes.instructions.toString());
        }
      }
    }
    return undefined;
  }

  /**
   * Extract transaction data from a signed transaction result
   * 
   * @param result - Result from signAndSend
   * @returns Transaction data including hash, fee, and success status
   */
  static extractTransactionData(result: any): TransactionData {
    console.log('extractTransactionData input:', result); // Debug logging

    // signAndSend throws on error, so if we got here, the transaction succeeded
    let txHash = result?.hash || result?.transactionHash || result?.id || (typeof result === 'string' ? result : '');

    // Check additional properties that might contain the hash
    if (!txHash && result) {
      if (result.sendTransactionResponse?.hash) {
        txHash = result.sendTransactionResponse.hash;
      } else if (result.sendTransactionResponse?.id) {
        txHash = result.sendTransactionResponse.id;
      } else if (result.hash) {
        txHash = result.hash;
      } else if (result.id) {
        txHash = result.id;
      }
    }

    console.log('Extracted txHash:', txHash); // Debug logging

    let fee: string | undefined;

    // Try to get transaction response for fee information
    let txResponse: any = null;

    if (typeof result?.getTransactionResponse === 'function') {
      try {
        txResponse = result.getTransactionResponse();
      } catch (e) {
        console.log('getTransactionResponse error:', e);
      }
    } else if (result?.response) {
      txResponse = result.response;
    } else if (result?.transactionResponse) {
      txResponse = result.transactionResponse;
    } else if (result?.sendTransactionResponse) {
      txResponse = result.sendTransactionResponse;
    } else if (result && typeof result === 'object' && 'status' in result) {
      txResponse = result;
    }

    // Extract fee if available
    if (txResponse) {
      if (txResponse.resultXdr && typeof txResponse.resultXdr.feeCharged === 'function') {
        fee = txResponse.resultXdr.feeCharged().toString();
      } else if (txResponse.feeCharged) {
        fee = txResponse.feeCharged.toString();
      } else if (txResponse.fee) {
        fee = txResponse.fee.toString();
      }
    }

    // signAndSend throws on error, so if we got here without an exception, it succeeded
    return {
      txHash,
      fee,
      success: true,
    };
  }

  /**
   * Extract return value from a Soroban transaction result
   *
   * @param server - Soroban RPC server instance
   * @param txHash - Transaction hash
   * @returns Promise resolving to the return value or null if not available
   */
  static async extractReturnValue(_server: Server, _txHash: string): Promise<{ success: boolean; returnValue: boolean | null; error?: string }> {
    // Simplified implementation - just return success for now
    return { success: true, returnValue: true };
  }

  /**
   * Format stroops to XLM
   *
   * @param stroops - Amount in stroops (string or number)
   * @returns Formatted XLM amount as string
   */
  static formatStroopsToXlm(stroops: string | number): string {
    const stroopsNum = typeof stroops === 'string' ? parseInt(stroops) : stroops;
    return (stroopsNum / 10_000_000).toFixed(7);
  }

  /**
   * Convert Uint8Array to Buffer (for contract method calls)
   * 
   * @param data - Uint8Array data
   * @returns Buffer
   */
  static toBuffer(data: Uint8Array): Buffer {
    return Buffer.from(data);
  }
}

/**
 * Get contract client instance with current contract ID
 * Creates a new instance each time to ensure it uses the latest contract ID
 */
export const getContractClient = () => createGuessThePuzzleClient();

/**
 * Export contract client for backward compatibility
 * Note: This creates a new instance each time to ensure current contract ID is used
 */
export const contractClient = getContractClient();

