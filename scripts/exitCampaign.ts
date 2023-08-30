import { ethers, network } from "hardhat";
import jsonContracts from "../deployed-contracts.json";
import { CrowdFunding, Token } from "../typechain-types";
import { FUNDED_AMOUNT, MINIMUN_DURATION, GOAL } from "../helper-hardhat-config";
import { log } from "../helper-functions";

// ----
const CAMPAIGN_ID = 0;

async function exitCampaign() {
  const [creator, funder] = await ethers.getSigners();
  const networkName: string = network.name;
  const contracts = Object(jsonContracts);
  if (!contracts[networkName].CrowdFunding) {
    throw new Error("Contract is not deployed yet");
  }
  if (networkName === "hardhat") {
    throw new Error("Can't run scripts to hardhat network deployed contract");
  }
  const crowdFunding: CrowdFunding = await ethers.getContractAt(
    "CrowdFunding",
    contracts[networkName].CrowdFunding,
    creator
  );

  const token: Token = await ethers.getContractAt("Token", contracts[networkName].Token, creator);

  try {
    // Exiting Campaign
    await crowdFunding.connect(creator).exitCampaign(CAMPAIGN_ID);

    // Increase the time by two hours
    await ethers.provider.send("evm_increaseTime", [7200]);
    await ethers.provider.send("evm_mine", []);
  } catch (err) {
    console.log(err);
    console.log("----------------------");
    throw new Error("Failed to exit campaign");
  }

  return crowdFunding;
}

exitCampaign()
  .then((crowdFunding) => {
    console.log(`Campign with ID: ${CAMPAIGN_ID} has been exited successfully`);
    process.exit(0);
  })
  .catch((err) => {
    console.log(err);
    process.exit(1);
  });
