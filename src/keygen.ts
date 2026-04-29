// src/keygen.ts
import { Wallet, ethers } from 'ethers';

export interface NodeIdentity {
  address: string;
  privateKey: string;
  publicKey: string;
  did: string;
}

export function generateIdentity(
  network = 'sepolia',
  existingPrivateKey?: string
): NodeIdentity {
  const wallet = existingPrivateKey
    ? new Wallet(existingPrivateKey)
    : Wallet.createRandom();

  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    publicKey: wallet.signingKey.publicKey,   // v6: wallet.publicKey → wallet.signingKey.publicKey
    did: `did:ethr:${network}:${wallet.address}`,
  };
}