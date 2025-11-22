
import React from 'react';

export interface GasLog {
  date: Date;
  id: string;
}

export interface DebtTransaction {
  id: string;
  date: Date;
  amount: number; // Positive for payment, negative for withdrawal
  reason?: string; // Optional reason for withdrawal
  type: 'payment' | 'withdrawal';
}

export interface Debt {
  id: string;
  name: string;
  source: string;
  totalAmount: number;
  amountPaid: number;
  dueDate: Date;
  createdAt: Date;
  targetMonth?: number; // 0-11, month the debt belongs to budget-wise
  targetYear?: number; // year the debt belongs to budget-wise
  transactions?: DebtTransaction[]; // History of payments and withdrawals
}

export interface Transaction {
    id: string;
    description: string;
    amount: number;
    date: Date;
    category: 'food' | 'misc' | 'fixed';
    isSelected: boolean;
}

export interface ExpenseLog {
    id: string;
    name: string;
    amount: number;
    date: Date;
}

// New Logs for Time-Travel Filtering
export interface IncomeLog {
    id: string;
    amount: number;
    date: Date;
    isSavingsWithdrawal?: boolean; // True if this income came from savings buffer
}

export interface FoodLog {
    id: string;
    amount: number;
    date: Date;
}

export interface Holiday {
    id: string;
    name: string;
    date: Date; // The actual holiday date
    isTakingOff: boolean;
    startDate?: string; // ISO string YYYY-MM-DD
    endDate?: string; // ISO string YYYY-MM-DD
    note?: string;
}

export type FilterType = 'all' | 'week' | 'month' | 'year';

export interface FilterState {
  type: FilterType;
  year: number;
  month?: number; // 0-11
  week?: number; // 1-53
}

export interface SeasonalTheme {
  greeting: string;
  background: string;
  primaryTextColor: string;
  secondaryTextColor: string;
  cardBg: string;
  accentColor: string;
  icon: React.ReactNode;
  decorations?: React.ReactNode;
}
