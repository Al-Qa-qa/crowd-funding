import { ethers, network } from "hardhat";
import jsonContracts from "../deployed-contracts.json";
import { CrowdFunding, Token } from "../typechain-types";
import { FUNDED_AMOUNT, MINIMUN_DURATION, GOAL } from "../helper-hardhat-config";
import imcreaseTime from "../utils/increase-time";
import formatCampaignStatus from "../utils/formatCampaignStatus";
import { BigNumber } from "ethers";
// ---

let campaignId: BigNumber = BigNumber.from(0);

async function fund() {
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
    // move the time to make the campaign time ended
    await imcreaseTime(MINIMUN_DURATION + 1);

    // Funding the campaign
    await crowdFunding.connect(creator).claim(campaignId);
    const stat: 0 | 1 | 2 = (await crowdFunding.getCampaign(campaignId)).status as 0 | 1 | 2;
    console.log(`Campaign ${campaignId}: is in ${formatCampaignStatus(stat)} state`);
  } catch (err) {
    console.log(err);
    console.log("----------------------");
    throw new Error(`Failed to claim campaign funds`);
  }

  return crowdFunding;
}

fund()
  .then((crowdFunding) => {
    console.log(`Campaign claimed successfully`);
    process.exit(0);
  })
  .catch((err) => {
    console.log(err);
    process.exit(1);
  });
