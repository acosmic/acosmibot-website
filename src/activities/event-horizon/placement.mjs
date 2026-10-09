// Pure helpers for the finish screen's server placement headline.
const TOP = 10;
const whole = value => Math.floor(Number(value) || 0);

// Provisional server rank for a just-finished score, from the already loaded
// top-10 board. Returns null unless the score is a new server best for this
// pilot that lands in the top ten. The verified result always replaces it.
export function predictPlacement(board, score) {
  const mine = whole(score);
  if (!board || !Array.isArray(board.entries) || mine <= 0) return null;
  if (mine <= whole(board.self?.score)) return null;
  const selfId = board.self?.playerId || board.self?.userId;
  // Ties rank behind the earlier flight.
  const ahead = board.entries.filter(entry => !(selfId && (entry.playerId === selfId || entry.userId === selfId)) && whole(entry.score) >= mine).length;
  return ahead < TOP ? ahead + 1 : null;
}

// Verified placement: only a new server best that sits in the top ten counts.
export function verifiedPlacement(result) {
  const rank = Number(result?.rank);
  return result?.personalBest === true && Number.isInteger(rank) && rank >= 1 && rank <= TOP ? rank : null;
}

export function placementCopy(rank) {
  if (rank === 1) return { title: 'SERVER #1', lead: 'Top of the board. Nobody on this server has flown a better orbit.' };
  return { title: `SERVER #${rank}`, lead: rank <= 3 ? `Podium finish: #${rank} on this server.` : `Top 10 finish: #${rank} on this server.` };
}
