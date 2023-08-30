import { ethers, BigNumber } from "ethers";

type NetworkConfigItem = {
  name: string;
};

type NetworkConfigMap = {
  [chainId: string]: NetworkConfigItem;
};

export const networkConfig: NetworkConfigMap = {
  default: {
    name: "hardhat",
  },
  31337: {
    name: "localhost",
  },
  1: {
    name: "mainnet",
  },
  11155111: {
    name: "sepolia",
  },
  137: {
    name: "polygon",
  },
};

// ERC20 token item used for testing constructor arguments
export const TOKEN_NAME = "Campaign Token";
export const TOKEN_SYMBOL = "CT";

// CrowdFunding Parameters needed when interacting with the contract
export const FUNDED_AMOUNT = ethers.utils.parseUnits("100"); // 100 TC token
export const MINIMUN_DURATION = 90 * 24 * 60 * 60; // 90 days
export const GOAL = ethers.utils.parseUnits("100"); // 100 TC token

export const ADDRESS_ZERO = ethers.constants.AddressZero;

export const developmentChains: string[] = ["hardhat", "localhost"];
export const VERIFICATION_BLOCK_CONFIRMATIONS = 6;
