import * as Client from 'guess_the_puzzle';
import { rpcUrl } from './util';

export default new Client.Client({
  networkPassphrase: 'Standalone Network ; February 2017',
  contractId: 'CBXWA6DTDZTSOQ4LSUDW4XFUJSZK5MA5T5HEI5GD5ZJGW2OBEHTS4J4W',
  rpcUrl,
  allowHttp: true,
  publicKey: undefined,
});
