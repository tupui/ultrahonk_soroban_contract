import { Buffer } from "buffer";
import { AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions, Result } from "@stellar/stellar-sdk/contract";
import type { u64, i128, Option } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";
export declare const Errors: {
    /**
     * The contract failed to transfer XLM to the guesser
     */
    1: {
        message: string;
    };
    /**
     * The guesser failed to transfer XLM to the contract
     */
    2: {
        message: string;
    };
    /**
     * The contract has no balance to transfer to the guesser
     */
    3: {
        message: string;
    };
};
export interface Client {
    /**
     * Construct and simulate a set_puzzle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    set_puzzle: ({ puzzle }: {
        puzzle: Buffer;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a verify_puzzle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Verify the puzzle is correctly solved
     */
    verify_puzzle: ({ guesser, vk_json, public_inputs, proof_blob }: {
        guesser: string;
        vk_json: Buffer;
        public_inputs: Buffer;
        proof_blob: Buffer;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<boolean>>>;
    /**
     * Construct and simulate a prize_pot transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    prize_pot: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>;
    /**
     * Construct and simulate a add_funds transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Add more funds to the contract, in XLM
     */
    add_funds: ({ funder, amount }: {
        funder: string;
        amount: u64;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Upgrade the contract to new wasm. Only callable by admin.
     */
    upgrade: ({ new_wasm_hash }: {
        new_wasm_hash: Buffer;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a puzzle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Read only function to get the current number
     */
    puzzle: (options?: MethodOptions) => Promise<AssembledTransaction<Buffer>>;
    /**
     * Construct and simulate a admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Get current admin
     */
    admin: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>;
    /**
     * Construct and simulate a set_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Set a new admin. Only callable by admin.
     */
    set_admin: ({ admin }: {
        admin: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
}
export declare class Client extends ContractClient {
    readonly options: ContractClientOptions;
    static deploy<T = Client>(
    /** Constructor/Initialization Args for the contract's `__constructor` method */
    { admin }: {
        admin: string;
    }, 
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions & Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
    }): Promise<AssembledTransaction<T>>;
    constructor(options: ContractClientOptions);
    readonly fromJSON: {
        set_puzzle: (json: string) => AssembledTransaction<null>;
        verify_puzzle: (json: string) => AssembledTransaction<Result<boolean, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        prize_pot: (json: string) => AssembledTransaction<bigint>;
        add_funds: (json: string) => AssembledTransaction<null>;
        upgrade: (json: string) => AssembledTransaction<null>;
        puzzle: (json: string) => AssembledTransaction<Buffer<ArrayBufferLike>>;
        admin: (json: string) => AssembledTransaction<Option<string>>;
        set_admin: (json: string) => AssembledTransaction<null>;
    };
}
