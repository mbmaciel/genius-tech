import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Traduções
const resources = {
  'pt-BR': {
    translation: {
      // Geral
      'Selecione um símbolo': 'Selecione um símbolo',
      'Pesquisar símbolo...': 'Pesquisar símbolo...',
      'Nenhum símbolo encontrado': 'Nenhum símbolo encontrado',
      'Selecione uma estratégia': 'Selecione uma estratégia',
      'Pesquisar estratégia...': 'Pesquisar estratégia...',
      'Nenhuma estratégia encontrada': 'Nenhuma estratégia encontrada',
      
      // Categorias de símbolos
      'Índices Sintéticos': 'Índices Sintéticos',
      'Contínuos': 'Contínuos',
      'Crash/Boom': 'Crash/Boom',
      'Mercados Reais': 'Mercados Reais',
      
      // Categorias de estratégias
      'Análise de Dígitos': 'Análise de Dígitos',
      'Tendência': 'Tendência',
      'Alta Precisão': 'Alta Precisão',
      'Volatilidade': 'Volatilidade',
      'Manual': 'Manual',
      'Avançada': 'Avançada',
      
      // Configurações
      'Básico': 'Básico',
      'Avançado': 'Avançado',
      'Valor Inicial ($)': 'Valor Inicial ($)',
      'Fator Martingale': 'Fator Martingale',
      'Perda Máxima ($)': 'Perda Máxima ($)',
      'Lucro Alvo ($)': 'Lucro Alvo ($)',
      'Parar ao Atingir Perda Máxima': 'Parar ao Atingir Perda Máxima',
      'Parar ao Atingir Lucro Alvo': 'Parar ao Atingir Lucro Alvo',
      'Salvar Configurações': 'Salvar Configurações',
      'Limiar de Frequência (%)': 'Limiar de Frequência (%)',
      'Janela de Análise (ticks)': 'Janela de Análise (ticks)',
      'Previsão': 'Previsão',
      'Salvar Configurações Avançadas': 'Salvar Configurações Avançadas',
      
      // Análise de dígitos
      'Estatísticas': 'Estatísticas',
      'Sequência': 'Sequência',
      'Sinais': 'Sinais',
      'Coletando dados de mercado...': 'Coletando dados de mercado...',
      'Erro': 'Erro',
      'Dígitos 0-4': 'Dígitos 0-4',
      'Dígitos 5-9': 'Dígitos 5-9',
      'Frequência 0-1': 'Frequência 0-1',
      'Atual': 'Atual',
      'Limiar': 'Limiar',
      'Status': 'Status',
      'Pronto para entrada!': 'Pronto para entrada!',
      'Aguardando...': 'Aguardando...',
      'Informações do Mercado': 'Informações do Mercado',
      'Símbolo': 'Símbolo',
      'Ticks analisados': 'Ticks analisados',
      'Ativo': 'Ativo',
      'Sim': 'Sim',
      'Não': 'Não',
      'Últimos Dígitos ({count})': 'Últimos Dígitos ({count})',
      'Dígitos Mais Frequentes': 'Dígitos Mais Frequentes',
      'Dígitos Menos Frequentes': 'Dígitos Menos Frequentes',
      'Dígito': 'Dígito',
      'Sinal de Entrada Detectado!': 'Sinal de Entrada Detectado!',
      'A frequência dos dígitos 0 e 1 está abaixo do limiar de 20%. Recomendação para entrada DIGITOVER com previsão 1.': 'A frequência dos dígitos 0 e 1 está abaixo do limiar de 20%. Recomendação para entrada DIGITOVER com previsão 1.',
      'Aguardando Condições de Entrada': 'Aguardando Condições de Entrada',
      'A frequência atual dos dígitos 0 e 1 é {frequency}%. Aguarde até que esteja abaixo de 20%.': 'A frequência atual dos dígitos 0 e 1 é {frequency}%. Aguarde até que esteja abaixo de 20%.',
      'Estratégia Advance': 'Estratégia Advance',
      'Esta estratégia monitora a frequência dos dígitos 0 e 1 nos últimos {count} ticks. Quando a frequência combinada desses dígitos cai abaixo de 20%, há uma maior probabilidade do próximo dígito ser maior que 1.': 'Esta estratégia monitora a frequência dos dígitos 0 e 1 nos últimos {count} ticks. Quando a frequência combinada desses dígitos cai abaixo de 20%, há uma maior probabilidade do próximo dígito ser maior que 1.',
      'Confiança': 'Confiança',
      'Alta': 'Alta',
      'Baixa': 'Baixa',
      
      // História de operações
      'HistOperações': 'Operações',
      'HistEstatísticas': 'Estatísticas',
      'Total': 'Total',
      'Limpar': 'Limpar',
      'Nenhuma operação realizada': 'Nenhuma operação realizada',
      'As operações aparecerão aqui quando forem realizadas': 'As operações aparecerão aqui quando forem realizadas',
      'Sem dados para mostrar': 'Sem dados para mostrar',
      'Complete operações para ver estatísticas': 'Complete operações para ver estatísticas',
      'Resumo Geral': 'Resumo Geral',
      'Lucro Total': 'Lucro Total',
      'Taxa de Acerto': 'Taxa de Acerto',
      'Ganhos': 'Ganhos',
      'Perdas': 'Perdas',
      'Melhor Sequência': 'Melhor Sequência',
      'Pior Sequência': 'Pior Sequência',
      'ganhos': 'ganhos',
      'perdas': 'perdas',
      'Sequência Atual': 'Sequência Atual',
      'Sequência de Ganhos': 'Sequência de Ganhos',
      'Sequência de Perdas': 'Sequência de Perdas',
      'operações': 'operações',
      'Sem sequência atual': 'Sem sequência atual',
      'Aviso': 'Aviso',
      'Estatísticas podem não ser representativas com menos de 10 operações completas.': 'Estatísticas podem não ser representativas com menos de 10 operações completas.',
      'ID': 'ID',
      'Em andamento': 'Em andamento',
      'Estratégia': 'Estratégia',
      'Entrada': 'Entrada',
      'Saída': 'Saída',
      'Resultado': 'Resultado',
      'Ganho': 'Ganho',
      'Empate': 'Empate',
      'Perda': 'Perda',
      
      // Página de teste
      'Teste de Componentes': 'Teste de Componentes',
      'Seletores e Configurações': 'Seletores e Configurações',
      'TesteAnalise': 'Análise de Dígitos',
      'Histórico de Operações': 'Histórico de Operações',
      'Seletores': 'Seletores',
      'Selecione símbolo e estratégia': 'Selecione símbolo e estratégia',
      'SymbolSelector': 'Seletor de Símbolo',
      'StrategySelector': 'Seletor de Estratégia',
      'Iniciar': 'Iniciar',
      'Parar': 'Parar',
      'Adicionar Operação Teste': 'Adicionar Operação Teste',
      'Configurações': 'Configurações',
      'Ajuste parâmetros da estratégia': 'Ajuste parâmetros da estratégia',
      'Estatísticas em tempo real de dígitos do mercado': 'Estatísticas em tempo real de dígitos do mercado',
      'Controles': 'Controles',
      'O componente DigitAnalysis se conecta com a API Deriv e recebe dados em tempo real. Você pode selecionar qualquer símbolo disponível para análise.': 'O componente DigitAnalysis se conecta com a API Deriv e recebe dados em tempo real. Você pode selecionar qualquer símbolo disponível para análise.',
      'Quando a estratégia "Advance" está selecionada, o robot usará as estatísticas dos dígitos 0 e 1 para determinar entradas com base no limiar configurado.': 'Quando a estratégia "Advance" está selecionada, o robot usará as estatísticas dos dígitos 0 e 1 para determinar entradas com base no limiar configurado.',
      'Símbolo Selecionado': 'Símbolo Selecionado',
      'Registro de todas as operações realizadas': 'Registro de todas as operações realizadas',
      'Adicionar Operação Aleatória': 'Adicionar Operação Aleatória',
      'O componente OperationHistoryCard mostra detalhes de cada operação e calcula estatísticas importantes como taxa de acerto, lucro total, etc.': 'O componente OperationHistoryCard mostra detalhes de cada operação e calcula estatísticas importantes como taxa de acerto, lucro total, etc.',
      
      // Descrições da estratégia Advance
      'A estratégia Advance monitora a frequência dos dígitos 0 e 1. Quando esta frequência estiver abaixo do Limiar de Frequência configurado, o robô fará uma operação DIGITOVER com a Previsão definida.': 'A estratégia Advance monitora a frequência dos dígitos 0 e 1. Quando esta frequência estiver abaixo do Limiar de Frequência configurado, o robô fará uma operação DIGITOVER com a Previsão definida.'
    }
  },
  'en': {
    translation: {
      // General
      'Selecione um símbolo': 'Select a symbol',
      'Pesquisar símbolo...': 'Search symbol...',
      'Nenhum símbolo encontrado': 'No symbol found',
      'Selecione uma estratégia': 'Select a strategy',
      'Pesquisar estratégia...': 'Search strategy...',
      'Nenhuma estratégia encontrada': 'No strategy found',
      
      // Symbol categories
      'Índices Sintéticos': 'Synthetic Indices',
      'Contínuos': 'Continuous',
      'Crash/Boom': 'Crash/Boom',
      'Mercados Reais': 'Real Markets',
      
      // Strategy categories
      'Análise de Dígitos': 'Digit Analysis',
      'Tendência': 'Trend',
      'Alta Precisão': 'High Precision',
      'Volatilidade': 'Volatility',
      'Manual': 'Manual',
      'Avançada': 'Advanced',
      
      // Settings
      'Básico': 'Basic',
      'Avançado': 'Advanced',
      'Valor Inicial ($)': 'Initial Value ($)',
      'Fator Martingale': 'Martingale Factor',
      'Perda Máxima ($)': 'Maximum Loss ($)',
      'Lucro Alvo ($)': 'Target Profit ($)',
      'Parar ao Atingir Perda Máxima': 'Stop at Maximum Loss',
      'Parar ao Atingir Lucro Alvo': 'Stop at Target Profit',
      'Salvar Configurações': 'Save Settings',
      'Limiar de Frequência (%)': 'Frequency Threshold (%)',
      'Janela de Análise (ticks)': 'Analysis Window (ticks)',
      'Previsão': 'Prediction',
      'Salvar Configurações Avançadas': 'Save Advanced Settings',
      
      // Digit analysis
      'Análise': 'Analysis',
      'Sequência': 'Sequence',
      'Sinais': 'Signals',
      'Coletando dados de mercado...': 'Collecting market data...',
      'Erro': 'Error',
      'Dígitos 0-4': 'Digits 0-4',
      'Dígitos 5-9': 'Digits 5-9',
      'Frequência 0-1': 'Frequency 0-1',
      'Atual': 'Current',
      'Limiar': 'Threshold',
      'Status': 'Status',
      'Pronto para entrada!': 'Ready for entry!',
      'Aguardando...': 'Waiting...',
      'Informações do Mercado': 'Market Information',
      'Símbolo': 'Symbol',
      'Ticks analisados': 'Analyzed ticks',
      'Ativo': 'Active',
      'Sim': 'Yes',
      'Não': 'No',
      'Últimos Dígitos ({count})': 'Last Digits ({count})',
      'Dígitos Mais Frequentes': 'Most Frequent Digits',
      'Dígitos Menos Frequentes': 'Least Frequent Digits',
      'Dígito': 'Digit',
      'Sinal de Entrada Detectado!': 'Entry Signal Detected!',
      'A frequência dos dígitos 0 e 1 está abaixo do limiar de 20%. Recomendação para entrada DIGITOVER com previsão 1.': 'The frequency of digits 0 and 1 is below the 20% threshold. Recommendation for DIGITOVER entry with prediction 1.',
      'Aguardando Condições de Entrada': 'Waiting for Entry Conditions',
      'A frequência atual dos dígitos 0 e 1 é {frequency}%. Aguarde até que esteja abaixo de 20%.': 'The current frequency of digits 0 and 1 is {frequency}%. Wait until it goes below 20%.',
      'Estratégia Advance': 'Advance Strategy',
      'Esta estratégia monitora a frequência dos dígitos 0 e 1 nos últimos {count} ticks. Quando a frequência combinada desses dígitos cai abaixo de 20%, há uma maior probabilidade do próximo dígito ser maior que 1.': 'This strategy monitors the frequency of digits 0 and 1 in the last {count} ticks. When the combined frequency of these digits falls below 20%, there is a higher probability that the next digit will be greater than 1.',
      'Confiança': 'Confidence',
      'Alta': 'High',
      'Baixa': 'Low',
      
      // Operation history
      'Operações': 'Operations',
      'Estatísticas': 'Statistics',
      'Total': 'Total',
      'Limpar': 'Clear',
      'Nenhuma operação realizada': 'No operations performed',
      'As operações aparecerão aqui quando forem realizadas': 'Operations will appear here when they are performed',
      'Sem dados para mostrar': 'No data to show',
      'Complete operações para ver estatísticas': 'Complete operations to see statistics',
      'Resumo Geral': 'General Summary',
      'Lucro Total': 'Total Profit',
      'Taxa de Acerto': 'Win Rate',
      'Ganhos': 'Wins',
      'Perdas': 'Losses',
      'Melhor Sequência': 'Best Streak',
      'Pior Sequência': 'Worst Streak',
      'ganhos': 'wins',
      'perdas': 'losses',
      'Sequência Atual': 'Current Streak',
      'Sequência de Ganhos': 'Win Streak',
      'Sequência de Perdas': 'Loss Streak',
      'operações': 'operations',
      'Sem sequência atual': 'No current streak',
      'Aviso': 'Warning',
      'Estatísticas podem não ser representativas com menos de 10 operações completas.': 'Statistics may not be representative with less than 10 completed operations.',
      'ID': 'ID',
      'Em andamento': 'In progress',
      'Estratégia': 'Strategy',
      'Entrada': 'Entry',
      'Saída': 'Exit',
      'Resultado': 'Result',
      'Ganho': 'Win',
      'Empate': 'Draw',
      'Perda': 'Loss',
      
      // Test page
      'Teste de Componentes': 'Component Test',
      'Seletores e Configurações': 'Selectors and Settings',
      'TesteAnalise': 'Digit Analysis',
      'Histórico de Operações': 'Operation History',
      'Seletores': 'Selectors',
      'Selecione símbolo e estratégia': 'Select symbol and strategy',
      'SymbolSelector': 'Symbol Selector',
      'StrategySelector': 'Strategy Selector',
      'Iniciar': 'Start',
      'Parar': 'Stop',
      'Adicionar Operação Teste': 'Add Test Operation',
      'Configurações': 'Settings',
      'Ajuste parâmetros da estratégia': 'Adjust strategy parameters',
      'Estatísticas em tempo real de dígitos do mercado': 'Real-time statistics of market digits',
      'Controles': 'Controls',
      'O componente DigitAnalysis se conecta com a API Deriv e recebe dados em tempo real. Você pode selecionar qualquer símbolo disponível para análise.': 'The DigitAnalysis component connects to the Deriv API and receives real-time data. You can select any available symbol for analysis.',
      'Quando a estratégia "Advance" está selecionada, o robot usará as estatísticas dos dígitos 0 e 1 para determinar entradas com base no limiar configurado.': 'When the "Advance" strategy is selected, the robot will use the statistics of digits 0 and 1 to determine entries based on the configured threshold.',
      'Símbolo Selecionado': 'Selected Symbol',
      'Registro de todas as operações realizadas': 'Record of all operations performed',
      'Adicionar Operação Aleatória': 'Add Random Operation',
      'O componente OperationHistoryCard mostra detalhes de cada operação e calcula estatísticas importantes como taxa de acerto, lucro total, etc.': 'The OperationHistoryCard component shows details for each operation and calculates important statistics such as hit rate, total profit, etc.',
      
      // Advance strategy descriptions
      'A estratégia Advance monitora a frequência dos dígitos 0 e 1. Quando esta frequência estiver abaixo do Limiar de Frequência configurado, o robô fará uma operação DIGITOVER com a Previsão definida.': 'The Advance strategy monitors the frequency of digits 0 and 1. When this frequency is below the configured Frequency Threshold, the robot will make a DIGITOVER operation with the defined Prediction.'
    }
  }
};

// Configuração do i18n
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'pt-BR',
    interpolation: {
      escapeValue: false // React já faz o escape
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    }
  });

export default i18n;