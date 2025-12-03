import React, { useState, useTransition } from "react";
import { useNotification } from "../hooks/useNotification.ts";
import { useWallet } from "../hooks/useWallet.ts";
import { Button, Tooltip } from "@stellar/design-system";
import { getFriendbotUrl } from "../util/friendbot";
import { useWalletBalance } from "../hooks/useWalletBalance.ts";

const FundAccountButton: React.FC = () => {
  const { addNotification } = useNotification();
  const [isPending, startTransition] = useTransition();
  const { isFunded, isLoading } = useWalletBalance();
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const { address } = useWallet();

  if (!address) return null;

  const handleFundAccount = () => {
    startTransition(async () => {
      try {
        const response = await fetch(getFriendbotUrl(address));

        if (response.ok) {
          addNotification("Account funded successfully!", "success");
        } else {
          // Try to parse error response
          let errorMessage = `Error funding account: ${response.status} ${response.statusText}`;
          try {
            const body: unknown = await response.json();
            if (
              body !== null &&
              typeof body === "object" &&
              "detail" in body &&
              typeof body.detail === "string"
            ) {
              errorMessage = `Error funding account: ${body.detail}`;
            }
          } catch {
            // If JSON parsing fails, use the status message
            if (response.status === 404) {
              errorMessage = "Friendbot service not available. Make sure Stellar Quickstart is running on localhost:8000";
            }
          }
          addNotification(errorMessage, "error");
        }
      } catch (error) {
        const errorMessage = error instanceof Error 
          ? `Error funding account: ${error.message}` 
          : "Error funding account. Please try again.";
        addNotification(errorMessage, "error");
      }
    });
  };

  return (
    <div
      onMouseEnter={() => setIsTooltipVisible(true)}
      onMouseLeave={() => setIsTooltipVisible(false)}
    >
      <Tooltip
        isVisible={isTooltipVisible}
        isContrast
        title="Fund Account"
        placement="bottom"
        triggerEl={
          <Button
            disabled={isPending || isLoading || isFunded}
            onClick={handleFundAccount}
            variant="primary"
            size="md"
          >
            Fund Account
          </Button>
        }
      >
        <div style={{ width: "13em" }}>
          {isFunded
            ? "Account is already funded"
            : "Fund your account using the Stellar Friendbot"}
        </div>
      </Tooltip>
    </div>
  );
};

export { FundAccountButton as default };
