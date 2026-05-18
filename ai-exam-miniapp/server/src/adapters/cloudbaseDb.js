const COLLECTIONS = [
  'users',
  'point_accounts',
  'point_ledger',
  'orders',
  'memberships',
  'generation_jobs',
  'worksheet_records',
  'file_objects'
]

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function nowIso() {
  return new Date().toISOString()
}

function normalizeDoc(doc) {
  if (!doc) return null
  const { _id, ...rest } = doc
  return clone(rest)
}

export class CloudBaseDbAdapter {
  constructor({ envId }) {
    this.envId = envId
    this.appPromise = null
    this.dbPromise = null
  }

  async getApp() {
    if (!this.appPromise) {
      this.appPromise = import('@cloudbase/node-sdk').then(({ default: tcb }) => tcb.init({ env: this.envId }))
    }
    return this.appPromise
  }

  async getDb() {
    if (!this.dbPromise) {
      this.dbPromise = this.getApp().then(app => app.database())
    }
    return this.dbPromise
  }

  async getCollection(name) {
    if (!COLLECTIONS.includes(name)) throw new Error(`unknown collection: ${name}`)
    const db = await this.getDb()
    return db.collection(name)
  }

  async create(name, record) {
    const item = { ...record, createdAt: record.createdAt || nowIso(), updatedAt: record.updatedAt || nowIso() }
    const collection = await this.getCollection(name)
    await collection.doc(item.id).set(item)
    return clone(item)
  }

  async update(name, id, patch) {
    const existing = await this.findById(name, id)
    if (!existing) return null
    const next = { ...patch, updatedAt: nowIso() }
    const collection = await this.getCollection(name)
    await collection.doc(id).update(next)
    return { ...existing, ...clone(next) }
  }

  async replace(name, id, next) {
    const existing = await this.findById(name, id)
    if (!existing) return null
    const item = { ...next, updatedAt: nowIso() }
    const collection = await this.getCollection(name)
    await collection.doc(id).set(item)
    return clone(item)
  }

  async findById(name, id) {
    const collection = await this.getCollection(name)
    const result = await collection.doc(id).get()
    return normalizeDoc(result.data?.[0])
  }

  async findOne(name, where) {
    const collection = await this.getCollection(name)
    const result = await collection.where(where).limit(1).get()
    return normalizeDoc(result.data?.[0])
  }

  async list(name, where = {}, orderField = 'createdAt', orderDirection = 'desc') {
    const collection = await this.getCollection(name)
    const result = await collection
      .where(where)
      .orderBy(orderField, orderDirection)
      .limit(1000)
      .get()
    return (result.data || []).map(normalizeDoc)
  }

  findUserByOpenid(openid) {
    return this.findOne('users', { openid })
  }

  findUserById(userId) {
    return this.findById('users', userId)
  }

  getPointAccount(userId) {
    return this.findOne('point_accounts', { userId })
  }

  async setPointBalance(userId, balance) {
    const account = await this.getPointAccount(userId)
    if (!account) return null
    return this.update('point_accounts', account.id, { balance: Number(balance || 0) })
  }

  findOrderByOrderNo(orderNo) {
    return this.findOne('orders', { orderNo })
  }

  findWorksheetByRequestId(userId, requestId) {
    return this.findOne('worksheet_records', { userId, requestId })
  }

  findGenerationJobById(id) {
    return this.findById('generation_jobs', id)
  }

  findGenerationJobByRequestId(userId, requestId) {
    return this.findOne('generation_jobs', { userId, requestId })
  }

  listGenerationJobs(where = {}) {
    return this.list('generation_jobs', where, 'createdAt', 'asc')
  }

  listUserGenerationJobs(userId, status = '') {
    const where = status ? { userId, status } : { userId }
    return this.list('generation_jobs', where)
  }

  findWorksheetById(id) {
    return this.findById('worksheet_records', id)
  }

  findFileById(id) {
    return this.findById('file_objects', id)
  }

  listUserWorksheets(userId) {
    return this.list('worksheet_records', { userId })
  }

  listUserOrders(userId) {
    return this.list('orders', { userId })
  }

  async listActiveMemberships(userId, now = Date.now()) {
    const memberships = await this.list('memberships', { userId }, 'expiresAt', 'desc')
    return memberships.filter(item => !item.expiresAt || new Date(item.expiresAt).getTime() > now)
  }
}
