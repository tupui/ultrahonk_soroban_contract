import React from "react";
import { Layout, Text } from "@stellar/design-system";
import { Sudoku } from "../components/Sudoku";

const Home: React.FC = () => (
  <Layout.Content>
    <Layout.Inset>
      <Text as="h1" size="xl">
        Sudoku Proof Generator
      </Text>
      <Text as="p" size="md">
        Solve Sudoku puzzles and generate zero-knowledge proofs that verify your solution
        on the Stellar blockchain using UltraHonk proof system.
      </Text>
      <Sudoku />
    </Layout.Inset>
  </Layout.Content>
);

export default Home;
