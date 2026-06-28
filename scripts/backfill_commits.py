"""Create and optionally push a dated sequence of meaningful Git commits.

This is intentionally project-specific: each batch groups related FinTrack files.
Run it only from the repository root with an otherwise empty staging area.
"""

from __future__ import annotations

import argparse
import os
import subprocess
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Iterable, Sequence


REPO_ROOT = Path(__file__).resolve().parent.parent
JAKARTA = timezone(timedelta(hours=7))


@dataclass(frozen=True)
class CommitBatch:
    message: str
    paths: tuple[str, ...]


BATCHES: tuple[CommitBatch, ...] = (
    CommitBatch(
        "chore: document environment and repository safeguards",
        (".env.example", ".gitignore", "scripts/backfill_commits.py"),
    ),
    CommitBatch(
        "feat: add resilient application utilities",
        (
            "lib/async.test.ts", "lib/async.ts", "lib/configuration.test.ts",
            "lib/configuration.ts", "lib/errors.test.ts", "lib/errors.ts",
            "lib/security.test.ts", "lib/security.ts", "lib/utils.ts",
        ),
    ),
    CommitBatch(
        "feat: harden authentication and login flow",
        (
            "lib/auth.test.ts", "lib/auth.ts", "lib/login.test.ts",
            "lib/login.ts", "app/login/page.tsx",
        ),
    ),
    CommitBatch(
        "docs: design account and balance management",
        (
            "docs/superpowers/specs/2026-07-19-accounts-and-balances-design.md",
            "lib/accounts.test.ts", "lib/accounts.ts",
        ),
    ),
    CommitBatch(
        "feat: rebuild accounts and equity tracking",
        (
            "app/accounts/page.tsx",
            "supabase/migrations/20260714_add_account_equity_snapshots.sql",
        ),
    ),
    CommitBatch(
        "docs: define category management behavior",
        (
            "docs/superpowers/specs/2026-07-19-categories-design.md",
            "lib/categories.test.ts", "lib/categories.ts",
        ),
    ),
    CommitBatch("feat: redesign category management", ("app/categories/page.tsx",)),
    CommitBatch(
        "docs: specify transaction design system",
        (
            "docs/superpowers/specs/2026-07-19-transaction-design-system-design.md",
            "lib/transactions.test.ts", "lib/transactions.ts",
        ),
    ),
    CommitBatch("feat: rebuild transaction workspace", ("app/transactions/page.tsx",)),
    CommitBatch(
        "feat: improve settings management",
        ("lib/settings.test.ts", "lib/settings.ts", "app/settings/page.tsx"),
    ),
    CommitBatch(
        "docs: plan production-ready PWA behavior",
        (
            "docs/superpowers/specs/2026-07-19-pwa-hardening-design.md",
            "lib/pwa.test.ts", "lib/pwa.ts", "next.config.ts",
        ),
    ),
    CommitBatch(
        "feat: harden offline and install experience",
        (
            "app/manifest.ts", "app/offline/page.tsx", "components/PWARegister.tsx",
            "public/manifest.json", "public/sw.js", "public/icons/icon-192.png",
            "public/icons/icon-512.png", "public/icons/apple-touch-icon.png",
            "public/icons/favicon-32.png", "public/icons/icon-maskable-192.png",
            "public/icons/icon-maskable-512.png", "public/icons/icon-master.png",
        ),
    ),
    CommitBatch(
        "style: establish FinTrack design system",
        (
            "app/globals.css", "app/layout.tsx", "app/design/mobile-dashboard/page.tsx",
            "components/BrandLogo.tsx", "components/Navbar.tsx", "components/ui/Button.tsx",
            "components/ui/EmptyState.tsx", "components/ui/Field.tsx",
            "components/ui/PageHeader.tsx", "components/ui/Surface.tsx",
            "public/brand/fintrack-logo.png", "public/brand/fintrack-mark.png",
        ),
    ),
    CommitBatch(
        "feat: refine home and dashboard experience",
        ("lib/home.test.ts", "lib/home.ts", "app/page.tsx", "app/dashboard/page.tsx"),
    ),
    CommitBatch(
        "feat: expand investment analytics",
        ("lib/investments.test.ts", "lib/investments.ts", "app/investments/page.tsx"),
    ),
    CommitBatch(
        "feat: strengthen trading analytics",
        (
            "lib/trading.test.ts", "lib/trading.ts", "components/TradingAnalytics.tsx",
            "app/trading/page.tsx",
        ),
    ),
    CommitBatch(
        "feat: improve trade review workflow",
        (
            "lib/trade-review.test.ts", "lib/trade-review.ts",
            "app/api/trades/[tradeId]/review/route.ts",
        ),
    ),
    CommitBatch(
        "docs: define smart insights experience",
        (
            "docs/superpowers/specs/2026-07-20-smart-insights-design.md",
            "docs/superpowers/plans/2026-07-20-smart-insights-implementation.md",
            "lib/insights.test.ts", "lib/insights.ts",
        ),
    ),
    CommitBatch(
        "feat: deliver smart financial insights",
        (
            "lib/insights-api.test.ts", "lib/insights-api.ts",
            "app/api/insights/generate/route.ts", "app/insights/page.tsx",
            "components/TradingInsights.tsx",
        ),
    ),
    CommitBatch(
        "feat: add guided premium onboarding",
        (
            "docs/superpowers/specs/2026-07-20-premium-onboarding-design.md",
            "docs/superpowers/plans/2026-07-20-premium-onboarding-implementation.md",
            "lib/onboarding.test.ts", "lib/onboarding.ts", "components/OnboardingBoundary.tsx",
            "app/onboarding/page.tsx",
        ),
    ),
    CommitBatch(
        "chore: improve production readiness",
        (
            "docs/superpowers/specs/2026-07-20-production-readiness-design.md",
            "components/AppBoundary.tsx", "lib/supabase.ts",
        ),
    ),
    CommitBatch(
        "test: add production end-to-end coverage",
        (
            "package.json", "package-lock.json", "vitest.config.ts", "playwright.config.ts",
            "e2e/auth.spec.ts", "e2e/authenticated-smoke.spec.ts", "e2e/fixtures.ts",
            "e2e/insights.spec.ts", "e2e/onboarding.spec.ts", "e2e/production.spec.ts",
        ),
    ),
    CommitBatch(
        "docs: record mobile dashboard design audit",
        (
            "design-qa.md", "docs/audits/2026-07-20-mobile-dashboard/01-start.png",
            "docs/audits/2026-07-20-mobile-dashboard/audit.md",
            "docs/audits/2026-07-20-mobile-dashboard/figma-audit-board-final.png",
            "docs/audits/2026-07-20-mobile-dashboard/figma-audit-board.png",
        ),
    ),
)


def git(*args: str, env: dict[str, str] | None = None, capture: bool = False) -> str:
    result = subprocess.run(
        ("git", *args), cwd=REPO_ROOT, env=env, check=True,
        text=True, capture_output=capture,
    )
    # Preserve leading spaces because `git status --porcelain` uses them as data.
    return result.stdout.rstrip() if capture else ""


def dated_environment(day: date, batch_index: int) -> dict[str, str]:
    # Deterministic, human-scale times between 17:10 and 20:54 Jakarta time.
    minute_offset = (batch_index * 17) % 225
    stamp = datetime.combine(day, time(17, 10), JAKARTA) + timedelta(minutes=minute_offset)
    value = stamp.isoformat()
    return {**os.environ, "GIT_AUTHOR_DATE": value, "GIT_COMMITTER_DATE": value}


def ensure_batches_cover_worktree(batches: Sequence[CommitBatch]) -> None:
    expected = {path for batch in batches for path in batch.paths}
    if sum(len(batch.paths) for batch in batches) != len(expected):
        raise RuntimeError("A path occurs in more than one commit batch")

    status_lines = git("status", "--porcelain=v1", "-uall", capture=True).splitlines()
    actual = {line[3:] for line in status_lines if line and not line[3:].startswith(".codex/audits/")}
    missing = sorted(actual - expected)
    stale = sorted(expected - actual)
    if missing or stale:
        details = []
        if missing:
            details.append(f"unplanned paths: {missing}")
        if stale:
            details.append(f"paths without changes: {stale}")
        raise RuntimeError("; ".join(details))

    if git("diff", "--cached", "--name-only", capture=True):
        raise RuntimeError("The staging area must be empty before backfilling commits")


def commit_in_daily_batches(
    batches: Sequence[CommitBatch], start_day: date, *, dry_run: bool = False,
) -> list[str]:
    """Commit each file batch on consecutive calendar days."""
    ensure_batches_cover_worktree(batches)
    commits: list[str] = []
    for index, batch in enumerate(batches):
        commit_day = start_day + timedelta(days=index)
        print(f"{commit_day.isoformat()}  {batch.message}")
        if dry_run:
            continue
        git("add", "--all", "--", *batch.paths)
        git("commit", "-m", batch.message, env=dated_environment(commit_day, index))
        commits.append(git("rev-parse", "HEAD", capture=True))
    return commits


def push_commits_incrementally(commits: Iterable[str], remote: str, branch: str) -> None:
    """Advance a remote branch one commit at a time, preserving push order."""
    for commit_hash in commits:
        git("push", remote, f"{commit_hash}:refs/heads/{branch}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--start-date", type=date.fromisoformat, default=date(2026, 6, 28))
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--push", action="store_true")
    parser.add_argument("--remote", default="origin")
    parser.add_argument("--branch", default="main")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    commits = commit_in_daily_batches(BATCHES, args.start_date, dry_run=args.dry_run)
    if args.push and not args.dry_run:
        push_commits_incrementally(commits, args.remote, args.branch)


if __name__ == "__main__":
    main()
