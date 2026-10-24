/** An unsigned JWT for user `u1` that auth-js decodes but never verifies. Expires in an hour. */
export function fakeAccessToken(): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const payload = {sub: 'u1', exp, role: 'authenticated'};
  return `${encode({alg: 'HS256', typ: 'JWT'})}.${encode(payload)}.sig`;
}
