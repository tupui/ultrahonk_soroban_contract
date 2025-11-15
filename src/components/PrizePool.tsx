import { useState, useEffect, useCallback } from "react";
import { Button, Input, Text, Code } from "@stellar/design-system";
import { Box } from "./layout/Box";
import { useWallet } from "../hooks/useWallet";
import { StellarContractService } from "../services/StellarContractService";

const stellarService = new StellarContractService();

export const PrizePool = () => {
  const { address, signTransaction } = useWallet();
  const [balance, setBalance] = useState<{ stroops: string; xlm: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [amount, setAmount] = useState<string>("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadPrizePot = useCallback(async () => {
    if (!address) {
      setBalance(null);
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const result = await stellarService.getPrizePot(address);
      if (result.success) {
        setBalance({
          stroops: result.stroops,
          xlm: result.xlm,
        });
      } else {
        setMessage({ type: "error", text: result.error || "Failed to load prize pool balance" });
        setBalance({ stroops: "0", xlm: "0.0000000" });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to load prize pool balance" });
      setBalance({ stroops: "0", xlm: "0.0000000" });
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    loadPrizePot();
  }, [loadPrizePot]);

  const handleAddFunds = async () => {
    if (!address || !signTransaction) {
      setMessage({ type: "error", text: "Please connect your wallet" });
      return;
    }

    if (!amount.trim()) {
      setMessage({ type: "error", text: "Please enter an amount" });
      return;
    }

    // Convert XLM to stroops if user enters XLM amount
    // Assume if amount contains decimal point, it's XLM, otherwise stroops
    let amountInStroops: string;
    if (amount.includes(".")) {
      // XLM amount - convert to stroops
      const xlmAmount = parseFloat(amount);
      if (isNaN(xlmAmount) || xlmAmount <= 0) {
        setMessage({ type: "error", text: "Invalid amount" });
        return;
      }
      amountInStroops = Math.floor(xlmAmount * 10_000_000).toString();
    } else {
      // Stroops amount
      const stroopsAmount = parseInt(amount);
      if (isNaN(stroopsAmount) || stroopsAmount <= 0) {
        setMessage({ type: "error", text: "Invalid amount" });
        return;
      }
      amountInStroops = amount;
    }

    setIsAdding(true);
    setMessage(null);

    try {
      const result = await stellarService.addFunds(amountInStroops, signTransaction, address);
      
      if (result.success) {
        setMessage({ 
          type: "success", 
          text: `Successfully added funds! Transaction: ${result.txHash?.slice(0, 8)}...` 
        });
        setAmount("");
        // Refresh balance after successful transaction
        setTimeout(() => {
          loadPrizePot();
        }, 2000);
      } else {
        setMessage({ type: "error", text: result.error || "Failed to add funds" });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to add funds" });
    } finally {
      setIsAdding(false);
    }
  };

  if (!address) {
    return (
      <Box gap="md" direction="column">
        <Text as="h2" size="lg">
          Prize Pool
        </Text>
        <Text as="p" size="sm" variant="secondary">
          Connect your wallet to view and manage the prize pool
        </Text>
      </Box>
    );
  }

  return (
    <Box gap="md" direction="column">
      <Box gap="sm" direction="row" align="center" justify="space-between" wrap="wrap">
        <Text as="h2" size="lg">
          Prize Pool
        </Text>
        <Button
          onClick={loadPrizePot}
          disabled={isLoading}
          variant="secondary"
          size="sm"
        >
          {isLoading ? "Loading..." : "Refresh"}
        </Button>
      </Box>

      {isLoading && !balance ? (
        <Text as="p" size="sm" variant="secondary">
          Loading prize pool balance...
        </Text>
      ) : balance ? (
        <Box gap="sm" direction="column">
          <Box gap="xs" direction="row" align="baseline" wrap="wrap">
            <Text as="p" size="md" style={{ fontWeight: "bold" }}>
              Current Balance:
            </Text>
            <Text as="p" size="lg" style={{ fontWeight: "bold", color: "#00d4aa" }}>
              {balance.xlm} XLM
            </Text>
          </Box>
          <Text as="p" size="sm" variant="secondary">
            <Code size="sm">{balance.stroops} stroops</Code>
          </Text>
        </Box>
      ) : null}

      <Box gap="sm" direction="column">
        <Text as="h3" size="md">
          Add Funds to Prize Pool
        </Text>
        <Text as="p" size="sm" variant="secondary">
          Enter an amount in XLM. Funds will be transferred from your connected wallet to the prize pool.
        </Text>
        
        <Box gap="sm" direction="row" align="end" wrap="wrap">
          <Input
            label="Amount"
            id="add-funds-amount"
            fieldSize="lg"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setMessage(null);
            }}
            placeholder="Enter amount (XLM or stroops)"
            type="text"
            style={{ flex: "1", minWidth: "200px" }}
          />
          <Button
            onClick={handleAddFunds}
            disabled={isAdding || !amount.trim()}
            variant="primary"
            size="md"
          >
            {isAdding ? "Adding..." : "Add Funds"}
          </Button>
        </Box>
      </Box>

      {message && (
        <Text
          as="p"
          size="sm"
          style={{
            color: message.type === "success" ? "#00d4aa" : "#ff3864",
            marginTop: "8px",
          }}
        >
          {message.text}
        </Text>
      )}
    </Box>
  );
};

