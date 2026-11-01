'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { AlertCircle, CheckCircle2, KeyRound, Loader2, LogIn, Mail, QrCode, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const LOGIN_METHOD_KEY = 'fmkj-login-method'
const rememberMethod = (method: 'wechat' | 'password') => {
  try {
    window.localStorage.setItem(LOGIN_METHOD_KEY, method)
  } catch {}
}

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [loginTab, setLoginTab] = useState<'wechat' | 'password'>('wechat')
  // 记住上次成功登录的方式：用邮箱登录过的人下次直接看到邮箱表单（预览环境里扫码登录不可用）
  useEffect(() => {
    try {
      if (window.localStorage.getItem(LOGIN_METHOD_KEY) === 'password') setLoginTab('password')
    } catch {}
  }, [])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // 小程序扫码登录状态
  const [qrTicket, setQrTicket] = useState<string | null>(null)
  const [qrImage, setQrImage] = useState<string | null>(null)
  const [qrStatus, setQrStatus] = useState<'loading' | 'pending' | 'confirmed' | 'expired'>('loading')

  const createQr = useCallback(async () => {
    setQrStatus('loading')
    setError('')
    try {
      const res = await fetch('/auth/wechat/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirectTo }),
      })
      const data = (await res.json().catch(() => null)) as { ok?: boolean; ticket?: string; qrImage?: string } | null
      if (!res.ok || !data?.ok || !data.ticket || !data.qrImage) {
        setQrStatus('expired')
        return
      }
      setQrTicket(data.ticket)
      setQrImage(data.qrImage)
      setQrStatus('pending')
    } catch {
      setQrStatus('expired')
    }
  }, [redirectTo])

  useEffect(() => {
    if (loginTab === 'wechat') void createQr()
  }, [loginTab, createQr])

  useEffect(() => {
    if (loginTab !== 'wechat' || qrStatus !== 'pending' || !qrTicket) return
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/auth/wechat/qr?ticket=${encodeURIComponent(qrTicket)}`, { cache: 'no-store' })
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean
          status?: 'pending' | 'confirmed' | 'expired'
          redirectTo?: string
          error?: string
        } | null
        if (!data) return
        if (data.status === 'confirmed') {
          setQrStatus('confirmed')
          clearInterval(timer)
          rememberMethod('wechat')
          window.location.assign(data.redirectTo || redirectTo)
        } else if (data.status === 'expired') {
          setQrStatus('expired')
          if (data.error) setError(data.error)
          clearInterval(timer)
        }
      } catch {
        // 忽略偶发网络抖动，继续轮询
      }
    }, 1500)
    return () => clearInterval(timer)
  }, [loginTab, qrStatus, qrTicket, redirectTo])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!email.trim() || !password) {
      setError('请输入邮箱和密码')
      return
    }
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        setError(data.error ?? '登录失败，请重试')
        setLoading(false)
        return
      }
      rememberMethod('password')
      window.location.assign(redirectTo)
    } catch {
      setError('网络错误，请稍后重试')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center lg:text-left">
        <h1 className="text-2xl font-semibold tracking-tight">欢迎回来</h1>
        <p className="text-sm text-muted-foreground">用微信小程序扫码，或输入邮箱和密码登录</p>
      </div>

      <Tabs
        value={loginTab}
        onValueChange={(v) => {
          setLoginTab(v === 'password' ? 'password' : 'wechat')
          setError('')
        }}
        className="gap-6"
      >
        <TabsList className="w-full">
          <TabsTrigger value="wechat">
            <QrCode className="size-3.5" />
            微信扫码登录
          </TabsTrigger>
          <TabsTrigger value="password">
            <Mail className="size-3.5" />
            邮箱密码登录
          </TabsTrigger>
        </TabsList>

        <TabsContent value="wechat" className="space-y-4">
          {error ? (
            <div role="alert" className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive-strong">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          ) : null}
          <div className="flex flex-col items-center gap-3 rounded-xl border bg-muted/20 p-6 text-center">
            {/* 二维码需要白底才能被稳定识别，深色模式下也保持白底 */}
            <div className="relative flex size-48 items-center justify-center overflow-hidden rounded-xl border bg-white p-2 shadow-2xs">
              {qrStatus === 'loading' ? (
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              ) : qrImage ? (
                <Image src={qrImage} alt="微信小程序扫码登录" width={176} height={176} unoptimized className="size-full object-contain" />
              ) : null}

              {qrStatus === 'expired' ? (
                <Button
                  variant="ghost"
                  onClick={() => void createQr()}
                  className="absolute inset-0 h-auto flex-col gap-2 rounded-none bg-background/90 text-xs backdrop-blur-xs hover:bg-background/95"
                >
                  <RefreshCw className="size-5 text-primary" />
                  <span>二维码已过期，点击刷新</span>
                </Button>
              ) : qrStatus === 'confirmed' ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/95 text-xs font-medium text-success">
                  <CheckCircle2 className="size-6" />
                  <span>扫码成功，正在进入工作台…</span>
                </div>
              ) : null}
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium">请使用微信小程序扫码登录</div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                打开小程序「我的 → 扫码登录」或直接用微信扫一扫
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="password">
          <form className="space-y-4" onSubmit={submit} noValidate>
            {error ? (
              <div role="alert" className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive-strong">
                <AlertCircle className="size-4 shrink-0" />
                {error}
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="email">邮箱</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  className="h-10 pl-9"
                  type="email"
                  placeholder="name@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setError('')
                  }}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">密码</Label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  className="h-10 pl-9"
                  type="password"
                  placeholder="输入密码"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError('')
                  }}
                />
              </div>
            </div>
            <Button type="submit" className="h-10 w-full" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
              {loading ? '登录中' : '登录'}
            </Button>
          </form>
        </TabsContent>
      </Tabs>
      <p className="text-center text-sm text-muted-foreground">没有账号？请联系团队负责人开通</p>
    </div>
  )
}
