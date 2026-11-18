'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ImageIcon, Save, Upload, X } from 'lucide-react'

import { Button } from '@astryxdesign/core/Button'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Field } from '@astryxdesign/core/Field'
import { Card } from '@astryxdesign/core/Card'
import { Layout, LayoutContent, LayoutHeader } from '@astryxdesign/core/Layout'
import { Stack } from '@astryxdesign/core/Stack'
import { Switch } from '@astryxdesign/core/Switch'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useToast } from '@astryxdesign/core/Toast'

import { registerLeaveGuard } from '@/lib/leave-guard'

import {
  DocumentTemplateSettings,
  type DocKindOption,
  type DocStyleOption,
} from './document-plugin-settings'
import { SquareCropDialog } from './square-crop-dialog'

type Values = {
  name: string
  slogan: string
  phone: string
  email: string
  address: string
  qrCaption: string
  quoteNotes: string
  contractTerms: string
  printProductImages: boolean
  logoUrl: string | null
  qrCodeUrl: string | null
}

/** 官方 TextInput 没有 maxLength（受控，长度由这里截断；服务端仍会二次校验）。 */
type TextKey = 'name' | 'slogan' | 'phone' | 'email' | 'address' | 'qrCaption'

type TextFieldOptions = Partial<
  Pick<React.ComponentProps<typeof TextInput>, 'type' | 'inputMode' | 'placeholder' | 'isRequired'>
> & { max: number }

function ImageField({
  name,
  label,
  url,
  hint,
  squareCrop,
  onChange,
}: {
  name: 'logo' | 'qrCode'
  label: string
  url: string | null
  hint: string
  squareCrop?: boolean
  /** 选了新文件或点了移除时通知父级：表单有了未保存修改。 */
  onChange?: () => void
}) {
  const [preview, setPreview] = useState(url)
  const [removed, setRemoved] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [cropping, setCropping] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const apply = (f: File) => {
    setPreview(URL.createObjectURL(f))
    setFileName(f.name)
    setRemoved(false)
    onChange?.()
  }
  return (
    <Field label={label} inputID={name}>
      <div className="flex items-center gap-3">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={label} className="size-full object-contain" />
          ) : (
            <ImageIcon className="size-6 text-muted-foreground/60" />
          )}
        </div>
        <div className="grid flex-1 gap-1.5">
          {/* 原生文件框的按钮文字由浏览器决定（常显示英文），这里隐藏原生控件、用中文按钮代替 */}
          <input
            ref={inputRef}
            id={name}
            name={name}
            type="file"
            className="peer sr-only"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) return
              if (squareCrop) setCropping(f)
              else apply(f)
            }}
          />
          <div className="flex min-w-0 items-center gap-2">
            <label
              htmlFor={name}
              className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring hover:bg-accent"
            >
              <Upload className="size-3.5" />
              {preview ? '更换图片' : '选择图片'}
            </label>
            <span className="truncate text-sm text-muted-foreground">
              {fileName ?? (preview ? '已上传' : '未选择文件')}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        {preview ? (
          <IconButton
            type="button"
            variant="ghost"

            aria-label={`移除${label}`}
            onClick={() => {
              setPreview(null)
              setFileName(null)
              setRemoved(true)
              onChange?.()
            }}
            label={`移除${label}`}
            icon={<X />}
            size="sm"
          />
        ) : null}
      </div>
      {removed ? <input type="hidden" name={`${name}Remove`} value="1" /> : null}
      {squareCrop ? (
        <SquareCropDialog
          file={cropping}
          onCancel={() => {
            // 放弃裁剪：清空本次选择，保留原来的图片
            if (inputRef.current) inputRef.current.value = ''
            setCropping(null)
          }}
          onDone={(f) => {
            const input = inputRef.current
            if (input) {
              const dt = new DataTransfer()
              dt.items.add(f)
              input.files = dt.files
            }
            apply(f)
            setCropping(null)
          }}
        />
      ) : null}
    </Field>
  )
}

export type PluginOption = {
  id: string
  name: string
  description: string
  categoryLabel: string
  status: 'ready' | 'coming-soon'
  enabled: boolean
}

export function CompanyForm({
  initial,
  documents,
  plugins,
}: {
  initial: Values
  plugins: PluginOption[]
  documents: {
    kinds: DocKindOption[]
    styles: DocStyleOption[]
    defaults: Record<string, { style?: string; layout?: string }>
  }
}) {
  const router = useRouter()
  const showToast = useToast()
  const [saving, setSaving] = useState(false)
  // 未保存修改：任一字段（含图片、文档模板、插件开关）变动时置 true；
  // 保存成功或点「撤销」后清除。保存条、beforeunload 和站内跳转守卫都看它。
  const [dirty, setDirty] = useState(false)
  // 撤销时 +1：图片和文档模板是子组件自己的 state，用 key 强制回到初始值
  const [resetKey, setResetKey] = useState(0)
  const [error, setError] = useState<{ message: string; field?: string } | null>(null)
  const [quoteNotes, setQuoteNotes] = useState(initial.quoteNotes)
  const [contractTerms, setContractTerms] = useState(initial.contractTerms)
  // 官方 TextInput 只有受控写法，6 个单行文本字段统一用一份 state
  const [values, setValues] = useState<Record<TextKey, string>>({
    name: initial.name,
    slogan: initial.slogan,
    phone: initial.phone,
    email: initial.email,
    address: initial.address,
    qrCaption: initial.qrCaption,
  })
  const [printProductImages, setPrintProductImages] = useState(initial.printProductImages)
  // 插件开关：默认全开（disabledPlugins 里没有即开启），未就绪的插件始终关闭且不提交
  const [pluginEnabled, setPluginEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(plugins.map((p) => [p.id, p.enabled])),
  )

  // 有未保存修改时：刷新/关页由 beforeunload 提醒，站内跳转交给 leave guard。
  // 保存成功或撤销后 dirty=false，effect 清理会自动注销两者。
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    const release = registerLeaveGuard(() =>
      window.confirm('品牌与联系设置还没有保存，确定离开吗？'),
    )
    return () => {
      window.removeEventListener('beforeunload', warn)
      release()
    }
  }, [dirty])

  /** 放弃本次所有修改，回到服务端下发的初始值。 */
  function undo() {
    setValues({
      name: initial.name,
      slogan: initial.slogan,
      phone: initial.phone,
      email: initial.email,
      address: initial.address,
      qrCaption: initial.qrCaption,
    })
    setQuoteNotes(initial.quoteNotes)
    setContractTerms(initial.contractTerms)
    setPrintProductImages(initial.printProductImages)
    setPluginEnabled(Object.fromEntries(plugins.map((p) => [p.id, p.enabled])))
    // 图片 input 的 FileList 无法直接清空，换 key 重新挂载；文档模板同理
    setResetKey((k) => k + 1)
    setError(null)
    setDirty(false)
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/settings/company', {
        method: 'POST',
        body: new FormData(e.currentTarget),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        field?: string
      }
      if (!res.ok || !data.ok)
        return setError({ message: data.error ?? '保存失败，请稍后重试', field: data.field })
      // 保存成功：清掉未保存状态（保存条随之消失、守卫注销），保留原有反馈
      setDirty(false)
      showToast({ body: '设置已保存' })
      router.refresh()
    } catch {
      setError({ message: '网络错误，请稍后重试' })
    } finally {
      setSaving(false)
    }
  }

  const field = (name: TextKey, label: string, { max, ...props }: TextFieldOptions) => (
    <TextInput
      id={name}
      label={label}
      htmlName={name}
      value={values[name]}
      onChange={(v) => {
        setValues((s) => ({ ...s, [name]: v.slice(0, max) }))
        setDirty(true)
      }}
      status={error?.field === name ? { type: 'error' } : undefined}
      {...props}
    />
  )

  return (
    <form
      onSubmit={submit}
      // dirty 时给保存条留出等高的底部空间，避免它遮住表单最后一行（含页尾保存按钮）
      className={dirty ? 'flex flex-col gap-4 pb-28' : 'flex flex-col gap-4'}
    >
      {error ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive-strong"
        >
          <AlertCircle className="size-4 shrink-0" />
          {error.message}
        </div>
      ) : null}
      <Card
        padding={0}
        className="border-0 bg-card text-sm text-card-foreground shadow-xs ring-1 ring-border"
      >
        <Layout
          height="auto"
          header={
            <LayoutHeader padding={5} paddingBlockEnd={0}>
              <div className="grid gap-1.5">
                <div className="font-heading text-base font-semibold tracking-tight">抬头</div>
                <div className="text-sm text-muted-foreground">
                  用于报价单、方案、合同页眉及侧边栏标识
                </div>
              </div>
            </LayoutHeader>
          }
          content={
            <LayoutContent padding={5} isScrollable={false}>
              <div className="grid gap-4 md:grid-cols-2">
                {field('name', '名称', {
                  max: 60,
                  isRequired: true,
                  placeholder: '公司、工作室或个人名称',
                })}
                {field('slogan', '副标题', { max: 80 })}
                <div className="md:col-span-2">
                  <ImageField
                    key={`logo-${resetKey}`}
                    name="logo"
                    label="Logo"
                    url={initial.logoUrl}
                    hint="PNG 或 SVG，透明背景，≤ 3MB"
                    onChange={() => setDirty(true)}
                  />
                </div>
              </div>
            </LayoutContent>
          }
        />
      </Card>
      <Card
        padding={0}
        className="border-0 bg-card text-sm text-card-foreground shadow-xs ring-1 ring-border"
      >
        <Layout
          height="auto"
          header={
            <LayoutHeader padding={5} paddingBlockEnd={0}>
              <div className="grid gap-1.5">
                <div className="font-heading text-base font-semibold tracking-tight">联系方式</div>
                <div className="text-sm text-muted-foreground">用于报价单页脚与合同乙方信息</div>
              </div>
            </LayoutHeader>
          }
          content={
            <LayoutContent padding={5} isScrollable={false}>
              <div className="grid gap-4 md:grid-cols-2">
                {field('phone', '联系电话', { inputMode: 'tel', max: 30 })}
                {field('email', '邮箱', { type: 'email', max: 80 })}
                <div className="md:col-span-2">{field('address', '地址', { max: 200 })}</div>
                <div className="md:col-span-2">
                  <ImageField
                    key={`qr-${resetKey}`}
                    name="qrCode"
                    label="二维码"
                    url={initial.qrCodeUrl}
                    hint="微信或公众号二维码，上传后可裁剪为正方形"
                    squareCrop
                    onChange={() => setDirty(true)}
                  />
                </div>
                {field('qrCaption', '二维码说明', {
                  max: 40,
                  placeholder: '扫码添加微信',
                })}
              </div>
            </LayoutContent>
          }
        />
      </Card>
      <Card
        padding={0}
        className="border-0 bg-card text-sm text-card-foreground shadow-xs ring-1 ring-border"
      >
        <Layout
          height="auto"
          header={
            <LayoutHeader padding={5} paddingBlockEnd={0}>
              <div className="grid gap-1.5">
                <div className="font-heading text-base font-semibold tracking-tight">默认内容</div>
                <div className="text-sm text-muted-foreground">新建报价与合同时自动带入</div>
              </div>
            </LayoutHeader>
          }
          content={
            <LayoutContent padding={5} isScrollable={false}>
              <div className="grid gap-5">
                <Field label="报价备注" inputID="quoteNotes">
                  <TextArea
                    id="quoteNotes"
                    label="报价备注"
                    isLabelHidden
                    value={quoteNotes}
                    onChange={(v) => {
                      setQuoteNotes(v)
                      setDirty(true)
                    }}
                    htmlName="quoteNotes"
                    rows={3}
                    maxLength={2000}
                    placeholder="例如：报价有效期 30 天；设备质保一年，含一年免费上门维护"
                  />
                </Field>
                <Field label="合同条款" inputID="contractTerms">
                  <TextArea
                    id="contractTerms"
                    label="合同条款"
                    isLabelHidden
                    value={contractTerms}
                    onChange={(v) => {
                      setContractTerms(v)
                      setDirty(true)
                    }}
                    htmlName="contractTerms"
                    rows={7}
                    maxLength={5000}
                    controlClassName="leading-relaxed"
                  />
                </Field>
                <Switch
                  label="打印报价单时显示产品缩略图"
                  value={printProductImages}
                  onChange={(v) => {
                    setPrintProductImages(v)
                    setDirty(true)
                  }}
                  htmlName="printProductImages"
                  labelPosition="start"
                  labelSpacing="spread"
                  width="100%"
                  className="rounded-lg border p-3"
                />
              </div>
            </LayoutContent>
          }
        />
      </Card>
      <DocumentTemplateSettings
        key={`docs-${resetKey}`}
        kinds={documents.kinds}
        styles={documents.styles}
        defaults={documents.defaults}
        onChange={() => setDirty(true)}
      />
      <Card
        padding={0}
        className="border-0 bg-card text-sm text-card-foreground shadow-xs ring-1 ring-border"
      >
        <Layout
          height="auto"
          header={
            <LayoutHeader padding={5} paddingBlockEnd={0}>
              <div className="grid gap-1.5">
                <div className="font-heading text-base font-semibold tracking-tight">插件</div>
                <div className="text-sm text-muted-foreground">
                  关闭后侧边栏与页面入口会隐藏，随时可以重新打开；改动随底部「保存」生效
                </div>
              </div>
            </LayoutHeader>
          }
          content={
            <LayoutContent padding={5} isScrollable={false}>
              {/* 告诉服务端本次提交带插件开关；未勾选的插件会被记为关闭 */}
              <input type="hidden" name="plugins-present" value="1" />
              <Stack gap={3}>
                {plugins.map((plugin) => {
                  const isReady = plugin.status === 'ready'
                  return (
                    <Switch
                      key={plugin.id}
                      label={plugin.name}
                      description={`${plugin.categoryLabel} · ${plugin.description}${
                        isReady ? '' : '（未就绪）'
                      }`}
                      value={pluginEnabled[plugin.id] ?? false}
                      onChange={(checked) => {
                        setPluginEnabled((s) => ({ ...s, [plugin.id]: checked }))
                        setDirty(true)
                      }}
                      htmlName={`plugin-${plugin.id}`}
                      isDisabled={!isReady}
                      disabledMessage={isReady ? undefined : '功能尚未就绪，暂不可开启'}
                      labelPosition="start"
                      labelSpacing="spread"
                      width="100%"
                      className="rounded-lg border p-3"
                    />
                  )
                })}
              </Stack>
            </LayoutContent>
          }
        />
      </Card>
      {/*
        表单末尾的保存按钮保留：用户滚到底仍可保存。
        但设置页很长（外观 / 品牌 / 文档模板 / 插件 / 成本），改完名称时它可能在
        好几屏之外，所以有未保存修改时再出现一条固定的保存条。
      */}
      <div className="flex justify-end border-t border-border pt-4">
        <Button type="submit" isLoading={saving} icon={<Save />} label="保存" />
      </div>

      {/*
        保存条（仅在 dirty 时出现）：
        - fixed 吸底，不随页面滚动；实心 bg-background + 上边框 + 阴影，
          避免背后卡片的标题从半透明背景里透出来。
        - 必须放在 <form> 内部：主按钮是 type=submit，提交同一张表单。
        - inset-x-0 + 内部 max-w-5xl + flex-wrap，375px 窄屏不横向溢出。
        表单在 dirty 时加了 pb-28，底部字段不会被这条盖住。
      */}
      {dirty ? (
        <div
          data-testid="settings-save-bar"
          role="region"
          aria-label="未保存的修改"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background shadow-[0_-4px_16px_rgba(0,0,0,0.12)]"
        >
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
            <span className="text-sm font-medium text-foreground">有未保存的修改</span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                label="撤销"
                onClick={undo}
                isDisabled={saving}
              />
              <Button type="submit" isLoading={saving} icon={<Save />} label="保存" />
            </div>
          </div>
        </div>
      ) : null}
    </form>
  )
}
