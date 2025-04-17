/**
 * Factory de erros personalizados - Facilita a criação de classes de erro
 * para diferentes categorias de erro no sistema
 */

// eslint-disable-next-line max-classes-per-file
export function errorFactory(type: string) {
    return class GenericError extends Error {
        type: string;
        
        constructor(message: string) {
            super();
            this.type = type;
            this.message = message;
        }

        toString() {
            return `${this.type}: ${this.message}`;
        }
    };
}

// Erros de API (comunicação com Deriv)
export class APIError extends errorFactory('APIError') {}

// Erros de construção (problemas ao construir/inicializar componentes)
export class ConstructionError extends errorFactory('ConstructionError') {}

// Erros de autenticação (problemas de token, autorização, etc)
export class AuthError extends errorFactory('AuthError') {}

// Erros de validação (dados inválidos, formato incorreto, etc)
export class ValidationError extends errorFactory('ValidationError') {}

// Erros de conexão (problemas de WebSocket, rede, etc)
export class ConnectionError extends errorFactory('ConnectionError') {}