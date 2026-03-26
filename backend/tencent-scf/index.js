'use strict';

const COS = require('cos-nodejs-sdk-v5');

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOW_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8'
};

const cos = new COS({
  SecretId: process.env.TENCENT_SECRET_ID,
  SecretKey: process.env.TENCENT_SECRET_KEY
});

function response(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body)
  };
}

exports.main_handler = async (event, context) => {
  if ((event.httpMethod || event.requestContext?.http?.method) === 'OPTIONS') {
    return response(200, { ok: true });
  }

  if ((event.httpMethod || event.requestContext?.http?.method) !== 'POST') {
    return response(405, { ok: false, message: 'Method Not Allowed' });
  }

  try {
    const rawBody = typeof event.body === 'string' ? event.body : JSON.stringify(event.body || {});
    const payload = JSON.parse(rawBody || '{}');

    if (!payload.pairId || !payload.choice || !payload.sessionId) {
      return response(400, { ok: false, message: 'Missing required fields: pairId / choice / sessionId' });
    }

    const bucket = process.env.COS_BUCKET;
    const region = process.env.COS_REGION;
    const prefix = process.env.COS_PREFIX || 'votes/';

    if (!bucket || !region) {
      return response(500, { ok: false, message: 'COS_BUCKET or COS_REGION is not configured' });
    }

    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const stamp = now.toISOString().replace(/[:.]/g, '-');
    const rand = Math.random().toString(36).slice(2, 10);

    const key = `${prefix}${yyyy}/${mm}/${dd}/${payload.sessionId}__${payload.pairId}__${stamp}__${rand}.json`;

    const objectBody = JSON.stringify({
      receivedAt: new Date().toISOString(),
      requestId: context?.request_id || null,
      payload
    }, null, 2);

    await cos.putObject({
      Bucket: bucket,
      Region: region,
      Key: key,
      Body: objectBody,
      ContentType: 'application/json; charset=utf-8'
    });

    return response(200, { ok: true, key });
  } catch (error) {
    console.error(error);
    return response(500, { ok: false, message: error.message || 'Unknown error' });
  }
};
