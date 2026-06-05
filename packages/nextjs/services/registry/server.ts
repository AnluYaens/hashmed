import { type Address, type Hex, createPublicClient, getAddress, http } from "viem";
import deployedContracts from "~~/contracts/deployedContracts";
import scaffoldConfig from "~~/scaffold.config";

/**
 * Server-side reader for the on-chain `FileRegistry`.
 *
 * The registry is the source of truth for who owns a file, what it costs, and
 * whether it is public. The resource server reads it on every download to
 * decide between "serve for free" and "gate behind an x402 payment". Writes
 * (register / set price / set visibility) happen from the browser via the
 * Scaffold-HBAR contract hooks, never here.
 */

/** Minimal ABI covering only the read paths the resource server needs. */
const FILE_REGISTRY_ABI = [
  {
    type: "function",
    name: "getFile",
    stateMutability: "view",
    inputs: [{ name: "fileId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "owner", type: "address" },
          { name: "payToAccountId", type: "string" },
          { name: "priceTinybar", type: "uint256" },
          { name: "isPublic", type: "bool" },
          { name: "objectKey", type: "string" },
          { name: "contentHash", type: "bytes32" },
          { name: "name", type: "string" },
          { name: "mimeType", type: "string" },
          { name: "exists", type: "bool" },
        ],
      },
    ],
  },
] as const;

/** A registered file as returned by the registry, normalised for server use. */
export type RegistryFile = {
  fileId: Hex;
  owner: Address;
  payToAccountId: string;
  priceTinybar: bigint;
  isPublic: boolean;
  objectKey: string;
  contentHash: Hex;
  name: string;
  mimeType: string;
};

/** The chain the resource server reads from (first configured target network). */
const targetChain = scaffoldConfig.targetNetworks[0];

function resolveRpcUrl(): string {
  return (
    process.env.HEDERA_RPC_URL || scaffoldConfig.rpcOverrides?.[targetChain.id] || targetChain.rpcUrls.default.http[0]
  );
}

/**
 * Resolve the deployed `FileRegistry` address.
 *
 * Prefers an explicit env override (handy before the generated
 * `deployedContracts.ts` is populated) and otherwise falls back to the address
 * recorded for the target chain at deploy time.
 *
 * @returns The checksummed registry address, or `undefined` when not deployed.
 */
export function getFileRegistryAddress(): Address | undefined {
  const fromEnv = process.env.FILE_REGISTRY_ADDRESS ?? process.env.NEXT_PUBLIC_FILE_REGISTRY_ADDRESS;
  if (fromEnv) return getAddress(fromEnv);

  const chainContracts = (deployedContracts as Record<number, Record<string, { address?: string }>>)[targetChain.id];
  const address = chainContracts?.FileRegistry?.address;
  return address ? getAddress(address) : undefined;
}

let cachedClient: ReturnType<typeof createPublicClient> | null = null;

function getClient() {
  if (!cachedClient) {
    cachedClient = createPublicClient({
      chain: targetChain,
      transport: http(resolveRpcUrl()),
    });
  }
  return cachedClient;
}

/**
 * Raised when a download is requested before the registry contract is deployed.
 * Surfaced as a 503 so the cause is obvious in local development.
 */
export class RegistryNotDeployedError extends Error {
  constructor() {
    super("FileRegistry is not deployed. Run `yarn deploy` and restart the app.");
    this.name = "RegistryNotDeployedError";
  }
}

const HEX_32 = /^0x[0-9a-fA-F]{64}$/;

/** Whether `value` is a well-formed `bytes32` file id. */
export function isFileId(value: string): value is Hex {
  return HEX_32.test(value);
}

/**
 * Read a single file's metadata from the registry.
 *
 * @param fileId - The `bytes32` file id.
 * @returns The file, or `null` when the id is unknown (the contract reverts with
 *   `FileNotFound`, which we treat as "not found" rather than an error).
 * @throws {RegistryNotDeployedError} When no registry address is configured.
 */
export async function getRegistryFile(fileId: Hex): Promise<RegistryFile | null> {
  const address = getFileRegistryAddress();
  if (!address) throw new RegistryNotDeployedError();

  try {
    const file = await getClient().readContract({
      address,
      abi: FILE_REGISTRY_ABI,
      functionName: "getFile",
      args: [fileId],
    });

    if (!file.exists) return null;

    return {
      fileId,
      owner: file.owner,
      payToAccountId: file.payToAccountId,
      priceTinybar: file.priceTinybar,
      isPublic: file.isPublic,
      objectKey: file.objectKey,
      contentHash: file.contentHash,
      name: file.name,
      mimeType: file.mimeType,
    };
  } catch (error) {
    // `getFile` reverts with `FileNotFound` for unknown ids; treat as not found.
    if (error instanceof Error && /FileNotFound|reverted/i.test(error.message)) {
      return null;
    }
    throw error;
  }
}
