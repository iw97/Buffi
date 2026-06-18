export let currentOnboardingDirection: 1 | -1 = 1;

export function setOnboardingDirection(dir: 1 | -1) {
  currentOnboardingDirection = dir;
}
