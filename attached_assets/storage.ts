import { 
  users, strategies, tradeSessions, trades, userSettings,
  type User, type Strategy, type TradeSession, type Trade, type UserSettings, 
  type InsertUser, type InsertStrategy, type InsertTradeSession, type InsertTrade, type InsertUserSettings 
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { z } from "zod";

export interface IStorage {
  // Usuários
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(insertUser: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User | undefined>;
  
  // Estratégias
  getStrategy(id: number): Promise<Strategy | undefined>;
  getStrategiesByUser(userId: number): Promise<Strategy[]>;
  createStrategy(insertStrategy: InsertStrategy): Promise<Strategy>;
  updateStrategy(id: number, strategy: Partial<Strategy>): Promise<Strategy | undefined>;
  
  // Sessões de Trading
  getTradeSession(id: number): Promise<TradeSession | undefined>;
  getTradeSessionsByUser(userId: number): Promise<TradeSession[]>;
  getTradeSessionsByStrategy(strategyId: number): Promise<TradeSession[]>;
  createTradeSession(insertTradeSession: InsertTradeSession): Promise<TradeSession>;
  updateTradeSession(id: number, session: Partial<TradeSession>): Promise<TradeSession | undefined>;
  
  // Trades
  getTrade(id: number): Promise<Trade | undefined>;
  getTradesByUser(userId: number): Promise<Trade[]>;
  getTradesBySession(sessionId: number): Promise<Trade[]>;
  createTrade(insertTrade: InsertTrade): Promise<Trade>;
  updateTrade(id: number, trade: Partial<Trade>): Promise<Trade | undefined>;
  
  // Configurações de Usuário
  getUserSettings(userId: number): Promise<UserSettings | undefined>;
  createUserSettings(insertUserSettings: InsertUserSettings): Promise<UserSettings>;
  updateUserSettings(userId: number, settings: Partial<UserSettings>): Promise<UserSettings | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Métodos de Usuário
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  // Métodos de Estratégia
  async getStrategy(id: number): Promise<Strategy | undefined> {
    const [strategy] = await db.select().from(strategies).where(eq(strategies.id, id));
    return strategy;
  }

  async getStrategiesByUser(userId: number): Promise<Strategy[]> {
    return db.select().from(strategies).where(eq(strategies.userId, userId));
  }

  async createStrategy(insertStrategy: InsertStrategy): Promise<Strategy> {
    const [strategy] = await db.insert(strategies).values(insertStrategy).returning();
    return strategy;
  }

  async updateStrategy(id: number, strategyData: Partial<Strategy>): Promise<Strategy | undefined> {
    const [updatedStrategy] = await db
      .update(strategies)
      .set(strategyData)
      .where(eq(strategies.id, id))
      .returning();
    return updatedStrategy;
  }

  // Métodos de Sessão de Trading
  async getTradeSession(id: number): Promise<TradeSession | undefined> {
    const [session] = await db.select().from(tradeSessions).where(eq(tradeSessions.id, id));
    return session;
  }

  async getTradeSessionsByUser(userId: number): Promise<TradeSession[]> {
    return db.select().from(tradeSessions).where(eq(tradeSessions.userId, userId));
  }

  async getTradeSessionsByStrategy(strategyId: number): Promise<TradeSession[]> {
    return db
      .select()
      .from(tradeSessions)
      .where(eq(tradeSessions.strategyId, strategyId));
  }

  async createTradeSession(insertTradeSession: InsertTradeSession): Promise<TradeSession> {
    const [session] = await db
      .insert(tradeSessions)
      .values(insertTradeSession)
      .returning();
    return session;
  }

  async updateTradeSession(id: number, sessionData: Partial<TradeSession>): Promise<TradeSession | undefined> {
    const [updatedSession] = await db
      .update(tradeSessions)
      .set(sessionData)
      .where(eq(tradeSessions.id, id))
      .returning();
    return updatedSession;
  }

  // Métodos de Trade
  async getTrade(id: number): Promise<Trade | undefined> {
    const [trade] = await db.select().from(trades).where(eq(trades.id, id));
    return trade;
  }

  async getTradesByUser(userId: number): Promise<Trade[]> {
    return db.select().from(trades).where(eq(trades.userId, userId));
  }

  async getTradesBySession(sessionId: number): Promise<Trade[]> {
    return db.select().from(trades).where(eq(trades.sessionId, sessionId));
  }

  async createTrade(insertTrade: InsertTrade): Promise<Trade> {
    const [trade] = await db.insert(trades).values(insertTrade).returning();
    return trade;
  }

  async updateTrade(id: number, tradeData: Partial<Trade>): Promise<Trade | undefined> {
    const [updatedTrade] = await db
      .update(trades)
      .set(tradeData)
      .where(eq(trades.id, id))
      .returning();
    return updatedTrade;
  }

  // Métodos de Configuração de Usuário
  async getUserSettings(userId: number): Promise<UserSettings | undefined> {
    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId));
    return settings;
  }

  async createUserSettings(insertUserSettings: InsertUserSettings): Promise<UserSettings> {
    const [settings] = await db
      .insert(userSettings)
      .values(insertUserSettings)
      .returning();
    return settings;
  }

  async updateUserSettings(userId: number, settingsData: Partial<UserSettings>): Promise<UserSettings | undefined> {
    const [updatedSettings] = await db
      .update(userSettings)
      .set(settingsData)
      .where(eq(userSettings.userId, userId))
      .returning();
    return updatedSettings;
  }
}

export const storage = new DatabaseStorage();