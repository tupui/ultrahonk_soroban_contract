import * as Client from 'ultrahonk_soroban_contract';
import { rpcUrl } from './util';

export default new Client.Client({
  networkPassphrase: 'Standalone Network ; February 2017',
  contractId: 'CAXMCB6EYJ6Z6PHHC3MZ54IKHAZV5WSM2OAK4DSGM2E2M6DJG4FX5CPB',
  rpcUrl,
  allowHttp: true,
  publicKey: undefined,
});
