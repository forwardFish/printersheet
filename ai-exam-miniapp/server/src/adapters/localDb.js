import fs from 'fs'
import path from 'path'

const EMPTY_STATE = {
  users: [],
  point_accounts: [],
  point_ledger: [],
  orders: [],
  memberships: [],
  generation_jobs: [],
  worksheet_records: [],
  file_objects: []
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function nowIso() {
  return new Date().toISOString()
}

export class LocalDbAdapter {
  constructor(filePath) {
    this.filePath = filePath
    this.state = this.load()
  }

  load() {
    if (!fs.existsSync(this.filePath)) return clone(EMPTY_STATE)
    const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'))
    return { ...clone(EMPTY_STATE), ...parsed }
  }

  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
    const tmp = `${this.filePath}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2))
    fs.renameSync(tmp, this.filePath)
  }

  get collection() {
    return this.state
  }

  create(name, record) {
    const item = { ...record, createdAt: record.createdAt || nowIso(), updatedAt: record.updatedAt || nowIso() }
    this.state[name].push(item)
    this.save()
    return clone(item)
  }

  update(name, id, patch) {
    const list = this.state[name]
    const index = list.findIndex(item => item.id === id)
    if (index < 0) return null
    list[index] = { ...list[index], ...patch, updatedAt: nowIso() }
    this.save()
    return clone(list[index])
  }

  replace(name, id, next) {
    const list = this.state[name]
    const index = list.findIndex(item => item.id === id)
    if (index < 0) return null
    list[index] = { ...next, updatedAt: nowIso() }
    this.save()
    return clone(list[index])
  }

  findUserByOpenid(openid) {
    const user = this.state.users.find(item => item.openid === openid)
    return user ? clone(user) : null
  }

  findUserById(userId) {
    const user = this.state.users.find(item => item.id === userId)
    return user ? clone(user) : null
  }

  getPointAccount(userId) {
    const account = this.state.point_accounts.find(item => item.userId === userId)
    return account ? clone(account) : null
  }

  setPointBalance(userId, balance) {
    const account = this.state.point_accounts.find(item => item.userId === userId)
    if (!account) return null
    account.balance = Number(balance || 0)
    account.updatedAt = nowIso()
    this.save()
    return clone(account)
  }

  findOrderByOrderNo(orderNo) {
    const order = this.state.orders.find(item => item.orderNo === orderNo)
    return order ? clone(order) : null
  }

  findWorksheetByRequestId(userId, requestId) {
    const record = this.state.worksheet_records.find(item => item.userId === userId && item.requestId === requestId)
    return record ? clone(record) : null
  }

  findGenerationJobById(id) {
    const record = this.state.generation_jobs.find(item => item.id === id)
    return record ? clone(record) : null
  }

  findGenerationJobByRequestId(userId, requestId) {
    const record = this.state.generation_jobs.find(item => item.userId === userId && item.requestId === requestId)
    return record ? clone(record) : null
  }

  listGenerationJobs(where = {}) {
    const entries = Object.entries(where).filter(([, value]) => value !== undefined && value !== null && value !== '')
    return clone(this.state.generation_jobs
      .filter(item => entries.every(([key, value]) => item[key] === value))
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))))
  }

  listUserGenerationJobs(userId, status = '') {
    const entries = { userId }
    if (status) entries.status = status
    return this.listGenerationJobs(entries).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  }

  findWorksheetById(id) {
    const record = this.state.worksheet_records.find(item => item.id === id)
    return record ? clone(record) : null
  }

  findFileById(id) {
    const file = this.state.file_objects.find(item => item.id === id)
    return file ? clone(file) : null
  }

  listUserWorksheets(userId) {
    return clone(this.state.worksheet_records.filter(item => item.userId === userId).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))))
  }

  listUserOrders(userId) {
    return clone(this.state.orders.filter(item => item.userId === userId).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))))
  }

  listActiveMemberships(userId, now = Date.now()) {
    return clone(this.state.memberships
      .filter(item => item.userId === userId && (!item.expiresAt || new Date(item.expiresAt).getTime() > now))
      .sort((a, b) => String(b.expiresAt || '').localeCompare(String(a.expiresAt || ''))))
  }
}
