#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, Address, Bytes, BytesN, Env, Symbol};


mod ultrahonk_contract {
    soroban_sdk::contractimport!(file = "ultrahonk_soroban_contract.wasm");
}

mod error;
mod xlm;

use error::Error;

#[contract]
pub struct GuessThePuzzle;

pub const THE_PUZZLE: &Symbol = &symbol_short!("n");
pub const ADMIN_KEY: &Symbol = &symbol_short!("ADMIN");

pub const ULTRAHONK_CONTRACT_ADDRESS: &str = "CAXMCB6EYJ6Z6PHHC3MZ54IKHAZV5WSM2OAK4DSGM2E2M6DJG4FX5CPB";


#[contractimpl]
impl GuessThePuzzle {
    /// Constructor to initialize the contract with an admin and a random number
    pub fn __constructor(env: &Env, admin: Address) {
        // Require auth from the admin to make the transfer
        admin.require_auth();
        // This is for testing purposes. Ensures that the XLM contract set up for unit testing and local network
        xlm::register(env, &admin);
        // Send the contract an amount of XLM to play with
        xlm::token_client(env).transfer(
            &admin,
            env.current_contract_address(),
            &xlm::to_stroops(10),
        );
        // Set the admin in storage
        Self::set_admin(env, admin);
    }

    // Set a new puzzle to play
    pub fn set_puzzle(env: Env, puzzle: Bytes) {
        Self::require_admin(&env);
        env.storage().instance().set(THE_PUZZLE, &puzzle);
    }

    /// Verify the puzzle is correctly solved
    pub fn verify_puzzle(env: Env, guesser: Address, vk_json: Bytes, proof_blob: Bytes) -> Result<BytesN<32>, Error> {
        // take a fee before doing anything and starting any validation
        guesser.require_auth();
        let xlm_client = xlm::token_client(&env);
        let contract_address = env.current_contract_address();
        // Methods `try_*` will return an error if the method fails
        // `.map_err` lets us convert the error to our custom Error type
        let _ = xlm_client
                .try_transfer(&guesser, &contract_address, &xlm::to_stroops(1))
                .map_err(|_| Error::FailedToTransferFromGuesser)?;

        // proof validation itself
        let ultrahonk_contract_address = Address::from_str(&env, ULTRAHONK_CONTRACT_ADDRESS);
        let ultrahonk_client = ultrahonk_contract::Client::new(&env, &ultrahonk_contract_address);

        match ultrahonk_client.try_verify_proof(&vk_json, &proof_blob) {
            Ok(Ok(result)) => {
                let balance = xlm_client.balance(&contract_address);
                if balance == 0 {
                    return Err(Error::NoBalanceToTransfer);
                }
                let _ = xlm_client
                    .try_transfer(&contract_address, &guesser, &balance)
                    .map_err(|_| Error::FailedToTransferToGuesser)?;
                Ok(result)
            },
            _ => Ok(BytesN::from_array(&env, &[0; 32])),
        }
    }

    pub fn prize_pot(env: &Env) -> i128 {
        let xlm_client = xlm::token_client(&env);
        let contract_address = env.current_contract_address();
        xlm_client.balance(&contract_address)
    }

    /// Add more funds to the contract, in XLM
    pub fn add_funds(env: &Env, funder: Address, amount: u64) {
        funder.require_auth();
        let contract_address = env.current_contract_address();
        xlm::token_client(env).transfer(&funder, &contract_address, &xlm::to_stroops(amount));
    }

    /// Upgrade the contract to new wasm. Only callable by admin.
    pub fn upgrade(env: &Env, new_wasm_hash: BytesN<32>) {
        Self::require_admin(env);
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    /// Read only function to get the current number
    pub fn puzzle(env: &Env) -> Bytes {
        env.storage().instance().get(THE_PUZZLE).unwrap()
    }

    /// Get current admin
    pub fn admin(env: &Env) -> Option<Address> {
        env.storage().instance().get(ADMIN_KEY)
    }

    /// Set a new admin. Only callable by admin.
    pub fn set_admin(env: &Env, admin: Address) {
        // Check if admin is already set
        if env.storage().instance().has(ADMIN_KEY) {
            panic!("admin already set");
        }
        env.storage().instance().set(ADMIN_KEY, &admin);
    }

    /// Private helper function to require auth from the admin
    fn require_admin(env: &Env) {
        let admin = Self::admin(env).expect("admin not set");
        admin.require_auth();
    }
}

