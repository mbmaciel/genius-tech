import React from 'react';
import './DigitSequence.css';

interface DigitSequenceProps {
  digits: number[];
}

const DigitSequence: React.FC<DigitSequenceProps> = ({ digits }) => {
  // Garantir que sempre temos uma array de dígitos válida
  const validDigits = Array.isArray(digits) ? digits : [];
  
  // Função para determinar a cor do dígito (par ou ímpar)
  const getDigitClass = (digit: number): string => {
    return digit % 2 === 0 ? 'digit-even' : 'digit-odd';
  };

  return (
    <div className="digit-sequence">
      {validDigits.map((digit, index) => (
        <div 
          key={`digit-${index}`} 
          className={`digit-item ${getDigitClass(digit)}`}
        >
          {digit}
        </div>
      ))}
    </div>
  );
};

export default DigitSequence;