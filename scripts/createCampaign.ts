import { ethers, network } from "hardhat";
import jsonContracts from "../deployed-contracts.json";
import { CrowdFunding, Token } from "../typechain-types";
import { FUNDED_AMOUNT, MINIMUN_DURATION, GOAL } from "../helper-hardhat-config";
import { BigNumber } from "ethers";
// ---

let campaignId: BigNumber;

async function createCampaign() {
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
    // Creating new campaign
    const blockNumber = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumber);
    const startingAt = block.timestamp + 3600; // make the campaign starts after one hour
    const endingAt = startingAt + MINIMUN_DURATION;

    campaignId = await crowdFunding.getCampaignCount();
    await crowdFunding.connect(creator).createCampaign(GOAL, startingAt, endingAt);

    // Increase the time by two hours
    await ethers.provider.send("evm_increaseTime", [7200]);
    await ethers.provider.send("evm_mine", []);
  } catch (err) {
    console.log(err);
    console.log("----------------------");
    throw new Error("Failed to create Campaign");
  }

  return crowdFunding;
}

createCampaign()
  .then((crowdFunding) => {
    console.log(`Campaign created successfully with ID: ${campaignId}`);
    process.exit(0);
  })
  .catch((err) => {
    console.log(err);
    process.exit(1);
  });
