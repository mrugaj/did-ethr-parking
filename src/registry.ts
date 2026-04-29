// src/registry.ts
import { EthrDID, DelegateTypes } from 'ethr-did';
import { Wallet, JsonRpcProvider } from 'ethers';   // ← single 'ethers' import

const REGISTRY = '0x03d5003bf0e79C5F5223588F347ebA39AfbC3818';

export function buildEthrDID(privateKey: string, rpcUrl: string) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error(`PRIVATE_KEY format invalid: "${privateKey.slice(0, 10)}..."`);
  }
  if (!rpcUrl) throw new Error('SEPOLIA_RPC_URL is missing');

  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(privateKey, provider);

  return new EthrDID({
    identifier: wallet.address,
    privateKey,
    provider: provider as any,
    chainNameOrId: 'sepolia',
    registry: REGISTRY,
    txSigner: wallet as any,
  });
}

export async function addServiceEndpoint(
  ethrDid: EthrDID,
  serviceUrl: string,
  validitySeconds = 86400 * 365
) {
  const txHash = await ethrDid.setAttribute(
    'did/svc/ParkingService',
    serviceUrl,
    validitySeconds
  );
  console.log('setAttribute tx:', txHash);
  return txHash;
}

export async function delegateKey(
  ethrDid: EthrDID,
  delegateAddress: string,
  type: 'veriKey' | 'sigAuth' | 'enc' = 'sigAuth',
  validitySeconds = 3600
) {
  const txHash = await ethrDid.addDelegate(delegateAddress, {
    delegateType: type as DelegateTypes,
    expiresIn: validitySeconds,
  });
  console.log('addDelegate tx:', txHash);
  return txHash;
}