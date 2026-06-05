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
  });
};

deployFileRegistry.tags = ["FileRegistry"];
export default deployFileRegistry;
