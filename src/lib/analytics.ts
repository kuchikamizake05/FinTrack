export type EquitySnapshotInput = { recordedAt: string; equity: number; accountId?: string };

function getIsoWeekKey(value: string) {
  const date = new Date(value);
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function buildWeeklyEquitySeries(snapshots: readonly EquitySnapshotInput[]) {
  const latestByWeek = new Map<string, EquitySnapshotInput>();
  for (const snapshot of snapshots) {
    const equity = Number(snapshot.equity);
    if (!Number.isFinite(equity) || Number.isNaN(new Date(snapshot.recordedAt).getTime())) continue;
    const week = getIsoWeekKey(snapshot.recordedAt);
    const current = latestByWeek.get(week);
    if (!current || new Date(snapshot.recordedAt) > new Date(current.recordedAt)) latestByWeek.set(week, { ...snapshot, equity });
  }
  return [...latestByWeek.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([week, snapshot]) => ({ week, equity: snapshot.equity }));
}

export function buildPortfolioWeeklyEquitySeries(snapshots: readonly Required<EquitySnapshotInput>[]) {
  const latestByAccountWeek = new Map<string, Required<EquitySnapshotInput>>();
  for (const snapshot of snapshots) {
    if (!Number.isFinite(Number(snapshot.equity)) || Number.isNaN(new Date(snapshot.recordedAt).getTime())) continue;
    const key = `${getIsoWeekKey(snapshot.recordedAt)}:${snapshot.accountId}`;
    const current = latestByAccountWeek.get(key);
    if (!current || new Date(snapshot.recordedAt) > new Date(current.recordedAt)) latestByAccountWeek.set(key, { ...snapshot, equity: Number(snapshot.equity) });
  }
  const weeks = [...new Set([...latestByAccountWeek.values()].map((snapshot) => getIsoWeekKey(snapshot.recordedAt)))].sort();
  const latestByAccount = new Map<string, number>();
  return weeks.map((week) => {
    for (const snapshot of latestByAccountWeek.values()) {
      if (getIsoWeekKey(snapshot.recordedAt) === week) latestByAccount.set(snapshot.accountId, snapshot.equity);
    }
    return { week, equity: [...latestByAccount.values()].reduce((total, equity) => total + equity, 0) };
  });
}

export function calculateTradingPerformance(trades: readonly { netPnl: number }[]) {
  let wins = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let totalPnl = 0;
  let runningPnl = 0;
  let peakPnl = 0;
  let maxDrawdown = 0;

  for (const trade of trades) {
    const pnl = Number(trade.netPnl);
    if (!Number.isFinite(pnl)) continue;
    totalPnl += pnl;
    runningPnl += pnl;
    if (pnl > 0) {
      wins += 1;
      grossProfit += pnl;
    } else if (pnl < 0) {
      grossLoss += Math.abs(pnl);
    }
    peakPnl = Math.max(peakPnl, runningPnl);
    maxDrawdown = Math.max(maxDrawdown, peakPnl - runningPnl);
  }

  const total = trades.filter((trade) => Number.isFinite(Number(trade.netPnl))).length;
  return {
    winRate: total ? Number(((wins / total) * 100).toFixed(2)) : 0,
    profitFactor: grossLoss ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit ? Infinity : 0,
    maxDrawdown: Number(maxDrawdown.toFixed(2)),
    totalPnl: Number(totalPnl.toFixed(2)),
  };
}

export function calculatePercentageChange(current: number, previous: number) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return Number((((current - previous) / Math.abs(previous)) * 100).toFixed(1));
}
