// src/resolver.ts
import { Resolver } from 'did-resolver';
import { getResolver } from 'ethr-did-resolver';

const REGISTRY = '0x03d5003bf0e79C5F5223588F347ebA39AfbC3818';

export async function resolveDID(did: string, rpcUrl: string) {
  const ethrResolver = getResolver({
    networks: [
      {
        name: 'sepolia',
        chainId: 11155111,
        rpcUrl,
        registry: REGISTRY,
      },
    ],
  });

  const resolver = new Resolver(ethrResolver);
  const result = await resolver.resolve(did);

  if (result.didResolutionMetadata.error) {
    throw new Error(result.didResolutionMetadata.error);
  }

  return result.didDocument;
}