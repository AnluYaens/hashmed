import { wagmiAdapter } from "~~/services/web3/appKitHedera";
import scaffoldConfig from "~~/scaffold.config";

export const enabledChains = scaffoldConfig.targetNetworks;
export const wagmiConfig = wagmiAdapter.wagmiConfig;
