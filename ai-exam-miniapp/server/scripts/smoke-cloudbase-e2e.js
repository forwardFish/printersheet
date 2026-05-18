import 'dotenv/config'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

process.env.DB_PROVIDER = 'cloudbase'
process.env.FILE_PROVIDER = 'cloudbase'
process.env.PAYMENT_PROVIDER = 'mock'
process.env.CLOUDBASE_ENV_ID = process.env.CLOUDBASE_ENV_ID || 'aiassistant-0517-d6en8tw82f2f7fc'
process.env.AI_MOCK_MODE = 'true'
process.env.NODE_ENV = 'test'

const { createApp } = await import('../src/index.js')
const { CloudBaseDbAdapter } = await import('../src/adapters/cloudbaseDb.js')
const { default: tcb } = await import('@cloudbase/node-sdk')

const envId = process.env.CLOUDBASE_ENV_ID
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const ownerOpenid = `e2e-cloudbase-owner-${runId}`
const otherOpenid = `e2e-cloudbase-other-${runId}`

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

async function expectJson(res, expectedStatus = 200) {
  const data = await res.json()
  assert.equal(res.status, expectedStatus, data.message || `HTTP ${res.status}`)
  return data
}

async function login(base, openid, nickname = 'CloudBase E2E User') {
  const data = await expectJson(await postJson(`${base}/api/auth/wechat-login`, {
    mockOpenid: openid,
    userInfo: { nickName: nickname }
  }))
  return { ...data, auth: { authorization: `Bearer ${data.token}` } }
}

async function points(base, auth) {
  const data = await expectJson(await fetch(`${base}/api/points`, { headers: auth }))
  return data.pointsBalance
}

async function createOrder(base, auth, productCode) {
  const data = await expectJson(await postJson(`${base}/api/orders/create`, { productCode }, auth))
  return data.order
}

async function payMock(base, auth, orderNo) {
  return expectJson(await postJson(`${base}/api/dev/pay/mock-success`, { orderNo }, auth))
}

async function payNotify(base, orderNo) {
  return expectJson(await postJson(`${base}/api/pay/notify`, { orderNo }))
}

async function generateWorksheet(base, auth, requestId) {
  return expectJson(await postJson(`${base}/api/worksheets/generate`, {
    requestId,
    prompt: 'Generate five Grade 7 linear equation questions for CloudBase E2E.',
    grade: 'Grade 7',
    subject: 'Math',
    difficulty: 'medium',
    mode: 'practice',
    questionCount: 5
  }, auth))
}

async function downloadAndAssert(url, auth, expectedStatus = 200) {
  const res = await fetch(url, { headers: auth })
  assert.equal(res.status, expectedStatus)
  if (expectedStatus === 200) {
    assert.ok((await res.arrayBuffer()).byteLength > 1000)
  }
  return res
}

async function downloadCloudFile(file) {
  assert.ok(file.fileId, `file_objects ${file.id} must have CloudBase fileId`)
  assert.ok(file.cloudPath, `file_objects ${file.id} must have cloudPath`)
  const app = tcb.init({ env: envId })
  const result = await app.downloadFile({ fileID: file.fileId })
  assert.ok(result.fileContent, `CloudBase file ${file.fileId} should return fileContent`)
  const tempPath = path.join(os.tmpdir(), `printersheet-${file.id}${path.extname(file.originalName || '')}`)
  await fs.writeFile(tempPath, result.fileContent)
  assert.ok(result.fileContent.length > 1000, `CloudBase file ${file.fileId} should be downloadable`)
  return { tempPath, size: result.fileContent.length }
}

const server = await listen(createApp())
const base = baseUrl(server)
const db = new CloudBaseDbAdapter({ envId })

try {
  const first = await login(base, ownerOpenid, 'CloudBase E2E Owner')
  assert.equal(first.firstLogin, true)
  assert.equal(await points(base, first.auth), 3)

  const repeated = await login(base, ownerOpenid, 'CloudBase E2E Owner')
  assert.equal(repeated.firstLogin, false)
  assert.equal(await points(base, repeated.auth), 3)

  const products = await expectJson(await fetch(`${base}/api/products`))
  assert.ok(products.products.some(product => product.productCode === 'small_pack'))
  assert.ok(products.products.some(product => product.productCode === 'pro_monthly'))

  const smallOrder = await createOrder(base, first.auth, 'small_pack')
  assert.equal(smallOrder.status, 'pending')
  const paidSmall = await payMock(base, first.auth, smallOrder.orderNo)
  assert.equal(paidSmall.order.status, 'paid')
  assert.equal(await points(base, first.auth), 28)

  await payMock(base, first.auth, smallOrder.orderNo)
  assert.equal(await points(base, first.auth), 28)

  const firstRequestId = `e2e-cloudbase-generate-${runId}`
  const generated = await generateWorksheet(base, first.auth, firstRequestId)
  assert.equal(generated.success, true)
  assert.ok(generated.worksheetId)
  assert.equal(await points(base, first.auth), 27)

  const repeatedGenerate = await generateWorksheet(base, first.auth, firstRequestId)
  assert.equal(repeatedGenerate.worksheetId, generated.worksheetId)
  assert.equal(await points(base, first.auth), 27)

  const records = await expectJson(await fetch(`${base}/api/worksheets`, { headers: first.auth }))
  assert.ok(records.records.some(item => item.id === generated.worksheetId))

  const detail = await expectJson(await fetch(`${base}/api/worksheets/${generated.worksheetId}`, { headers: first.auth }))
  assert.equal(detail.record.id, generated.worksheetId)
  assert.equal(detail.record.pdfFileId, records.records.find(item => item.id === generated.worksheetId).pdfFileId)

  await downloadAndAssert(`${base}${generated.pdfUrl}`, first.auth)
  await downloadAndAssert(`${base}${generated.wordUrl}`, first.auth, 403)

  const other = await login(base, otherOpenid, 'CloudBase E2E Other')
  await downloadAndAssert(`${base}${generated.pdfUrl}`, other.auth, 404)
  await expectJson(await fetch(`${base}/api/worksheets/${generated.worksheetId}`, { headers: other.auth }), 404)

  const proOrder = await createOrder(base, first.auth, 'pro_monthly')
  assert.equal(proOrder.status, 'pending')
  const paidPro = await payMock(base, first.auth, proOrder.orderNo)
  assert.equal(paidPro.order.status, 'paid')
  const afterProPoints = await points(base, first.auth)
  assert.equal(afterProPoints, 107)

  await payNotify(base, proOrder.orderNo)
  await payNotify(base, proOrder.orderNo)
  assert.equal(await points(base, first.auth), afterProPoints)

  const me = await expectJson(await fetch(`${base}/api/me`, { headers: first.auth }))
  assert.equal(me.isPaid, true)
  assert.equal(me.canDownloadWord, true)

  const memberGenerated = await generateWorksheet(base, first.auth, `e2e-cloudbase-member-generate-${runId}`)
  assert.equal(await points(base, first.auth), 106)
  await downloadAndAssert(`${base}${memberGenerated.wordUrl}`, first.auth)

  const orders = await expectJson(await fetch(`${base}/api/orders`, { headers: first.auth }))
  assert.ok(orders.orders.some(item => item.orderNo === smallOrder.orderNo))
  assert.ok(orders.orders.some(item => item.orderNo === proOrder.orderNo))

  const relogin = await login(base, ownerOpenid, 'CloudBase E2E Owner')
  assert.equal(relogin.firstLogin, false)
  assert.equal(await points(base, relogin.auth), 106)
  const persistedRecords = await expectJson(await fetch(`${base}/api/worksheets`, { headers: relogin.auth }))
  assert.ok(persistedRecords.records.some(item => item.id === generated.worksheetId))
  assert.ok(persistedRecords.records.some(item => item.id === memberGenerated.worksheetId))

  const cloudUser = await db.findUserByOpenid(ownerOpenid)
  assert.ok(cloudUser?.id)
  const cloudAccount = await db.getPointAccount(cloudUser.id)
  assert.equal(cloudAccount.balance, 106)
  const cloudOrders = await db.listUserOrders(cloudUser.id)
  assert.ok(cloudOrders.some(item => item.orderNo === smallOrder.orderNo))
  assert.ok(cloudOrders.some(item => item.orderNo === proOrder.orderNo))
  const cloudWorksheets = await db.listUserWorksheets(cloudUser.id)
  assert.ok(cloudWorksheets.some(item => item.id === generated.worksheetId))
  assert.ok(cloudWorksheets.some(item => item.id === memberGenerated.worksheetId))

  const firstRecord = await db.findWorksheetById(generated.worksheetId)
  const memberRecord = await db.findWorksheetById(memberGenerated.worksheetId)
  const pdfFile = await db.findFileById(firstRecord.pdfFileId)
  const freeWordFile = await db.findFileById(firstRecord.wordFileId)
  const memberWordFile = await db.findFileById(memberRecord.wordFileId)
  const cloudPdf = await downloadCloudFile(pdfFile)
  const cloudFreeWord = await downloadCloudFile(freeWordFile)
  const cloudMemberWord = await downloadCloudFile(memberWordFile)

  console.log(JSON.stringify({
    success: true,
    envId,
    runId,
    ownerOpenid,
    otherOpenid,
    orderNos: [smallOrder.orderNo, proOrder.orderNo],
    worksheetIds: [generated.worksheetId, memberGenerated.worksheetId],
    pointsBalance: await points(base, first.auth),
    cloudbase: {
      userId: cloudUser.id,
      orders: cloudOrders.length,
      worksheets: cloudWorksheets.length,
      filesVerified: [
        { id: pdfFile.id, type: pdfFile.type, cloudPath: pdfFile.cloudPath, size: cloudPdf.size },
        { id: freeWordFile.id, type: freeWordFile.type, cloudPath: freeWordFile.cloudPath, size: cloudFreeWord.size },
        { id: memberWordFile.id, type: memberWordFile.type, cloudPath: memberWordFile.cloudPath, size: cloudMemberWord.size }
      ]
    }
  }, null, 2))
} finally {
  await new Promise(resolve => server.close(resolve))
}
