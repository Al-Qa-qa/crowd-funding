import { expect, assert } from "chai";
import { ethers, network } from "hardhat";
import { CrowdFunding, CrowdFunding__factory, Token, Token__factory } from "../../typechain-types";

// Function
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

// Data
import {
  ADDRESS_ZERO,
  FUNDED_AMOUNT,
  GOAL,
  MINIMUN_DURATION,
  TOKEN_NAME,
  TOKEN_SYMBOL,
  developmentChains,
} from "../../helper-hardhat-config";

// Types
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractTransaction, ContractReceipt } from "ethers/src.ts/ethers";
import { BigNumber } from "ethers";

// ------------

describe("CrowdFunding", function () {
  beforeEach(async () => {
    if (!developmentChains.includes(network.name)) {
      throw new Error("You need to be on a development chain to run unit tests");
    }
  });

  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  type DeployFixture = {
    deployer: SignerWithAddress;
    crowdFunding: CrowdFunding;
    token: Token;
  };
  async function deployCrowdFundingFixture(): Promise<DeployFixture> {
    const [deployer]: SignerWithAddress[] = await ethers.getSigners();

    const tokenFactory: Token__factory = await ethers.getContractFactory("Token", deployer);
    const token: Token = await tokenFactory.deploy(TOKEN_NAME, TOKEN_SYMBOL);
    await token.deployed();

    const crowdFundingFactory: CrowdFunding__factory = await ethers.getContractFactory(
      "CrowdFunding",
      deployer
    );
    const crowdFunding: CrowdFunding = await crowdFundingFactory.deploy(token.address);
    await crowdFunding.deployed();

    return { deployer, crowdFunding, token };
  }

  async function creatingCampaign(crowdFunding: CrowdFunding, deployer: SignerWithAddress) {
    const blockNumber = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumber);
    const startingAt = block.timestamp + 3600; // make the campaign starts after one hour
    const endingAt = startingAt + MINIMUN_DURATION;

    await crowdFunding.connect(deployer).createCampaign(GOAL, startingAt, endingAt);

    // Increase the time by two hours
    await ethers.provider.send("evm_increaseTime", [7200]);
    await ethers.provider.send("evm_mine", []);

    return { goal: GOAL, startingAt, endingAt };
  }

  async function increaseTime(amount: number) {
    await ethers.provider.send("evm_increaseTime", [amount]);
    await ethers.provider.send("evm_mine", []);
  }

  async function approveToken(crowdFunding: CrowdFunding, token: Token, funder: SignerWithAddress) {
    await token.connect(funder).approve(crowdFunding.address, FUNDED_AMOUNT);
  }

  describe("Constructor", function () {
    it("should set ERC20 token address successfully", async function () {
      const { crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const tokenAddress: string = await crowdFunding.getToken();
      assert.equal(tokenAddress, token.address);
    });

    it("should `MINIMUM_DURATION` constant variable correctly", async function () {
      const { crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);
      const minimumDuration: number = await crowdFunding.getMinimunDuration();
      assert.equal(minimumDuration, MINIMUN_DURATION);
    });
  });

  describe("#createCampaign", function () {
    it("should emit `CreateCampaign` event on successful creating", async function () {
      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);
      const startingAt = block.timestamp + 1;
      const endingAt = startingAt + MINIMUN_DURATION;

      const campaignCount: BigNumber = await crowdFunding.getCampaignCount();

      await expect(crowdFunding.createCampaign(GOAL, startingAt, endingAt))
        .to.emit(crowdFunding, "CampaignCreated")
        .withArgs(campaignCount, deployer.address, GOAL, startingAt, endingAt);
    });

    it("should increase `campaignCount` by 1", async function () {
      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const campaignCountBeforeCreating: BigNumber = await crowdFunding.getCampaignCount();

      await creatingCampaign(crowdFunding, deployer);
      const campaignCountAfterCreating: BigNumber = await crowdFunding.getCampaignCount();

      assert(campaignCountAfterCreating.eq(campaignCountBeforeCreating.add(1)));
    });

    it("should the new campaign parameters successfully", async function () {
      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const campaignCount: BigNumber = await crowdFunding.getCampaignCount();

      const { goal, startingAt, endingAt } = await creatingCampaign(crowdFunding, deployer);

      const campaign = await crowdFunding.campaigns(campaignCount);

      assert.equal(campaign.creator, deployer.address);
      assert(campaign.goal.eq(goal));
      assert(campaign.fundedAmount.eq(0));
      assert.equal(campaign.startingAt, startingAt);
      assert.equal(campaign.endingAt, endingAt);
      assert.equal(campaign.status, 0 /* IN_PROGRESS */);
    });

    it("reverts if the `goal` is zero", async function () {
      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);
      const startingAt = block.timestamp + 1;
      const endingAt = startingAt + MINIMUN_DURATION;

      const invalidGoal: BigNumber = BigNumber.from(0);

      await expect(crowdFunding.createCampaign(invalidGoal, startingAt, endingAt))
        .to.be.revertedWithCustomError(crowdFunding, "CrowdFunding__InvalidGoalValue")
        .withArgs(invalidGoal);
    });

    it("reverts if `startingAt` is in the past", async function () {
      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);
      const invalidStartingAt = block.timestamp - 1; // to make it in the past
      const endingAt = invalidStartingAt + MINIMUN_DURATION + 1;

      await expect(crowdFunding.createCampaign(GOAL, invalidStartingAt, endingAt))
        .to.be.revertedWithCustomError(crowdFunding, "CrowdFunding__StartingInPast")
        .withArgs(invalidStartingAt);
    });

    it("reverts if the `endingAt` is before 90 days from `startingAt` time", async function () {
      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);
      const startingAt = block.timestamp + 1;
      const invalidEndingAt = startingAt + MINIMUN_DURATION - 1;

      await expect(crowdFunding.createCampaign(GOAL, startingAt, invalidEndingAt))
        .to.be.revertedWithCustomError(crowdFunding, "CrowdFunding__InvalidEndingDate")
        .withArgs(invalidEndingAt);
    });
  });

  describe("#exitCampaign", function () {
    it("should emit `CampaignExited` event on successful exiting", async function () {
      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const campaignCount: BigNumber = await crowdFunding.getCampaignCount();
      const { goal } = await creatingCampaign(crowdFunding, deployer);

      await increaseTime(MINIMUN_DURATION + 1);

      await expect(crowdFunding.exitCampaign(campaignCount))
        .to.emit(crowdFunding, "CampaignExited")
        .withArgs(campaignCount, deployer.address, goal);
    });

    it("should emit make campaign status `EXITED`", async function () {
      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const campaignCount: BigNumber = await crowdFunding.getCampaignCount();
      await creatingCampaign(crowdFunding, deployer);

      await increaseTime(MINIMUN_DURATION + 1);

      await crowdFunding.exitCampaign(campaignCount);

      const campaignStatus: number = (await crowdFunding.getCampaign(campaignCount)).status;

      assert.equal(campaignStatus, 1 /* EXITED */);
    });

    it("reverts if the campaign is not created", async function () {
      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const invalidCampaignCount: BigNumber = (await crowdFunding.getCampaignCount()).add(1);
      await creatingCampaign(crowdFunding, deployer);

      await expect(crowdFunding.exitCampaign(invalidCampaignCount))
        .to.be.revertedWithCustomError(crowdFunding, "CrowdFunding__CampaignNotExisted")
        .withArgs(invalidCampaignCount);
    });

    it("reverts if the caller is not the creator of the campaign", async function () {
      const [, hacker]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const campaignCount: BigNumber = await crowdFunding.getCampaignCount();

      await creatingCampaign(crowdFunding, deployer);

      const creator: string = (await crowdFunding.getCampaign(campaignCount)).creator;

      await increaseTime(MINIMUN_DURATION + 1);

      await expect(crowdFunding.connect(hacker).exitCampaign(campaignCount))
        .to.be.revertedWithCustomError(crowdFunding, "CrowdFunding__NotCampaignCreator")
        .withArgs(hacker.address, creator);
    });

    it("reverts if the campaign is not started yet", async function () {
      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const campaignCount: BigNumber = await crowdFunding.getCampaignCount();

      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);
      const startingAt = block.timestamp + 3600; /* Starts after one hour */
      const endingAt = startingAt + MINIMUN_DURATION;

      await crowdFunding.createCampaign(GOAL, startingAt, endingAt);

      await expect(crowdFunding.exitCampaign(campaignCount))
        .to.be.revertedWithCustomError(crowdFunding, "CrowdFunding__NotStartedYet")
        .withArgs(startingAt);
    });

    it("reverts if the campaign is already existed", async function () {
      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const campaignId: BigNumber = await crowdFunding.getCampaignCount();
      const { goal } = await creatingCampaign(crowdFunding, deployer);

      const endingAt: number = (await crowdFunding.getCampaign(campaignId)).endingAt;

      await increaseTime(MINIMUN_DURATION + 1);
      await crowdFunding.exitCampaign(campaignId);
      await expect(crowdFunding.exitCampaign(campaignId))
        .to.be.revertedWithCustomError(crowdFunding, "CrowdFunding__CampaignEnded")
        .withArgs(campaignId, endingAt);
    });
  });

  describe("#fund", function () {
    it("should emit `CampaignFunded` event on successful funding", async function () {
      const [, funder]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const campaignCount: BigNumber = await crowdFunding.getCampaignCount();
      const { goal } = await creatingCampaign(crowdFunding, deployer);

      // Mint 1 million token and approve 100 by the CrowdFunding contract
      await token.connect(funder).mintMillion();
      await approveToken(crowdFunding, token, funder);

      await expect(crowdFunding.connect(funder).fund(campaignCount, FUNDED_AMOUNT))
        .to.emit(crowdFunding, "Funded")
        .withArgs(campaignCount, funder.address, FUNDED_AMOUNT);
    });

    it("should increase contract balance", async function () {
      const [, funder]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const campaignCount: BigNumber = await crowdFunding.getCampaignCount();
      await creatingCampaign(crowdFunding, deployer);

      // Mint 1 million token and approve 100 by the CrowdFunding contract
      await token.connect(funder).mintMillion();
      await approveToken(crowdFunding, token, funder);

      await crowdFunding.connect(funder).fund(campaignCount, FUNDED_AMOUNT);

      const crowdFundingBalance: BigNumber = await token.balanceOf(crowdFunding.address);
      assert(crowdFundingBalance.eq(FUNDED_AMOUNT));
    });

    it("should update `funderFundedAmount` mapping and add the amount funded to the funder address", async function () {
      const [, funder]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const campaignCount: BigNumber = await crowdFunding.getCampaignCount();
      await creatingCampaign(crowdFunding, deployer);

      // Mint 1 million token and approve 100 by the CrowdFunding contract
      await token.connect(funder).mintMillion();
      await approveToken(crowdFunding, token, funder);

      await crowdFunding.connect(funder).fund(campaignCount, FUNDED_AMOUNT);

      const funderFundedAmount: BigNumber = await crowdFunding.funderFundedAmount(
        campaignCount,
        funder.address
      );
      assert(funderFundedAmount.eq(FUNDED_AMOUNT));
    });

    it("should update campaign `fundedAmount` parameter, and add the funded amount to it", async function () {
      const [, funder]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const campaignCount: BigNumber = await crowdFunding.getCampaignCount();
      await creatingCampaign(crowdFunding, deployer);

      // Mint 1 million token and approve 100 by the CrowdFunding contract
      await token.connect(funder).mintMillion();
      await approveToken(crowdFunding, token, funder);

      await crowdFunding.connect(funder).fund(campaignCount, FUNDED_AMOUNT);

      const fundedAmount: BigNumber = (await crowdFunding.getCampaign(campaignCount)).fundedAmount;
      assert(fundedAmount.eq(FUNDED_AMOUNT));
    });

    it("reverts if the campaign is not existed", async function () {
      const [, funder]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const invalidCampaignId: BigNumber = await crowdFunding.getCampaignCount();
      await expect(crowdFunding.connect(funder).fund(invalidCampaignId, FUNDED_AMOUNT))
        .to.be.revertedWithCustomError(crowdFunding, "CrowdFunding__CampaignNotExisted")
        .withArgs(invalidCampaignId);
    });

    it("reverts if the funded amount is 0", async function () {
      const [, funder]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const campaignId: BigNumber = await crowdFunding.getCampaignCount();
      await creatingCampaign(crowdFunding, deployer);

      const invalidAmount: BigNumber = BigNumber.from(0);

      // Mint 1 million token and approve 100 by the CrowdFunding contract
      await token.connect(funder).mintMillion();
      await approveToken(crowdFunding, token, funder);

      await expect(crowdFunding.connect(funder).fund(campaignId, invalidAmount))
        .to.be.revertedWithCustomError(crowdFunding, "CrowdFunding__InsufficientAmount")
        .withArgs(invalidAmount);
    });

    it("reverts if the campaign ended", async function () {
      const [, funder]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const campaignId: BigNumber = await crowdFunding.getCampaignCount();
      await creatingCampaign(crowdFunding, deployer);

      // Mint 1 million token and approve 100 by the CrowdFunding contract
      await token.connect(funder).mintMillion();
      await approveToken(crowdFunding, token, funder);

      await increaseTime(MINIMUN_DURATION + 1);

      const endingAt: number = (await crowdFunding.getCampaign(campaignId)).endingAt;

      await expect(crowdFunding.connect(funder).fund(campaignId, FUNDED_AMOUNT))
        .to.be.revertedWithCustomError(crowdFunding, "CrowdFunding__CampaignEnded")
        .withArgs(campaignId, endingAt);
    });

    it("reverts if the campaign is not in `IN_PROGRESS` state", async function () {
      const [, funder]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const campaignId: BigNumber = await crowdFunding.getCampaignCount();
      await creatingCampaign(crowdFunding, deployer);

      // Mint 1 million token and approve 100 by the CrowdFunding contract
      await token.connect(funder).mintMillion();
      await approveToken(crowdFunding, token, funder);

      await crowdFunding.connect(deployer).exitCampaign(campaignId);

      // Exiting the campaign by the user
      await expect(crowdFunding.connect(funder).fund(campaignId, FUNDED_AMOUNT))
        .to.be.revertedWithCustomError(crowdFunding, "CrowdFunding__CampaignIsNotInProgress")
        .withArgs(campaignId, 1 /* EXITED */);
    });
  });

  describe("#refund", function () {
    it("should emit `refund` event on successful refunding", async function () {
      const [, funder]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const campaignId: BigNumber = await crowdFunding.getCampaignCount();
      const { goal } = await creatingCampaign(crowdFunding, deployer);

      // Mint 1 million token and approve 100 by the CrowdFunding contract
      await token.connect(funder).mintMillion();
      await approveToken(crowdFunding, token, funder);

      await crowdFunding.connect(funder).fund(campaignId, FUNDED_AMOUNT);

      const fundedAmount: BigNumber = await crowdFunding.funderFundedAmount(
        campaignId,
        funder.address
      );

      await expect(crowdFunding.connect(funder).refund(campaignId))
        .to.emit(crowdFunding, "Refunded")
        .withArgs(campaignId, funder.address, fundedAmount);
    });

    it("should reset `funderFundedAmount` to zero", async function () {
      const [, funder]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const campaignId: BigNumber = await crowdFunding.getCampaignCount();
      const { goal } = await creatingCampaign(crowdFunding, deployer);

      // Mint 1 million token and approve 100 by the CrowdFunding contract
      await token.connect(funder).mintMillion();
      await approveToken(crowdFunding, token, funder);

      await crowdFunding.connect(funder).fund(campaignId, FUNDED_AMOUNT);

      await crowdFunding.connect(funder).refund(campaignId);

      const fundedAmount: BigNumber = await crowdFunding.funderFundedAmount(
        campaignId,
        funder.address
      );

      assert(fundedAmount.eq(0));
    });

    it("should decrease the `fundedAmount` of the campaign by the fundedAmount", async function () {
      const [, funder]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const campaignId: BigNumber = await crowdFunding.getCampaignCount();
      const { goal } = await creatingCampaign(crowdFunding, deployer);

      // Mint 1 million token and approve 100 by the CrowdFunding contract
      await token.connect(funder).mintMillion();
      await approveToken(crowdFunding, token, funder);

      await crowdFunding.connect(funder).fund(campaignId, FUNDED_AMOUNT);

      const campaignFundedAmountBeforeRefunding: BigNumber = (
        await crowdFunding.getCampaign(campaignId)
      ).fundedAmount;

      const funderFundedAmount: BigNumber = await crowdFunding.funderFundedAmount(
        campaignId,
        funder.address
      );

      await crowdFunding.connect(funder).refund(campaignId);

      const campaignFundedAmountAfterRefunding: BigNumber = (
        await crowdFunding.getCampaign(campaignId)
      ).fundedAmount;

      assert(
        campaignFundedAmountAfterRefunding.eq(
          campaignFundedAmountBeforeRefunding.sub(funderFundedAmount)
        )
      );
    });

    it("should transfer money from the contract to the funder", async function () {
      const [, funder]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const campaignId: BigNumber = await crowdFunding.getCampaignCount();
      const { goal } = await creatingCampaign(crowdFunding, deployer);

      // Mint 1 million token and approve 100 by the CrowdFunding contract
      await token.connect(funder).mintMillion();
      await approveToken(crowdFunding, token, funder);

      await crowdFunding.connect(funder).fund(campaignId, FUNDED_AMOUNT);

      const funderFundedAmount: BigNumber = await crowdFunding.funderFundedAmount(
        campaignId,
        funder.address
      );

      const funderBalanceBeforeRefunding: BigNumber = await token.balanceOf(funder.address);

      await crowdFunding.connect(funder).refund(campaignId);

      const funderBalanceAfterRefunding: BigNumber = await token.balanceOf(funder.address);

      assert(funderBalanceAfterRefunding.eq(funderBalanceBeforeRefunding.add(funderFundedAmount)));
    });

    it("reverts if the campaign is not created", async function () {
      const [, funder]: SignerWithAddress[] = await ethers.getSigners();

      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const invalidCampaignCount: BigNumber = (await crowdFunding.getCampaignCount()).add(1);

      await expect(crowdFunding.connect(funder).refund(invalidCampaignCount))
        .to.be.revertedWithCustomError(crowdFunding, "CrowdFunding__CampaignNotExisted")
        .withArgs(invalidCampaignCount);
    });

    it("reverts if the caller has no fundings", async function () {
      const [, funder]: SignerWithAddress[] = await ethers.getSigners();

      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const campaignId: BigNumber = await crowdFunding.getCampaignCount();
      const { goal } = await creatingCampaign(crowdFunding, deployer);

      // Mint 1 million token and approve 100 by the CrowdFunding contract
      await token.connect(funder).mintMillion();
      await approveToken(crowdFunding, token, funder);

      await expect(crowdFunding.connect(funder).refund(campaignId))
        .to.be.revertedWithCustomError(crowdFunding, "CrowdFunding__NoFundedAmount")
        .withArgs(campaignId);
    });

    it("reverts if the campaign is completed (in `COMPLETED` state)", async function () {
      const [, funder]: SignerWithAddress[] = await ethers.getSigners();

      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const campaignId: BigNumber = await crowdFunding.getCampaignCount();
      await creatingCampaign(crowdFunding, deployer);

      // Mint 1 million token and approve 100 by the CrowdFunding contract
      await token.connect(funder).mintMillion();
      await approveToken(crowdFunding, token, funder);

      await crowdFunding.connect(funder).fund(campaignId, FUNDED_AMOUNT);

      await increaseTime(MINIMUN_DURATION + 1);

      await crowdFunding.connect(deployer).claim(campaignId);

      await expect(crowdFunding.connect(funder).refund(campaignId))
        .to.be.revertedWithCustomError(crowdFunding, "CrowdFunding__CampaignCompleted")
        .withArgs(campaignId);
    });
  });

  describe("#claim", function () {
    it("should emit `CampaignClaimed` event on successful claimed", async function () {
      const [, funder]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const campaignId: BigNumber = await crowdFunding.getCampaignCount();
      const { goal } = await creatingCampaign(crowdFunding, deployer);

      // Mint 1 million token and approve 100 by the CrowdFunding contract
      await token.connect(funder).mintMillion();
      await approveToken(crowdFunding, token, funder);

      await crowdFunding.connect(funder).fund(campaignId, FUNDED_AMOUNT);

      await increaseTime(MINIMUN_DURATION + 1);

      await expect(crowdFunding.connect(deployer).claim(campaignId))
        .to.emit(crowdFunding, "CampaignClaimed")
        .withArgs(campaignId, deployer.address, goal, FUNDED_AMOUNT);
    });

    it("should transfere tokens to the creator of the campaign", async function () {
      const [, funder]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const campaignId: BigNumber = await crowdFunding.getCampaignCount();
      const { goal } = await creatingCampaign(crowdFunding, deployer);

      // Mint 1 million token and approve 100 by the CrowdFunding contract
      await token.connect(funder).mintMillion();
      await approveToken(crowdFunding, token, funder);

      await crowdFunding.connect(funder).fund(campaignId, FUNDED_AMOUNT);

      await increaseTime(MINIMUN_DURATION + 1);

      const creatorBalanceBefore: BigNumber = await token.balanceOf(deployer.address);

      await crowdFunding.connect(deployer).claim(campaignId);

      const creatorBalanceAfter: BigNumber = await token.balanceOf(deployer.address);

      assert(creatorBalanceAfter.eq(creatorBalanceBefore.add(FUNDED_AMOUNT)));
    });

    it("should update campaign status to `COMPLETED`", async function () {
      const [, funder]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const campaignId: BigNumber = await crowdFunding.getCampaignCount();
      const { goal } = await creatingCampaign(crowdFunding, deployer);

      // Mint 1 million token and approve 100 by the CrowdFunding contract
      await token.connect(funder).mintMillion();
      await approveToken(crowdFunding, token, funder);

      await crowdFunding.connect(funder).fund(campaignId, FUNDED_AMOUNT);

      await increaseTime(MINIMUN_DURATION + 1);

      await crowdFunding.connect(deployer).claim(campaignId);

      const campaignStatus: number = (await crowdFunding.getCampaign(campaignId)).status;

      assert.equal(campaignStatus, 2 /* COMPLETED */);
    });

    it("reverts if the campaign is not existed", async function () {
      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const invalidCampaignId: BigNumber = await crowdFunding.getCampaignCount();

      await expect(crowdFunding.claim(invalidCampaignId))
        .to.be.revertedWithCustomError(crowdFunding, "CrowdFunding__CampaignNotExisted")
        .withArgs(invalidCampaignId);
    });

    it("reverts if the caller is not the creator", async function () {
      const [, funder, hacker]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const campaignId: BigNumber = await crowdFunding.getCampaignCount();
      const { goal } = await creatingCampaign(crowdFunding, deployer);

      // Mint 1 million token and approve 100 by the CrowdFunding contract
      await token.connect(funder).mintMillion();
      await approveToken(crowdFunding, token, funder);

      await crowdFunding.connect(funder).fund(campaignId, FUNDED_AMOUNT);

      await increaseTime(MINIMUN_DURATION + 1);

      await expect(crowdFunding.connect(hacker).claim(campaignId))
        .to.be.revertedWithCustomError(crowdFunding, "CrowdFunding__NotCampaignCreator")
        .withArgs(hacker.address, deployer.address);
    });

    it("reverts if the campaign is still `IN_PROGRESS` state", async function () {
      const [, funder, hacker]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const campaignId: BigNumber = await crowdFunding.getCampaignCount();
      const { goal } = await creatingCampaign(crowdFunding, deployer);

      // Mint 1 million token and approve 100 by the CrowdFunding contract
      await token.connect(funder).mintMillion();
      await approveToken(crowdFunding, token, funder);

      await crowdFunding.connect(funder).fund(campaignId, FUNDED_AMOUNT);

      const endingAt: number = (await crowdFunding.getCampaign(campaignId)).endingAt;

      await expect(crowdFunding.connect(deployer).claim(campaignId))
        .to.be.revertedWithCustomError(crowdFunding, "CrowFunding__CampaignInProgress")
        .withArgs(campaignId, endingAt);
    });

    it("reverts if the campaign didn't reached its goal", async function () {
      const [, funder, hacker]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const campaignId: BigNumber = await crowdFunding.getCampaignCount();
      const { goal } = await creatingCampaign(crowdFunding, deployer);

      // Mint 1 million token and approve 100 by the CrowdFunding contract
      await token.connect(funder).mintMillion();
      await approveToken(crowdFunding, token, funder);

      const notEnoughFund: BigNumber = FUNDED_AMOUNT.div(2);

      // funding with
      await crowdFunding.connect(funder).fund(campaignId, notEnoughFund);

      await increaseTime(MINIMUN_DURATION + 1);

      await expect(crowdFunding.connect(deployer).claim(campaignId))
        .to.be.revertedWithCustomError(crowdFunding, "CrowdFunding__CampaignGoalNotReached")
        .withArgs(campaignId, goal, notEnoughFund);
    });

    it("reverts if the campaign is `COMPLETED`", async function () {
      const [, funder, hacker]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, crowdFunding, token } = await loadFixture(deployCrowdFundingFixture);

      const campaignId: BigNumber = await crowdFunding.getCampaignCount();
      const { goal } = await creatingCampaign(crowdFunding, deployer);

      // Mint 1 million token and approve 100 by the CrowdFunding contract
      await token.connect(funder).mintMillion();
      await approveToken(crowdFunding, token, funder);

      await crowdFunding.connect(funder).fund(campaignId, FUNDED_AMOUNT);

      await increaseTime(MINIMUN_DURATION + 1);

      await crowdFunding.connect(deployer).claim(campaignId);

      await expect(crowdFunding.connect(deployer).claim(campaignId))
        .to.be.revertedWithCustomError(crowdFunding, "CrowdFunding__CampaignCompleted")
        .withArgs(campaignId);
    });
  });
});
