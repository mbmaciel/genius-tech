import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface Trade {
  id: number;
  time: string;
  symbol: string;
  type: "buy" | "sell";
  result: string;
  profit: number;
}

export function RecentTrades() {
  const [trades, setTrades] = useState<Trade[]>([
    { id: 1, time: "10:45", symbol: "EUR/USD", type: "buy", result: "Win", profit: 18.5 },
    { id: 2, time: "10:30", symbol: "BTC/USD", type: "sell", result: "Win", profit: 32.4 },
    { id: 3, time: "10:15", symbol: "GBP/JPY", type: "buy", result: "Loss", profit: -12.75 },
    { id: 4, time: "10:00", symbol: "EUR/USD", type: "sell", result: "Win", profit: 9.2 },
    { id: 5, time: "09:45", symbol: "ETH/USD", type: "buy", result: "Win", profit: 27.1 },
    { id: 6, time: "09:30", symbol: "BTC/USD", type: "sell", result: "Loss", profit: -15.3 },
  ]);

  return (
    <Card className="grid-card">
      <CardHeader className="p-4 border-b border-gray-800 flex flex-row justify-between items-center space-y-0">
        <CardTitle className="text-lg font-medium font-poppins">Recent Trades</CardTitle>
        <Button variant="ghost" className="text-[#8492b4] hover:text-white transition-colors duration-200">
          <Menu className="w-5 h-5" />
        </Button>
      </CardHeader>
      
      <CardContent className="p-2">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="text-left text-xs text-[#8492b4]">
                <th className="p-2">Time</th>
                <th className="p-2">Symbol</th>
                <th className="p-2">Type</th>
                <th className="p-2">Result</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {trades.map((trade) => (
                <tr key={trade.id} className="border-b border-gray-800">
                  <td className="p-2">{trade.time}</td>
                  <td className="p-2">{trade.symbol}</td>
                  <td className="p-2">
                    <span className={`indicator ${trade.type === "buy" ? "up" : "down"}`}>
                      {trade.type === "buy" ? "Buy" : "Sell"}
                    </span>
                  </td>
                  <td className={`p-2 ${trade.profit > 0 ? "text-[#00e5b3]" : "text-[#ff5252]"}`}>
                    {trade.profit > 0 ? `+$${trade.profit.toFixed(2)}` : `-$${Math.abs(trade.profit).toFixed(2)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
