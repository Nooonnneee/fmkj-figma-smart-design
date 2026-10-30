const { api, upload, absUrl, toast } = require('../../utils/request')
const { requireLogin } = require('../../utils/auth')
const { getMeta } = require('../../utils/meta')
const { relTime } = require('../../utils/format')
const { toHtml } = require('../../utils/markdown')
const { streamNdjson } = require('../../utils/stream')
const { buildMessage, parseStored } = require('../../utils/attachments')
const { openHref } = require('../../utils/route')
const { pickImage } = require('../../utils/pick')

/**
 * AI 助手：与网页侧栏共用同一个后端（/ai/chat 流式接口、会话记录、积分）。
 * AI 可以直接新建项目、添加户型图、识别导入点位、智能选型、生成报价和合同；工具结果点一下就能跳到对应页面。
 */
const PROMPTS = [
  '帮我新建一个项目：万科城 3-1201，米家，客户张先生',
  '检查当前项目每个房间的点位配置是否完整',
  '按标准档为当前项目智能选型，然后生成报价单',
  '客户觉得贵，把当前报价打九五折',
]

Page({
  data: {
    messages: [],
    input: '',
    attachments: [],
    streaming: false,
    credits: 0,
    project: null,
    conversationId: '',
    conversations: [],
    showHistory: false,
    prompts: PROMPTS,
    aiReady: true,
  },
  modelId: 'deepseek-flash',
  pluginIds: [],
  acc: '',

  onLoad() {
    getMeta()
      .then((m) => {
        this.modelId = (m.aiModels[0] && m.aiModels[0].id) || this.modelId
        this.pluginIds = m.plugins.map((p) => p.id)
        const extra = m.aiTemplates.slice(0, 2).map((t) => t.name)
        this.setData({ aiReady: m.ai, prompts: PROMPTS.concat(extra) })
        this.templates = m.aiTemplates
      })
      .catch(() => null)
  },

  onShow() {
    if (!requireLogin()) return
    const me = getApp().globalData.me
    if (me) this.setData({ credits: me.aiCredits })
    api
      .get('/me', null, { silent: true })
      .then((u) => {
        getApp().globalData.me = u
        this.setData({ credits: u.aiCredits })
      })
      .catch(() => null)
    const pending = getApp().globalData.pending
    if (pending && pending.action === 'pick-image') {
      getApp().globalData.pending = null
      this.addImage()
    }
  },

  onInput(e) {
    this.setData({ input: e.detail.value })
  },
  usePrompt(e) {
    const text = e.currentTarget.dataset.text
    const tpl = (this.templates || []).find((t) => t.name === text)
    this.setData({ input: tpl ? tpl.prompt : text })
  },
  scrollBottom() {
    wx.pageScrollTo({ scrollTop: 1e6, duration: 120 })
  },

  /* ---------- 附件 ---------- */

  async addImage() {
    const img = await pickImage()
    if (!img) return
    const id = 'a' + Date.now()
    this.setData({ attachments: this.data.attachments.concat({ id, name: img.name, status: 'uploading', preview: img.path, summary: '上传中…' }) })
    try {
      const r = await upload('/ai/upload', img.path, { name: img.name })
      this.setData({
        attachments: this.data.attachments.map((a) =>
          a.id === id
            ? Object.assign({}, a, {
                status: 'ready',
                url: r.url,
                mediaId: r.mediaId,
                detectedPoints: r.detectedPoints || [],
                summary: r.detectedPointCount ? '识别到 ' + r.detectedPointCount + ' 个点位' : '图纸已就绪（不生成默认点位）',
              })
            : a,
        ),
      })
    } catch (e) {
      this.setData({ attachments: this.data.attachments.filter((a) => a.id !== id) })
    }
  },
  removeAttachment(e) {
    this.setData({ attachments: this.data.attachments.filter((a) => a.id !== e.currentTarget.dataset.id) })
  },
  preview(e) {
    wx.previewImage({ urls: [e.currentTarget.dataset.url] })
  },

  /* ---------- 发送与流式接收 ---------- */

  onSendTap() {
    if (this.data.streaming) this.stop()
    else this.send()
  },

  send() {
    const ready = this.data.attachments.filter((a) => a.status === 'ready')
    const text = this.data.input.trim()
    if (!text && !ready.length) return
    if (this.data.attachments.some((a) => a.status === 'uploading')) return toast('图片还在上传')
    if (!this.data.aiReady) return toast('服务器还没有配置 AI 密钥')
    const names = ready.map((a) => a.name).join('、')
    const prompt = text || '请将上传的户型图（' + names + '）添加到' + (this.data.project ? '当前项目' : '新项目') + '的点位图中。'
    const now = Date.now()
    const userMsg = { id: 'u' + now, role: 'user', text: prompt, images: ready.map((a) => ({ url: a.preview || absUrl(a.url) })) }
    const reply = { id: 'r' + now, role: 'assistant', text: '', html: '', tools: [], pending: true, error: false, cost: 0 }
    this.acc = ''
    this.setData({ messages: this.data.messages.concat(userMsg, reply), input: '', attachments: [], streaming: true })
    this.scrollBottom()
    this.task = streamNdjson(
      '/ai/chat',
      {
        conversationId: this.data.conversationId || null,
        message: buildMessage(prompt, ready),
        modelId: this.modelId,
        projectId: this.data.project ? this.data.project.id : null,
        pluginIds: this.pluginIds,
      },
      (ev) => this.onEvent(ev),
    )
  },

  stop() {
    if (this.task) this.task.abort()
  },

  onEvent(ev) {
    const idx = this.data.messages.length - 1
    const path = 'messages[' + idx + ']'
    const msg = this.data.messages[idx]
    if (!msg) return
    if (ev.type === 'meta') {
      this.setData({ conversationId: ev.conversationId })
    } else if (ev.type === 'tool') {
      this.setData({ [path + '.tools']: msg.tools.concat({ name: ev.pluginName, summary: ev.summary, href: ev.href || '', label: ev.hrefLabel || '' }) })
      this.scrollBottom()
    } else if (ev.type === 'project' && ev.project) {
      this.setData({ project: { id: ev.project.id, name: ev.project.name } })
    } else if (ev.type === 'delta') {
      this.acc += ev.text || ''
      this.flushSoon(path)
    } else if (ev.type === 'done') {
      this.flush(path)
      const credits = typeof ev.balance === 'number' ? ev.balance : this.data.credits
      this.setData({ [path + '.pending']: false, [path + '.cost']: ev.cost || 0, credits })
      if (getApp().globalData.me) getApp().globalData.me.aiCredits = credits
      if (ev.mutated) getApp().touchData()
    } else if (ev.type === 'error') {
      this.acc = this.acc || '发送失败：' + (ev.error || '请稍后重试')
      this.flush(path)
      this.setData({ [path + '.pending']: false, [path + '.error']: true })
    } else if (ev.type === 'closed' || ev.type === 'aborted') {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
      if (ev.type === 'aborted' && !this.acc) this.acc = '已停止'
      this.flush(path)
      this.setData({ streaming: false, [path + '.pending']: false })
      this.task = null
    }
  },
  flushSoon(path) {
    if (this.flushTimer) return
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      this.flush(path)
    }, 80)
  },
  flush(path) {
    if (!this.acc) return
    this.setData({ [path + '.html']: toHtml(this.acc), [path + '.text']: this.acc })
    this.scrollBottom()
  },

  openTool(e) {
    const href = e.currentTarget.dataset.href
    if (href && !openHref(href)) toast('请在网页版打开')
  },
  copy(e) {
    wx.setClipboardData({ data: this.data.messages[Number(e.currentTarget.dataset.index)].text })
  },

  /* ---------- 项目、会话 ---------- */

  async pickProject() {
    const d = await api.get('/projects', { status: 'active', limit: 5 })
    const list = d.items
    wx.showActionSheet({
      itemList: ['不关联项目'].concat(list.map((p) => p.name)),
      success: (r) => this.setData({ project: r.tapIndex === 0 ? null : { id: list[r.tapIndex - 1].id, name: list[r.tapIndex - 1].name } }),
    })
  },
  newChat() {
    if (this.data.streaming) return
    this.setData({ messages: [], conversationId: '', attachments: [] })
  },
  async openHistory() {
    this.setData({ showHistory: true })
    const d = await api.get('/ai/conversations')
    this.setData({ conversations: d.items.map((c) => Object.assign({}, c, { time: relTime(c.updatedAt) })) })
  },
  closeHistory() {
    this.setData({ showHistory: false })
  },
  async openConversation(e) {
    if (this.data.streaming) return
    const id = e.currentTarget.dataset.id
    this.setData({ showHistory: false })
    wx.showLoading({ title: '加载中' })
    try {
      const d = await api.get('/ai/conversations/' + id)
      const messages = d.messages.map((m) => {
        if (m.role === 'user') {
          const parsed = parseStored(m.content)
          return { id: m.id, role: 'user', text: parsed.text, images: parsed.images.map((i) => ({ url: absUrl(i.url) })) }
        }
        return {
          id: m.id,
          role: 'assistant',
          text: m.content,
          html: toHtml(m.content),
          tools: (m.toolCalls || []).map((t) => ({ name: t.pluginName, summary: t.summary, href: t.href || '', label: t.hrefLabel || '' })),
          pending: false,
          cost: m.cost || 0,
        }
      })
      this.setData({ messages, conversationId: id })
      setTimeout(() => this.scrollBottom(), 100)
    } finally {
      wx.hideLoading()
    }
  },
  deleteConversation(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除对话',
      content: '删除后无法恢复，积分记录保留。',
      confirmColor: '#a51d24',
      success: async (r) => {
        if (!r.confirm) return
        await api.del('/ai/conversations/' + id)
        this.setData({ conversations: this.data.conversations.filter((c) => c.id !== id) })
        if (id === this.data.conversationId) this.newChat()
      },
    })
  },
})
