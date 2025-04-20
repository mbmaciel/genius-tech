/**
 * Tipos para dados de dígitos e estatísticas
 */

export type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface DigitStat {
  digit: Digit | number;
  count: number;
  percentage: number;
}

export interface TickData {
  price: number;
  lastDigit: number;
  time: Date;
}

export interface DigitDistribution {
  [digit: number]: {
    count: number;
    percentage: number;
  };
}