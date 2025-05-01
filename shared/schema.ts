import { pgTable, text, serial, integer, boolean, timestamp, jsonb, index, uniqueIndex, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name"),
  role: text("role").default("user").notNull(),
  is_active: boolean("is_active").default(true).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  last_login: timestamp("last_login"),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  created_at: true,
  last_login: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Tabela para estatísticas dos dígitos do R_100
export const digitStats = pgTable("digit_stats", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(), // R_100, R_50, etc.
  digit: integer("digit").notNull(), // 0-9
  count: integer("count").notNull().default(0), // Contagem total deste dígito
  percentage: integer("percentage").notNull().default(0), // Percentagem (0-100)
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

// Tabela para armazenar a sequência completa de dígitos
export const digitHistory = pgTable("digit_history", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(), // R_100, R_50, etc.
  digits: jsonb("digits").notNull().default([]), // Array com os últimos dígitos
  total_count: integer("total_count").notNull().default(0), // Total de ticks processados
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

// Tabela para estatísticas de dígitos por período
export const digitStatsByPeriod = pgTable("digit_stats_by_period", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(), // R_100, R_50, etc.
  period: text("period").notNull(), // 1h, 6h, 24h, etc.
  stats: jsonb("stats").notNull(), // Estatísticas completas para o período
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

// Nova tabela para armazenar ticks de mercado
export const marketTicks = pgTable("market_ticks", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(), // R_100, R_50, etc.
  tick_value: doublePrecision("tick_value").notNull(), // Valor do tick (por exemplo, 1234.56)
  last_digit: integer("last_digit").notNull(), // Último dígito (0-9)
  timestamp: timestamp("timestamp").notNull().defaultNow(),
}, (table) => {
  return {
    // Índice composto para evitar duplicação e para buscas rápidas
    symbolTimestampIdx: uniqueIndex("symbol_timestamp_idx").on(table.symbol, table.timestamp),
    // Índice para buscas rápidas por símbolo
    symbolIdx: index("symbol_idx").on(table.symbol),
    // Índice para buscas rápidas por último dígito
    lastDigitIdx: index("last_digit_idx").on(table.last_digit)
  };
});

export const insertDigitStatSchema = createInsertSchema(digitStats).omit({
  id: true,
  updated_at: true
});

export const insertDigitHistorySchema = createInsertSchema(digitHistory).omit({
  id: true,
  updated_at: true
});

export const insertDigitStatsByPeriodSchema = createInsertSchema(digitStatsByPeriod).omit({
  id: true,
  updated_at: true
});

export const insertMarketTickSchema = createInsertSchema(marketTicks).omit({
  id: true,
  timestamp: true
});

export type InsertDigitStat = z.infer<typeof insertDigitStatSchema>;
export type DigitStat = typeof digitStats.$inferSelect;

export type InsertDigitHistory = z.infer<typeof insertDigitHistorySchema>;
export type DigitHistory = typeof digitHistory.$inferSelect;

export type InsertDigitStatsByPeriod = z.infer<typeof insertDigitStatsByPeriodSchema>;
export type DigitStatsByPeriod = typeof digitStatsByPeriod.$inferSelect;

export type InsertMarketTick = z.infer<typeof insertMarketTickSchema>;
export type MarketTick = typeof marketTicks.$inferSelect;

// Tabela para armazenar as credenciais dos usuários
export const userCredentials = pgTable("user_credentials", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserCredentialSchema = createInsertSchema(userCredentials).omit({
  id: true,
  created_at: true,
});

export type InsertUserCredential = z.infer<typeof insertUserCredentialSchema>;
export type UserCredential = typeof userCredentials.$inferSelect;
