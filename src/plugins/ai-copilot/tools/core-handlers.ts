import { inferAreaType, isAreaType } from '@/lib/area-types'
import { getCatalog, getCompanyInfo } from '@/lib/cached-data'
import {
  DEFAULT_CONTRACT_TERMS,
  DEFAULT_DURATION_DAYS,
  DEFAULT_PAYMENTS,
  DEFAULT_WARRANTY_MONTHS,
  isContractStatus,
  paymentPercentTotal,
} from '@/lib/contracts'
import { CAMERA_PER_FLOOR, DESIGN_RULE_TEXT, isDrawingOnlyType, isSpeakerArea, NEEDS_SWITCH_TYPES, ONE_PER_AREA_TYPES, VRF_PER_FLOOR } from '@/lib/design-rules'
import { DEVICE_TYPE_ORDER, deviceTypeOf, isDeviceType } from '@/lib/device-types'
import { getPayloadClient } from '@/lib/payload'
import { fillDefaultProducts, isPointData, parseDefaults, pointDeviceType, summarizePoints, type PointCustomData } from '@/lib/point-map-items'
import {
  analyzeScene,
  buildAreaElements,
  buildPointElements,
  buildSheetElements,
  compactScene,
  nextPointCode,
  normalizeScene,
  type StoredScene,
} from '@/lib/point-scene'
import { inPointScope } from '@/lib/point-scopes'
import { DEFAULT_PLATFORM, isProjectPlatform } from '@/lib/projects'
import { QUOTE_STATUSES, type QuoteStatus } from '@/lib/quotes'
import type { Project } from '@/payload-types'
import { parsePointImport, planToElements, resolveDeviceType } from '@/plugins/ai-import/point-import'
import { IMAGE_MODELS, generateImage } from '../image-generation'

import { getCachedDetectedBundle } from '../upload-handler'
import { refreshContextProject, type AiToolHandler } from './context'

const parseQuoteStatus = (v: unknown): QuoteStatus | null => {
  if (v === 'confirmed') return 'accepted'
  return QUOTE_STATUSES.some((s) => s.value === v) ? (v as QuoteStatus) : null
}

export const coreToolHandlers: Record<string, AiToolHandler> = {
  async list_projects(args, ctx) {
      if (typeof args.switchToProjectId === 'string' && args.switchToProjectId.trim()) {
        await refreshContextProject(ctx, args.switchToProjectId.trim())
        if (ctx.project) {
          return {
            result: { switchedTo: ctx.project.project.name, projectId: ctx.projectId },
            summary: `已切换到项目「${ctx.project.project.name}」`,
            href: `/projects/${ctx.projectId}`,
            hrefLabel: '打开项目',
          }
        }
      }
      const payload = await getPayloadClient()
      const status = args.status === 'archived' || args.status === 'all' ? args.status : 'active'
      const q = typeof args.query === 'string' ? args.query.trim().toLowerCase() : ''
      const res = await payload.find({
        collection: 'projects',
        ...(status !== 'all' ? { where: { status: { equals: status } } } : {}),
        sort: '-updatedAt',
        limit: 30,
        depth: 0,
        user: ctx.user,
        overrideAccess: false,
        select: { name: true, customerName: true, customerPhone: true, community: true, address: true, platform: true, budget: true, status: true, pointCount: true },
      })
      const list = res.docs
        .filter((p) => (!q ? true : `${p.name} ${p.customerName ?? ''} ${p.community ?? ''} ${p.address ?? ''}`.toLowerCase().includes(q)))
        .slice(0, 15)
        .map((p) => ({
          id: String(p.id),
          name: p.name,
          customerName: p.customerName ?? null,
          community: p.community ?? null,
          address: p.address ?? null,
          platform: p.platform ?? null,
          budget: p.budget ?? null,
          status: p.status,
          pointCount: p.pointCount ?? 0,
        }))
      return {
        result: { count: list.length, projects: list },
        summary: `查找到 ${list.length} 个项目`,
        href: '/projects',
        hrefLabel: '项目列表',
      }
    },
  async create_project(args, ctx) {
      const payload = await getPayloadClient()
      const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
      const platformRaw = str(args.platform, 40)
      const platform = (isProjectPlatform(platformRaw) ? platformRaw : DEFAULT_PLATFORM) as Project['platform']
      const budget = typeof args.budget === 'number' && Number.isFinite(args.budget) && args.budget >= 0 ? Math.round(args.budget) : null

      const doc = await payload.create({
        collection: 'projects',
        data: {
          name: str(args.name, 120),
          customerName: str(args.customerName, 60) || null,
          customerPhone: str(args.customerPhone, 30) || null,
          community: str(args.community, 80) || null,
          address: str(args.address, 200) || null,
          platform,
          budget,
          notes: str(args.notes, 2000) || null,
          owner: ctx.user.id,
          status: 'active',
        },
        user: ctx.user,
        overrideAccess: false,
        depth: 0,
      })
      ctx.mutated = true
      await refreshContextProject(ctx, String(doc.id))
      return {
        result: {
          projectId: String(doc.id),
          name: doc.name,
          customerName: doc.customerName ?? null,
          community: doc.community ?? null,
          address: doc.address ?? null,
          platform: doc.platform ?? null,
          budget: doc.budget ?? null,
        },
        summary: `已创建项目「${doc.name}」`,
        href: `/projects/${doc.id}`,
        hrefLabel: '打开新项目',
      }
    },
  async update_project(args, ctx) {
      const targetId = typeof args.projectId === 'string' && args.projectId.trim() ? args.projectId.trim() : ctx.projectId
      if (!targetId) return { result: { error: '没有指定或关联项目' }, summary: '未指定项目' }

      const patch: Record<string, unknown> = {}
      if (typeof args.name === 'string' && args.name.trim()) patch.name = args.name.trim().slice(0, 120)
      if (typeof args.customerName === 'string') patch.customerName = args.customerName.trim().slice(0, 60) || null
      if (typeof args.customerPhone === 'string') patch.customerPhone = args.customerPhone.trim().slice(0, 30) || null
      if (typeof args.community === 'string') patch.community = args.community.trim().slice(0, 80) || null
      if (typeof args.address === 'string') patch.address = args.address.trim().slice(0, 200) || null
      if (typeof args.platform === 'string' && isProjectPlatform(args.platform)) patch.platform = args.platform
      if (typeof args.budget === 'number' && Number.isFinite(args.budget) && args.budget >= 0) patch.budget = Math.round(args.budget)
      if (typeof args.notes === 'string') patch.notes = args.notes.trim().slice(0, 2000) || null
      if (args.status === 'active' || args.status === 'archived') patch.status = args.status

      const payload = await getPayloadClient()
      const updated = await payload.update({
        collection: 'projects',
        id: targetId,
        data: patch as never,
        user: ctx.user,
        overrideAccess: false,
        depth: 0,
      })
      ctx.mutated = true
      await refreshContextProject(ctx, String(updated.id))
      return {
        result: { projectId: String(updated.id), name: updated.name, status: updated.status, platform: updated.platform, budget: updated.budget },
        summary: `已更新项目「${updated.name}」`,
        href: `/projects/${updated.id}`,
        hrefLabel: '查看项目',
      }
    },
  async add_floor_sheet(args, ctx) {
      if (!ctx.projectId) return { result: { error: '没有关联项目，请先新建或关联项目' }, summary: '未关联项目' }
      const url = typeof args.url === 'string' ? args.url.trim() : ''
      if (!url) return { result: { error: '缺少图片 url' }, summary: '缺少图片地址' }
      const mediaId = typeof args.mediaId === 'string' && args.mediaId.trim() ? args.mediaId.trim() : null
      const name = typeof args.sheetName === 'string' && args.sheetName.trim() ? args.sheetName.trim().slice(0, 40) : '一层平面图'

      const payload = await getPayloadClient()
      const project = await payload
        .findByID({ collection: 'projects', id: ctx.projectId, depth: 0, user: ctx.user, overrideAccess: false, select: { status: true, pointMap: true } })
        .catch(() => null)
      if (!project) return { result: { error: '项目不存在或无权限' }, summary: '项目不可用' }
      if (project.status === 'archived') return { result: { error: '项目已归档，无法修改点位图' }, summary: '项目已归档' }

      const norm = normalizeScene(project.pointMap as Partial<StoredScene> | null)
      let elements = [...norm.elements]
      const files = { ...norm.files }
      const fileId = mediaId ? `sheet-${mediaId}` : `sheet-${Date.now().toString(36)}`
      files[fileId] = { id: fileId, dataURL: url, mimeType: 'image/png' }

      let analyzed = analyzeScene({ elements, files })
      // 只有一张空白示意图、且上面还没有任何点位和区域时直接替换；否则追加为新图纸，不丢失已有点位
      if (analyzed.sheets.length === 1 && analyzed.sheets[0].fileId === 'blank-sheet' && analyzed.points.length === 0 && analyzed.areas.length === 0) {
        elements = [...buildSheetElements({ index: 0, name, fileId, mediaId }), ...elements.filter((e) => e.customData?.kind !== 'sheet' && e.customData?.kind !== 'sheet-title')]
      } else {
        elements.push(...buildSheetElements({ index: analyzed.sheets.length, name, fileId, mediaId }))
      }

      analyzed = analyzeScene({ elements, files })
      const targetSheet = analyzed.sheets[analyzed.sheets.length - 1]
      const importMode = args.importMode === 'all' ? 'all' : args.importMode === 'none' ? 'none' : 'switches'
      const bundle = getCachedDetectedBundle(mediaId, url)
      let rawPts = Array.isArray(args.detectedPoints) && args.detectedPoints.length > 0 ? (args.detectedPoints as Record<string, unknown>[]) : []
      if (importMode === 'none') {
        rawPts = []
      } else if (rawPts.length === 0) {
        if (bundle) {
          rawPts =
            importMode === 'switches' && bundle.switchPoints.length > 0
              ? bundle.switchPoints
              : bundle.points
        } else if (mediaId) {
          const mediaDoc = await payload.findByID({ collection: 'media', id: mediaId, depth: 0, overrideAccess: true }).catch(() => null)
          const fromMedia = (mediaDoc as unknown as { aiDetectedPoints?: unknown } | null)?.aiDetectedPoints
          if (Array.isArray(fromMedia) && fromMedia.length > 0) {
            rawPts = fromMedia as Record<string, unknown>[]
          }
        }
      }

      // 自动创建识别出的房间区域（避免点位全部落入「公共区」）
      let createdAreas = 0
      if (targetSheet && importMode !== 'none' && bundle?.areas?.length) {
        const onSheetAreas = analyzed.areas.filter((a) => a.sheetId === targetSheet.id)
        if (onSheetAreas.length === 0) {
          for (const a of bundle.areas) {
            const [rx, ry, rw, rh] = a.rect
            if (rw <= 0.02 || rh <= 0.02) continue
            const areaName = a.name || '房间'
            const areaType = isAreaType(a.type) ? a.type : inferAreaType(areaName)
            elements.push(
              ...buildAreaElements({
                name: areaName,
                areaType,
                x: targetSheet.x + rx * targetSheet.width,
                y: targetSheet.y + ry * targetSheet.height,
                width: rw * targetSheet.width,
                height: rh * targetSheet.height,
              }),
            )
            createdAreas++
          }
        }
      }

      let recognizedCount = 0
      if (targetSheet && rawPts.length > 0) {
        const usedCodes = new Set(analyzed.points.map((p) => p.code).filter(Boolean))
        for (const p of rawPts) {
          const rx = typeof p.x === 'number' ? p.x : Number(p.x)
          const ry = typeof p.y === 'number' ? p.y : Number(p.y)
          if (!Number.isFinite(rx) || !Number.isFinite(ry) || rx < 0 || rx > 1 || ry < 0 || ry > 1) continue
          const dt = resolveDeviceType(p.type) ?? (isDeviceType(p.type) ? String(p.type) : 'switch-2')
          const code = nextPointCode(dt, usedCodes)
          usedCodes.add(code)
          elements.push(
            ...buildPointElements({
              deviceType: dt,
              cx: targetSheet.x + rx * targetSheet.width,
              cy: targetSheet.y + ry * targetSheet.height,
              code,
            }),
          )
          recognizedCount++
        }
      }

      const compacted = compactScene(elements, files, norm.appState)
      await payload.update({
        collection: 'projects',
        id: ctx.projectId,
        data: { pointMap: compacted as never },
        user: ctx.user,
        overrideAccess: false,
        depth: 0,
      })
      ctx.mutated = true
      await refreshContextProject(ctx, ctx.projectId)
      return {
        result: {
          sheetName: name,
          url,
          importMode,
          recognizedPoints: recognizedCount,
          recognizedAreas: createdAreas,
          detectedSummary: bundle?.summary ?? null,
          totalSheets: ctx.project?.sheets.length ?? 1,
          note: recognizedCount
            ? `已在图纸上生成 ${recognizedCount} 个点位（模式：${importMode === 'switches' ? '仅开关' : '全部'}）与 ${createdAreas} 个房间分区`
            : '图纸已添加（未检测到标准 CAD 点位符号，按规则保持 0 默认点位，可在画布手动放置或导入识别 JSON）',
        },
        summary: recognizedCount
          ? `已添加图纸「${name}」（${recognizedCount} 个点位 · ${createdAreas} 个房间）`
          : `已添加户型图「${name}」（无默认点位）`,
        href: `/projects/${ctx.projectId}/point-map`,
        hrefLabel: '查看点位图',
      }
    },
  async import_points_json(args, ctx) {
      if (!ctx.projectId) return { result: { error: '没有关联项目，请先新建或关联项目' }, summary: '未关联项目' }
      const jsonText = typeof args.jsonText === 'string' ? args.jsonText.trim() : ''
      if (!jsonText) return { result: { error: '缺少 jsonText 内容' }, summary: '缺少 JSON 内容' }

      const payload = await getPayloadClient()
      const project = await payload
        .findByID({ collection: 'projects', id: ctx.projectId, depth: 0, user: ctx.user, overrideAccess: false, select: { status: true, pointMap: true } })
        .catch(() => null)
      if (!project) return { result: { error: '项目不存在或无权限' }, summary: '项目不可用' }
      if (project.status === 'archived') return { result: { error: '项目已归档，无法修改点位图' }, summary: '项目已归档' }

      const norm = normalizeScene(project.pointMap as Partial<StoredScene> | null)
      const elements = [...norm.elements]
      const files = { ...norm.files }
      let analyzed = analyzeScene({ elements, files })
      if (!analyzed.sheets.length) {
        const blankFileId = 'blank-sheet'
        files[blankFileId] = { id: blankFileId, dataURL: '/blank-sheet.svg', mimeType: 'image/svg+xml' }
        elements.push(...buildSheetElements({ index: 0, name: '一层平面图', fileId: blankFileId }))
        analyzed = analyzeScene({ elements, files })
      }

      const parsed = parsePointImport(jsonText, analyzed.sheets)
      if (!parsed.ok) return { result: { error: parsed.error }, summary: `导入失败：${parsed.error}` }

      const usedCodes = new Set(analyzed.points.map((p) => p.code).filter(Boolean))
      const built = planToElements(parsed.plan, usedCodes)
      elements.push(...built.areas, ...built.points)

      const compacted = compactScene(elements, files, norm.appState)
      await payload.update({
        collection: 'projects',
        id: ctx.projectId,
        data: { pointMap: compacted as never },
        user: ctx.user,
        overrideAccess: false,
        depth: 0,
      })
      ctx.mutated = true
      await refreshContextProject(ctx, ctx.projectId)
      return {
        result: {
          addedAreas: parsed.plan.areaCount,
          addedPoints: parsed.plan.pointCount,
          warnings: parsed.plan.warnings,
          totalPoints: ctx.project?.points.length ?? parsed.plan.pointCount,
        },
        summary: `已导入 ${parsed.plan.areaCount} 个区域、${parsed.plan.pointCount} 个点位`,
        href: `/projects/${ctx.projectId}/point-map`,
        hrefLabel: '查看点位图',
      }
    },
  async setup_rooms_and_points(args, ctx) {
      if (!ctx.projectId) return { result: { error: '没有关联项目，请先新建或选择项目' }, summary: '未关联项目' }
      const rawRooms = Array.isArray(args.rooms) ? (args.rooms as Record<string, unknown>[]) : []
      if (!rawRooms.length) return { result: { error: '请提供 rooms 房间列表' }, summary: '未提供房间列表' }

      const payload = await getPayloadClient()
      const project = await payload
        .findByID({ collection: 'projects', id: ctx.projectId, depth: 0, user: ctx.user, overrideAccess: false, select: { status: true, pointMap: true } })
        .catch(() => null)
      if (!project) return { result: { error: '项目不存在或无权限' }, summary: '项目不可用' }
      if (project.status === 'archived') return { result: { error: '项目已归档，无法修改点位图' }, summary: '项目已归档' }

      const norm = normalizeScene(project.pointMap as Partial<StoredScene> | null)
      let elements = [...norm.elements]
      const files = { ...norm.files }
      const existingSheets = analyzeScene({ elements, files }).sheets
      const hasRealFloorPlan = existingSheets.some((s) => s.fileId && s.fileId !== 'blank-sheet')
      if (hasRealFloorPlan) {
        return {
          result: {
            skipped: true,
            reason:
              '当前项目已包含真实上传的户型图。按系统规则，点位图打开时不生成网格默认点位，只有真实识别到的点位（add_floor_sheet 的 detectedPoints 或 import_points_json）才会生成图标。',
          },
          summary: '已保持真实户型图干净（不生成网格默认点位）',
          href: `/projects/${ctx.projectId}/point-map`,
          hrefLabel: '打开点位图',
        }
      }

      const sheetName = typeof args.sheetName === 'string' && args.sheetName.trim() ? args.sheetName.trim().slice(0, 40) : '一层平面图'
      const replace = args.mode === 'replace'

      if (replace) {
        elements = []
      }

      let analyzed = analyzeScene({ elements, files })
      let sheet = analyzed.sheets.find((s) => s.name === sheetName) ?? analyzed.sheets[0]
      if (!sheet) {
        const blankFileId = 'blank-sheet'
        files[blankFileId] = { id: blankFileId, dataURL: '/blank-sheet.svg', mimeType: 'image/svg+xml' }
        elements.push(...buildSheetElements({ index: 0, name: sheetName, fileId: blankFileId }))
        analyzed = analyzeScene({ elements, files })
        sheet = analyzed.sheets[0]!
      }

      const usedCodes = new Set(analyzed.points.map((p) => p.code).filter(Boolean))
      const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(rawRooms.length))))
      const rows = Math.ceil(rawRooms.length / cols)
      const padX = 48
      const padY = 48
      const gapX = 24
      const gapY = 24
      const cellW = Math.floor((sheet.width - padX * 2 - gapX * (cols - 1)) / cols)
      const cellH = Math.floor((sheet.height - padY * 2 - gapY * (rows - 1)) / rows)

      let addedAreas = 0
      let addedPoints = 0
      let ruleSkipped = 0
      let vrfCount = 0
      let cameraCount = 0
      for (const [idx, r] of rawRooms.entries()) {
        const rName = typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 30) : `房间 ${idx + 1}`
        const rType = isAreaType(r.type) ? r.type : inferAreaType(rName)
        const col = idx % cols
        const row = Math.floor(idx / cols)
        const rx = sheet.x + padX + col * (cellW + gapX)
        const ry = sheet.y + padY + row * (cellH + gapY)

        elements.push(...buildAreaElements({ name: rName, areaType: rType, x: rx, y: ry, width: cellW, height: cellH }))
        addedAreas++

        const devs = Array.isArray(r.devices) ? (r.devices as Record<string, unknown>[]) : []
        const flatTypes: string[] = []
        for (const d of devs) {
          const dt = resolveDeviceType(d.deviceType ?? d.type) ?? (isDeviceType(d.deviceType) ? String(d.deviceType) : null)
          if (!dt) continue
          // 设计规范：没有图纸就没有准确的开关 / 灯光点位，这类设备不生成
          // 空白图没有开关点位：中控屏不加入；音箱只放客厅、书房
          if (isDrawingOnlyType(dt) || NEEDS_SWITCH_TYPES.has(dt) || (dt === 'speaker' && !isSpeakerArea(typeof r.type === 'string' ? r.type : null, typeof r.name === 'string' ? r.name : ''))) {
            ruleSkipped++
            continue
          }
          let c = Math.min(20, Math.max(1, Math.round(Number(d.count) || 1)))
          // 数量规范：VRF 每层 1 个、摄像头每层 2 个、音箱 / 中控屏每个区域只放一种一个
          if (dt === 'vrf-controller') c = Math.min(c, VRF_PER_FLOOR - vrfCount)
          if (dt === 'camera') c = Math.min(c, CAMERA_PER_FLOOR - cameraCount)
          if (ONE_PER_AREA_TYPES.has(dt)) c = flatTypes.some((t) => ONE_PER_AREA_TYPES.has(t)) ? 0 : 1
          if (c <= 0) {
            ruleSkipped++
            continue
          }
          if (dt === 'vrf-controller') vrfCount += c
          if (dt === 'camera') cameraCount += c
          for (let i = 0; i < c; i++) flatTypes.push(dt)
        }
        if (!flatTypes.length) continue

        const pCols = Math.min(5, Math.max(2, Math.ceil(Math.sqrt(flatTypes.length))))
        const pRows = Math.ceil(flatTypes.length / pCols)
        for (const [pIdx, dt] of flatTypes.entries()) {
          const pc = pIdx % pCols
          const pr = Math.floor(pIdx / pCols)
          const cx = rx + ((pc + 0.6) / (pCols + 0.2)) * cellW
          const cy = ry + 26 + ((pr + 0.5) / (pRows + 0.2)) * (cellH - 36)
          const code = nextPointCode(dt, usedCodes)
          usedCodes.add(code)
          elements.push(...buildPointElements({ deviceType: dt, cx, cy, code }))
          addedPoints++
        }
      }

      const compacted = compactScene(elements, files, norm.appState)
      await payload.update({
        collection: 'projects',
        id: ctx.projectId,
        data: { pointMap: compacted as never },
        user: ctx.user,
        overrideAccess: false,
        depth: 0,
      })
      ctx.mutated = true
      await refreshContextProject(ctx, ctx.projectId)
      return {
        result: {
          sheetName: sheet.name,
          addedAreas,
          addedPoints,
          totalPoints: ctx.project?.points.length ?? addedPoints,
          ...(ruleSkipped ? { skippedDrawingOnly: ruleSkipped, rule: DESIGN_RULE_TEXT } : {}),
        },
        summary: `已布置 ${addedAreas} 个房间、${addedPoints} 个点位${ruleSkipped ? `（按设计规范跳过 ${ruleSkipped} 项）` : ''}`,
        href: `/projects/${ctx.projectId}/point-map`,
        hrefLabel: '查看点位图',
      }
    },
  async search_products(args) {
      const catalog = await getCatalog()
      const q = typeof args.query === 'string' ? args.query.trim().toLowerCase() : ''
      const dt = typeof args.deviceType === 'string' ? args.deviceType.trim() : ''
      const brand = typeof args.brand === 'string' ? args.brand.trim().toLowerCase() : ''
      const platform = typeof args.platform === 'string' ? args.platform.trim().toLowerCase() : ''
      const maxPrice = typeof args.maxPrice === 'number' && args.maxPrice > 0 ? args.maxPrice : null

      const matched = catalog
        .filter((p) => (p.status ?? 'active') === 'active')
        .filter((p) => (!dt ? true : p.deviceType === dt))
        .filter((p) => (!brand ? true : (p.brand?.name ?? '').toLowerCase().includes(brand)))
        .filter((p) => (!platform ? true : p.platforms.some((pl) => pl.toLowerCase().includes(platform))))
        .filter((p) => (maxPrice === null ? true : p.price <= maxPrice))
        .filter((p) => (!q ? true : `${p.name} ${p.sku} ${p.brand?.name ?? ''} ${deviceTypeOf(p.deviceType ?? '')?.name ?? ''}`.toLowerCase().includes(q)))
        .slice(0, 15)
        .map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          brand: p.brand?.name ?? null,
          deviceType: p.deviceType,
          deviceTypeLabel: deviceTypeOf(p.deviceType ?? '')?.name ?? p.deviceType,
          platforms: p.platforms,
          price: p.price,
          cost: p.cost,
          unit: p.unit,
        }))

      return {
        result: { count: matched.length, products: matched },
        summary: `检索到 ${matched.length} 款产品`,
        href: '/products',
        hrefLabel: '打开产品库',
      }
    },
  async set_project_defaults(args, ctx) {
      if (!ctx.projectId) return { result: { error: '没有关联项目' }, summary: '未关联项目' }
      const payload = await getPayloadClient()
      const project = await payload
        .findByID({ collection: 'projects', id: ctx.projectId, depth: 0, user: ctx.user, overrideAccess: false, select: { status: true, defaultProducts: true } })
        .catch(() => null)
      if (!project || project.status === 'archived') return { result: { error: '项目不可用或已归档' }, summary: '项目不可修改' }

      const catalog = await getCatalog()
      const byId = new Map(catalog.map((p) => [p.id, p]))
      const defaults = parseDefaults(project.defaultProducts)
      const rawItems = Array.isArray(args.items) ? (args.items as { deviceType?: unknown; productId?: unknown }[]) : []
      const updated: { deviceType: string; productName: string; price: number }[] = []

      for (const it of rawItems) {
        const dt = typeof it.deviceType === 'string' && isDeviceType(it.deviceType) ? it.deviceType : null
        const pid = typeof it.productId === 'string' ? it.productId : null
        const prod = pid ? byId.get(pid) : null
        if (!dt || !prod) continue
        defaults[dt] = prod.id
        updated.push({ deviceType: deviceTypeOf(dt)?.name ?? dt, productName: prod.name, price: prod.price })
      }
      if (!updated.length) return { result: { error: '未匹配到有效的设备类型或产品 ID' }, summary: '未更新型号' }

      await payload.update({
        collection: 'projects',
        id: ctx.projectId,
        data: { defaultProducts: defaults },
        user: ctx.user,
        overrideAccess: false,
        depth: 0,
      })
      ctx.mutated = true
      await refreshContextProject(ctx, ctx.projectId)
      return {
        result: { updated },
        summary: `已更新 ${updated.length} 类设备的默认型号`,
        href: `/projects/${ctx.projectId}/point-map`,
        hrefLabel: '查看点位图',
      }
    },
  async get_project_details(_args, ctx) {
      if (!ctx.project || !ctx.projectId) {
        return { result: { error: '没有关联项目，请先新建或关联项目' }, summary: '未关联项目' }
      }
      const payload = await getPayloadClient()
      const quotes = await payload.find({
        collection: 'quotes',
        where: { project: { equals: ctx.projectId } },
        sort: '-updatedAt',
        limit: 5,
        depth: 0,
        user: ctx.user,
        overrideAccess: false,
        select: { title: true, status: true, discount: true, total: true, items: true, fees: true, notes: true },
      })
      return {
        result: {
          project: {
            id: ctx.projectId,
            name: ctx.project.project.name,
            customerName: ctx.project.project.customerName,
            customerPhone: ctx.project.project.customerPhone,
            community: ctx.project.project.community,
            address: ctx.project.project.address,
            platform: ctx.project.project.platform,
            budget: ctx.project.project.budget,
            totalPoints: ctx.project.points.length,
            pendingPoints: ctx.project.pending,
            equipmentTotal: ctx.project.total,
          },
          products: ctx.project.products.map((r) => ({
            deviceType: deviceTypeOf(r.deviceType)?.name ?? r.deviceType,
            name: r.product.name,
            brand: r.product.brand?.name ?? null,
            price: r.product.price,
            count: r.count,
            subtotal: r.subtotal,
            rooms: r.rooms,
          })),
          quotes: quotes.docs.map((q) => ({
            id: String(q.id),
            title: q.title,
            status: q.status,
            discount: q.discount,
            total: q.total,
            fees: q.fees ?? [],
            itemCount: (q.items ?? []).length,
          })),
          contract: ctx.project.contract
            ? {
                id: String(ctx.project.contract.id),
                number: ctx.project.contract.number,
                amount: ctx.project.contract.amount,
                status: ctx.project.contract.status,
                payments: ctx.project.contract.payments ?? [],
              }
            : null,
        },
        summary: `读取了 ${ctx.project.products.length} 项设备与 ${quotes.docs.length} 份报价`,
        href: `/projects/${ctx.projectId}`,
        hrefLabel: '查看项目',
      }
    },
  async create_or_update_quote(args, ctx) {
      if (!ctx.projectId) return { result: { error: '没有关联项目，请先新建或选择项目' }, summary: '未关联项目' }
      const payload = await getPayloadClient()
      const fees = Array.isArray(args.fees)
        ? (args.fees as { name?: unknown; amount?: unknown }[])
            .map((f) => ({
              name: typeof f.name === 'string' ? f.name.trim().slice(0, 60) : '',
              amount: typeof f.amount === 'number' && Number.isFinite(f.amount) && f.amount >= 0 ? Math.round(f.amount * 100) / 100 : 0,
            }))
            .filter((f) => f.name && f.amount > 0)
        : undefined

      // 修改已有报价单
      if (typeof args.quoteId === 'string' && args.quoteId.trim()) {
        const qid = args.quoteId.trim()
        const patch: Record<string, unknown> = {}
        if (typeof args.title === 'string' && args.title.trim()) patch.title = args.title.trim().slice(0, 60)
        const nextStatus = parseQuoteStatus(args.status)
        if (nextStatus) patch.status = nextStatus
        if (typeof args.discount === 'number' && args.discount >= 0) patch.discount = Math.round(args.discount * 100) / 100
        if (fees !== undefined) patch.fees = fees
        if (typeof args.notes === 'string') patch.notes = args.notes.trim().slice(0, 2000) || null

        const updated = await payload.update({
          collection: 'quotes',
          id: qid,
          data: patch as never,
          user: ctx.user,
          overrideAccess: false,
          depth: 0,
        })
        ctx.mutated = true
        await refreshContextProject(ctx, ctx.projectId)
        return {
          result: { quoteId: String(updated.id), title: updated.title, status: updated.status, total: updated.total, discount: updated.discount },
          summary: `已更新「${updated.title}」（合计 ¥${updated.total}）`,
          href: `/projects/${ctx.projectId}/quotes/${updated.id}`,
          hrefLabel: '查看报价单',
        }
      }

      // 新建报价单
      const project = await payload
        .findByID({ collection: 'projects', id: ctx.projectId, depth: 0, user: ctx.user, overrideAccess: false, select: { name: true, status: true, platform: true, pointMap: true, defaultProducts: true } })
        .catch(() => null)
      if (!project) return { result: { error: '项目不存在或无权限' }, summary: '项目不可用' }
      if (project.status === 'archived') return { result: { error: '项目已归档，不能新建报价' }, summary: '项目已归档' }

      const elements = ((project.pointMap as { elements?: unknown[] } | null)?.elements ?? []) as { isDeleted?: boolean; customData?: PointCustomData }[]
      const allPoints = elements.filter((el) => !el?.isDeleted && isPointData(el?.customData)).map((el) => el.customData!)
      const catalog = await getCatalog()
      const byId = new Map(catalog.map((p) => [p.id, p]))
      const points = allPoints.filter((cd) => inPointScope(pointDeviceType(cd, byId), 'all'))
      const summary = summarizePoints(points, byId, fillDefaultProducts(parseDefaults(project.defaultProducts), catalog, project.platform))
      const items = [...summary.products.entries()]
        .map(([id, row]) => ({ p: byId.get(id)!, row }))
        .sort((a, b) => DEVICE_TYPE_ORDER.indexOf(a.p.deviceType ?? a.row.deviceType) - DEVICE_TYPE_ORDER.indexOf(b.p.deviceType ?? b.row.deviceType))
        .map(({ p, row }) => ({
          product: p.id,
          deviceType: (p.deviceType ?? row.deviceType) as never,
          image: p.image?.id ?? null,
          name: p.name,
          sku: p.sku,
          unit: p.unit,
          price: p.price,
          quantity: row.count,
        }))

      if (items.length === 0) {
        return {
          result: { error: '当前项目还没有已选型的点位。请先调用 setup_rooms_and_points 布置点位，并调用 smart_select(apply=true) 配好默认型号后再生成报价。' },
          summary: '点位尚未选型',
          href: `/projects/${ctx.projectId}/point-map`,
        }
      }

      const company = await getCompanyInfo(ctx.user.id)
      const existing = await payload.count({ collection: 'quotes', where: { project: { equals: ctx.projectId } }, user: ctx.user, overrideAccess: false })
      const title = typeof args.title === 'string' && args.title.trim() ? args.title.trim().slice(0, 60) : `报价 ${existing.totalDocs + 1}`
      const discount = typeof args.discount === 'number' && args.discount >= 0 ? Math.round(args.discount * 100) / 100 : 0
      const notes = typeof args.notes === 'string' && args.notes.trim() ? args.notes.trim().slice(0, 2000) : (company.quoteNotes ?? null)
      const status = parseQuoteStatus(args.status) ?? 'draft'

      const quote = await payload.create({
        collection: 'quotes',
        data: { title, project: ctx.projectId, status, items, fees: fees ?? [], discount, notes },
        user: ctx.user,
        overrideAccess: false,
        depth: 0,
      })
      ctx.mutated = true
      await refreshContextProject(ctx, ctx.projectId)
      return {
        result: {
          quoteId: String(quote.id),
          title: quote.title,
          status: quote.status,
          itemCount: items.length,
          pendingPoints: summary.pendingTotal,
          total: quote.total,
        },
        summary: `已生成「${quote.title}」（合计 ¥${quote.total}）`,
        href: `/projects/${ctx.projectId}/quotes/${quote.id}`,
        hrefLabel: '打开报价单',
      }
    },
  async create_or_update_contract(args, ctx) {
      if (!ctx.projectId) return { result: { error: '没有关联项目，请先新建或选择项目' }, summary: '未关联项目' }
      const payload = await getPayloadClient()
      const [project, existingContracts, quotesRes, company] = await Promise.all([
        payload.findByID({ collection: 'projects', id: ctx.projectId, depth: 0, user: ctx.user, overrideAccess: false }).catch(() => null),
        payload.find({ collection: 'contracts', where: { project: { equals: ctx.projectId } }, limit: 1, depth: 0, user: ctx.user, overrideAccess: false }),
        payload.find({ collection: 'quotes', where: { project: { equals: ctx.projectId } }, sort: '-updatedAt', limit: 5, depth: 0, user: ctx.user, overrideAccess: false }),
        getCompanyInfo(ctx.user.id),
      ])
      if (!project) return { result: { error: '项目不存在或无权限' }, summary: '项目不可用' }

      let contract = existingContracts.docs[0] ?? null
      const targetQuoteId = typeof args.quoteId === 'string' && args.quoteId.trim() ? args.quoteId.trim() : null
      const quote = (targetQuoteId ? quotesRes.docs.find((q) => String(q.id) === targetQuoteId) : null) ?? quotesRes.docs[0] ?? null

      if (!contract) {
        if (!quote) {
          return {
            result: { error: '该项目还没有报价单，请先调用 create_or_update_quote 生成报价单后再创建合同' },
            summary: '缺少报价单',
            href: `/projects/${ctx.projectId}/quotes`,
          }
        }
        contract = await payload.create({
          collection: 'contracts',
          data: {
            project: project.id,
            quote: quote.id,
            status: 'draft',
            amount: quote.total ?? 0,
            customerName: project.customerName ?? null,
            customerPhone: project.customerPhone ?? null,
            address: [project.community, project.address].filter(Boolean).join(' ') || null,
            durationDays: DEFAULT_DURATION_DAYS,
            warrantyMonths: DEFAULT_WARRANTY_MONTHS,
            payments: DEFAULT_PAYMENTS.map((p) => ({ name: p.name, percent: p.percent, received: false })),
            terms: company.contractTerms?.trim() || DEFAULT_CONTRACT_TERMS,
          } as never,
          user: ctx.user,
          overrideAccess: false,
          depth: 0,
        })
      }

      const patch: Record<string, unknown> = {}
      if (contract.status !== 'signed') {
        if (typeof args.amount === 'number' && args.amount >= 0) patch.amount = Math.round(args.amount * 100) / 100
        if (typeof args.durationDays === 'number' && args.durationDays >= 1 && args.durationDays <= 365) patch.durationDays = Math.round(args.durationDays)
        if (typeof args.warrantyMonths === 'number' && args.warrantyMonths >= 0 && args.warrantyMonths <= 120) patch.warrantyMonths = Math.round(args.warrantyMonths)
        if (typeof args.terms === 'string' && args.terms.trim()) patch.terms = args.terms.trim().slice(0, 5000)
        if (Array.isArray(args.payments) && args.payments.length > 0 && args.payments.length <= 6) {
          const parsed = (args.payments as { name?: unknown; percent?: unknown; received?: unknown }[])
            .map((p) => ({
              name: typeof p.name === 'string' ? p.name.trim().slice(0, 40) : '',
              percent: typeof p.percent === 'number' ? Math.round(p.percent * 100) / 100 : 0,
              received: Boolean(p.received),
            }))
            .filter((p) => p.name && p.percent >= 0 && p.percent <= 100)
          if (parsed.length && Math.abs(paymentPercentTotal(parsed) - 100) < 0.01) {
            patch.payments = parsed
          }
        }
      } else if (Array.isArray(args.payments)) {
        const receivedFlags = (args.payments as { received?: unknown }[]).map((p) => Boolean(p?.received))
        patch.payments = (contract.payments ?? []).map((p, i) => ({
          id: p.id,
          name: p.name,
          percent: p.percent,
          received: receivedFlags[i] ?? Boolean(p.received),
        }))
      }
      if (isContractStatus(args.status) && args.status !== contract.status) {
        patch.status = args.status
        if (args.status === 'signed') patch.signedAt = new Date().toISOString()
      }

      if (Object.keys(patch).length > 0) {
        contract = await payload.update({
          collection: 'contracts',
          id: contract.id,
          data: patch as never,
          user: ctx.user,
          overrideAccess: false,
          depth: 0,
        })
      }

      ctx.mutated = true
      await refreshContextProject(ctx, ctx.projectId)
      return {
        result: {
          contractId: String(contract.id),
          number: contract.number,
          status: contract.status,
          amount: contract.amount,
          payments: contract.payments ?? [],
        },
        summary: `合同「${contract.number}」（¥${contract.amount}，${contract.status === 'signed' ? '已签订' : '草稿'}）`,
        href: `/projects/${ctx.projectId}/contract`,
        hrefLabel: '打开合同页',
      }
    },
  async get_document_links(args, ctx) {
      if (!ctx.projectId || !ctx.project) return { result: { error: '没有关联项目' }, summary: '未关联项目' }
      const style = typeof args.style === 'string' && ['qixu', 'business', 'oriental', 'tech', 'minimal'].includes(args.style) ? args.style : 'qixu'
      const pid = ctx.projectId
      const qid = ctx.project.quote ? String(ctx.project.quote.id) : null
      const cid = ctx.project.contract ? String(ctx.project.contract.id) : null
      const links = {
        plans: `/print/projects/${pid}/plans?style=${style}`,
        checklist: `/print/projects/${pid}/checklist?style=${style}`,
        proposalQixu: `/print/projects/${pid}/proposal?template=qixu`,
        quote: qid ? `/print/quotes/${qid}?style=${style}` : null,
        contract: cid ? `/print/contracts/${cid}?style=${style}` : null,
        archive: `/projects/${pid}/archive`,
      }
      return {
        result: { project: ctx.project.project.name, style, links },
        summary: `已生成「${ctx.project.project.name}」的文档打印链接`,
        href: `/projects/${pid}/archive`,
        hrefLabel: '打开项目归档与文档页',
      }
    },
  async generate_image(args, ctx) {
      const prompt = typeof args.prompt === 'string' ? args.prompt.trim() : ''
      if (!prompt) throw new Error('请提供图片描述')
      if (prompt.length > 2000) throw new Error('图片描述最多 2000 字')
      const model = IMAGE_MODELS[0]
      const size = typeof args.size === 'string' && (model.sizes as readonly string[]).includes(args.size) ? args.size : model.sizes[0]
      const payload = await getPayloadClient()
      const fresh = await payload.findByID({ collection: 'users', id: ctx.user.id, depth: 0, overrideAccess: true, select: { aiCredits: true } })
      if ((fresh.aiCredits ?? 0) < model.cost) throw new Error(`积分不足，本模型需要 ${model.cost} 积分`)
      const image = await generateImage({ prompt, model: model.id as never, size, userId: ctx.user.id })
      let balance: number | null = null
      try {
        const entry = await payload.create({
          collection: 'ai-credit-ledger',
          data: { user: ctx.user.id, delta: -model.cost, reason: `AI 生图 · ${model.name} · ${prompt.slice(0, 40)}` },
          overrideAccess: true,
          depth: 0,
        })
        balance = entry.balanceAfter ?? null
      } catch {
        // 图片已生成，扣费失败不影响返回
      }
      return {
        result: { ...image, cost: model.cost, balance },
        summary: `已生成图片（${model.cost} 积分${balance != null ? `，余额 ${balance}` : ''}）`,
        href: image.url,
        hrefLabel: '查看图片',
        imageUrl: image.url,
      }
    },
}
