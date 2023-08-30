// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title ERC20 token
 * @author Al-Qa'qa'
 * @notice This contract is for creating an ERC20 token
 * @dev We let users mint 1 million token for free, to interact with CrowdFunding contract easily in testing
 */
contract Token is ERC20 {
  /**
   * @notice Creating ERC20 Token contract to use in our CrowdFunding contract
   *
   * @param _name Token name
   * @param _symbol Token symbol
   */
  constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {}

  /// @notice mintion 1 million token to the caller address
  function mintMillion() public {
    _mint(msg.sender, 1000000 ether);
  }
}
