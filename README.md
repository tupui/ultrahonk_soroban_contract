# Sudoku with a Noir Ultrahonk Stellar smart contract

This demo repository is leveraging Scaffold Stellar:

http://scaffoldstellar.org

It shows how to use the Noir Ultrahonk Stellar smart contract. Presented at NoirCon3!

https://github.com/tupui/Academia/blob/main/Conf/NoirCon3.pdf

The game is simple, after you solve a Sudoku grid, you can verify your solution
and if it's valid generate a proof client side that you solved the problem.
This proof is then sent to the Stellar smart contract `guess-the-puzzle` which
itself calls `ultrahonk-soroban-contract` to verify it. Upon proof validation,
the contract's balance is transferred to the guesser. If the proof is incorrect,
the guesser incurs a fee for trying which goes increases the contract's balance. 

### Pre-requisites

Follow the installation instructions for Scaffold Stellar. Then we need to install:

- barretenberg v0.87.0
- nargo 1.0.0-beta.9

```bash
curl -L \
  https://github.com/AztecProtocol/aztec-packages/releases/download/v0.87.0/barretenberg-arm64-darwin.tar.gz \
  -o /tmp/bb.tar.gz
tar -xzf /tmp/bb.tar.gz -C ~/.bb/bin

curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install
noirup -v 1.0.0-beta.9
```

From there you can run `nargo` to verify your circuit and use `bb` to make proofs and verification keys:
```bash
// 
nargo compile
bb write_vk -b target/noir_sudoku.json -o target --scheme ultra_honk --oracle_hash keccak --output_format bytes_and_fields
```

This creates a `target/vk_fields.json` we then need to create a bin format:
```bash
preprocess_vk_cli vk_fields.json public/circuits
```

### Getting started

```bash
# Starts Quickstart (stellar-core + RPC + Horizon + Friendbot) in a container
stellar container start local --limits unlimited
```

* The `--limits unlimited` preset sets Stellar smart contract resource limits to their maximum values for local mode.
* Quickstart’s local mode exposes RPC on `http://localhost:8000` and includes a Friendbot faucet by default.

Then you can use Scaffold Stellar:

```bash
bun run dev
```

Scaffold Stellar is a powerful utility which helps you throughout your entire
development life cycle. Everytime you change the contract, or frontend, it
recompiles the project and frees you from all the repetitive tasks such as
re-deployment, key management, bindings generation.

Checkout the documentation and tutorial for more.

### Push it further!

With the upcoming protocol 25, we are getting support for BN254. We can rewrite
the Ultrahonk contract which would allow to use normal limits. This is live
on Futurenet. See:

https://github.com/jayz22/soroban-examples/tree/p25-preview/p25-preview

On the contract itself, there is another problem. We are not checking the
input puzzle and restrict the proof validation to a given puzzle. You can fix
it!

### Useful links

Noir verifier: https://github.com/yugocabrio/ultrahonk-rust-verifier
Risk0 verifier: https://github.com/NethermindEth/stellar-risc0-verifier

Some games:

https://github.com/kalepail/ultrahonk_soroban_contract/tree/zkp-maze__frontend
https://github.com/kalepail/zkp-pong/tree/multi
https://github.com/kalepail/zkp-maze
