import { getSelectedNetwork, getNetworkUrls } from "../contracts/util";

// Utility to get the correct Friendbot URL based on environment
export function getFriendbotUrl(address: string) {
  // Get the current network dynamically (checks localStorage for runtime selection)
  const currentNetwork = getSelectedNetwork();
  
  switch (currentNetwork) {
    case "FUTURENET":
      return `https://friendbot-futurenet.stellar.org/?addr=${address}`;
    case "TESTNET":
      return `https://friendbot.stellar.org/?addr=${address}`;
    case "LOCAL":
    case "NOIR":
    default:
      // For LOCAL, NOIR, and other custom networks, use the Horizon URL + /friendbot
      // This ensures LOCAL uses explicit localhost:8000 URL (not relative path)
      const { horizonUrl } = getNetworkUrls();
      return `${horizonUrl}/friendbot?addr=${address}`;
  }
}
