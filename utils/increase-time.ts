import { network } from "hardhat";

async function increaseTime(amount: number) {
  await network.provider.send("evm_increaseTime", [amount]);
  await network.provider.send("evm_mine", []);
}

export default increaseTime;
