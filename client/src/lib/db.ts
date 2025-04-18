// Método para chamadas à API do servidor para acessar o banco de dados
// Esta é a conexão para o cliente, que fará requisições para a API do servidor

export async function fetchFromDb<T>(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', data?: any): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const options: RequestInit = {
    method,
    headers,
    credentials: 'include',
  };

  if (data && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(`/api/db/${endpoint}`, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro na requisição ao banco de dados: ${errorText}`);
  }

  return response.json();
}

// Proxy para as operações do banco de dados que faz chamadas à API
export const db = {
  // Operações para stats de dígitos
  digitStats: {
    async getAll(symbol: string) {
      return fetchFromDb(`digit-stats?symbol=${symbol}`);
    },
    async update(symbol: string, stats: any) {
      return fetchFromDb(`digit-stats/${symbol}`, 'PUT', stats);
    },
  },
  // Operações para histórico de dígitos
  digitHistory: {
    async get(symbol: string) {
      return fetchFromDb(`digit-history?symbol=${symbol}`);
    },
    async update(symbol: string, history: any) {
      return fetchFromDb(`digit-history/${symbol}`, 'PUT', history);
    },
  },
  // Operações por período
  digitStatsByPeriod: {
    async get(symbol: string, period: string) {
      return fetchFromDb(`digit-stats-period?symbol=${symbol}&period=${period}`);
    },
  },
};