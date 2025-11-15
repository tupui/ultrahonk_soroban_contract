import * as Client from 'guess_the_puzzle';
import { rpcUrl } from './util';
import storage from '../util/storage';

const DEFAULT_CONTRACT_ID = 'CBXWA6DTDZTSOQ4LSUDW4XFUJSZK5MA5T5HEI5GD5ZJGW2OBEHTS4J4W';

const getContractId = (): string => {
  const stored = storage.getItem('contractId', 'safe');
  return stored || DEFAULT_CONTRACT_ID;
};

// Create contract client instance
const contractClient = new Client.Client({
  networkPassphrase: 'Standalone Network ; February 2017',
  contractId: getContractId(),
  rpcUrl,
  allowHttp: true,
  publicKey: undefined,
});

// Function to update contract ID when storage changes
export const updateContractId = () => {
  const newContractId = getContractId();
  contractClient.options.contractId = newContractId;
};

export default contractClient;
