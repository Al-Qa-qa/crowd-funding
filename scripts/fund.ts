import { ethers, network } from "hardhat";
import jsonContracts from "../deployed-contracts.json";
import { CrowdFunding, Token } from "../typechain-types";
import { FUNDED_AMOUNT, MINIMUN_DURATION, GOAL } from "../helper-hardhat-config";
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
    // Fund 1 million TC token
    await token.connect(funder).mintMillion();

    // Allow token transfer by CrowdFunding contract
    await token.connect(funder).approve(crowdFunding.address, FUNDED_AMOUNT);

    // Funding the campaign
    await crowdFunding.connect(funder).fund(campaignId, FUNDED_AMOUNT);

    const campaignFundings: BigNumber = (await crowdFunding.getCampaign(campaignId)).fundedAmount;
    console.log(`Campaign fundedAmount: ${ethers.utils.formatEther(campaignFundings)} TC`);
  } catch (err) {
    console.log(err);
    console.log("----------------------");
    throw new Error(`Failed to fund campaign of ID: ${campaignId}`);
  }

  return crowdFunding;
}

fund()
  .then((crowdFunding) => {
    console.log(`Campaign funded successfully`);
    process.exit(0);
  })
  .catch((err) => {
    console.log(err);
    process.exit(1);
  });
