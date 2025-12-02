import { z } from "zod";
import { WalletNetwork } from "@creit.tech/stellar-wallets-kit";
import { Network, NetworkType } from "../debug/types/types";
import storage from "../util/storage";

const envSchema = z.object({
  PUBLIC_STELLAR_NETWORK: z.enum([
    "PUBLIC",
    "FUTURENET",
    "TESTNET",
    "LOCAL",
    "STANDALONE", // deprecated in favor of LOCAL
  ] as const),
  PUBLIC_STELLAR_NETWORK_PASSPHRASE: z.nativeEnum(WalletNetwork),
  PUBLIC_STELLAR_RPC_URL: z.string(),
  PUBLIC_STELLAR_HORIZON_URL: z.string(),
  PUBLIC_GUESS_THE_PUZZLE_CONTRACT_ID: z.string().optional(),
  PUBLIC_ULTRAHONK_CONTRACT_ID: z.string().optional(),
});

const parsed = envSchema.safeParse(import.meta.env);

const env: z.infer<typeof envSchema> = parsed.success
  ? parsed.data
  : {
      PUBLIC_STELLAR_NETWORK: "LOCAL",
      PUBLIC_STELLAR_NETWORK_PASSPHRASE: WalletNetwork.STANDALONE,
      PUBLIC_STELLAR_RPC_URL: "http://localhost:8000/rpc",
      PUBLIC_STELLAR_HORIZON_URL: "http://localhost:8000",
      PUBLIC_GUESS_THE_PUZZLE_CONTRACT_ID: undefined,
      PUBLIC_ULTRAHONK_CONTRACT_ID: undefined,
    };

// Check localStorage for runtime-selected network first, fall back to env var
const getSelectedNetwork = (): string => {
  const selected = storage.getItem("selectedNetwork");
  if (selected) {
    return selected;
  }
  return env.PUBLIC_STELLAR_NETWORK === "STANDALONE"
    ? "LOCAL"
    : env.PUBLIC_STELLAR_NETWORK;
};

export const stellarNetwork = getSelectedNetwork();

// Get network passphrase based on selected network
const getNetworkPassphraseForNetwork = (network: string): WalletNetwork => {
  switch (network) {
    case "LOCAL":
    case "NOIR":
      return WalletNetwork.STANDALONE;
    case "TESTNET":
      return WalletNetwork.TESTNET;
    case "FUTURENET":
      return WalletNetwork.FUTURENET;
    case "PUBLIC":
      return WalletNetwork.PUBLIC;
    default:
      return env.PUBLIC_STELLAR_NETWORK_PASSPHRASE;
  }
};

// Get current network passphrase (dynamically checks current network)
export const getNetworkPassphrase = (): WalletNetwork => {
  const currentNetwork = getSelectedNetwork();
  return getNetworkPassphraseForNetwork(currentNetwork);
};

export const networkPassphrase = getNetworkPassphraseForNetwork(stellarNetwork);

const stellarEncode = (str: string) => {
  return str.replace(/\//g, "//").replace(/;/g, "/;");
};

export const labPrefix = () => {
  // For LOCAL network, always use localhost URLs
  const localHorizonUrl = "http://localhost:8000";
  const localRpcUrl = "http://localhost:8000/rpc";
  
  switch (stellarNetwork) {
    case "LOCAL":
      return `http://localhost:8000/lab/transaction-dashboard?$=network$id=custom&label=Custom&horizonUrl=${stellarEncode(localHorizonUrl)}&rpcUrl=${stellarEncode(localRpcUrl)}&passphrase=${stellarEncode(networkPassphrase)};`;
    case "NOIR":
      return `https://lab.stellar.org/transaction-dashboard?$=network$id=custom&label=NOIR&horizonUrl=${stellarEncode(horizonUrl)}&rpcUrl=${stellarEncode(rpcUrl)}&passphrase=${stellarEncode(networkPassphrase)};`;
    case "PUBLIC":
      return `https://lab.stellar.org/transaction-dashboard?$=network$id=mainnet&label=Mainnet&horizonUrl=${stellarEncode(horizonUrl)}&rpcUrl=${stellarEncode(rpcUrl)}&passphrase=${stellarEncode(networkPassphrase)};`;
    case "TESTNET":
      return `https://lab.stellar.org/transaction-dashboard?$=network$id=testnet&label=Testnet&horizonUrl=${stellarEncode(horizonUrl)}&rpcUrl=${stellarEncode(rpcUrl)}&passphrase=${stellarEncode(networkPassphrase)};`;
    case "FUTURENET":
      return `https://lab.stellar.org/transaction-dashboard?$=network$id=futurenet&label=Futurenet&horizonUrl=${stellarEncode(horizonUrl)}&rpcUrl=${stellarEncode(rpcUrl)}&passphrase=${stellarEncode(networkPassphrase)};`;
    default:
      return `https://lab.stellar.org/transaction-dashboard?$=network$id=testnet&label=Testnet&horizonUrl=${stellarEncode(horizonUrl)}&rpcUrl=${stellarEncode(rpcUrl)}&passphrase=${stellarEncode(networkPassphrase)};`;
  }
};

// Get RPC and Horizon URLs based on selected network
const getNetworkUrlsForNetwork = (network: string): { rpcUrl: string; horizonUrl: string } => {
  switch (network) {
    case "LOCAL":
      return {
        rpcUrl: "http://localhost:8000/rpc",
        horizonUrl: "http://localhost:8000",
      };
    case "NOIR":
      return {
        rpcUrl: "https://noir-local.stellar.buzz/soroban/rpc",
        horizonUrl: "https://noir-local.stellar.buzz",
      };
    case "TESTNET":
      return {
        rpcUrl: "https://soroban-testnet.stellar.org:443",
        horizonUrl: "https://horizon-testnet.stellar.org",
      };
    case "FUTURENET":
      return {
        rpcUrl: "https://rpc-futurenet.stellar.org:443",
        horizonUrl: "https://horizon-futurenet.stellar.org",
      };
    case "PUBLIC":
      return {
        rpcUrl: "https://soroban-rpc.mainnet.stellar.org:443",
        horizonUrl: "https://horizon.stellar.org",
      };
    default:
      // Fall back to env vars if network not recognized
      return {
        rpcUrl: env.PUBLIC_STELLAR_RPC_URL,
        horizonUrl: env.PUBLIC_STELLAR_HORIZON_URL,
      };
  }
};

// Get current network URLs (dynamically checks current network)
export const getNetworkUrls = (): { rpcUrl: string; horizonUrl: string } => {
  const currentNetwork = getSelectedNetwork();
  return getNetworkUrlsForNetwork(currentNetwork);
};

const networkUrls = getNetworkUrlsForNetwork(stellarNetwork);

// NOTE: needs to be exported for contract files in this directory
export const rpcUrl = networkUrls.rpcUrl;
export const horizonUrl = networkUrls.horizonUrl;

const networkToId = (network: string): NetworkType => {
  switch (network) {
    case "PUBLIC":
      return "mainnet";
    case "TESTNET":
      return "testnet";
    case "FUTURENET":
      return "futurenet";
    case "NOIR":
    case "LOCAL":
    default:
      return "custom";
  }
};

export const network: Network = {
  id: networkToId(stellarNetwork),
  label: stellarNetwork.toLowerCase(),
  passphrase: networkPassphrase,
  rpcUrl: rpcUrl,
  horizonUrl: horizonUrl,
};

/**
 * Get the guess_the_puzzle contract ID.
 * Priority: 1. Storage override (user input), 2. Environment variable, 3. Fallback value
 * @param skipStorage - If true, skip storage check and return env var directly
 */
export const getGuessThePuzzleContractId = (skipStorage = false): string => {
  if (!skipStorage) {
    // First check storage for user override
    const stored = storage.getItem('contractId', 'safe');
    if (stored) {
      return stored;
    }
  }
  // Fall back to environment variable (check both parsed env and import.meta.env as fallback)
  const envContractId = env.PUBLIC_GUESS_THE_PUZZLE_CONTRACT_ID || import.meta.env.PUBLIC_GUESS_THE_PUZZLE_CONTRACT_ID;
  return envContractId || 'CCOBCE3MIRXNKA7AMWT2Y5R6IU6A734MM6OM67X7QQHBZTC4NP7D2SJT';
};

/**
 * Get the ultrahonk_soroban_contract ID.
 * Priority: 1. Storage override (user input), 2. Environment variable, 3. Fallback value
 * @param skipStorage - If true, skip storage check and return env var directly
 */
export const getUltrahonkContractId = (skipStorage = false): string => {
  if (!skipStorage) {
    // First check storage for user override
    const stored = storage.getItem('ultrahonkContractId', 'safe');
    if (stored) {
      return stored;
    }
  }
  // Fall back to environment variable (check both parsed env and import.meta.env as fallback)
  const envContractId = env.PUBLIC_ULTRAHONK_CONTRACT_ID || import.meta.env.PUBLIC_ULTRAHONK_CONTRACT_ID;
  return envContractId || 'CCYFHQLAPB7CHBBE7QIN2QEBEBJPSGRJ2OJ4JPCHIN5IPKTVQ7YCR2CI';
};
