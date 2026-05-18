import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

process.env.DB_PROVIDER = process.env.DB_PROVIDER || 'local'
process.env.FILE_PROVIDER = process.env.FILE_PROVIDER || 'local'
process.env.PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER || 'mock'
process.env.AI_MOCK_MODE = process.env.AI_MOCK_MODE || 'true'
process.env.NODE_ENV = 'test'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
process.chdir(path.resolve(__dirname, '..'))

const { createApp } = await import('../src/index.js')

function listen(app) {
  return new Promise(resolve => {
    const server = app.listen(0, () => resolve(server))
  })
}

function baseUrl(server) {
  const { port } = server.address()
  return `http://127.0.0.1:${port}`
}

async function postJson(url, body, headers = {}) {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body)
  })
}

async function json(res) {
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`)
  return data
}

const server = await listen(createApp())
const base = baseUrl(server)
const openid = `smoke-${Date.now()}`

try {
  const login = await json(await postJson(`${base}/api/auth/wechat-login`, {
    mockOpenid: openid,
    userInfo: { nickName: 'Smoke User' }
  }))
  const auth = { authorization: `Bearer ${login.token}` }

  const initialPoints = await json(await fetch(`${base}/api/points`, { headers: auth }))
  assert.equal(initialPoints.pointsBalance, 3)

  const orderCreated = await json(await postJson(`${base}/api/orders/create`, { productCode: 'small_pack' }, auth))
  assert.equal(orderCreated.order.status, 'pending')

  const paid = await json(await postJson(`${base}/api/dev/pay/mock-success`, { orderNo: orderCreated.order.orderNo }, auth))
  assert.equal(paid.order.status, 'paid')

  const paidPoints = await json(await fetch(`${base}/api/points`, { headers: auth }))
  assert.equal(paidPoints.pointsBalance, 28)

  const generated = await json(await postJson(`${base}/api/worksheets/generate`, {
    requestId: `smoke-generate-${Date.now()}`,
    prompt: 'Generate five Grade 7 linear equation questions.',
    grade: 'Grade 7',
    subject: 'Math',
    difficulty: 'medium',
    mode: 'practice',
    questionCount: 5
  }, auth))
  assert.equal(generated.success, true)
  assert.ok(generated.worksheetId)

  const records = await json(await fetch(`${base}/api/worksheets`, { headers: auth }))
  assert.ok(records.records.some(item => item.id === generated.worksheetId))

  const detail = await json(await fetch(`${base}/api/worksheets/${generated.worksheetId}`, { headers: auth }))
  assert.equal(detail.record.id, generated.worksheetId)

  const pdf = await fetch(`${base}${generated.pdfUrl}`, { headers: auth })
  assert.equal(pdf.status, 200)
  assert.ok((await pdf.arrayBuffer()).byteLength > 1000)

  const relogin = await json(await postJson(`${base}/api/auth/wechat-login`, { mockOpenid: openid }))
  const reloginAuth = { authorization: `Bearer ${relogin.token}` }
  const finalPoints = await json(await fetch(`${base}/api/points`, { headers: reloginAuth }))
  assert.equal(finalPoints.pointsBalance, 27)

  console.log(JSON.stringify({
    success: true,
    openid,
    orderNo: orderCreated.order.orderNo,
    worksheetId: generated.worksheetId,
    pointsBalance: finalPoints.pointsBalance
  }, null, 2))
} finally {
  await new Promise(resolve => server.close(resolve))
}
