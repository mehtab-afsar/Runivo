import { test } from '@playwright/test';

test('debug-jwt', async ({ page }) => {
  page.on('console', msg => {
    if (['log','error'].includes(msg.type())) console.log('PAGE:', msg.type(), msg.text().substring(0, 200));
  });
  
  await page.addInitScript(() => {
    const now = Math.floor(Date.now() / 1000);
    
    function b64url(obj: unknown): string {
      return btoa(JSON.stringify(obj)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
    }
    
    const jwt = [
      b64url({ alg: 'HS256', typ: 'JWT' }),
      b64url({ sub: 'user-1', email: 'test@test.com', role: 'authenticated', aud: 'authenticated', exp: now + 7200, iat: now }),
      'fakesig'
    ].join('.');
    
    const session = { access_token: jwt, refresh_token: 'r', expires_in: 7200, expires_at: now + 7200, token_type: 'bearer', user: { id: 'user-1', email: 'test@test.com', role: 'authenticated', aud: 'authenticated' } };
    
    localStorage.setItem('runivo-onboarding-complete', 'true');
    localStorage.setItem('sb-127-auth-token', JSON.stringify(session));
    console.log('SET JWT session, exp in', 7200, 'secs');
  });
  
  await page.goto('/subscription');
  await page.waitForTimeout(4000);
  
  const text = await page.locator('body').innerText();
  console.log('BODY:', JSON.stringify(text.substring(0, 300)));
});
