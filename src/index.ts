// src/index.ts
import 'dotenv/config';
import { Wallet } from 'ethers';                          // ← v6
import { generateIdentity } from './keygen';
import { buildEthrDID, addServiceEndpoint, delegateKey } from './registry';
import { resolveDID } from './resolver';

async function main() {
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  const privateKey = process.env.PRIVATE_KEY;

  if (!rpcUrl) throw new Error('Missing SEPOLIA_RPC_URL in .env');
  if (!privateKey) throw new Error('Missing PRIVATE_KEY in .env');
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error(`PRIVATE_KEY is malformed. Got: "${privateKey.slice(0, 10)}..."`);
  }

  const identity = generateIdentity('sepolia', privateKey);
  console.log('Node DID:', identity.did);

  const ethrDid = buildEthrDID(privateKey, rpcUrl);

  await addServiceEndpoint(ethrDid, 'https://node-14.parking.example.com:9090');

  const vehicleAddress = Wallet.createRandom().address;
  console.log('Delegating to vehicle:', vehicleAddress);
  await delegateKey(ethrDid, vehicleAddress, 'sigAuth', 3600);

  const didDoc = await resolveDID(identity.did, rpcUrl);
  console.log('\nResolved DID Document:');
  console.log(JSON.stringify(didDoc, null, 2));
}

main().catch(console.error);