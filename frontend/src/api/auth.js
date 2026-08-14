import client from './client';

export const registerStudent = async (data) => {
  const response = await client.post('/auth/register/student', data);
  return response.data;
};

export const registerTeacher = async (data) => {
  const response = await client.post('/auth/register/teacher', data);
  return response.data;
};

export const registerParent = async (data) => {
  const response = await client.post('/auth/register/parent', data);
  return response.data;
};

export const registerAdmin = async (data) => {
  const response = await client.post('/auth/register/admin', data);
  return response.data;
};

export const verifyEmail = async (email, code) => {
  const response = await client.post('/auth/verify-email', { email, code });
  return response.data;
};

export const login = async (data) => {
  const response = await client.post('/auth/login', data);
  return response.data;
};

/** Codes are emailed — SMS was dropped, so the identity here is the email address. */
export const requestOtp = async (email, purpose) => {
  const response = await client.post('/auth/otp/request', { email, purpose });
  return response.data;
};

export const loginWithOtp = async (email, code) => {
  const response = await client.post('/auth/otp/login', { email, code });
  return response.data;
};

export const resetPassword = async (email, code, newPassword) => {
  const response = await client.post('/auth/password/reset', { email, code, newPassword });
  return response.data;
};

export const refresh = async (data) => {
  const response = await client.post('/auth/refresh', data);
  return response.data;
};

export const getMe = async () => {
  const response = await client.get('/me');
  return response.data;
};

export const updateMe = async (data) => {
  const response = await client.put('/me', data);
  return response.data;
};

/** Anonymizes and disables the account — see backend ProfileServiceImpl.deleteAccount
 *  for exactly what is kept (order/wallet history, anonymized) vs. removed. This is also
 *  the app-store-required web-accessible deletion path, reachable without installing the
 *  mobile app. */
export const deleteMe = async () => {
  await client.delete('/me');
};

// ── Firebase (phone OTP / email), additive alongside the endpoints above ──

/** Signs in with a Firebase ID token. Rejects with response.data.code ===
 *  'FIREBASE_USER_NOT_REGISTERED' if this identity has no linked account yet — the caller
 *  should route to one of the register calls below with the same idToken. */
export const firebaseExchange = async (idToken) => {
  const response = await client.post('/auth/firebase/exchange', { idToken });
  return response.data;
};

export const firebaseRegisterStudent = async (data) => {
  const response = await client.post('/auth/firebase/register/student', data);
  return response.data;
};

export const firebaseRegisterTeacher = async (data) => {
  const response = await client.post('/auth/firebase/register/teacher', data);
  return response.data;
};

export const firebaseRegisterParent = async (data) => {
  const response = await client.post('/auth/firebase/register/parent', data);
  return response.data;
};
