
import 'dotenv/config';
import { platforms } from '../src/config/platforms.js';
import { logger } from '../src/utils/logger.js';
import fetch from 'node-fetch';

async function testPlatform(platformId: string) {
  const platform = platforms.find(p => p.id === platformId);
  if (!platform) {
    console.error(`Platform ${platformId} not found in config`);
    return;
  }

  console.log(`Testing platform: ${platform.id}`);
  console.log(`Base URL: ${platform.baseUrl}`);
  console.log(`Token: ${platform.token ? 'PRESENT (starts with ' + platform.token.substring(0, 4) + '...)' : 'MISSING'}`);

  const page = 1;
  const isModern = (platform as any).apiStyle === 'modern';
  const params: Record<string, string> = {
    [isModern ? 'page_num' : 'page']: String(page),
    [isModern ? 'page_size' : 'limit']: String(platform.pageSize),
    if_asc: 'false',
    min_amount: String(Number(process.env.FETCH_MIN_AMOUNT ?? process.env.MIN_AMOUNT ?? 9000)),
    max_amount: '100000000',
    method: '1',
    date_asc: '1',
  };

  if (isModern) {
    params.type = 'max';
    params.sort_by = 'desc';
  }

  if (platform.customParams) {
    Object.assign(params, platform.customParams);
  }

  const searchParams = new URLSearchParams(params);
  const url = `${platform.baseUrl}?${searchParams.toString()}`;

  console.log(`Full URL: ${url}`);

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...platform.headers,
      ...(platform as any).customHeaders,
    };

    if ((platform as any).useBearerAuth) {
      headers.Authorization = `Bearer ${platform.token}`;
    } else {
      (headers as any).indiatoken = platform.token;
    }

    console.log('Headers:', JSON.stringify(headers, null, 2));

    const res = await fetch(url, {
      method: 'GET',
      headers,
    });

    console.log(`Response Status: ${res.status} ${res.statusText}`);
    
    const text = await res.text();
    console.log('Raw Response Body:');
    console.log(text);

    try {
      const body = JSON.parse(text);
      console.log('Parsed JSON:', JSON.stringify(body, null, 2));
    } catch (e) {
      console.log('Failed to parse JSON response');
    }

  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testPlatform('zippay').catch(console.error);
