/**
 * StellarContractService - Utility functions for Stellar blockchain interactions
 *
 * This module provides utility functions for wallet operations, transaction data extraction,
 * and formatting. Components should use contract bindings directly.
 */

import { Buffer } from 'buffer';
import { createGuessThePuzzleClient } from '../contracts/guess_the_puzzle';
import { SorobanRpc } from '@stellar/stellar-sdk';

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
    // signAndSend throws on error, so if we got here, the transaction succeeded
    const txHash = result?.hash || result?.transactionHash || (typeof result === 'string' ? result : '');
    let fee: string | undefined;

    // Try to get transaction response for fee information
    let txResponse: any = null;
    
    if (typeof result?.getTransactionResponse === 'function') {
      try {
        txResponse = result.getTransactionResponse();
      } catch (e) {
        // Ignore errors
      }
    } else if (result?.response) {
      txResponse = result.response;
    } else if (result?.transactionResponse) {
      txResponse = result.transactionResponse;
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
  static async extractReturnValue(server: SorobanRpc.Server, txHash: string): Promise<boolean | null> {
    try {
      const txResponse = await server.getTransaction(txHash);

      // Check if transaction was successful and has a return value
      if (SorobanRpc.Api.isSuccessful(txResponse) && txResponse.returnValue) {
        // The return value is a ScVal (Soroban Value) in XDR format
        // For boolean values, we can extract the boolean value
        const scVal = txResponse.returnValue;
        if (scVal.switch() === SorobanRpc.xdr.ScValType.scvBool()) {
          return scVal.bool();
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to extract return value:', error);
      return null;
    }
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

