// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import "hardhat/console.sol"; // used in testing purposes

// ---

error CrowdFunding__CampaignNotExisted(uint256 campaignId);

error CrowdFunding__InvalidGoalValue(uint256 goal);
error CrowdFunding__StartingInPast(uint32 startingAt);
error CrowdFunding__InvalidEndingDate(uint32 endingAt);

error CrowdFunding__NotCampaignCreator(address caller, address creator);
error CrowdFunding__NotStartedYet(uint32 startingAt);

error CrowdFunding__InsufficientAmount(uint256 amount);
error CrowdFunding__CampaignEnded(uint256 id, uint32 endingAt);

error CrowdFunding__NoFundedAmount(uint256 id);
error CrowdFunding__CampaignCompleted(uint256 id);

error CrowFunding__CampaignInProgress(uint256 id, uint32 endingAt);
error CrowdFunding__CampaignGoalNotReached(uint256 id, uint256 goal, uint256 fundedAmount);

// ---

/**
 * @title Crowd Funding Smart contract
 * @author Al-Qa'qa'
 * @notice This contract works like a sinple mutlisig wallet
 */
contract CrowdFunding {
  /// @notice Campaign status
  enum CampaignStatus {
    IN_PROGRESS,
    EXITED,
    COMPLETED
  }

  // We added this error here as to see CampaignStatus
  error CrowdFunding__CampaignIsNotInProgress(uint256 id, CampaignStatus status);

  event CampaignCreated(
    uint256 campaignCount,
    address indexed creator,
    uint256 goal,
    uint32 startingAt,
    uint32 endingAt
  );

  event CampaignExited(uint256 id, address indexed creator, uint256 goal);

  event Funded(uint256 indexed id, address indexed funder, uint256 amount);

  event Refunded(uint256 indexed id, address indexed funder, uint256 amount);

  event CampaignClaimed(uint256 id, address creator, uint256 goal, uint256 fundedAmount);

  /// @notice Campaign Parameters
  struct Campaign {
    address creator;
    uint goal;
    uint fundedAmount;
    uint32 startingAt;
    uint32 endingAt;
    CampaignStatus status;
  }

  uint32 private constant _MINIMUN_DURATION = 90 days;
  IERC20 private immutable _i_token;
  uint256 private _campaignCount = 0;

  // Campaign ID -> Campaign Object
  mapping(uint256 => Campaign) public campaigns;

  // Campaign Id -> Funder address -> amount funded
  mapping(uint => mapping(address => uint)) public funderFundedAmount;

  modifier isCampaignExisted(uint256 _id) {
    if (_id >= _campaignCount) {
      revert CrowdFunding__CampaignNotExisted(_id);
    }
    _;
  }

  /**
   * @notice Deploy ERC20 token address to be used in payment in Campaigns
   * @dev Once the contract is deployed you cannot change the payable token address
   * @dev You can only use ERC20 token
   *
   * @param _token ERC20 token address to be used in Campaigns
   */
  constructor(address _token) {
    _i_token = IERC20(_token);
  }

  ///////////////////////////////////////////////
  //////// external and public function /////////
  ///////////////////////////////////////////////

  /**
   * @notice Creating new campaign
   *
   * @param _goal The target of the money this campaign needs
   * @param _startingAt Starting time of this campaign
   * @param _endingAt ending time of this campaign
   */
  function createCampaign(uint256 _goal, uint32 _startingAt, uint32 _endingAt) external {
    // Check that the goal is not equal zero
    if (_goal == 0) {
      revert CrowdFunding__InvalidGoalValue(_goal);
    }

    // Check that starting date is not in past
    if (_startingAt < block.timestamp) {
      revert CrowdFunding__StartingInPast(_startingAt);
    }

    // Check that endingAt is at least 90 days after the curret time
    if (_endingAt < _startingAt + _MINIMUN_DURATION) {
      revert CrowdFunding__InvalidEndingDate(_endingAt);
    }

    // Create new Campaign
    _createCampaign(msg.sender, _goal, _startingAt, _endingAt);
  }

  /**
   * @notice exiting a campaign to stop receving funds and to allow funders to withdraw there money
   *
   * @param _id Campaign ID to be exited
   */
  function exitCampaign(uint256 _id) external isCampaignExisted(_id) {
    (
      address creator,
      uint256 goal,
      ,
      uint32 startingAt,
      uint32 endingAt,
      CampaignStatus status
    ) = getCampaign(_id);
    // Check that the creator is the one who want to exit the campaign
    if (msg.sender != creator) {
      revert CrowdFunding__NotCampaignCreator(msg.sender, creator);
    }

    // Check that the campaign has been started
    if (startingAt > block.timestamp) {
      revert CrowdFunding__NotStartedYet(startingAt);
    }

    // Check to see if the campaign already exited
    if (status == CampaignStatus.EXITED) {
      revert CrowdFunding__CampaignEnded(_id, endingAt);
    }

    // You should exit the campaign in order to let funders withdraw there balances
    campaigns[_id].status = CampaignStatus.EXITED;

    // Emit exitCampaign event
    emit CampaignExited(_id, creator, goal);
  }

  /**
   * @notice support the campaign by adding am amount of funds to it
   * @dev Campaign to be funded should be existed
   *
   * @param _id Campaign ID
   * @param _amount The amount to fund to this campaign
   */
  function fund(uint256 _id, uint256 _amount) external isCampaignExisted(_id) {
    (, , , , uint32 endingAt, CampaignStatus status) = getCampaign(_id);

    // Check that the amount is not zero
    if (_amount == 0) {
      revert CrowdFunding__InsufficientAmount(_amount);
    }

    // Check that the campaign is not ended
    if (endingAt <= block.timestamp) {
      revert CrowdFunding__CampaignEnded(_id, endingAt);
    }

    // Check that the campaign is in `IN_PROGRESS` state
    if (status != CampaignStatus.IN_PROGRESS) {
      revert CrowdFunding__CampaignIsNotInProgress(_id, status);
    }

    // NOTE: We will not check allowance as its checked by OpenZeppeilen ERC20 contract

    // console.log("Contract Balance before funding: ", IERC20(getToken()).balanceOf(address(this)));
    // console.log("Funder Balance before funding: ", IERC20(getToken()).balanceOf(msg.sender));

    // Add funds to the campaign and to mapping that tracks funders
    // You should add funds first to see if it will pass or not, you can't change data before taking money
    IERC20(getToken()).transferFrom(msg.sender, address(this), _amount);

    // console.log("Contract Balance after funding: ", IERC20(getToken()).balanceOf(address(this)));
    // console.log("Funder Balance after funding: ", IERC20(getToken()).balanceOf(msg.sender));

    campaigns[_id].fundedAmount += _amount;
    funderFundedAmount[_id][msg.sender] += _amount;

    // emit Funded event
    emit Funded(_id, msg.sender, _amount);
  }

  /**
   * @notice Make Funder has the apility to takeback his funds if he changed his mint
   * @dev Campaign should be existed
   * @dev The caller should have funded this campaign before in order to takeback hos money
   *
   * @param _id Campaign ID
   */
  function refund(uint256 _id) external isCampaignExisted(_id) {
    (, , , , , CampaignStatus status) = getCampaign(_id);

    uint256 funderFundings = funderFundedAmount[_id][msg.sender];

    // Check that the amount is not zero
    if (funderFundings == 0) {
      revert CrowdFunding__NoFundedAmount(_id);
    }

    // Check that the campaign is not in `COMPLETED` status
    if (status == CampaignStatus.COMPLETED) {
      revert CrowdFunding__CampaignCompleted(_id);
    }

    funderFundedAmount[_id][msg.sender] = 0;
    campaigns[_id].fundedAmount -= funderFundings;

    IERC20(getToken()).transfer(msg.sender, funderFundings);

    emit Refunded(_id, msg.sender, funderFundings);
  }

  /**
   * @notice let the creator of the campaign take the money
   * @dev Campaign should be marked as `COMPLETED` before transfereing tokens, to avoid reenterancy attack
   *
   * @param _id Campaign ID to be claimed
   */
  function claim(uint256 _id) external isCampaignExisted(_id) {
    (
      address creator,
      uint256 goal,
      uint256 fundedAmount,
      ,
      uint32 endingAt,
      CampaignStatus status
    ) = getCampaign(_id);

    // Check that the claimer is the owner of this campaign
    if (msg.sender != creator) {
      revert CrowdFunding__NotCampaignCreator(msg.sender, creator);
    }

    // Check that the campaign has been ended
    if (endingAt > block.timestamp) {
      revert CrowFunding__CampaignInProgress(_id, endingAt);
    }

    // Check that the campaign reached to its target
    if (goal > fundedAmount) {
      revert CrowdFunding__CampaignGoalNotReached(_id, goal, fundedAmount);
    }

    // Check that the campaign is not already claimed
    if (status == CampaignStatus.COMPLETED) {
      revert CrowdFunding__CampaignCompleted(_id);
    }

    campaigns[_id].status = CampaignStatus.COMPLETED;

    // console.log(IERC20(getToken()).balanceOf(creator));
    IERC20(getToken()).transfer(creator, fundedAmount);
    // console.log(IERC20(getToken()).balanceOf(creator));

    emit CampaignClaimed(_id, creator, goal, fundedAmount);
  }

  ///////////////////////////////////////////////
  //////// private and internal function ////////
  ///////////////////////////////////////////////

  /**
   * @notice creating new campaign object in campaign mapping
   * @dev values are being checked in `createCampaign` public function
   *
   * @param _creator Campaign creator
   * @param _goal The target of the money this campaign needs
   * @param _startingAt Starting time of this campaign
   * @param _endingAt ending time of this campaign
   */
  function _createCampaign(
    address _creator,
    uint256 _goal,
    uint32 _startingAt,
    uint32 _endingAt
  ) private {
    campaigns[_campaignCount] = Campaign({
      creator: _creator,
      goal: _goal,
      fundedAmount: 0,
      startingAt: _startingAt,
      endingAt: _endingAt,
      status: CampaignStatus.IN_PROGRESS
    });

    emit CampaignCreated(_campaignCount, _creator, _goal, _startingAt, _endingAt);

    _campaignCount += 1;
  }

  ///////////////////////////////////////////////
  /////// Getter, View, and Pure function ///////
  ///////////////////////////////////////////////

  /**
   * @notice get campaign information with the given ID
   *
   * @param _id campaign ID
   * @return creator The creator of the campaign
   * @return goal Target of the campaign
   * @return fundedAmount Funded amount to the campaign
   * @return startingAt Starting date of the campaign
   * @return endingAt Ending date of the campaign
   * @return status Campaign status
   */
  function getCampaign(
    uint256 _id
  )
    public
    view
    returns (
      address creator,
      uint goal,
      uint fundedAmount,
      uint32 startingAt,
      uint32 endingAt,
      CampaignStatus status
    )
  {
    Campaign memory campaign = campaigns[_id];
    return (
      campaign.creator,
      campaign.goal,
      campaign.fundedAmount,
      campaign.startingAt,
      campaign.endingAt,
      campaign.status
    );
  }

  /// @notice get ERC20 token address that is used in funding campaigns
  function getToken() public view returns (address) {
    return address(_i_token);
  }

  /// @notice get the number of created campaigns
  function getCampaignCount() public view returns (uint256) {
    return _campaignCount;
  }

  /// @notice get the minimun duration a campaign can takes
  function getMinimunDuration() public pure returns (uint32) {
    return _MINIMUN_DURATION;
  }
}
