import React from 'react';

export function DirectHTMLSwitcher() {
  return (
    <div className="bg-[#162746] border border-[#1c3654] rounded-lg p-2">
      <div className="flex flex-col">
        <div className="p-2 text-center text-white text-sm">
          <a href="https://deriv.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[#00e5b3] hover:text-[#00c99f] transition-colors"
          >
            Genius Technology Trading
          </a>
          <div className="text-xs text-gray-400 mt-1">
            Powered by Deriv API
          </div>
        </div>
      </div>
    </div>
  );
}