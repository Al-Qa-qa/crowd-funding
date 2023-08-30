import { expect, assert } from "chai";
import { ethers, network } from "hardhat";
import { CrowdFunding, CrowdFunding__factory, Token, Token__factory } from "../../typechain-types";

// Function
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

// Data
import {
  ADDRESS_ZERO,
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

describe("Token", function () {
  const REQUIRED: BigNumber = ethers.utils.parseUnits("2");
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
    token: Token;
  };
  async function deployTokenFixture(): Promise<DeployFixture> {
    const [deployer]: SignerWithAddress[] = await ethers.getSigners();

    const tokenFactory: Token__factory = await ethers.getContractFactory("Token", deployer);
    const token: Token = await tokenFactory.deploy(TOKEN_NAME, TOKEN_SYMBOL);
    await token.deployed();

    return { deployer, token };
  }

  describe("Constructor", function () {
    it("should set ERC20 name successfully", async function () {
      const { deployer, token } = await loadFixture(deployTokenFixture);

      const name: string = await token.name();
      assert.equal(name, TOKEN_NAME);
    });

    it("should set ERC20 symbol successfully", async function () {
      const { deployer, token } = await loadFixture(deployTokenFixture);

      const symbol: string = await token.symbol();
      assert.equal(symbol, TOKEN_SYMBOL);
    });
  });

  describe("#mintMillion", function () {
    it("should increase minter balance by 1 million on successful mint", async function () {
      const { deployer, token } = await loadFixture(deployTokenFixture);

      await token.mintMillion();

      const minterHoldings: BigNumber = await token.balanceOf(deployer.address);

      assert(minterHoldings.eq(ethers.utils.parseUnits("1000000")));
    });
  });
});
