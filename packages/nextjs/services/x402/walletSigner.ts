import type { DAppConnector } from "@hashgraph/hedera-wallet-connect/dist/lib/dapp";
import type { PaymentRequirements } from "@x402/core/types";
import type { ClientHederaSigner, HederaClientSignerConfig } from "@x402/hedera";

/**
 * x402 client signer that partially signs Hedera transfers via WalletConnect
 * (`hedera_signTransaction`), e.g. HashPack.
 */
export function createWalletHederaSigner(
  accountId: string,
  connector: DAppConnector,
  config: HederaClientSignerConfig = {},
): ClientHederaSigner {
  const configuredNetwork = config.network ?? "hedera:testnet";

  return {
    accountId,
    createPartiallySignedTransferTransaction: async (requirements: PaymentRequirements) => {
      const [{ AccountId, Hbar, TokenId, Transaction, TransactionId, TransferTransaction }, hedera] = await Promise.all(
        [import("@hiero-ledger/sdk"), import("@x402/hedera")],
      );

      if (!hedera.isSupportedHederaNetwork(requirements.network)) {
        throw new Error(`Unsupported Hedera network: ${requirements.network}`);
      }
      const feePayer = requirements.extra?.feePayer;
      if (typeof feePayer !== "string") {
        throw new Error("feePayer is required in paymentRequirements.extra");
      }

      const amount = BigInt(requirements.amount);
      if (amount <= 0n) {
        throw new Error("amount must be greater than zero");
      }

      const payer = AccountId.fromString(accountId);
      const payTo = AccountId.fromString(requirements.payTo);
      const tx = new TransferTransaction();

      if (hedera.isHbarAsset(requirements.asset)) {
        tx.addHbarTransfer(payer, Hbar.fromTinybars((-amount).toString()));
        tx.addHbarTransfer(payTo, Hbar.fromTinybars(amount.toString()));
      } else {
        const tokenId = TokenId.fromString(requirements.asset);
        tx.addTokenTransfer(tokenId, payer, -amount);
        tx.addTokenTransfer(tokenId, payTo, amount);
      }

      tx.setTransactionId(TransactionId.generate(AccountId.fromString(feePayer)));

      const client = hedera.createHederaClient(configuredNetwork, config.nodeUrl);
      try {
        tx.freezeWith(client);
        const signed = await connector.signTransaction({
          signerAccountId: accountId,
          transactionBody: tx,
        });
        if (!(signed instanceof Transaction)) {
          throw new Error("Wallet did not return a signed transaction");
        }
        return Buffer.from(signed.toBytes()).toString("base64");
      } finally {
        client.close();
      }
    },
  };
}
