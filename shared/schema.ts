import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
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

export type InsertDigitStat = z.infer<typeof insertDigitStatSchema>;
export type DigitStat = typeof digitStats.$inferSelect;

export type InsertDigitHistory = z.infer<typeof insertDigitHistorySchema>;
export type DigitHistory = typeof digitHistory.$inferSelect;

export type InsertDigitStatsByPeriod = z.infer<typeof insertDigitStatsByPeriodSchema>;
export type DigitStatsByPeriod = typeof digitStatsByPeriod.$inferSelect;
