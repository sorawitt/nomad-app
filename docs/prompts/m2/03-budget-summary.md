# Task: Budget Summary - สรุปค่าใช้จ่าย

## Context
สร้างระบบจัดการค่าใช้จ่ายในทริป แสดงสรุปยอดรวม ยอดคงเหลือ และรายการค่าใช้จ่ายแบ่งตาม tab (ทั้งหมด/ตามหมวด) พร้อม donut chart แสดงสัดส่วนแต่ละหมวด

## Tech Stack
- **Preact + TypeScript**: Component และ Type Safety
- **TanStack Query**: Data fetching, mutations, cache
- **Supabase**: Database, RLS policies
- **Tailwind CSS v4**: Styling (mobile-first)
- **date-fns**: Date formatting
- **Recharts**: Donut chart visualization

## Requirements

### Functional Requirements
- เพิ่มค่าใช้จ่าย: หมวด, จำนวนเงิน, วันที่, ผู้จ่าย, หมายเหตุ
- แสดงยอดรวมค่าใช้จ่ายทั้งหมด
- แสดงยอดคงเหลือ (งบประมาณ - ค่าใช้จ่าย)
- Tab navigation: "ทั้งหมด" และ "ตามหมวด"
- Donut chart แสดงสัดส่วนตามหมวด
- แก้ไข/ลบค่าใช้จ่าย (owner/editor เท่านั้น)
- Empty state เมื่อยังไม่มีรายการ
- Optimistic updates

### Categories
```typescript
const EXPENSE_CATEGORIES = [
  'อาหาร',
  'ที่พัก',
  'พาหนะ',
  'กิจกรรม',
  'ของที่ระลึก',
  'อื่นๆ'
] as const;
```

## Step-by-Step Implementation

### Step 1: Database Migration

สร้างตาราง `expenses` และ RLS policies

**File: `supabase/migrations/002_expenses.sql`**

```sql
-- ตาราง expenses
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_id UUID REFERENCES trip_days(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  paid_by UUID NOT NULL REFERENCES profiles(id),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_expenses_trip ON expenses(trip_id);
CREATE INDEX idx_expenses_category ON expenses(trip_id, category);
CREATE INDEX idx_expenses_day ON expenses(day_id);

-- RLS Enable
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Policy: อ่านได้ถ้าเป็นสมาชิกทริป
CREATE POLICY "Members can view expenses"
  ON expenses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = expenses.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

-- Policy: เพิ่มได้ถ้าเป็น owner/editor
CREATE POLICY "Owner/Editor can insert expenses"
  ON expenses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = expenses.trip_id
        AND trip_members.user_id = auth.uid()
        AND trip_members.role IN ('owner', 'editor')
    )
  );

-- Policy: แก้ไขได้ถ้าเป็น owner/editor
CREATE POLICY "Owner/Editor can update expenses"
  ON expenses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = expenses.trip_id
        AND trip_members.user_id = auth.uid()
        AND trip_members.role IN ('owner', 'editor')
    )
  );

-- Policy: ลบได้ถ้าเป็น owner/editor
CREATE POLICY "Owner/Editor can delete expenses"
  ON expenses FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = expenses.trip_id
        AND trip_members.user_id = auth.uid()
        AND trip_members.role IN ('owner', 'editor')
    )
  );

-- Trigger: อัปเดต updated_at
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

**Run migration:**
```bash
supabase db push
```

---

### Step 2: Type Definitions

**File: `src/types/expense.ts`**

```typescript
export const EXPENSE_CATEGORIES = [
  'อาหาร',
  'ที่พัก',
  'พาหนะ',
  'กิจกรรม',
  'ของที่ระลึก',
  'อื่นๆ'
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

export interface Expense {
  id: string;
  trip_id: string;
  day_id: string | null;
  category: ExpenseCategory;
  amount: number;
  paid_by: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  payer_name?: string;
  day_date?: string;
}

export interface ExpenseSummary {
  total: number;
  budget: number;
  remaining: number;
  byCategory: CategorySummary[];
}

export interface CategorySummary {
  category: ExpenseCategory;
  total: number;
  percentage: number;
  color: string;
}

export interface AddExpenseInput {
  trip_id: string;
  day_id?: string | null;
  category: ExpenseCategory;
  amount: number;
  paid_by: string;
  note?: string;
}

export interface UpdateExpenseInput {
  category?: ExpenseCategory;
  amount?: number;
  day_id?: string | null;
  note?: string;
}
```

---

### Step 3: Hooks - useExpenses

**File: `src/hooks/useExpenses.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Expense } from '@/types/expense';

export function useExpenses(tripId: string) {
  return useQuery({
    queryKey: ['expenses', tripId],
    queryFn: async (): Promise<Expense[]> => {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          payer:profiles!paid_by(display_name),
          day:trip_days(date)
        `)
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data.map(expense => ({
        ...expense,
        payer_name: expense.payer?.display_name || 'Unknown',
        day_date: expense.day?.date
      }));
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
```

---

### Step 4: Hooks - useExpenseSummary

**File: `src/hooks/useExpenseSummary.ts`**

```typescript
import { useMemo } from 'preact/hooks';
import type { Expense, ExpenseSummary, CategorySummary, ExpenseCategory } from '@/types/expense';

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  'อาหาร': '#10b981',
  'ที่พัก': '#3b82f6',
  'พาหนะ': '#f59e0b',
  'กิจกรรม': '#8b5cf6',
  'ของที่ระลึก': '#ec4899',
  'อื่นๆ': '#6b7280'
};

export function useExpenseSummary(
  expenses: Expense[] | undefined,
  budget: number
): ExpenseSummary {
  return useMemo(() => {
    if (!expenses || expenses.length === 0) {
      return {
        total: 0,
        budget,
        remaining: budget,
        byCategory: []
      };
    }

    const total = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
    const remaining = budget - total;

    // Group by category
    const categoryMap = expenses.reduce((acc, expense) => {
      const cat = expense.category;
      if (!acc[cat]) {
        acc[cat] = 0;
      }
      acc[cat] += Number(expense.amount);
      return acc;
    }, {} as Record<ExpenseCategory, number>);

    const byCategory: CategorySummary[] = Object.entries(categoryMap).map(([category, amount]) => ({
      category: category as ExpenseCategory,
      total: amount,
      percentage: (amount / total) * 100,
      color: CATEGORY_COLORS[category as ExpenseCategory]
    }));

    // Sort by amount descending
    byCategory.sort((a, b) => b.total - a.total);

    return {
      total,
      budget,
      remaining,
      byCategory
    };
  }, [expenses, budget]);
}
```

---

### Step 5: Hooks - Mutations

**File: `src/hooks/useAddExpense.ts`**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { AddExpenseInput, Expense } from '@/types/expense';
import { trackEvent } from '@/lib/analytics';

export function useAddExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddExpenseInput): Promise<Expense> => {
      const { data, error } = await supabase
        .from('expenses')
        .insert(input)
        .select(`
          *,
          payer:profiles!paid_by(display_name),
          day:trip_days(date)
        `)
        .single();

      if (error) throw error;

      return {
        ...data,
        payer_name: data.payer?.display_name,
        day_date: data.day?.date
      };
    },
    onSuccess: (newExpense) => {
      // Invalidate expenses cache
      queryClient.invalidateQueries({ queryKey: ['expenses', newExpense.trip_id] });

      // Track analytics
      trackEvent('add_expense', {
        trip_id: newExpense.trip_id,
        category: newExpense.category,
        amount: newExpense.amount
      });
    }
  });
}
```

**File: `src/hooks/useUpdateExpense.ts`**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { UpdateExpenseInput, Expense } from '@/types/expense';

export function useUpdateExpense(expenseId: string, tripId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateExpenseInput): Promise<Expense> => {
      const { data, error } = await supabase
        .from('expenses')
        .update(input)
        .eq('id', expenseId)
        .select(`
          *,
          payer:profiles!paid_by(display_name),
          day:trip_days(date)
        `)
        .single();

      if (error) throw error;

      return {
        ...data,
        payer_name: data.payer?.display_name,
        day_date: data.day?.date
      };
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['expenses', tripId] });

      const previousExpenses = queryClient.getQueryData<Expense[]>(['expenses', tripId]);

      // Optimistic update
      if (previousExpenses) {
        queryClient.setQueryData<Expense[]>(
          ['expenses', tripId],
          previousExpenses.map(exp =>
            exp.id === expenseId ? { ...exp, ...input } : exp
          )
        );
      }

      return { previousExpenses };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousExpenses) {
        queryClient.setQueryData(['expenses', tripId], context.previousExpenses);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', tripId] });
    }
  });
}
```

**File: `src/hooks/useDeleteExpense.ts`**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Expense } from '@/types/expense';

export function useDeleteExpense(expenseId: string, tripId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId);

      if (error) throw error;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['expenses', tripId] });

      const previousExpenses = queryClient.getQueryData<Expense[]>(['expenses', tripId]);

      // Optimistic update
      if (previousExpenses) {
        queryClient.setQueryData<Expense[]>(
          ['expenses', tripId],
          previousExpenses.filter(exp => exp.id !== expenseId)
        );
      }

      return { previousExpenses };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousExpenses) {
        queryClient.setQueryData(['expenses', tripId], context.previousExpenses);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', tripId] });
    }
  });
}
```

---

### Step 6: Component - BudgetView (Main Screen)

**File: `src/pages/BudgetView.tsx`**

```typescript
import { useState } from 'preact/hooks';
import { useParams } from 'react-router-dom';
import { useTrip } from '@/hooks/useTrip';
import { useExpenses } from '@/hooks/useExpenses';
import { useExpenseSummary } from '@/hooks/useExpenseSummary';
import { useTripMember } from '@/hooks/useTripMember';
import { ExpenseSummaryCard } from '@/components/budget/ExpenseSummaryCard';
import { ExpenseList } from '@/components/budget/ExpenseList';
import { ExpensesByCategory } from '@/components/budget/ExpensesByCategory';
import { ExpenseModal } from '@/components/budget/ExpenseModal';
import { EmptyExpenses } from '@/components/budget/EmptyExpenses';

type TabType = 'all' | 'by-category';

export function BudgetView() {
  const { tripId } = useParams<{ tripId: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: trip, isLoading: tripLoading } = useTrip(tripId!);
  const { data: expenses, isLoading: expensesLoading } = useExpenses(tripId!);
  const { data: member } = useTripMember(tripId!);

  const summary = useExpenseSummary(expenses, trip?.budget || 0);

  const canEdit = member?.role === 'owner' || member?.role === 'editor';

  if (tripLoading || expensesLoading) {
    return (
      <div class="min-h-screen bg-gray-50 p-4">
        <div class="max-w-2xl mx-auto space-y-4">
          <div class="h-32 bg-gray-200 rounded-lg animate-pulse" />
          <div class="h-12 bg-gray-200 rounded-lg animate-pulse" />
          <div class="h-96 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  const isEmpty = !expenses || expenses.length === 0;

  return (
    <div class="min-h-screen bg-gray-50 pb-20">
      {/* Summary Card */}
      <ExpenseSummaryCard summary={summary} />

      {/* Tab Navigation */}
      {!isEmpty && (
        <div class="bg-white border-b border-gray-200">
          <div class="max-w-2xl mx-auto px-4">
            <div class="flex gap-4">
              <button
                onClick={() => setActiveTab('all')}
                class={`
                  py-3 px-4 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === 'all'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                  }
                `}
              >
                ทั้งหมด ({expenses.length})
              </button>
              <button
                onClick={() => setActiveTab('by-category')}
                class={`
                  py-3 px-4 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === 'by-category'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                  }
                `}
              >
                ตามหมวด ({summary.byCategory.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div class="max-w-2xl mx-auto p-4">
        {isEmpty ? (
          <EmptyExpenses onAddClick={() => setIsModalOpen(true)} />
        ) : (
          <>
            {activeTab === 'all' && <ExpenseList expenses={expenses} canEdit={canEdit} />}
            {activeTab === 'by-category' && (
              <ExpensesByCategory expenses={expenses} summary={summary} canEdit={canEdit} />
            )}
          </>
        )}
      </div>

      {/* Add Button */}
      {canEdit && (
        <button
          onClick={() => setIsModalOpen(true)}
          class="fixed bottom-20 right-4 bg-blue-500 text-white rounded-full p-4 shadow-lg hover:bg-blue-600 transition-colors"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}

      {/* Modal */}
      {isModalOpen && (
        <ExpenseModal
          tripId={tripId!}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}
```

---

### Step 7: Component - ExpenseSummaryCard

**File: `src/components/budget/ExpenseSummaryCard.tsx`**

```typescript
import type { ExpenseSummary } from '@/types/expense';

interface Props {
  summary: ExpenseSummary;
}

export function ExpenseSummaryCard({ summary }: Props) {
  const { total, budget, remaining, byCategory } = summary;
  const percentage = budget > 0 ? (total / budget) * 100 : 0;
  const isOverBudget = remaining < 0;

  return (
    <div class="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6">
      <div class="max-w-2xl mx-auto space-y-4">
        {/* Total and Budget */}
        <div>
          <div class="text-sm opacity-90">ค่าใช้จ่ายทั้งหมด</div>
          <div class="text-4xl font-bold mt-1">
            ฿{total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </div>
          <div class="text-sm opacity-90 mt-2">
            จากงบประมาณ ฿{budget.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </div>
        </div>

        {/* Progress Bar */}
        <div>
          <div class="bg-white/20 rounded-full h-2 overflow-hidden">
            <div
              class={`h-full transition-all ${isOverBudget ? 'bg-red-300' : 'bg-white'}`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
          <div class="flex justify-between text-sm mt-2">
            <span>{percentage.toFixed(0)}% ใช้ไปแล้ว</span>
            <span class={isOverBudget ? 'text-red-200' : ''}>
              {isOverBudget ? 'เกินงบ' : 'คงเหลือ'} ฿{Math.abs(remaining).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Top Categories (preview) */}
        {byCategory.length > 0 && (
          <div class="flex gap-4 pt-2">
            {byCategory.slice(0, 3).map(cat => (
              <div key={cat.category} class="flex items-center gap-2 text-sm">
                <div class="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                <span class="opacity-90">{cat.category}</span>
                <span class="font-medium">฿{cat.total.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### Step 8: Component - ExpenseList

**File: `src/components/budget/ExpenseList.tsx`**

```typescript
import { useState } from 'preact/hooks';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import type { Expense } from '@/types/expense';
import { ExpenseModal } from './ExpenseModal';
import { useDeleteExpense } from '@/hooks/useDeleteExpense';

interface Props {
  expenses: Expense[];
  canEdit: boolean;
}

export function ExpenseList({ expenses, canEdit }: Props) {
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  return (
    <div class="space-y-3">
      {expenses.map(expense => (
        <ExpenseItem
          key={expense.id}
          expense={expense}
          canEdit={canEdit}
          onEdit={() => setEditingExpense(expense)}
        />
      ))}

      {editingExpense && (
        <ExpenseModal
          tripId={editingExpense.trip_id}
          expense={editingExpense}
          onClose={() => setEditingExpense(null)}
        />
      )}
    </div>
  );
}

interface ItemProps {
  expense: Expense;
  canEdit: boolean;
  onEdit: () => void;
}

function ExpenseItem({ expense, canEdit, onEdit }: ItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const deleteMutation = useDeleteExpense(expense.id, expense.trip_id);

  const handleDelete = async () => {
    if (!confirm('ต้องการลบรายการนี้?')) return;
    try {
      await deleteMutation.mutateAsync();
    } catch (error) {
      alert('ไม่สามารถลบรายการได้');
    }
  };

  return (
    <div class="bg-white rounded-lg p-4 shadow-sm border border-gray-200 relative">
      {/* Menu button */}
      {canEdit && (
        <div class="absolute top-3 right-3">
          <button
            onClick={() => setShowMenu(!showMenu)}
            class="text-gray-400 hover:text-gray-600"
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>

          {showMenu && (
            <div class="absolute right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-[120px]">
              <button
                onClick={() => {
                  onEdit();
                  setShowMenu(false);
                }}
                class="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
              >
                แก้ไข
              </button>
              <button
                onClick={handleDelete}
                class="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-50"
              >
                ลบ
              </button>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div class="pr-8">
        <div class="flex items-start justify-between">
          <div>
            <div class="font-medium text-gray-900">{expense.category}</div>
            {expense.note && (
              <div class="text-sm text-gray-600 mt-1">{expense.note}</div>
            )}
            <div class="text-xs text-gray-500 mt-2 space-x-3">
              <span>{expense.payer_name}</span>
              {expense.day_date && (
                <span>
                  {format(new Date(expense.day_date), 'd MMM', { locale: th })}
                </span>
              )}
            </div>
          </div>
          <div class="text-lg font-semibold text-gray-900">
            ฿{Number(expense.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### Step 9: Component - ExpensesByCategory (with Donut Chart)

**File: `src/components/budget/ExpensesByCategory.tsx`**

```typescript
import { useState } from 'preact/hooks';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { Expense, ExpenseSummary, ExpenseCategory } from '@/types/expense';
import { ExpenseList } from './ExpenseList';

interface Props {
  expenses: Expense[];
  summary: ExpenseSummary;
  canEdit: boolean;
}

export function ExpensesByCategory({ expenses, summary, canEdit }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | null>(null);

  const chartData = summary.byCategory.map(cat => ({
    name: cat.category,
    value: cat.total,
    color: cat.color
  }));

  const filteredExpenses = selectedCategory
    ? expenses.filter(exp => exp.category === selectedCategory)
    : expenses;

  return (
    <div class="space-y-6">
      {/* Donut Chart */}
      <div class="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <h3 class="font-semibold text-gray-900 mb-4">สัดส่วนค่าใช้จ่าย</h3>

        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => `฿${value.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value) => value}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Category Summary List */}
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div class="divide-y divide-gray-200">
          {summary.byCategory.map(cat => {
            const count = expenses.filter(exp => exp.category === cat.category).length;
            const isSelected = selectedCategory === cat.category;

            return (
              <button
                key={cat.category}
                onClick={() => setSelectedCategory(isSelected ? null : cat.category)}
                class={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                  isSelected ? 'bg-blue-50' : ''
                }`}
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div
                      class="w-4 h-4 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <div>
                      <div class="font-medium text-gray-900">{cat.category}</div>
                      <div class="text-sm text-gray-500">{count} รายการ</div>
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="font-semibold text-gray-900">
                      ฿{cat.total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </div>
                    <div class="text-sm text-gray-500">
                      {cat.percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filtered Expense List */}
      {selectedCategory && (
        <div>
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold text-gray-900">
              {selectedCategory} ({filteredExpenses.length})
            </h3>
            <button
              onClick={() => setSelectedCategory(null)}
              class="text-sm text-blue-600 hover:text-blue-700"
            >
              แสดงทั้งหมด
            </button>
          </div>
          <ExpenseList expenses={filteredExpenses} canEdit={canEdit} />
        </div>
      )}
    </div>
  );
}
```

---

### Step 10: Component - ExpenseModal (Form)

**File: `src/components/budget/ExpenseModal.tsx`**

```typescript
import { useState } from 'preact/hooks';
import { useAuth } from '@/hooks/useAuth';
import { useTripDays } from '@/hooks/useTripDays';
import { useAddExpense } from '@/hooks/useAddExpense';
import { useUpdateExpense } from '@/hooks/useUpdateExpense';
import { EXPENSE_CATEGORIES, type Expense, type ExpenseCategory } from '@/types/expense';

interface Props {
  tripId: string;
  expense?: Expense;
  onClose: () => void;
}

export function ExpenseModal({ tripId, expense, onClose }: Props) {
  const { user } = useAuth();
  const { data: days } = useTripDays(tripId);

  const [category, setCategory] = useState<ExpenseCategory>(expense?.category || 'อาหาร');
  const [amount, setAmount] = useState(expense?.amount.toString() || '');
  const [dayId, setDayId] = useState<string | null>(expense?.day_id || null);
  const [note, setNote] = useState(expense?.note || '');
  const [error, setError] = useState('');

  const addMutation = useAddExpense();
  const updateMutation = useUpdateExpense(expense?.id || '', tripId);

  const isEditing = !!expense;

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('กรุณาระบุจำนวนเงินที่ถูกต้อง');
      return;
    }

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({
          category,
          amount: amountNum,
          day_id: dayId,
          note: note.trim() || null
        });
      } else {
        await addMutation.mutateAsync({
          trip_id: tripId,
          category,
          amount: amountNum,
          paid_by: user!.id,
          day_id: dayId,
          note: note.trim() || null
        });
      }
      onClose();
    } catch (err) {
      setError(isEditing ? 'ไม่สามารถแก้ไขรายการได้' : 'ไม่สามารถเพิ่มรายการได้');
    }
  };

  const isPending = addMutation.isPending || updateMutation.isPending;

  return (
    <div class="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
      <div class="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div class="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900">
            {isEditing ? 'แก้ไขรายการ' : 'เพิ่มรายการ'}
          </h2>
          <button
            onClick={onClose}
            class="text-gray-400 hover:text-gray-600"
            disabled={isPending}
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} class="p-6 space-y-5">
          {/* Category */}
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              หมวดหมู่ *
            </label>
            <div class="grid grid-cols-3 gap-2">
              {EXPENSE_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  class={`
                    py-2 px-3 rounded-lg border text-sm font-medium transition-colors
                    ${category === cat
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                    }
                  `}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              จำนวนเงิน (฿) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onInput={(e) => setAmount((e.target as HTMLInputElement).value)}
              placeholder="0.00"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Day */}
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              วันที่ (ถ้ามี)
            </label>
            <select
              value={dayId || ''}
              onChange={(e) => setDayId((e.target as HTMLSelectElement).value || null)}
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">ไม่ระบุ</option>
              {days?.map(day => (
                <option key={day.id} value={day.id}>
                  วันที่ {day.day_number} - {day.title}
                </option>
              ))}
            </select>
          </div>

          {/* Note */}
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              หมายเหตุ
            </label>
            <textarea
              value={note}
              onInput={(e) => setNote((e.target as HTMLTextAreaElement).value)}
              placeholder="เพิ่มรายละเอียด..."
              rows={3}
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div class="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending}
            class="w-full bg-blue-500 text-white py-3 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? 'กำลังบันทึก...' : isEditing ? 'บันทึก' : 'เพิ่มรายการ'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

---

### Step 11: Component - EmptyExpenses

**File: `src/components/budget/EmptyExpenses.tsx`**

```typescript
interface Props {
  onAddClick: () => void;
}

export function EmptyExpenses({ onAddClick }: Props) {
  return (
    <div class="bg-white rounded-lg p-12 text-center border border-gray-200">
      <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      </div>
      <h3 class="text-lg font-medium text-gray-900 mb-2">ยังไม่มีรายการค่าใช้จ่าย</h3>
      <p class="text-gray-500 mb-6">เริ่มบันทึกค่าใช้จ่ายเพื่อติดตามงบประมาณของคุณ</p>
      <button
        onClick={onAddClick}
        class="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
      >
        เพิ่มรายการแรก
      </button>
    </div>
  );
}
```

---

## Testing Checklist

- [ ] เพิ่มค่าใช้จ่าย → แสดงในรายการทันที (optimistic update)
- [ ] ยอดรวมและคงเหลือคำนวณถูกต้อง
- [ ] Progress bar แสดงเปอร์เซนต์ถูกต้อง
- [ ] เกินงบ → แสดง "เกินงบ" สีแดง
- [ ] Tab "ทั้งหมด" → แสดงรายการทั้งหมดเรียงตามเวลา
- [ ] Tab "ตามหมวด" → แสดง donut chart + รายการแยกหมวด
- [ ] คลิกหมวดใน "ตามหมวด" → กรองเฉพาะหมวดนั้น
- [ ] แก้ไขรายการ → อัปเดตทันที
- [ ] ลบรายการ → หายจากรายการทันที
- [ ] Empty state → แสดงเมื่อยังไม่มีรายการ
- [ ] RLS: viewer ไม่สามารถเพิ่ม/แก้ไข/ลบได้
- [ ] RLS: owner/editor เพิ่ม/แก้ไข/ลบได้
- [ ] Validation: amount ≤ 0 → error
- [ ] Analytics: `add_expense` event tracked

---

## Best Practices

### 1. Type Safety
```typescript
// ✅ Use const assertion for categories
export const EXPENSE_CATEGORIES = ['อาหาร', 'ที่พัก', ...] as const;
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

// ✅ Validate amount
if (isNaN(amountNum) || amountNum <= 0) throw new Error('Invalid amount');
```

### 2. Optimistic Updates
```typescript
// ✅ Optimistic delete with rollback
onMutate: async () => {
  const previous = queryClient.getQueryData(['expenses', tripId]);
  queryClient.setQueryData(['expenses', tripId],
    previous.filter(e => e.id !== expenseId)
  );
  return { previous };
},
onError: (err, vars, context) => {
  queryClient.setQueryData(['expenses', tripId], context.previous);
}
```

### 3. Data Calculation
```typescript
// ✅ Use useMemo for expensive calculations
export function useExpenseSummary(expenses, budget) {
  return useMemo(() => {
    const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    // ... calculations
  }, [expenses, budget]);
}
```

### 4. Number Formatting
```typescript
// ✅ Use Thai locale formatting
amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })

// ✅ Store as NUMERIC(12,2) in database
CREATE TABLE expenses (
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0)
);
```

### 5. Chart Performance
```typescript
// ✅ Use ResponsiveContainer for responsive charts
<ResponsiveContainer width="100%" height={250}>
  <PieChart>
    <Pie innerRadius={60} outerRadius={90} />
  </PieChart>
</ResponsiveContainer>
```

---

## Common Issues

### Issue: ยอดรวมไม่ตรง
```typescript
// ❌ String addition
const total = expenses.reduce((sum, e) => sum + e.amount, 0); // "10020030"

// ✅ Number conversion
const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
```

### Issue: Donut chart ไม่แสดง
```typescript
// ❌ Missing ResponsiveContainer
<PieChart width={300} height={300}>...</PieChart>

// ✅ Use ResponsiveContainer
<ResponsiveContainer width="100%" height={250}>
  <PieChart>...</PieChart>
</ResponsiveContainer>
```

### Issue: เปอร์เซนต์เกิน 100%
```typescript
// ❌ ไม่จำกัด
<div style={{ width: `${percentage}%` }} />

// ✅ จำกัดไม่เกิน 100%
<div style={{ width: `${Math.min(percentage, 100)}%` }} />
```

---

## Notes

- **Budget field**: ต้องมี `budget` field ใน `trips` table (เพิ่มใน migration ถ้ายังไม่มี)
- **Recharts**: ติดตั้ง `npm install recharts` สำหรับ donut chart
- **date-fns**: ติดตั้ง `npm install date-fns` สำหรับ date formatting
- **Decimal precision**: ใช้ `NUMERIC(12,2)` ไม่ใช่ `FLOAT` เพื่อความแม่นยำ
- **Performance**: useMemo สำหรับ summary calculations ที่ซับซ้อน
