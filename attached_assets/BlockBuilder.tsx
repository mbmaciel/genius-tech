import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Blocks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { BlocklyEditor } from "../blocks/BlocklyEditor";

export function BlockBuilder() {
  const [showEditor, setShowEditor] = useState(false);
  
  return (
    <Card className="grid-card">
      <CardHeader className="p-4 border-b border-gray-800">
        <CardTitle className="text-lg font-medium font-poppins">Visual Block Builder</CardTitle>
      </CardHeader>
      
      <CardContent className="p-4">
        <p className="text-[#8492b4] text-sm mb-4">
          Configure your trading bot with block-based programming. Drag and drop blocks to create your strategy.
        </p>
        
        {!showEditor ? (
          <div className="bg-[#0e1a33] border border-gray-800 rounded p-3 h-40 flex items-center justify-center">
            <div className="text-center">
              <Blocks className="w-10 h-10 mx-auto text-[#8492b4] mb-2" />
              <Button 
                onClick={() => setShowEditor(true)}
                className="bg-[#3a7bd5] hover:bg-opacity-80 text-white text-sm"
              >
                Open Block Editor
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-[#0e1a33] border border-gray-800 rounded p-3 h-[400px] mb-3">
              <BlocklyEditor />
            </div>
            <div className="flex justify-end">
              <Button 
                onClick={() => setShowEditor(false)}
                variant="outline" 
                className="text-sm mr-2"
              >
                Close Editor
              </Button>
              <Button 
                className="bg-[#00e5b3] hover:bg-opacity-80 text-white text-sm"
              >
                Save Strategy
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
