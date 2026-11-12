const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const {
  CONSUMER_KEY,
  CONSUMER_SECRET,
  SHORTCODE = '174379',
  PASSKEY,
  CALLBACK_URL
} = process.env;

function nairobiTimestamp() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date());
  const v = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${v.year}${v.month}${v.day}${v.hour}${v.minute}${v.second}`;
}

function normalizePhone(input) {
  let phone = String(input || '').replace(/\D/g, '');
  if (phone.startsWith('0')) phone = '254' + phone.slice(1);
  if (phone.startsWith('7') || phone.startsWith('1')) phone = '254' + phone;
  if (!/^254[17]\d{8}$/.test(phone)) {
    throw new Error('Enter a valid Kenyan mobile number, e.g. 0712345678 or 254712345678.');
  }
  return phone;
}

async function getAccessToken() {
  if (!CONSUMER_KEY || !CONSUMER_SECRET) {
    throw new Error('Missing CONSUMER_KEY or CONSUMER_SECRET environment variable.');
  }
  const credentials = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
  const response = await axios.get(
    'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    { headers: { Authorization: `Basic ${credentials}` }, timeout: 20000 }
  );
  return response.data.access_token;
}

app.get('/health', (_req, res) => res.json({ ok: true, service: 'M-Pesa STK testing site' }));

app.post('/api/stkpush', async (req, res) => {
  try {
    if (!PASSKEY) return res.status(500).json({ error: 'Missing PASSKEY environment variable.' });
    if (!CALLBACK_URL || !CALLBACK_URL.startsWith('https://')) {
      return res.status(500).json({ error: 'Set CALLBACK_URL to your public HTTPS callback URL, ending in /mpesa/callback.' });
    }

    const phone = normalizePhone(req.body.phone);
    const amount = Number(req.body.amount);
    if (!Number.isInteger(amount) || amount < 1 || amount > 150000) {
      return res.status(400).json({ error: 'Amount must be a whole number between KSh 1 and KSh 150,000.' });
    }

    const token = await getAccessToken();
    const timestamp = nairobiTimestamp();
    const password = Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString('base64');

    const payload = {
      BusinessShortCode: SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phone,
      PartyB: SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: CALLBACK_URL,
      AccountReference: 'TEST-PAYMENT',
      TransactionDesc: 'M-Pesa STK sandbox test'
    };

    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      payload,
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 30000 }
    );

    res.json({
      message: 'STK Push request submitted. Check the phone and enter your M-Pesa PIN if prompted.',
      checkoutRequestID: response.data.CheckoutRequestID,
      merchantRequestID: response.data.MerchantRequestID,
      responseDescription: response.data.ResponseDescription
    });
  } catch (error) {
    const detail = error.response?.data || error.message || 'Unknown error';
    console.error('STK Push error:', detail);
    res.status(400).json({ error: typeof detail === 'string' ? detail : (detail.errorMessage || detail.ResponseDescription || JSON.stringify(detail)) });
  }
});

app.post('/mpesa/callback', (req, res) => {
  const callback = req.body?.Body?.stkCallback;
  if (!callback) {
    console.log('Received callback with unexpected format:', JSON.stringify(req.body));
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }

  if (Number(callback.ResultCode) === 0) {
    const items = callback.CallbackMetadata?.Item || [];
    const details = Object.fromEntries(items.map(item => [item.Name, item.Value]));
    console.log('PAYMENT SUCCESS', {
      amount: details.Amount,
      receipt: details.MpesaReceiptNumber,
      phone: details.PhoneNumber,
      transactionDate: details.TransactionDate,
      checkoutRequestID: callback.CheckoutRequestID
    });
  } else {
    console.log('PAYMENT NOT COMPLETED', {
      resultCode: callback.ResultCode,
      resultDescription: callback.ResultDesc,
      checkoutRequestID: callback.CheckoutRequestID
    });
  }
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`M-Pesa testing site listening on port ${PORT}`);
});
