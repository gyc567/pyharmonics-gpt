export type FundScale = "small" | "medium" | "large";
export type RiskAppetite = "conservative" | "balanced" | "aggressive";

export interface PositionConfig {
  totalCapitalWu: number;
  emergencyRatio: number;
  btcRatio: number;
  altcoinMaxRatio: number;
  midAccountRatio: number;
  smallAccountRatio: number;
  smallTradableRatio: number;
  largeCapitalThresholdWu: number;
  largeCapitalAltcoinMaxRatio: number;
  largeCapitalBtcReferenceRatio: number;
  cutPositionWu: number;
}

export interface AccountBucket {
  key: string;
  label: string;
  amountWu: number;
  ratioOfRegular: number;
  ratioOfTotal: number;
  device: string;
  color: string;
}

export interface PositionBalance {
  emergencyWu: number;
  btcWu: number;
  midWu: number;
  smallTradableWu: number;
  smallReserveWu: number;
  cutPositionWu: number;
}

export interface RiskLevel {
  level: number;
  label: string;
  minWu: number;
  maxWu: number;
  trouble: string;
  cooldown: string;
}

export interface ColdCheckItem {
  id: string;
  label: string;
  checked: boolean;
}

export interface LongTermHolding {
  id: string;
  symbol: string;
  entryPrice?: number;
  positionWu: number;
  exitCondition?: string;
  reviewDate?: string;
  createdAt: string;
}

export interface TradeReadinessLog {
  id: string;
  userId: string;
  plannedTradeWu: number;
  riskLevel: number;
  checklist: Record<string, boolean>;
  passed: boolean;
  createdAt: string;
}

export interface ValidationResult {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface DiagnosticItem {
  id: string;
  severity: "warning" | "info";
  message: string;
  action?: string;
}

export interface WhatIfResult {
  tradeWu: number;
  consumedEmergencyWu: number;
  consumedBtcWu: number;
  consumedMidWu: number;
  consumedSmallTradableWu: number;
  consumedSmallReserveWu: number;
  remainingEmergencyWu: number;
  remainingBtcWu: number;
  remainingMidWu: number;
  remainingSmallTradableWu: number;
  remainingSmallReserveWu: number;
  remainingTotalWu: number;
  touchesEmergency: boolean;
}
