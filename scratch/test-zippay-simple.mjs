
import 'dotenv/config';
import fetch from 'node-fetch';

async function testZippay() {
  const token = process.env.ZIPPAY_TOKEN;
  const baseUrl = 'https://api.kelura.xyz/xxapi/buyitoken/waitpayerpaymentslip';
  
  console.log(`Testing Zippay...`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Token: ${token ? 'PRESENT' : 'MISSING'}`);

  if (!token) return;

  const params = new URLSearchParams({
    page: '1',
    limit: '50',
    if_asc: 'false',
    min_amount: '9000',
    max_amount: '100000000',
    method: '1',
    date_asc: '0',
  });

  const url = `${baseUrl}?${params.toString()}`;
  console.log(`URL: ${url}`);

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'indiatoken': token,
    'origin': 'https://web.zippay.wiki',
    'referer': 'https://web.zippay.wiki/',
  };

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers,
    });

    console.log(`Status: ${res.status} ${res.statusText}`);
    const text = await res.text();
    console.log('Response:');
    console.log(text);
  } catch (err) {
    console.error('Error:', err);
  }
}

testZippay();
