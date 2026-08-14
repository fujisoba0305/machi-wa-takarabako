export function getNormalArrivalRewardExp(isRegisteredTreasure: boolean) {
return isRegisteredTreasure ? 30 : 20;
}

export function claimNormalArrivalOnce(claimed: { current: boolean }) {
if (claimed.current) return false;

claimed.current = true;
return true;
}
