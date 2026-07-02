import { prisma } from "@/lib/prisma";

// Default categories seeded for every new user. Users can rename, recolor,
// or add their own on top of these.
export const DEFAULT_CATEGORIES: { name: string; icon: string; color: string }[] = [
  { name: "Groceries", icon: "cart", color: "#D4537E" },
  { name: "Dining", icon: "utensils", color: "#E0708F" },
  { name: "Rent & Housing", icon: "home", color: "#7F77DD" },
  { name: "Transport", icon: "car", color: "#9C95E8" },
  { name: "Subscriptions", icon: "repeat", color: "#B07FD6" },
  { name: "Shopping", icon: "bag", color: "#D98BB0" },
  { name: "Health", icon: "heart", color: "#C46A9A" },
  { name: "Entertainment", icon: "film", color: "#8D7FE0" },
  { name: "Travel", icon: "plane", color: "#6E66C8" },
  { name: "Utilities", icon: "bolt", color: "#A79FEE" },
  { name: "Income", icon: "coins", color: "#5FA97C" },
  { name: "Other", icon: "tag", color: "#8B8494" },
];

// Maps Plaid personal_finance_category.primary → default category name
const PLAID_CATEGORY_MAP: Record<string, string> = {
  FOOD_AND_DRINK: "Dining",
  GENERAL_MERCHANDISE: "Shopping",
  GROCERIES: "Groceries",
  HOME_IMPROVEMENT: "Rent & Housing",
  RENT_AND_UTILITIES: "Rent & Housing",
  TRANSPORTATION: "Transport",
  TRAVEL: "Travel",
  MEDICAL: "Health",
  PERSONAL_CARE: "Health",
  ENTERTAINMENT: "Entertainment",
  GENERAL_SERVICES: "Other",
  GOVERNMENT_AND_NON_PROFIT: "Other",
  LOAN_PAYMENTS: "Other",
  BANK_FEES: "Other",
  TRANSFER_IN: "Income",
  TRANSFER_OUT: "Other",
  INCOME: "Income",
};

export async function seedDefaultCategories(userId: string): Promise<void> {
  await prisma.category.createMany({
    data: DEFAULT_CATEGORIES.map((c) => ({ ...c, userId, isDefault: true })),
    skipDuplicates: true,
  });
}

/**
 * Resolve a category id for an incoming transaction:
 * 1. a MerchantRule from a past manual override wins,
 * 2. otherwise map the Plaid primary category to a default category,
 * 3. otherwise fall back to "Other".
 */
export function resolveCategoryName(plaidPrimary: string | null | undefined): string {
  if (plaidPrimary && PLAID_CATEGORY_MAP[plaidPrimary]) {
    return PLAID_CATEGORY_MAP[plaidPrimary];
  }
  return "Other";
}
