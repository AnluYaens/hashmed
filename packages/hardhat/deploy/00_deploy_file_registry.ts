import type { HardhatRuntimeEnvironment } from "hardhat/types";
import type { DeployFunction } from "hardhat-deploy/types";

const deployFileRegistry: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  await deploy("FileRegistry", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
    // Hedera testnet/mainnet: same values as templates/tokenise-subscriptions (INSUFFICIENT_TX_FEE fix).
    gasLimit: "3000000",
    gasPrice: "1100000000000",
  });
};

deployFileRegistry.tags = ["FileRegistry"];
export default deployFileRegistry;
