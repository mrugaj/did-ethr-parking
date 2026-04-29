# did-ethr-parking

Ethereum-based decentralized identity (`did:ethr`) for autonomous parking nodes on the Sepolia testnet. Each node or vehicle gets a self-sovereign, trustless identity anchored to the ERC-1056 DID Registry — no central authority required.

Built with [`ethr-did`](https://github.com/uport-project/ethr-did), [`ethr-did-resolver`](https://github.com/decentralized-identity/ethr-did-resolver), and ethers v6.

---

## Architecture

```
secp256k1 keypair
      │
      ▼
did:ethr:sepolia:0x...          ← identity string (no on-chain tx needed to create)
      │
      ▼
ERC-1056 Registry               0x03d5003bf0e79C5F5223588F347ebA39AfbC3818 (Sepolia)
      │
      ├── setAttribute()        → registers service endpoint (parking node gRPC/HTTP address)
      └── addDelegate()         → assigns ephemeral session key to a vehicle (TTL: 1 hr)
            │
            ▼
      On-chain event log        DIDAttributeChanged / DIDDelegateChanged
            │
            ▼
      ethr-did-resolver         replays event log → constructs DID Document in memory
            │
            ▼
      DID Document (JSON-LD)    verificationMethod, authentication, service endpoints
```

---

## Prerequisites

- Node.js 18+
- A Sepolia RPC URL — [Alchemy](https://alchemy.com) or [Infura](https://infura.io)
- A funded Sepolia wallet — get ETH from [Ethereum Sepolia Faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia)

---

## Installation

```bash
git clone https://github.com/mrugaj/did-ethr-parking
cd did-ethr-parking
npm install
```

---

## Configuration

Create a `.env` file in the project root:

```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
PRIVATE_KEY=0xYOUR_64_HEX_CHAR_PRIVATE_KEY
```

Rules for `PRIVATE_KEY`:
- Must start with `0x`
- Must be exactly 64 hex characters after the prefix
- Never commit this file — it is already in `.gitignore`

To generate a fresh keypair for testing:

```bash
node -e "
const { Wallet } = require('ethers');
const w = Wallet.createRandom();
console.log('PRIVATE_KEY=' + w.privateKey);
console.log('ADDRESS=' + w.address);
"
```

---

## Usage

```bash
npx ts-node src/index.ts
```

Expected output:

```
Node DID: did:ethr:sepolia:0xCC30C8B307F36531bb227C0DCC8095E5552B22Bf
setAttribute tx: 0x7a1461564d50e1b9731e9cb5522eb2563740438cade8cbfd4698261afb897ecb
Delegating to vehicle: 0x0a8C59025D125F16c1c12396AF00f2625a9bb7BE
addDelegate tx: 0xbe68f6b855b3f8f0a9c2d19b23fb1bbc96c9b510d9e6135d8efc2e328e9b3828

Resolved DID Document:
{
  "id": "did:ethr:sepolia:0xCC30C8B307F36531bb227C0DCC8095E5552B22Bf",
  "verificationMethod": [ ... ],
  "authentication": [ ... ],
  "service": [ { "type": "ParkingService", "serviceEndpoint": "..." } ]
}
```

---

## Project Structure

```
did-ethr-parking/
├── src/
│   ├── index.ts        entry point — wires keygen, registry, resolver
│   ├── keygen.ts       secp256k1 keypair generation and DID string formatting
│   ├── registry.ts     ERC-1056 registry interactions (setAttribute, addDelegate)
│   └── resolver.ts     DID Document resolution via ethr-did-resolver
├── .env                secrets (not committed)
├── .gitignore
├── package.json
└── tsconfig.json
```

---

## Module Reference

### `keygen.ts` — `generateIdentity(network?, existingPrivateKey?)`

Generates or loads a `secp256k1` identity and formats the `did:ethr` string.

```typescript
// Load existing key from env (production — deterministic)
const identity = generateIdentity('sepolia', process.env.PRIVATE_KEY);

// Generate a fresh random keypair (onboarding / testing only)
const identity = generateIdentity('sepolia');

// Returns:
// {
//   address:    '0xCC30C8...',
//   privateKey: '0xabc123...',
//   publicKey:  '0x04abcd...',
//   did:        'did:ethr:sepolia:0xCC30C8...'
// }
```

### `registry.ts` — `buildEthrDID(privateKey, rpcUrl)`

Constructs an `EthrDID` instance connected to the Sepolia registry.

```typescript
const ethrDid = buildEthrDID(process.env.PRIVATE_KEY, process.env.SEPOLIA_RPC_URL);
```

### `registry.ts` — `addServiceEndpoint(ethrDid, serviceUrl, validitySeconds?)`

Registers a service endpoint on-chain via `setAttribute`. Default validity: 1 year. Gas cost: ~50,000.

```typescript
await addServiceEndpoint(ethrDid, 'https://node-14.parking.example.com:9090');
```

The attribute name is hardcoded to `did/svc/ParkingService` which appears as `type: "ParkingService"` in the resolved DID Document.

### `registry.ts` — `delegateKey(ethrDid, delegateAddress, type?, validitySeconds?)`

Assigns an ephemeral signing key to a vehicle address via `addDelegate`. Default validity: 1 hour. Gas cost: ~45,000.

```typescript
await delegateKey(ethrDid, vehicleAddress, 'sigAuth', 3600);
```

`delegateType` options:
- `sigAuth` — key appears in both `verificationMethod` and `authentication` (needed for VP signing)
- `veriKey` — key appears in `verificationMethod` only
- `enc` — key for encryption use cases

### `resolver.ts` — `resolveDID(did, rpcUrl)`

Replays the registry event log and returns the constructed JSON DID Document. No centralised document store involved.

```typescript
const didDocument = await resolveDID(identity.did, process.env.SEPOLIA_RPC_URL);
```

---

## Smart Contract Reference

| Network | Registry Address |
|---------|-----------------|
| Sepolia (chainId: 11155111) | `0x03d5003bf0e79C5F5223588F347ebA39AfbC3818` |
| Mainnet (chainId: 1) | `0xdca7ef03e98e0dc2b855be647c39abe984fcf21b` |
| Polygon (chainId: 137) | `0xdca7ef03e98e0dc2b855be647c39abe984fcf21b` |

The Sepolia registry uses `legacyNonce: false` (new nonce scheme via `nonce(identity)`). The `ethr-did` library handles this automatically when `chainNameOrId: 'sepolia'` is set.

---

## Vehicle Session Key Pattern

The intended flow for parking sessions:

```
1. Vehicle generates ephemeral keypair locally
2. Vehicle sends only its address (never the private key) to the parking node
3. Node calls delegateKey(ethrDid, vehicleAddress, 'sigAuth', 3600)
4. Vehicle signs session JWTs with its ephemeral private key
5. Verifier resolves the node DID and checks authentication[] contains the vehicle key
6. Session key expires automatically after TTL — no revocation tx needed
7. For immediate revocation: call revokeDelegate() — one tx, ~12s finality on Sepolia
```

---

## Production Hardening

**Private key management.** Never use `.env` files in production. The `txSigner` field in `EthrDID` accepts any ethers `Signer` — swap in a KMS-backed signer:

```typescript
import { AwsKmsSigner } from '@dennisdang/ethers-aws-kms-signer';

const signer = new AwsKmsSigner({ keyId: 'arn:aws:kms:...' }, provider);
```

**RPC reliability.** Use a `FallbackProvider` with multiple endpoints to avoid dropped transactions:

```typescript
import { FallbackProvider } from 'ethers';

const provider = new FallbackProvider([
  new JsonRpcProvider(process.env.ALCHEMY_URL),
  new JsonRpcProvider(process.env.INFURA_URL),
]);
```

**DID Document caching.** Resolution replays the full event log on every call. Cache resolved documents locally and invalidate by subscribing to the registry's `DIDAttributeChanged` event filter:

```typescript
const registry = new Contract(REGISTRY, ABI, provider);
registry.on('DIDAttributeChanged', (identity) => invalidateCache(identity));
```

**Gas budget for key rotation.** At ~45,000 gas per `addDelegate`, high-frequency vehicle session rotation can be expensive. Consider a meta-transaction relayer (ERC-2771) so vehicles pay their own gas, or batch rotations using a multicall contract.

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `ethers` v6 | Wallet, provider, contract interaction |
| `ethr-did` | High-level ERC-1056 DID management |
| `ethr-did-resolver` | DID Document resolution from event log |
| `did-resolver` | W3C-compliant resolver interface |
| `dotenv` | Environment variable loading |

---

## Verifying Transactions

```
https://sepolia.etherscan.io/tx/<TX_HASH>
https://sepolia.etherscan.io/address/0x03d5003bf0e79C5F5223588F347ebA39AfbC3818
```

---

## License

MIT