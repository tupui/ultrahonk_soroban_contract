import * as Client from 'guess_the_number';
import { rpcUrl } from './util';

export default new Client.Client({
  networkPassphrase: 'Standalone Network ; February 2017',
  contractId: 'CAURK5U2JXHODOVKYPIZXWT7ZZUV3H36AIC5G6NVZRIDN4HJTQTXHPQ2',
  rpcUrl,
  allowHttp: true,
  publicKey: undefined,
});
