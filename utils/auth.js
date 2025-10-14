/**
 * Authentication Utilities
 * JWT secret ve auth helper fonksiyonları
 */

import jwt from 'jsonwebtoken';

/**
 * JWT Secret'ı güvenli şekilde alır
 * @returns {string} JWT Secret
 * @throws {Error} Secret bulunamazsa hata fırlatır
 */
export function getJWTSecret() {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required but not set');
  }
  
  // Minimum 16 karakter kontrolü (daha esnek)
  if (secret.length < 16) {
    throw new Error('JWT_SECRET must be at least 16 characters long');
  }
  
  return secret;
}

/**
 * JWT token'ı verify eder
 * @param {string} token - JWT token
 * @returns {Object} Decoded token payload
 * @throws {Error} Token geçersizse hata fırlatır
 */
export function verifyJWTToken(token) {
  try {
    const secret = getJWTSecret();
    return jwt.verify(token, secret);
  } catch (error) {
    // Daha detaylı hata mesajı
    console.error('JWT verification error:', error.message);
    throw new Error(`Invalid token: ${error.message}`);
  }
}

/**
 * JWT token oluşturur
 * @param {Object} payload - Token payload
 * @param {string} expiresIn - Token süresi (örn: "24h")
 * @returns {string} JWT token
 */
export function createJWTToken(payload, expiresIn = "24h") {
  const secret = getJWTSecret();
  return jwt.sign(payload, secret, { expiresIn });
}
