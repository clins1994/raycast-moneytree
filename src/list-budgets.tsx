import {
  Action,
  ActionPanel,
  Alert,
  Icon,
  Keyboard,
  List,
  Toast,
  confirmAlert,
  popToRoot,
  showToast,
} from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { BudgetForm } from "./components/BudgetForm";
import { TransactionsList } from "./components/TransactionsList";
import { changeBudget, describeBudgets, getBudgetContext } from "./lib/budgets";

const formatJPY = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" });

export default function Command() {
  const { data, isLoading, error, revalidate } = useCachedPromise(getBudgetContext, []);
  const budgets = data ? describeBudgets(data.budgets, data.categories) : [];
  const createAction = data && (
    <Action.Push
      title="Create Budget"
      icon={Icon.Plus}
      shortcut={Keyboard.Shortcut.Common.New}
      target={<BudgetForm categories={data.categories} budgets={budgets} onSaved={revalidate} />}
    />
  );

  async function deleteBudget(categoryId: number, categoryName: string, amount: number) {
    const confirmed = await confirmAlert({
      title: `Delete ${categoryName} Budget?`,
      message: `Remove the saved ${formatJPY.format(amount)} limit from Moneytree?`,
      primaryAction: { title: "Delete Budget", style: Alert.ActionStyle.Destructive },
    });
    if (!confirmed) return;
    try {
      await changeBudget("delete", categoryId);
      await revalidate();
      await showToast({ style: Toast.Style.Success, title: `${categoryName} budget deleted` });
      await popToRoot({ clearSearchBar: true });
    } catch (cause) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Could not delete budget",
        message: cause instanceof Error ? cause.message : "Unknown error",
      });
    }
  }

  return (
    <List isLoading={isLoading} navigationTitle="Budgets">
      {error ? (
        <List.EmptyView icon={Icon.ExclamationMark} title="Could Not Load Budgets" description={error.message} />
      ) : !isLoading && !budgets.length ? (
        <List.EmptyView
          icon={Icon.List}
          title="No Saved Budgets"
          description="No category budget limits were returned."
          actions={<ActionPanel>{createAction}</ActionPanel>}
        />
      ) : (
        budgets.map((budget) => (
          <List.Item
            key={budget.category_id}
            title={budget.category.name}
            subtitle={budget.parentName}
            accessories={[{ text: formatJPY.format(budget.amount) }]}
            actions={
              <ActionPanel>
                <Action.Push
                  title="Edit Budget"
                  icon={Icon.Pencil}
                  shortcut={Keyboard.Shortcut.Common.Edit}
                  target={
                    <BudgetForm
                      categories={data?.categories ?? []}
                      budgets={budgets}
                      editing={budget}
                      onSaved={revalidate}
                    />
                  }
                />
                <Action.Push
                  title="Show Transactions"
                  icon={Icon.Receipt}
                  target={
                    <TransactionsList
                      budgetCategory={{
                        id: budget.category_id,
                        name: budget.category.name,
                        categories: data?.categories ?? [],
                      }}
                    />
                  }
                />
                {createAction}
                <Action
                  title="Delete Budget"
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  shortcut={Keyboard.Shortcut.Common.Remove}
                  onAction={() => deleteBudget(budget.category_id, budget.category.name, budget.amount)}
                />
                <Action
                  title="Refresh Budgets"
                  icon={Icon.ArrowClockwise}
                  shortcut={Keyboard.Shortcut.Common.Refresh}
                  onAction={revalidate}
                />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
