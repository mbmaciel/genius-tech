import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ArrowUpIcon, ArrowDownIcon, RefreshCwIcon, TrendingUpIcon, 
  CpuIcon, ZapIcon, DatabaseIcon, ArrowRightCircleIcon, AlertCircleIcon 
} from "lucide-react";
import { BinaryBotStrategy } from "../lib/automationService";

interface StrategySelectorProps {
  strategies: BinaryBotStrategy[];
  selectedStrategy: BinaryBotStrategy | null;
  onSelect: (strategy: BinaryBotStrategy) => void;
}

export function StrategySelector({ strategies, selectedStrategy, onSelect }: StrategySelectorProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {strategies.map((strategy) => (
        <Card
          key={strategy.id}
          className={`bg-[#1a2234] border cursor-pointer transition-all hover:border-blue-500 ${
            selectedStrategy?.id === strategy.id ? "border-blue-500 ring-1 ring-blue-500" : "border-gray-700"
          }`}
          onClick={() => onSelect(strategy)}
        >
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>{strategy.name}</CardTitle>
                <CardDescription className="text-gray-400 mt-1">
                  {strategy.description}
                </CardDescription>
              </div>
              <div className="flex items-center justify-center rounded-full bg-blue-500/20 p-1">
                {strategy.type === "OVER" && <ArrowUpIcon className="h-4 w-4 text-blue-500" />}
                {strategy.type === "UNDER" && <ArrowDownIcon className="h-4 w-4 text-red-500" />}
                {strategy.type === "BOTH" && <RefreshCwIcon className="h-4 w-4 text-green-500" />}
                {strategy.type === "RISE" && <TrendingUpIcon className="h-4 w-4 text-green-500" />}
                {strategy.type === "FALL" && (
                  <TrendingUpIcon
                    className="h-4 w-4 text-red-500"
                    style={{ transform: "rotate(180deg)" }}
                  />
                )}
                {strategy.type === "ADVANCED" && <CpuIcon className="h-4 w-4 text-purple-500" />}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pb-2">
            <div className="flex flex-wrap gap-1">
              <div className="flex items-center bg-blue-500/10 text-blue-500 rounded px-2 py-0.5 text-xs">
                <DatabaseIcon className="mr-1 h-3 w-3" />
                {strategy.config.initialStake} USD
              </div>
              <div className="flex items-center bg-green-500/10 text-green-500 rounded px-2 py-0.5 text-xs">
                <ArrowRightCircleIcon className="mr-1 h-3 w-3" />
                Alvo: {strategy.config.targetProfit} USD
              </div>
              <div className="flex items-center bg-red-500/10 text-red-500 rounded px-2 py-0.5 text-xs">
                <AlertCircleIcon className="mr-1 h-3 w-3" />
                Stop: {strategy.config.stopLoss} USD
              </div>
              {strategy.config.prediction !== undefined && (
                <div className="flex items-center bg-purple-500/10 text-purple-500 rounded px-2 py-0.5 text-xs">
                  <ZapIcon className="mr-1 h-3 w-3" />
                  Digit: {strategy.config.prediction}
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="pt-0">
            <Button
              className="w-full"
              variant={selectedStrategy?.id === strategy.id ? "default" : "outline"}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(strategy);
              }}
            >
              {selectedStrategy?.id === strategy.id ? "Selecionada" : "Selecionar"}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}