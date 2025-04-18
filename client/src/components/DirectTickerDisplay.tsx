/**
 * Componente que usa JavaScript nativo para exibir ticks em tempo real
 * Contornando problemas de framework React/Vite
 */

export function DirectTickerDisplay() {
  // Carrega o script quando o componente é montado
  const initTickerDisplay = () => {
    // Verificar se o elemento já existe para evitar duplicação
    if (document.getElementById('direct-ticker-display')) {
      return;
    }

    console.log('[DIRECT_TICKER] Iniciando ticker display nativo');
    
    // Criar elemento container principal 
    const container = document.createElement('div');
    container.id = 'direct-ticker-display';
    container.className = 'bg-slate-900 p-4 rounded-lg border border-slate-700 shadow-lg';
    
    // Adicionar título
    const title = document.createElement('h3');
    title.textContent = 'Ticks em Tempo Real (JavaScript Nativo)';
    title.className = 'text-slate-300 text-sm font-medium mb-3';
    container.appendChild(title);
    
    // Criar uma linha de status
    const statusLine = document.createElement('div');
    statusLine.className = 'flex items-center gap-2 mb-3';
    
    const statusDot = document.createElement('div');
    statusDot.className = 'w-2 h-2 bg-yellow-500 rounded-full';
    statusLine.appendChild(statusDot);
    
    const statusText = document.createElement('span');
    statusText.textContent = 'Conectando...';
    statusText.className = 'text-xs text-slate-400';
    statusLine.appendChild(statusText);
    
    container.appendChild(statusLine);
    
    // Criar container para dígitos
    const digitsContainer = document.createElement('div');
    digitsContainer.className = 'flex flex-wrap justify-center gap-2 mb-3';
    digitsContainer.id = 'digits-container';
    container.appendChild(digitsContainer);
    
    // Adicionar texto informativo
    const info = document.createElement('div');
    info.className = 'text-xs text-slate-500 text-center';
    info.textContent = 'Última atualização: --:--:--';
    info.id = 'ticker-info';
    container.appendChild(info);
    
    // Função para adicionar dígito
    const addDigit = (digit: number) => {
      // Criar elemento para o dígito
      const digitEl = document.createElement('div');
      digitEl.className = `w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-md text-white ${getDigitColor(digit)}`;
      digitEl.textContent = digit.toString();
      
      // Adicionar no início do container
      if (digitsContainer.firstChild) {
        digitsContainer.insertBefore(digitEl, digitsContainer.firstChild);
      } else {
        digitsContainer.appendChild(digitEl);
      }
      
      // Limitar a 20 dígitos
      while (digitsContainer.children.length > 20) {
        digitsContainer.removeChild(digitsContainer.lastChild as Node);
      }
      
      // Atualizar timestamp
      const now = new Date();
      (document.getElementById('ticker-info') as HTMLElement).textContent = 
        `Última atualização: ${now.toLocaleTimeString()}`;
    };
    
    // Função para determinar a cor do dígito
    const getDigitColor = (digit: number): string => {
      if (digit === 0 || digit === 5) {
        return "bg-blue-500"; // Azul para 0 e 5
      } else if (digit % 2 === 0) {
        return "bg-red-500";  // Vermelho para pares
      } else {
        return "bg-green-500"; // Verde para ímpares
      }
    };
    
    // Iniciar conexão WebSocket
    const startWebSocket = () => {
      try {
        const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
        
        ws.onopen = () => {
          console.log('[DIRECT_TICKER] WebSocket conectado');
          statusDot.className = 'w-2 h-2 bg-green-500 rounded-full';
          statusText.textContent = 'Conectado';
          
          // Solicitar ticks do R_100
          ws.send(JSON.stringify({ ticks: 'R_100', subscribe: 1 }));
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.msg_type === 'tick') {
              const price = parseFloat(data.tick.quote);
              const lastDigit = parseInt(price.toString().slice(-1));
              
              // Adicionar ao display
              if (!isNaN(lastDigit)) {
                addDigit(lastDigit);
              }
            }
          } catch (err) {
            console.error('[DIRECT_TICKER] Erro ao processar mensagem:', err);
          }
        };
        
        ws.onerror = (error) => {
          console.error('[DIRECT_TICKER] Erro WebSocket:', error);
          statusDot.className = 'w-2 h-2 bg-red-500 rounded-full';
          statusText.textContent = 'Erro de conexão';
        };
        
        ws.onclose = () => {
          console.log('[DIRECT_TICKER] WebSocket fechado');
          statusDot.className = 'w-2 h-2 bg-red-500 rounded-full';
          statusText.textContent = 'Desconectado';
          
          // Tentar reconectar após 3 segundos
          setTimeout(startWebSocket, 3000);
        };
        
        // Configurar ping periódico
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ ping: 1 }));
          } else if (ws.readyState === WebSocket.CLOSED) {
            clearInterval(pingInterval);
          }
        }, 30000);
        
        // Adicionar mensagem inicial
        const placeholderText = document.createElement('div');
        placeholderText.textContent = 'Aguardando ticks...';
        placeholderText.className = 'text-slate-500';
        placeholderText.id = 'placeholder-text';
        digitsContainer.appendChild(placeholderText);
        
      } catch (error) {
        console.error('[DIRECT_TICKER] Erro ao iniciar WebSocket:', error);
        statusDot.className = 'w-2 h-2 bg-red-500 rounded-full';
        statusText.textContent = 'Falha na conexão';
      }
    };
    
    // Iniciar WebSocket
    startWebSocket();
    
    // Adicionar o container ao DOM
    const targetElement = document.getElementById('ticker-display-mount-point');
    if (targetElement) {
      targetElement.appendChild(container);
    } else {
      console.error('[DIRECT_TICKER] Ponto de montagem não encontrado');
    }
  };
  
  // Limpar quando o componente for desmontado
  const cleanupTickerDisplay = () => {
    const container = document.getElementById('direct-ticker-display');
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  };
  
  return (
    <div className="mt-4">
      <div id="ticker-display-mount-point"></div>
      <button 
        className="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm" 
        onClick={initTickerDisplay}
      >
        Iniciar Ticker Nativo
      </button>
      <button 
        className="mt-2 ml-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm" 
        onClick={cleanupTickerDisplay}
      >
        Remover Ticker
      </button>
    </div>
  );
}