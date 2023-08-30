function campaignStatus(stat: 0 | 1 | 2): string {
  switch (stat) {
    case 0:
      return "IN_PROGRESS";
    case 1:
      return "EXITED";
    case 2:
      return "COMPLETED";
  }
}

export default campaignStatus;
