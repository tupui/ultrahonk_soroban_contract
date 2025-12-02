import React from "react";
import { Layout, Text } from "@stellar/design-system";
import { Sudoku } from "../components/Sudoku";
import { ContractConfig } from "../components/ContractConfig";
import { PrizePool } from "../components/PrizePool";
import { Box } from "../components/layout/Box";

const Home: React.FC = () => {
  return (
    <Layout.Content>
      <Layout.Inset>
        <Text as="h1" size="xl">
          Sudoku Proof Generator
        </Text>
        <Text as="p" size="md">
          Solve Sudoku puzzles and generate zero-knowledge proofs that verify your solution
          on the Stellar blockchain using the UltraHonk proof system.
        </Text>

        <Text as="p" size="md">
          To validate the proof you either need to use a local node or select the NOIR network.
          In your wallet, use the following RPC https://noir-local.stellar.buzz/soroban/rpc and Horizon URL https://noir-local.stellar.buzz
        </Text>
        
        <Box gap="md" direction="column" style={{ marginTop: "2rem" }}>
          <ContractConfig />
          <PrizePool />
          <Sudoku />
        </Box>
      </Layout.Inset>
    </Layout.Content>
  );
};

export default Home;
