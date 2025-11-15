import { useState, useEffect } from "react";
import { Button, Input, Text, Code } from "@stellar/design-system";
import { Box } from "./layout/Box";
import storage from "../util/storage";

const DEFAULT_CONTRACT_ID = 'CBXWA6DTDZTSOQ4LSUDW4XFUJSZK5MA5T5HEI5GD5ZJGW2OBEHTS4J4W';

const getContractId = (): string => {
  const stored = storage.getItem('contractId', 'safe');
  return stored || DEFAULT_CONTRACT_ID;
};

export const ContractConfig = () => {
  const [contractId, setContractId] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    // Load current contract ID on mount
    const currentId = getContractId();
    setContractId(currentId);
  }, []);

  const handleUpdate = () => {
    if (!contractId.trim()) {
      setMessage({ type: "error", text: "Contract ID cannot be empty" });
      return;
    }

    // Basic validation: Stellar contract IDs are 56 characters
    if (contractId.length !== 56) {
      setMessage({ type: "error", text: "Invalid contract ID format (must be 56 characters)" });
      return;
    }

    setIsUpdating(true);
    setMessage(null);

    try {
      // Store the contract ID
      storage.setItem('contractId', contractId);
      setMessage({ type: "success", text: "Contract address updated successfully! Please refresh the page for changes to take effect." });
      
      // Clear message after 5 seconds
      setTimeout(() => {
        setMessage(null);
      }, 5000);
    } catch (error: any) {
      setMessage({ type: "error", text: `Failed to update: ${error.message}` });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Box gap="md" direction="column">
      <Text as="h2" size="lg">
        Contract Configuration
      </Text>
      <Text as="p" size="sm" variant="secondary">
        Configure the contract address for the guess-the-puzzle contract. The contract ID must be 56 characters. Note: You may need to refresh the page after updating for changes to take effect.
      </Text>
      
      <Box gap="sm" direction="row" align="end" wrap="wrap">
        <Input
          label="Contract Address"
          id="contract-id"
          fieldSize="lg"
          value={contractId}
          onChange={(e) => {
            setContractId(e.target.value);
            setMessage(null);
          }}
          placeholder="Enter 56-character contract ID"
          style={{ flex: "1", minWidth: "300px" }}
        />
        <Button
          onClick={handleUpdate}
          disabled={isUpdating || !contractId.trim()}
          variant="primary"
          size="md"
        >
          {isUpdating ? "Updating..." : "Update"}
        </Button>
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

      <Box gap="xs" direction="column">
        <Text as="p" size="sm" variant="secondary">
          Current Contract ID:
        </Text>
        <Code size="sm">{getContractId()}</Code>
      </Box>
    </Box>
  );
};

