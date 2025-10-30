# UltraHonk Proof Generator

A browser-based application for generating and verifying UltraHonk zero-knowledge proofs on Stellar blockchain.

## Overview

This application provides a complete workflow for:
1. **Generating proofs** - Execute Noir circuits client-side and generate UltraHonk proofs using bb.js
2. **On-chain verification** - Submit proofs to a Stellar/Soroban smart contract for verification
3. **Cost analysis** - View transaction fees and CPU instructions consumed during verification

## Features

- 🔐 **Client-side proof generation** - Generate proofs entirely in the browser using WebAssembly
- ⛓️ **Stellar integration** - Submit proofs to Stellar blockchain for on-chain verification
- 📊 **Multiple circuits** - Support for simple_circuit, fib_chain, and zkp_maze
- 🎨 **Dynamic UI** - Auto-generated input forms based on circuit ABIs
- 📈 **Cost tracking** - Display fees (in XLM and stroops) and CPU instructions
- 🔍 **Proof details** - View proof IDs, sizes, and verification status

## Quick Start

### Prerequisites

- [Bun](https://bun.com) v1.3.1 or higher

### Installation

```bash
# Install dependencies
bun install
```

### Running the Application

```bash
# Start the development server
bun run dev
```

The application will be available at http://localhost:3001

## Architecture

### Project Structure

```
frontend/
├── src/
│   ├── main.ts              # Main application & UI logic
│   ├── NoirService.ts       # Proof generation service
│   ├── StellarService.ts    # Stellar blockchain integration
│   ├── polyfills.ts         # Browser polyfills for Node.js modules
│   └── styles.css           # Application styles
├── public/
│   ├── circuits/            # Compiled Noir circuits and VKs
│   │   ├── simple_circuit.json
│   │   ├── simple_circuit_vk.json
│   │   ├── fib_chain.json
│   │   ├── fib_chain_vk.json
│   │   ├── zkp_maze.json
│   │   └── zkp_maze_vk.json
│   └── wasm/                # Noir WASM modules
│       ├── acvm_js_bg.wasm
│       └── noirc_abi_wasm_bg.wasm
├── index.html               # Main HTML page
├── vite.config.ts          # Vite configuration
└── package.json
```

### Core Components

#### NoirService

Handles Noir circuit execution and UltraHonk proof generation:
- Loads compiled circuits from JSON files
- Executes circuits with user inputs to generate witnesses
- Generates UltraHonk proofs using bb.js with keccak oracle hash
- Builds proof blobs compatible with the Stellar verifier contract
- Computes proof IDs as Keccak-256 hashes

#### StellarService

Manages interaction with Stellar blockchain:
- Submits proofs to the UltraHonk verifier contract
- Extracts CPU instructions from simulation data
- Retrieves transaction fees from results
- Queries on-chain verification status

#### Main Application

Provides the browser UI:
- Dynamic form generation based on circuit ABIs
- Input validation and type conversion
- Proof generation workflow
- Result display with detailed metrics

## Configuration

### Stellar Network

Default configuration (can be modified in `StellarService.ts`):
- **Contract ID**: `CCS7MNX4SQKFMJDLVBUXYYYUIKRJMONLJKF5VWF4CTBNNPGWJLEHMVSD`
- **RPC URL**: `https://noir-local.stellar.buzz/soroban/rpc`
- **Network**: Standalone Network ; February 2017

### Circuits

The application includes three pre-compiled circuits:

1. **simple_circuit** - Basic addition circuit (x + y)
2. **fib_chain** - Fibonacci sequence verification
3. **zkp_maze** - Maze path verification with 500-move solution

## Proof Generation Flow

1. User selects a circuit from the dropdown
2. Input form is dynamically generated based on circuit ABI
3. Default values are auto-populated for easier testing
4. User clicks "Generate Proof"
5. Application executes the circuit and generates witness
6. UltraHonk proof is generated using bb.js
7. Proof blob is constructed: `u32_be(total_fields) || public_inputs || proof`
8. Proof ID is computed as Keccak-256 hash of the proof blob
9. Proof is submitted to Stellar contract for verification
10. Results are displayed including:
    - Proof ID and size
    - Transaction hash
    - Verification status
    - CPU instructions consumed
    - Fee (in stroops and XLM)

## Key Technical Details

### Proof Blob Format

The proof blob follows this structure:
```
┌────────────────┬──────────────────┬─────────────┐
│   Header       │  Public Inputs   │    Proof    │
│  (4 bytes)     │  (n * 32 bytes)  │  (m bytes)  │
└────────────────┴──────────────────┴─────────────┘
```

- **Header**: Big-endian u32 indicating total number of 32-byte fields
- **Public Inputs**: Each public parameter encoded as a 32-byte big-endian field element
- **Proof**: Raw UltraHonk proof bytes from bb.js

### Public Input Encoding

Unlike bb.js's compact format (which strips leading zeros), this application encodes public inputs as full 32-byte field elements to match the contract's expectations. For example:

```typescript
// bb.js compact: 0x7d (1 byte for value 125)
// Our encoding:   0x00...007d (32 bytes)
```

This ensures compatibility with the Stellar verifier contract which expects fixed-size field elements.

## Development

### Adding a New Circuit

1. Compile the Noir circuit to JSON
2. Generate the verification key: `bb write_vk --oracle_hash keccak --output_format fields`
3. Place both files in `public/circuits/`:
   - `{circuit_name}.json`
   - `{circuit_name}_vk.json`
4. Add default values to `CIRCUIT_DEFAULTS` in `main.ts`
5. Circuit will automatically appear in the UI dropdown

### Building for Production

```bash
bun run build
```

This creates an optimized production build in the `dist/` directory.

## Troubleshooting

### WASM Loading Issues

If you encounter WASM loading errors:
1. Ensure CORS headers are properly set
2. Check that `Cross-Origin-Embedder-Policy` and `Cross-Origin-Opener-Policy` headers are configured
3. Verify WASM files are accessible in the public directory

### Proof Verification Failures

Common causes:
- Incorrect public input encoding (ensure 32-byte field elements)
- Wrong oracle hash (must use keccak, not poseidon)
- Mismatched VK and proof
- Network connectivity issues

## License

MIT
