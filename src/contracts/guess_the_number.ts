import * as Client from 'guess_the_number';
import { rpcUrl } from './util';

export default new Client.Client({
  networkPassphrase: 'Standalone Network ; February 2017',
  contractId: 'CAW6JTAFL5LA5BBO4GIMPMSTYHFVMPAEKKT7NFYXLTNJ525FP4IYFK6W',
  rpcUrl,
  allowHttp: true,
  publicKey: undefined,
});
