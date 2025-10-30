# UltraHonk Soroban Contract: A Deep Dive

## Executive Summary

This repository implements a **zero-knowledge proof verifier** for the Stellar blockchain using the UltraHonk proof system. It allows you to write circuits in Noir (a domain-specific language for ZK proofs), generate proofs off-chain using Barretenberg, and verify those proofs on-chain in a Soroban smart contract.

**Key Innovation**: This brings zkSNARK verification to Stellar's Soroban platform, enabling privacy-preserving computations and verifiable off-chain computation with on-chain verification.

---

## What Problem Does This Solve?

### The Privacy & Scalability Challenge

Blockchains are transparent by default—every transaction and computation is visible to everyone. Sometimes you need to:

1. **Prove you know something without revealing it** (e.g., "I have a valid credential" without showing the credential)
2. **Prove a computation was done correctly without re-executing it** (e.g., "I calculated the 1000th Fibonacci number correctly" without the blockchain recalculating it)
3. **Enable private transactions** (e.g., Tornado Cash-style mixers where you can withdraw funds without linking to your deposit)

### The Solution: Zero-Knowledge Proofs

Zero-knowledge proofs (specifically zkSNARKs using the UltraHonk proof system) let you:
- Prove statements about private data
- Verify complex computations cheaply on-chain
- Build privacy-preserving applications

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         OFF-CHAIN                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. Write Circuit in Noir                                        │
│     ├── Define private inputs (witness)                          │
│     ├── Define public inputs                                     │
│     └── Define constraints/logic                                 │
│                                                                   │
│  2. Compile with nargo                                           │
│     └── Generates bytecode                                       │
│                                                                   │
│  3. Generate Verification Key (VK) with Barretenberg             │
│     └── bb write_vk → vk_fields.json                            │
│                                                                   │
│  4. Generate Proof with Barretenberg                             │
│     ├── bb prove (with private inputs)                          │
│     └── Outputs: proof + public_inputs                          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    (proof + public_inputs)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         ON-CHAIN (Soroban)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  UltraHonkVerifierContract (Rust WASM)                          │
│     ├── verify_proof(vk_json, proof_blob)                       │
│     │   ├── Parse VK from JSON                                  │
│     │   ├── Parse proof and public inputs                       │
│     │   ├── Run verification algorithm                          │
│     │   ├── Store proof_id if valid                            │
│     │   └── Return proof_id                                     │
│     │                                                            │
│     ├── set_vk(vk_json) - Store VK on-chain                     │
│     ├── verify_proof_with_stored_vk(proof_blob)                 │
│     └── is_verified(proof_id) - Check if proof verified         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## How Noir and Stellar Interact

### The Two Ecosystems

1. **Noir** (by Aztec Protocol)
   - Domain-specific language for writing zero-knowledge circuits
   - Compiles to an intermediate representation
   - Uses Barretenberg proving system
   - Proof system: UltraHonk (a zkSNARK variant)

2. **Stellar/Soroban**
   - Layer-1 blockchain with smart contract platform
   - Contracts written in Rust, compiled to WebAssembly
   - No native ZK proof verification (yet!)

### The Bridge

This repository bridges them by:
1. Using Noir to **write and prove** circuits (off-chain)
2. Implementing a **Rust verifier** that runs in Soroban's WASM environment
3. The verifier uses `ultrahonk_rust_verifier` library (a pure Rust implementation of the UltraHonk verification algorithm)

**Why this matters**: Stellar doesn't have native precompiles for elliptic curve operations on BN254 (the curve used by UltraHonk), so this implementation does all the cryptography in pure Rust/WASM. This is slower and more expensive than native precompiles, but it makes ZK verification possible today.

---

## Key Components Explained

### 1. The Verifier Contract ([src/lib.rs](src/lib.rs))

This is the heart of the system—a Soroban smart contract that verifies UltraHonk proofs.

#### Core Functions

**`verify_proof(vk_json: Bytes, proof_blob: Bytes) -> Result<BytesN<32>, Error>`**
- Takes a verification key (JSON) and a packed proof blob
- Parses the VK manually (no serde in no_std environment)
- Extracts public inputs and proof from the blob
- Runs the UltraHonk verification algorithm
- If valid: stores `proof_id = keccak256(proof_blob)` on-chain and returns it
- If invalid: returns an error

**`set_vk(vk_json: Bytes) -> Result<BytesN<32>, Error>`**
- Stores a verification key on-chain for reuse
- Returns `vk_hash = keccak256(vk_json)`
- Use this to avoid sending the VK with every proof

**`verify_proof_with_stored_vk(proof_blob: Bytes) -> Result<BytesN<32>, Error>`**
- Uses the stored VK from `set_vk()`
- More gas-efficient for repeated verifications

**`is_verified(proof_id: BytesN<32>) -> bool`**
- Query function to check if a proof has been verified
- Useful for other contracts to check proof validity

#### The Proof Blob Format

The contract expects proofs in a specific packed format:

```
[4 bytes: total_fields (big-endian u32)]
[32*N bytes: public inputs (N fields × 32 bytes each)]
[32*P bytes: proof data (P=440 or P=456 fields)]
```

The script [scripts/invoke_ultrahonk.py](scripts/invoke_ultrahonk.py) handles this packing automatically.

#### Why Manual JSON Parsing?

The contract parses verification keys without `serde_json` because:
1. Soroban contracts use `#![no_std]` (no standard library)
2. VK files are large (~9KB) and have a specific format
3. Custom parser is more efficient and smaller in WASM

The VK contains 27 elliptic curve points (each 4 limbs of 32 bytes) representing the circuit's verification parameters.

---

### 2. Example Circuits

The repo includes two example Noir circuits to demonstrate usage:

#### Simple Circuit ([tests/simple_circuit/src/main.nr](tests/simple_circuit/src/main.nr))

```noir
fn main(x: Field, y: pub Field) {
    assert(x != y);
}
```

**What it proves**: "I know a value `x` that is different from the public value `y`"
- Private input: `x`
- Public input: `y`
- Constraint: `x ≠ y`

**Use case**: Proves you know a secret that satisfies a condition without revealing the secret.

#### Fibonacci Circuit ([tests/fib_chain/src/main.nr](tests/fib_chain/src/main.nr))

```noir
fn fib10(a0: Field, a1: Field) -> Field {
    let mut prev = a0;
    let mut curr = a1;
    for _ in 0..10 {
        let next = prev + curr;
        prev = curr;
        curr = next;
    }
    curr
}

pub fn main(a0: Field, a1: Field, out: pub Field) {
    let result = fib10(a0, a1);
    assert(result == out);
}
```

**What it proves**: "I computed the 10th Fibonacci number starting from `a0` and `a1`, and it equals `out`"
- Private inputs: `a0`, `a1`
- Public input: `out` (expected result = 89 for Fib(0,1))
- Constraint: Fibonacci computation correctness

**Use case**: Verifiable computation—prove you did an expensive calculation correctly without the verifier re-running it.

---

### 3. Tornado Cash-Style Mixer ([tornado_classic/](tornado_classic/))

This is a **real-world application** demonstrating privacy-preserving withdrawals.

#### Architecture

```
MixerContract (Soroban) + UltraHonkVerifierContract + Circuit (Noir)
```

#### How It Works

1. **Deposit Phase**
   - User generates: `nullifier` (random secret), `secret` (random)
   - Computes: `commitment = Poseidon2(nullifier, secret)`
   - Calls `MixerContract::deposit(commitment)`
   - Contract stores commitment in a Merkle tree (depth 20)

2. **Withdraw Phase**
   - User generates a ZK proof with:
     - **Private inputs**: `nullifier`, `secret`, Merkle path
     - **Public inputs**: `root` (current Merkle root), `nullifier_hash = Poseidon2(nullifier, 0)`, `recipient`
   - Circuit proves: "I know a leaf (`commitment`) in the tree with root `root` derived from `nullifier` and `secret`"
   - Calls `MixerContract::withdraw(verifier_address, proof_blob, nullifier_hash)`
   - Contract verifies:
     - Proof is valid (calls UltraHonkVerifierContract)
     - `nullifier_hash` matches proof's public input
     - `nullifier_hash` hasn't been used before
     - Merkle `root` matches current tree root
   - If valid: marks nullifier as spent, emits recipient

#### Privacy Guarantee

The deposit and withdrawal are **unlinkable**:
- Anyone can see commitments going in
- Anyone can see withdrawals coming out
- **But no one can link which deposit corresponds to which withdrawal** (assuming enough deposits exist for anonymity set)

#### Circuit ([tornado_classic/circuit/src/main.nr](tornado_classic/circuit/src/main.nr))

```noir
pub fn main(
    root: pub Field,
    nullifier_hash: pub Field,
    recipient: pub Field,
    nullifier: Field,           // private
    secret: Field,              // private
    path_siblings: [Field; 20], // private
    path_bits: [Field; 20],     // private
) {
    let leaf = hash2(nullifier, secret);
    let nf = hash2(nullifier, 0);

    assert(nf == nullifier_hash);
    let computed_root = compute_root(leaf, path_siblings, path_bits);
    assert(computed_root == root);
}
```

**Key insights**:
- Uses Poseidon2 hash (ZK-friendly)
- Merkle tree depth 20 = up to 1,048,576 deposits
- `nullifier_hash` prevents double-spending
- `recipient` can be anyone (breaks link between depositor and withdrawer)

---

## How to Use This System

### Adding Your Own Circuit

Here's the complete workflow:

#### 1. Write Your Circuit in Noir

Create a new directory (e.g., `my_circuit/`) with structure:
```
my_circuit/
├── Nargo.toml       # Noir project config
├── Prover.toml      # Input values for proof generation
└── src/
    └── main.nr      # Your circuit logic
```

**Example circuit** (`src/main.nr`):
```noir
fn main(secret: Field, hash: pub Field) {
    // Prove you know the preimage of a hash
    let computed = std::hash::poseidon::bn254::hash_1([secret]);
    assert(computed == hash);
}
```

**Prover.toml**:
```toml
secret = "42"
hash = "0x..." # poseidon(42)
```

#### 2. Generate Artifacts with Barretenberg

You need:
- `nargo` 1.0.0-beta.9+ (Noir compiler)
- `bb` 0.87.0+ (Barretenberg CLI)

```bash
cd my_circuit/

# Compile circuit
nargo compile

# Generate verification key
bb write_vk -b target/my_circuit.json -o target/vk

# Convert VK to JSON format expected by contract
bb vk_as_fields -k target/vk -o target/vk_fields.json

# Generate proof
bb prove -b target/my_circuit.json -w target/my_circuit.gz -o target/proof

# Extract public inputs
bb write_vk_ultra_honk -b target/my_circuit.json -o /dev/null
# (creates target/public_inputs as side effect)
```

**Outputs**:
- `target/vk_fields.json` - verification key (send to contract or use `set_vk()`)
- `target/proof` - the proof blob
- `target/public_inputs` - public input values (32 bytes each)

#### 3. Deploy the Verifier Contract

```bash
# Build contract
stellar contract build

# Deploy to localnet
stellar container start local --limits unlimited
stellar network add local --rpc-url http://localhost:8000/soroban/rpc \
  --network-passphrase "Standalone Network ; February 2017"
stellar keys generate --global alice --fund --network local

stellar contract deploy \
  --wasm target/wasm32v1-none/release/ultrahonk_soroban_contract.wasm \
  --source alice \
  --network local

# Save the contract ID (e.g., CXYZ...)
```

#### 4. Set the Verification Key (Optional but Recommended)

```bash
# Read VK as hex
VK_HEX=$(xxd -p -c 9999 my_circuit/target/vk_fields.json)

stellar contract invoke \
  --id <CONTRACT_ID> \
  --source alice \
  --network local \
  -- set_vk \
  --vk-json $VK_HEX
```

This stores the VK on-chain and returns its hash.

#### 5. Verify Proofs

**Option A: Using the Python helper script** (easiest)

```bash
python3 scripts/invoke_ultrahonk.py invoke \
  --dataset my_circuit/target \
  --contract-id <CONTRACT_ID> \
  --network local \
  --source alice
```

The script automatically:
- Packs the proof blob in the correct format
- Computes `proof_id = keccak256(proof_blob)`
- Calls `verify_proof_with_stored_vk()` or `verify_proof()`
- Calls `is_verified()` to confirm

**Option B: Manual invocation**

```bash
# Pack proof blob: [4-byte count][public_inputs][proof]
# (this is complex, use the Python script or write your own packer)

stellar contract invoke \
  --id <CONTRACT_ID> \
  --source alice \
  --network local \
  -- verify_proof_with_stored_vk \
  --proof-blob <HEX_ENCODED_PACKED_BLOB>
```

#### 6. Query Verification Status

```bash
# Get proof_id from verify_proof() response or compute it:
# proof_id = keccak256(proof_blob)

stellar contract invoke \
  --id <CONTRACT_ID> \
  --source alice \
  --network local \
  -- is_verified \
  --proof-id <PROOF_ID_HEX>
```

Returns `true` if the proof has been verified.

---

## Integration with Other Contracts

The verifier is designed to be **composable**—other contracts can call it to verify proofs as part of their logic.

### Example: Using in Your Contract

```rust
use soroban_sdk::{contract, contractimpl, Env, Address, Bytes, BytesN, Symbol};

#[contract]
pub struct MyApp;

#[contractimpl]
impl MyApp {
    pub fn do_something_with_proof(
        env: Env,
        verifier: Address,      // UltraHonkVerifierContract address
        proof_blob: Bytes,
    ) {
        // Verify the proof
        let proof_id: BytesN<32> = env.invoke_contract(
            &verifier,
            &Symbol::new(&env, "verify_proof_with_stored_vk"),
            (proof_blob,).into_val(&env)
        );

        // proof_id is returned on success
        // Now you can trust the public inputs in the proof!

        // ... your application logic using the verified public inputs ...
    }
}
```

See [tornado_classic/contracts/src/mixer.rs:187-192](tornado_classic/contracts/src/mixer.rs#L187-L192) for a real example.

---

## Technical Deep Dives

### The UltraHonk Proof System

**UltraHonk** is a zkSNARK proof system developed by Aztec Protocol:

- **Curve**: BN254 (Barreto-Naehrig curve with 254-bit prime)
- **Proof size**: ~14 KB (440-456 field elements × 32 bytes)
- **Verification key size**: ~9 KB (27 elliptic curve points + metadata)
- **Security level**: ~128-bit security

**Verification algorithm** (simplified):
1. Parse VK and proof into elliptic curve points and scalars
2. Compute pairing checks using BN254 pairing
3. Verify polynomial commitments match claimed evaluations
4. Check consistency of public inputs

The `ultrahonk_rust_verifier` library (dependency of this contract) implements this in pure Rust using `ark-bn254` for elliptic curve operations.

### Why BN254 Instead of BLS12-381?

Stellar's native ZK support uses BLS12-381 curves (mentioned in the search results). However:
- Noir/Barretenberg ecosystem uses BN254
- BN254 has slightly faster pairings
- This contract is **ecosystem-agnostic**—it brings Noir to Soroban even without native precompiles

If/when Soroban adds BN254 precompiles, this contract could be optimized to use them (similar to how Ethereum uses precompiles for alt_bn128).

### Contract Size Constraints

Soroban has a **128 KiB WASM limit**. This contract is large because:
- Elliptic curve arithmetic in pure Rust/WASM
- BN254 field operations
- No native precompiles (yet)

**Current status**: The contract fits within the limit using aggressive optimization (`opt-level = "z"`, `lto = true`).

**Optimization tips** (from [README.md:112](README.md#L112)):
```toml
[profile.release]
opt-level = "z"      # Optimize for size
lto = true           # Link-time optimization
codegen-units = 1    # Single codegen unit for better optimization
panic = "abort"      # Don't unwind on panic (smaller)
strip = true         # Strip debug symbols
```

If you exceed 128 KiB, use `stellar contract optimize` (wraps wasm-opt).

### The Keccak256 Hash in Python Script

The [invoke_ultrahonk.py](scripts/invoke_ultrahonk.py#L112-L146) script includes a **minimal Keccak-256 implementation** with no external dependencies (lines 37-146):

```python
def keccak256(data: bytes) -> bytes:
    # Full Keccak-f[1600] permutation implementation
    # Used to compute proof_id = keccak256(proof_blob)
```

**Why include this?**
- Allows the script to compute `proof_id` locally
- No need for external crypto libraries
- Educational: shows the full Keccak algorithm

---

## Why This Architecture?

### Design Decisions Explained

1. **Why separate VK storage?**
   - VKs are ~9 KB—expensive to send with every proof
   - `set_vk()` once, then use `verify_proof_with_stored_vk()` repeatedly
   - Saves gas/resources

2. **Why store proof_id instead of full proof?**
   - Proofs are ~14 KB—too expensive to store
   - `proof_id = keccak256(proof_blob)` is only 32 bytes
   - Other contracts can query `is_verified(proof_id)` cheaply

3. **Why manual JSON parsing?**
   - `serde_json` is huge (~100+ KB in WASM)
   - VK format is fixed and simple (array of hex strings)
   - Custom parser is <2 KB in WASM

4. **Why support both 440 and 456 field proofs?**
   - Different Barretenberg versions produce different proof sizes
   - Contract is forward/backward compatible

5. **Why Tornado Classic example?**
   - Demonstrates real-world privacy use case
   - Shows contract-to-contract interaction (Mixer ↔ Verifier)
   - Illustrates Poseidon2 hashing (ZK-friendly hash in Noir)

---

## Limitations & Future Work

### Current Limitations

1. **No native BN254 precompiles** on Soroban
   - Verification is expensive (all elliptic curve ops in WASM)
   - Testnet/Mainnet: expect high gas costs

2. **Contract size near limit**
   - Hard to add more features without exceeding 128 KiB
   - May need to split into multiple contracts for complex apps

3. **Educational/Experimental status**
   - Tornado example is NOT production-ready (no token custody, no audits)
   - Use for learning, not for real money

4. **Trusted setup** (inherited from UltraHonk)
   - BN254 curve uses a trusted setup ceremony
   - Not a limitation of this contract, but of the proof system itself

### Future Improvements

1. **Native precompiles**
   - If Stellar adds BN254 precompiles, update verifier to use them
   - 10-100x speedup possible

2. **Batch verification**
   - Verify multiple proofs in one call
   - Amortize setup costs

3. **Recursive proofs**
   - Verify proofs of proofs
   - Aggregate many proofs into one

4. **Different proof systems**
   - Support Groth16 (smaller proofs, ~200 bytes)
   - Support PLONK variants

---

## Comparison to Other Ecosystems

### Ethereum
- **Native BN254 precompiles** (`ecAdd`, `ecMul`, `ecPairing` at addresses 0x06-0x08)
- Groth16 verification costs ~150k gas (~$5-50 depending on gas price)
- UltraHonk support via Solidity verifier contracts

### Stellar/Soroban (This Project)
- **No native BN254 precompiles**
- All crypto in WASM (slower, more expensive)
- But still possible! This repo proves it.

### Comparison Table

| Feature | Ethereum | Stellar (this repo) |
|---------|----------|---------------------|
| Proof system | Groth16, PLONK, UltraHonk | UltraHonk |
| Curve | BN254 (alt_bn128) | BN254 |
| Precompiles | Yes (0x06-0x08) | No (pure WASM) |
| Verification cost | ~150k gas | TBD (likely higher) |
| Contract limit | 24 KB | 128 KB WASM |
| Language | Solidity | Rust |

---

## FAQs

### Q: Can I use this in production?

**A**: The verifier contract itself is functional, but:
- It hasn't been audited
- Gas costs may be prohibitive without native precompiles
- The Tornado example is educational only

For production, you'd need:
- Security audit
- Formal verification
- Gas optimization
- Integration with a token standard
- Anonymity set considerations (for mixers)

### Q: How do I debug proof verification failures?

1. **Check proof blob format**
   - Use `scripts/invoke_ultrahonk.py prepare` to inspect the blob
   - Ensure public inputs match circuit

2. **Verify locally first**
   - Use `bb verify` to check the proof off-chain
   - If it fails locally, the circuit or inputs are wrong

3. **Check VK**
   - Ensure the VK matches the circuit
   - Use `set_vk()` and verify the returned hash

4. **Enable diagnostics**
   - In tests: `env.host().set_diagnostic_level(DiagnosticLevel::Debug)`
   - Check contract logs for parse errors

### Q: Can I verify proofs from circuits with different sizes?

**A**: Yes, but each circuit needs its own VK. Either:
- Call `verify_proof()` with different VKs for different circuits
- Deploy multiple verifier instances with different stored VKs

### Q: What's the relationship to zkVerify?

**zkVerify** (mentioned in search results) is a separate project—a parachain focused on proof verification as a service. This repo is a **self-contained verifier** for Soroban, not related to zkVerify.

### Q: Can I use circuits with more than 20 public inputs?

**A**: Yes! The contract supports arbitrary numbers of public inputs. The `split_inputs_and_proof_bytes()` function handles it:
```
total_fields = num_public_inputs + 440 (or 456)
```

### Q: Why Poseidon2 instead of SHA-256 in the mixer?

**Poseidon2** is a ZK-friendly hash:
- Efficient in arithmetic circuits (few constraints)
- SHA-256 would require ~25,000 constraints vs ~100 for Poseidon2
- Faster proving and smaller circuits

---

## Resources

### Official Documentation
- [Noir Language Docs](https://noir-lang.org/docs)
- [Barretenberg](https://github.com/AztecProtocol/barretenberg)
- [Stellar Soroban Docs](https://developers.stellar.org/docs/build/smart-contracts)

### Key Dependencies
- `ultrahonk_rust_verifier` - [GitHub](https://github.com/yugocabrio/ultrahonk-rust-verifier)
- `ark-bn254` - Arkworks BN254 curve implementation
- `soroban-sdk` - Soroban smart contract SDK

### Related Projects
- Tornado Cash (Ethereum mixer, original inspiration)
- Aztec Protocol (Noir/Barretenberg creators)
- ZCash (pioneering zkSNARKs)

### Learning Resources
- [Why and How zk-SNARK Works](https://arxiv.org/abs/1906.07221) - Maksym Petkus
- [zkSNARKs in a Nutshell](https://chriseth.github.io/notes/articles/zksnarks/zksnarks.pdf) - Christian Reitwiessner
- [Zero Knowledge Proofs on Stellar](https://stellar.org/learn/zero-knowledge-proof)

---

## Conclusion

This repository demonstrates **ZK proof verification on Stellar/Soroban** without native cryptographic precompiles—a significant technical achievement. While currently experimental, it opens the door for:

1. **Privacy-preserving DeFi** (mixers, dark pools, private auctions)
2. **Verifiable computation** (off-chain processing with on-chain verification)
3. **Identity & credentials** (prove attributes without revealing data)
4. **Cross-chain bridges** (verify proofs from other chains)

The architecture is **modular**: write any circuit in Noir, prove it with Barretenberg, verify it in this Soroban contract. As Stellar adds native ZK support, this pattern will become even more powerful.

**Next steps for builders**:
1. Study the example circuits (simple_circuit, fib_chain, tornado_classic)
2. Write your own circuit for your use case
3. Test locally with the provided tools
4. Deploy to Stellar testnet
5. Measure gas costs and optimize

The future of privacy and scalability on Stellar starts here. 🚀

---

## Appendix: File Reference

| File | Purpose |
|------|---------|
| [src/lib.rs](src/lib.rs) | Main verifier contract implementation |
| [scripts/invoke_ultrahonk.py](scripts/invoke_ultrahonk.py) | Helper script for proof packing and invocation |
| [tests/integration_tests.rs](tests/integration_tests.rs) | Integration tests for verifier |
| [tests/simple_circuit/](tests/simple_circuit/) | Example: simple inequality circuit |
| [tests/fib_chain/](tests/fib_chain/) | Example: Fibonacci computation |
| [tornado_classic/](tornado_classic/) | Example: privacy mixer application |
| [tornado_classic/circuit/src/main.nr](tornado_classic/circuit/src/main.nr) | Mixer circuit (Merkle proof) |
| [tornado_classic/contracts/src/mixer.rs](tornado_classic/contracts/src/mixer.rs) | Mixer contract implementation |
| [tornado_classic/contracts/src/hash2.rs](tornado_classic/contracts/src/hash2.rs) | Poseidon2 hash implementation |

---

**Version**: 0.1.0
**Last Updated**: October 2025
**License**: See [LICENSE](LICENSE)
