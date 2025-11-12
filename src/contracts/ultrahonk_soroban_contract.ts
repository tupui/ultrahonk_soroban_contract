import * as Client from 'ultrahonk_soroban_contract';
import { rpcUrl } from './util';

export default new Client.Client({
  networkPassphrase: 'Standalone Network ; February 2017',
  contractId: 'CA6UBZSOZ7OHUZ5JSRUBWGCGYYKEEIPPAYGWLXWMWMGPL5UHDF5724TO',
  rpcUrl,
  allowHttp: true,
  publicKey: undefined,
});
