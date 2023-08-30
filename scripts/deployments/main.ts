// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
import { network, run } from "hardhat";

import deployToken from "./deployToken";
import deployCrowdFunding from "./deployCrowdFunding";
import { log } from "../../helper-functions";
import { Token } from "../../typechain-types";

// ---------

async function main() {
  await run("compile");
  const chainId = network.config.chainId!;

  log(`Deploying into network ${network.name} with chainId: ${chainId}`, "title");
  const token: Token = await deployToken(chainId);

  log("", "separator");

  await deployCrowdFunding(chainId, token.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
