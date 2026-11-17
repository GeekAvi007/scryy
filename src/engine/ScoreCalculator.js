import { GAME_CONFIG } from '../config/constants.js';

export function calculateGuesserPoints(roundStartTime) {
  const totalMs = GAME_CONFIG.ROUND_DURATION_SEC * 1000;
  const elapsedMs = Date.now() - roundStartTime;
  const remainingRatio = Math.max(0, (totalMs - elapsedMs) / totalMs);

  // Award between 50 and 500 points based on speed
  return Math.max(50, Math.ceil(remainingRatio * 500));
}

export function calculateDrawerPoints(totalPlayers) {
  const guessersCount = Math.max(1, totalPlayers - 1);
  return Math.ceil(300 / guessersCount);
}

// Standard dynamic programming Levenshtein edit distance
function getLevenshteinDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[a.length][b.length];
}

export function isCloseGuess(guess, targetWord) {
  const g = guess.toLowerCase().trim();
  const t = targetWord.toLowerCase().trim();

  // Avoid false "close" hints on tiny 1-2 letter words
  if (t.length < 3 || g === t) return false;

  return getLevenshteinDistance(g, t) === 1;
}