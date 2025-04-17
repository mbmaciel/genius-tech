import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

interface LogEntry {
  id: number;
  timestamp: string;
  message: string;
  type: "info" | "success" | "error" | "warning";
}

export function SystemLog() {
  const [logFilter, setLogFilter] = useState("all");
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: 1, timestamp: "10:45:12", message: "Trade executed: EUR/USD Buy @ 1.0826", type: "success" },
    { id: 2, timestamp: "10:44:58", message: "RSI indicator triggered buy signal (RSI: 28.5)", type: "info" },
    { id: 3, timestamp: "10:35:20", message: "API rate limit warning: 80% of limit used", type: "error" },
    { id: 4, timestamp: "10:30:45", message: "Trade executed: BTC/USD Sell @ 36,245.50", type: "info" },
    { id: 5, timestamp: "10:30:30", message: "MACD crossed below signal line (-0.002)", type: "info" },
    { id: 6, timestamp: "10:25:18", message: "Position closed: GBP/JPY with profit +$32.40", type: "success" },
    { id: 7, timestamp: "10:20:05", message: "Bollinger Bands contracting (width: 0.15)", type: "info" },
    { id: 8, timestamp: "10:15:42", message: "Trade executed: GBP/JPY Buy @ 156.723", type: "info" },
    { id: 9, timestamp: "10:05:33", message: "Error: Failed to fetch market data. Retrying...", type: "error" },
    { id: 10, timestamp: "10:00:15", message: "Bot started successfully. Strategy: RSI+MACD", type: "success" },
  ]);

  const filteredLogs = logs.filter(log => {
    if (logFilter === "all") return true;
    return log.type === logFilter;
  });

  const getLogColor = (type: string) => {
    switch (type) {
      case "success":
        return "text-[#00e5b3]";
      case "error":
        return "text-[#ff5252]";
      case "warning":
        return "text-[#ffd166]";
      default:
        return "text-[#8492b4]";
    }
  };

  return (
    <Card className="grid-card">
      <CardHeader className="p-4 border-b border-gray-800 flex flex-row justify-between items-center space-y-0">
        <CardTitle className="text-lg font-medium font-poppins">System Log</CardTitle>
        <div className="flex space-x-2">
          <Select 
            value={logFilter}
            onValueChange={setLogFilter}
          >
            <SelectTrigger className="bg-[#1f3158] border border-gray-700 rounded text-xs px-2 py-1 h-auto w-[100px]">
              <SelectValue placeholder="All Logs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Logs</SelectItem>
              <SelectItem value="error">Errors</SelectItem>
              <SelectItem value="warning">Warnings</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="success">Success</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" className="text-[#8492b4] hover:text-white transition-colors duration-200 h-7 w-7 p-0">
            <ChevronDown className="w-5 h-5" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 h-[360px] overflow-y-auto text-sm font-mono">
        {filteredLogs.map((log) => (
          <div key={log.id} className={`mb-2 ${getLogColor(log.type)}`}>
            <span className="text-[#8492b4]">[{log.timestamp}]</span> {log.message}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
