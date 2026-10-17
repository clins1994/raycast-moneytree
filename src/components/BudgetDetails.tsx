import { Action, ActionPanel, Color, Detail, Icon, Keyboard } from "@raycast/api";
import { getProgressIcon, useCachedPromise } from "@raycast/utils";
import { BudgetForm } from "./BudgetForm";
import { TransactionsList } from "./TransactionsList";
import {
  getBudgetCategoryIds,
  getBudgetProgress,
  getSpendingPeriodDates,
  type BudgetWithCategory,
} from "../lib/budgets";
import { fetchTransactions } from "../lib/moneytree";
import { getMonthlySpending } from "../lib/api";
import type { Category } from "../lib/types";

const yen = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" });

export function BudgetDetails({
  budget,
  budgets,
  categories,
  onSaved,
}: {
  budget: BudgetWithCategory;
  budgets: BudgetWithCategory[];
  categories: Category[];
  onSaved: () => void;
}) {
  const today = new Date();
  const dates = getSpendingPeriodDates(today);
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const transactionDates = { startDate: currentMonth, endDate: dates.endDate };
  const {
    data: periods,
    isLoading,
    error,
    revalidate,
  } = useCachedPromise(getMonthlySpending, [dates.startDate, dates.endDate]);
  const {
    data: transactionsResult,
    isLoading: transactionsLoading,
    error: transactionsError,
  } = useCachedPromise(fetchTransactions, [
    {
      ...transactionDates,
      maxPages: 10,
    },
  ]);
  const categoryIds = new Set(getBudgetCategoryIds(budget.category_id, categories));
  const transactions =
    transactionsResult?.transactions.filter((transaction) => categoryIds.has(transaction.category_id)) ?? [];
  const progress = periods && getBudgetProgress(budget, categories, periods, today);
  const previous =
    periods && getBudgetProgress(budget, categories, periods, new Date(today.getFullYear(), today.getMonth() - 1, 1));
  const remaining = progress && budget.amount - progress.spent;
  const percent = progress && Math.round(progress.percent);
  const month = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(today);
  const escapeMarkdown = (text: string) => text.replace(/[\\`*_{}[\]()#+.!|<>-]/g, "\\$&").replace(/[\r\n]+/g, " ");
  const markdown = [
    `# ${budget.category.name}`,
    `### ${month} · ${dates.startDate} – ${dates.endDate}`,
    `**Budget:** ${yen.format(budget.amount)}`,
    progress
      ? `**Spent:** ${yen.format(progress.spent)}  ·  **Remaining:** ${yen.format(remaining ?? 0)}  ·  **Used:** ${percent}%`
      : isLoading
        ? "Loading spending…"
        : `Spending unavailable${error ? " (request failed)" : " (unexpected period data)"}. The saved limit is still available.`,
    previous ? `**Last month:** ${yen.format(previous.spent)}` : "",
    "## This Month’s Transactions",
    transactions.length
      ? transactions
          .map(
            (transaction) =>
              `* ${transaction.date.substring(0, 10)} · ${escapeMarkdown(transaction.description_pretty || transaction.description_raw || "Unknown")} · ${yen.format(transaction.amount)}`,
          )
          .join("\n")
      : transactionsLoading
        ? "Loading transactions…"
        : transactionsError
          ? "Transactions unavailable; try opening the transaction list."
          : "No transactions found in the fetched range.",
    transactionsResult && transactionsResult.details.transactions_count > transactionsResult.transactions.length
      ? "Showing transactions from the first 10 pages only; open the transaction list for more."
      : "",
    "Spending totals and the transaction list may differ due to Moneytree’s aggregation rules.",
  ]
    .filter(Boolean)
    .join("\n\n");
  return (
    <Detail
      navigationTitle={`${budget.category.name} Budget`}
      isLoading={isLoading}
      markdown={markdown}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Limit" text={yen.format(budget.amount)} />
          {progress && (
            <>
              <Detail.Metadata.Label title="Spent this month" text={yen.format(progress.spent)} />
              <Detail.Metadata.Label
                title="Remaining"
                text={yen.format(remaining ?? 0)}
                color={remaining! < 0 ? Color.Red : Color.Green}
              />
              <Detail.Metadata.Label
                title="Used"
                icon={getProgressIcon(
                  Math.min(1, progress.percent / 100),
                  progress.percent >= 100 ? Color.Red : Color.Green,
                )}
                text={`${percent}%`}
              />
            </>
          )}
          {previous && <Detail.Metadata.Label title="Last month" text={yen.format(previous.spent)} />}
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action.Push
            title="This Month’s Transactions"
            icon={Icon.Receipt}
            target={
              <TransactionsList
                budgetCategory={{ id: budget.category_id, name: budget.category.name, categories }}
                dateRange={transactionDates}
              />
            }
          />
          <Action.Push
            title="Edit Budget"
            icon={Icon.Pencil}
            shortcut={Keyboard.Shortcut.Common.Edit}
            target={<BudgetForm categories={categories} budgets={budgets} editing={budget} onSaved={onSaved} />}
          />
          <Action
            title="Refresh Spending"
            icon={Icon.ArrowClockwise}
            shortcut={Keyboard.Shortcut.Common.Refresh}
            onAction={revalidate}
          />
        </ActionPanel>
      }
    />
  );
}
