import { pgTable, serial, text, timestamp, boolean, integer, json, decimal, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Tabela de usuários
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  fullName: text("full_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastLogin: timestamp("last_login"),
  isActive: boolean("is_active").default(true).notNull(),
  derivToken: text("deriv_token"),
});

export const usersRelations = relations(users, ({ many }) => ({
  strategies: many(strategies),
  tradeSessions: many(tradeSessions),
  trades: many(trades),
}));

// Tabela de estratégias de trading
export const strategies = pgTable("strategies", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  strategyConfig: json("strategy_config").notNull(),
  blocklyXml: text("blockly_xml"), // Formato XML do Blockly
  jsCode: text("js_code"), // Código JavaScript gerado
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const strategiesRelations = relations(strategies, ({ one, many }) => ({
  user: one(users, {
    fields: [strategies.userId],
    references: [users.id],
  }),
  tradeSessions: many(tradeSessions),
}));

// Tabela de sessões de trading
export const tradeSessions = pgTable("trade_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  strategyId: integer("strategy_id").references(() => strategies.id),
  startTime: timestamp("start_time").defaultNow().notNull(),
  endTime: timestamp("end_time"),
  initialBalance: decimal("initial_balance", { precision: 12, scale: 2 }).notNull(),
  finalBalance: decimal("final_balance", { precision: 12, scale: 2 }),
  totalProfit: decimal("total_profit", { precision: 12, scale: 2 }),
  totalTrades: integer("total_trades").default(0),
  successfulTrades: integer("successful_trades").default(0),
  symbol: text("symbol").notNull(),
  tradeType: text("trade_type").notNull(),
  status: text("status").default("running").notNull(), // running, completed, stopped
});

export const tradeSessionsRelations = relations(tradeSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [tradeSessions.userId],
    references: [users.id],
  }),
  strategy: one(strategies, {
    fields: [tradeSessions.strategyId],
    references: [strategies.id],
  }),
  trades: many(trades),
}));

// Tabela de trades individuais
export const trades = pgTable("trades", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  sessionId: integer("session_id").references(() => tradeSessions.id),
  contractId: text("contract_id").notNull(),
  symbol: text("symbol").notNull(),
  contractType: text("contract_type").notNull(), // CALL, PUT, etc.
  entryPrice: decimal("entry_price", { precision: 12, scale: 2 }).notNull(),
  exitPrice: decimal("exit_price", { precision: 12, scale: 2 }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  profit: decimal("profit", { precision: 12, scale: 2 }),
  entryTime: timestamp("entry_time").notNull(),
  exitTime: timestamp("exit_time"),
  duration: integer("duration").notNull(), // em segundos
  status: text("status").notNull(), // open, won, lost, expired
  contractDetails: json("contract_details"), // Detalhes do contrato da API
});

export const tradesRelations = relations(trades, ({ one }) => ({
  user: one(users, {
    fields: [trades.userId],
    references: [users.id],
  }),
  session: one(tradeSessions, {
    fields: [trades.sessionId],
    references: [tradeSessions.id],
  }),
}));

// Tabela de configurações do usuário
export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  theme: text("theme").default("dark"),
  language: text("language").default("pt"),
  notificationsEnabled: boolean("notifications_enabled").default(true),
  emailNotifications: boolean("email_notifications").default(false),
  riskSettings: json("risk_settings").default({}),
  uiSettings: json("ui_settings").default({}),
  tradingSettings: json("trading_settings").default({}),
}, (table) => {
  return {
    userIdx: unique("user_idx").on(table.userId),
  };
});

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.id],
  }),
}));

// Schemas Zod para inserção
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertStrategySchema = createInsertSchema(strategies).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTradeSessionSchema = createInsertSchema(tradeSessions).omit({ id: true, startTime: true });
export const insertTradeSchema = createInsertSchema(trades).omit({ id: true });
export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({ id: true });

// Tipos de inserção
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertStrategy = z.infer<typeof insertStrategySchema>;
export type InsertTradeSession = z.infer<typeof insertTradeSessionSchema>;
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;

// Tipos de seleção
export type User = typeof users.$inferSelect;
export type Strategy = typeof strategies.$inferSelect;
export type TradeSession = typeof tradeSessions.$inferSelect;
export type Trade = typeof trades.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;