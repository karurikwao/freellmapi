import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { PageHeader } from '@/components/page-header'
import type { ApiKey, Platform } from '../../../shared/types'

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'google', label: 'Google AI Studio' },
  { value: 'groq', label: 'Groq' },
  { value: 'cerebras', label: 'Cerebras' },
  { value: 'sambanova', label: 'SambaNova' },
  { value: 'nvidia', label: 'NVIDIA NIM' },
  { value: 'mistral', label: 'Mistral' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'github', label: 'GitHub Models' },
  { value: 'cohere', label: 'Cohere' },
  { value: 'cloudflare', label: 'Cloudflare Workers AI' },
  { value: 'zhipu', label: 'Zhipu AI (Z.ai)' },
  { value: 'ollama', label: 'Ollama Cloud' },
  { value: 'kilo', label: 'Kilo Gateway (anon ok)' },
  { value: 'pollinations', label: 'Pollinations (anon ok)' },
  { value: 'llm7', label: 'LLM7 (anon ok)' },
  { value: 'huggingface', label: 'HuggingFace Router' },
]

const REFRESH_INTERVAL_MS = 10000
const PROVIDER_ID = 'freellmapi'
const PROVIDER_NAME = 'FreeLLMAPI'
const CLIENT_MODEL_ALIASES = [
  { id: 'freellmapi/opencode-agent', name: 'OpenCode agent (recommended)' },
  { id: 'auto', name: 'Auto (fallback chain)' },
  { id: 'freellmapi/auto', name: 'Auto (slash alias)' },
]

const statusDot: Record<string, string> = {
  healthy: 'bg-emerald-500',
  rate_limited: 'bg-amber-500',
  invalid: 'bg-rose-500',
  error: 'bg-rose-500',
  unknown: 'bg-muted-foreground/40',
}

const statusLabel: Record<string, string> = {
  healthy: 'healthy',
  rate_limited: 'rate-limited',
  invalid: 'invalid',
  error: 'error',
  unknown: 'unchecked',
}

interface HealthPlatform {
  platform: string
  totalKeys: number
  healthyKeys: number
  rateLimitedKeys: number
  invalidKeys: number
  errorKeys: number
  unknownKeys: number
}

interface HealthData {
  platforms: HealthPlatform[]
  keys: { id: number; platform: string; status: string; lastCheckedAt: string | null }[]
}

function getBaseUrl() {
  return import.meta.env.DEV
    ? `http://${window.location.hostname}:${__SERVER_PORT__}/v1`
    : `${window.location.origin}/v1`
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return
  } catch {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  }
}

interface ProviderModel {
  modelDbId: number
  priority: number
  enabled: boolean
  platform: Platform
  modelId: string
  displayName: string
  intelligenceRank: number
  speedRank: number
  sizeLabel: string
  rpmLimit: number | null
  rpdLimit: number | null
  monthlyTokenBudget: string
  keyCount: number
}

function UnifiedKeySection() {
  const queryClient = useQueryClient()
  const [showKey, setShowKey] = useState(false)
  const [copied, setCopied] = useState(false)

  const { data } = useQuery<{ apiKey: string }>({
    queryKey: ['unified-key'],
    queryFn: () => apiFetch('/api/settings/api-key'),
  })

  const regenerate = useMutation({
    mutationFn: () => apiFetch('/api/settings/api-key/regenerate', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['unified-key'] }),
  })

  const apiKey = data?.apiKey ?? ''
  const masked = apiKey ? apiKey.slice(0, 13) + '•'.repeat(32) : '…'
  const baseUrl = getBaseUrl()

  function copy() {
    copyToClipboard(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h2 className="text-sm font-medium">Your unified API key</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Use this as your OpenAI <code className="font-mono">api_key</code>; it authenticates requests to this proxy.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => regenerate.mutate()}
          disabled={regenerate.isPending}
        >
          Regenerate
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <code className="flex-1 font-mono text-xs bg-muted px-3 py-2 rounded-md select-all truncate tabular-nums">
          {showKey ? apiKey : masked}
        </code>
        <Button variant="outline" size="sm" onClick={() => setShowKey(!showKey)}>
          {showKey ? 'Hide' : 'Show'}
        </Button>
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
        <span className="text-muted-foreground">Base URL</span>
        <code className="font-mono">{baseUrl}</code>
        <span className="text-muted-foreground">Endpoint</span>
        <code className="font-mono">/v1/chat/completions</code>
      </div>
    </section>
  )
}

function ClientSetupSection({ fallbackEntries }: { fallbackEntries: ProviderModel[] }) {
  const [showKey, setShowKey] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const { data } = useQuery<{ apiKey: string }>({
    queryKey: ['unified-key'],
    queryFn: () => apiFetch('/api/settings/api-key'),
  })

  const apiKey = data?.apiKey ?? ''
  const baseUrl = getBaseUrl()
  const clientModels = [
    ...CLIENT_MODEL_ALIASES,
    ...fallbackEntries
      .filter(entry => entry.enabled && entry.keyCount > 0)
      .map(entry => ({ id: entry.modelId, name: entry.displayName })),
  ]
  const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
  const providerConfig = {
    providerId: PROVIDER_ID,
    displayName: PROVIDER_NAME,
    baseUrl,
    apiKey,
    models: clientModels,
    headers,
  }
  const apiKeyDisplay = showKey && apiKey
    ? apiKey
    : apiKey
      ? `${apiKey.slice(0, 13)}${'•'.repeat(24)}`
      : 'Loading…'
  const authHeaderDisplay = showKey && apiKey
    ? `Authorization: Bearer ${apiKey}`
    : apiKey
      ? `Authorization: Bearer ${apiKey.slice(0, 13)}${'•'.repeat(24)}`
      : 'Authorization: Bearer <api-key>'

  function copy(value: string, label: string) {
    copyToClipboard(value)
    setCopied(label)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-sm font-medium">Custom provider setup</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Values for VS Code, OpenCode, and other OpenAI-compatible clients.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => copy(JSON.stringify(providerConfig, null, 2), 'config')}
          disabled={!apiKey}
        >
          {copied === 'config' ? 'Copied' : 'Copy config'}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground mb-1">Provider ID</div>
          <div className="flex items-center gap-2">
            <code className="font-mono text-xs truncate flex-1">{PROVIDER_ID}</code>
            <Button variant="ghost" size="xs" onClick={() => copy(PROVIDER_ID, 'providerId')}>
              {copied === 'providerId' ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground mb-1">Display name</div>
          <div className="flex items-center gap-2">
            <code className="font-mono text-xs truncate flex-1">{PROVIDER_NAME}</code>
            <Button variant="ghost" size="xs" onClick={() => copy(PROVIDER_NAME, 'displayName')}>
              {copied === 'displayName' ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground mb-1">Base URL</div>
          <div className="flex items-center gap-2">
            <code className="font-mono text-xs truncate flex-1">{baseUrl}</code>
            <Button variant="ghost" size="xs" onClick={() => copy(baseUrl, 'baseUrl')}>
              {copied === 'baseUrl' ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground mb-1">API key</div>
          <div className="flex items-center gap-2">
            <code className="font-mono text-xs truncate flex-1">{apiKeyDisplay}</code>
            <Button variant="ghost" size="xs" onClick={() => setShowKey(!showKey)}>
              {showKey ? 'Hide' : 'Show'}
            </Button>
            <Button variant="ghost" size="xs" onClick={() => copy(apiKey, 'apiKey')} disabled={!apiKey}>
              {copied === 'apiKey' ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-3 py-2 border-b">
          <div>
            <h3 className="text-xs font-medium">Models</h3>
            <p className="text-[11px] text-muted-foreground">
              Use <code className="font-mono">freellmapi/opencode-agent</code> for OpenCode, or pick a specific model ID.
            </p>
          </div>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => copy(clientModels.map(model => `${model.id}\t${model.name}`).join('\n'), 'models')}
          >
            {copied === 'models' ? 'Copied' : 'Copy models'}
          </Button>
        </div>
        <div className="max-h-56 overflow-auto divide-y">
          {clientModels.map(model => (
            <div key={model.id} className="grid grid-cols-[minmax(0,1fr)_minmax(120px,220px)] gap-3 px-3 py-2 text-xs">
              <code className="font-mono truncate">{model.id}</code>
              <span className="truncate text-muted-foreground">{model.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-lg border p-3">
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="text-xs text-muted-foreground">Headers (optional)</div>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => copy(apiKey ? `Authorization: Bearer ${apiKey}` : '', 'headers')}
            disabled={!apiKey}
          >
            {copied === 'headers' ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <code className="block font-mono text-xs truncate">{authHeaderDisplay}</code>
      </div>
    </section>
  )
}

export default function KeysPage() {
  const queryClient = useQueryClient()
  const [platform, setPlatform] = useState<Platform | ''>('')
  const [apiKey, setApiKey] = useState('')
  const [accountId, setAccountId] = useState('')
  const [label, setLabel] = useState('')

  const { data: keys = [], isLoading } = useQuery<ApiKey[]>({
    queryKey: ['keys'],
    queryFn: () => apiFetch('/api/keys'),
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchOnWindowFocus: true,
  })

  const { data: healthData } = useQuery<HealthData>({
    queryKey: ['health'],
    queryFn: () => apiFetch('/api/health'),
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchOnWindowFocus: true,
  })

  const {
    data: fallbackEntries = [],
    dataUpdatedAt: fallbackUpdatedAt,
  } = useQuery<ProviderModel[]>({
    queryKey: ['fallback'],
    queryFn: () => apiFetch('/api/fallback'),
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  })

  useEffect(() => {
    if (!platform && keys.length > 0) {
      setPlatform(keys[0].platform)
    }
  }, [keys, platform])

  const refreshSharedState = () => {
    queryClient.invalidateQueries({ queryKey: ['keys'] })
    queryClient.invalidateQueries({ queryKey: ['health'] })
    queryClient.invalidateQueries({ queryKey: ['fallback'] })
  }

  const addKey = useMutation({
    mutationFn: (body: { platform: string; key: string; label?: string }) =>
      apiFetch('/api/keys', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keys'] })
      queryClient.invalidateQueries({ queryKey: ['health'] })
      queryClient.invalidateQueries({ queryKey: ['fallback'] })
      setApiKey('')
      setAccountId('')
      setLabel('')
    },
  })

  const deleteKey = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/keys/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keys'] })
      queryClient.invalidateQueries({ queryKey: ['health'] })
      queryClient.invalidateQueries({ queryKey: ['fallback'] })
    },
  })

  const checkAll = useMutation({
    mutationFn: () => apiFetch('/api/health/check-all', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health'] })
      queryClient.invalidateQueries({ queryKey: ['keys'] })
    },
  })

  const checkKey = useMutation({
    mutationFn: (keyId: number) => apiFetch(`/api/health/check/${keyId}`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health'] })
      queryClient.invalidateQueries({ queryKey: ['keys'] })
    },
  })

  const togglePlatform = useMutation({
    mutationFn: ({ platform, enabled }: { platform: string; enabled: boolean }) =>
      apiFetch(`/api/keys/platform/${platform}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keys'] })
      queryClient.invalidateQueries({ queryKey: ['health'] })
      queryClient.invalidateQueries({ queryKey: ['fallback'] })
    },
  })

  const updateFallback = useMutation({
    mutationFn: ({ modelDbId, enabled }: { modelDbId: number; enabled: boolean }) =>
      apiFetch(`/api/fallback/models/${modelDbId}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      }),
    onMutate: async ({ modelDbId, enabled }) => {
      await queryClient.cancelQueries({ queryKey: ['fallback'] })
      const previous = queryClient.getQueryData<ProviderModel[]>(['fallback'])
      queryClient.setQueryData<ProviderModel[]>(['fallback'], entries =>
        entries?.map(entry => entry.modelDbId === modelDbId ? { ...entry, enabled } : entry)
      )
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(['fallback'], context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['fallback'] }),
  })

  const updateProviderFallback = useMutation({
    mutationFn: ({ platform, enabled }: { platform: Platform; enabled: boolean }) =>
      apiFetch(`/api/fallback/platform/${platform}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      }),
    onMutate: async ({ platform, enabled }) => {
      await queryClient.cancelQueries({ queryKey: ['fallback'] })
      const previous = queryClient.getQueryData<ProviderModel[]>(['fallback'])
      queryClient.setQueryData<ProviderModel[]>(['fallback'], entries =>
        entries?.map(entry => entry.platform === platform ? { ...entry, enabled } : entry)
      )
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(['fallback'], context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['fallback'] }),
  })

  const needsAccountId = platform === 'cloudflare'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!platform || !apiKey) return
    if (needsAccountId && !accountId) return
    const key = needsAccountId ? `${accountId}:${apiKey}` : apiKey
    addKey.mutate({ platform, key, label: label || undefined })
  }

  const updateModelSelection = (modelDbId: number, enabled: boolean) => {
    updateFallback.mutate({ modelDbId, enabled })
  }

  const updateProviderModelSelection = (enabled: boolean) => {
    if (!platform) return
    updateProviderFallback.mutate({ platform, enabled })
  }

  const healthKeyMap = new Map<number, { status: string; lastCheckedAt: string | null }>()
  for (const k of healthData?.keys ?? []) healthKeyMap.set(k.id, k)

  const selectedProvider = platform ? PLATFORMS.find(p => p.value === platform) : null
  const selectedProviderKeys = platform ? keys.filter(k => k.platform === platform) : []
  const selectedProviderModels = platform
    ? fallbackEntries.filter(entry => entry.platform === platform)
    : []
  const selectedEnabledModelCount = selectedProviderModels.filter(m => m.enabled).length
  const isUpdatingModels = updateFallback.isPending || updateProviderFallback.isPending
  const lastSynced = fallbackUpdatedAt
    ? new Date(fallbackUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  const grouped = PLATFORMS.map(p => ({
    ...p,
    keys: keys.filter(k => k.platform === p.value),
  })).filter(p => p.keys.length > 0)

  return (
    <div>
      <PageHeader
        title="Keys"
        description="Provider credentials and the unified API key your apps connect with."
        actions={
          keys.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => checkAll.mutate()} disabled={checkAll.isPending}>
              {checkAll.isPending ? 'Checking…' : 'Check all'}
            </Button>
          )
        }
      />

      <div className="space-y-8">
        <UnifiedKeySection />
        <ClientSetupSection fallbackEntries={fallbackEntries} />

        <section>
          <div className="flex items-center justify-between gap-4 mb-3">
            <div>
              <h2 className="text-sm font-medium">Provider setup</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Add multiple keys for one provider and choose which of its models can route traffic.
              </p>
            </div>
            <div className="flex items-end gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Provider</Label>
                <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" onClick={refreshSharedState}>
                Refresh
              </Button>
            </div>
          </div>
          {lastSynced && (
            <p className="text-[11px] text-muted-foreground mb-3 tabular-nums">
              Synced {lastSynced}; model and key state refreshes every 10 seconds.
            </p>
          )}

          {!selectedProvider ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Select a provider to manage keys and models.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-lg border p-4 bg-card">
                  <div className="w-full flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-medium">Add key for {selectedProvider.label}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Add as many keys as you have accounts or projects for this provider.
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {selectedProviderKeys.length} configured
                    </span>
                  </div>

                  {needsAccountId && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Account ID</Label>
                      <Input
                        value={accountId}
                        onChange={e => setAccountId(e.target.value)}
                        placeholder="a1b2c3d4…"
                        className="w-[200px] font-mono text-xs"
                      />
                    </div>
                  )}
                  <div className="space-y-1.5 flex-1 min-w-[240px]">
                    <Label className="text-xs">{needsAccountId ? 'API token' : 'API key'}</Label>
                    <Input
                      type="password"
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      placeholder={needsAccountId ? 'Bearer token' : 'paste key here'}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Label</Label>
                    <Input
                      value={label}
                      onChange={e => setLabel(e.target.value)}
                      placeholder="optional"
                      className="w-[160px]"
                    />
                  </div>
                  <Button type="submit" size="sm" disabled={!apiKey || (needsAccountId && !accountId) || addKey.isPending}>
                    {addKey.isPending ? 'Adding…' : 'Add key'}
                  </Button>
                  {addKey.isError && (
                    <p className="w-full text-destructive text-xs">{(addKey.error as Error).message}</p>
                  )}
                </form>

                <div className="rounded-lg border bg-card overflow-hidden">
                  <div className="px-4 py-3 border-b">
                    <h3 className="text-sm font-medium">Keys for {selectedProvider.label}</h3>
                  </div>
                  {selectedProviderKeys.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">
                      No keys added for {selectedProvider.label}.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {selectedProviderKeys.map(k => {
                        const h = healthKeyMap.get(k.id)
                        const status = h?.status ?? k.status
                        return (
                          <div key={k.id} className="flex items-center gap-3 px-4 py-3">
                            <span className={`size-1.5 rounded-full flex-shrink-0 ${statusDot[status] ?? statusDot.unknown}`} />
                            <div className="min-w-0">
                              <code className="block text-xs font-mono truncate">{k.maskedKey}</code>
                              <div className="flex gap-2 text-[11px] text-muted-foreground">
                                <span>{statusLabel[status] ?? status}</span>
                                {k.label && <span>{k.label}</span>}
                              </div>
                            </div>
                            <div className="flex-1" />
                            <Button variant="ghost" size="xs" onClick={() => checkKey.mutate(k.id)} disabled={checkKey.isPending}>
                              Check
                            </Button>
                            <Button variant="ghost" size="xs" className="text-muted-foreground hover:text-destructive" onClick={() => deleteKey.mutate(k.id)} disabled={deleteKey.isPending}>
                              Remove
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border bg-card overflow-hidden">
                <div className="flex items-center justify-between gap-4 px-4 py-3 border-b">
                  <div>
                    <h3 className="text-sm font-medium">Models for {selectedProvider.label}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedEnabledModelCount} of {selectedProviderModels.length} enabled for routing.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => updateProviderModelSelection(true)} disabled={isUpdatingModels || selectedProviderModels.length === 0}>
                      Enable all
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => updateProviderModelSelection(false)} disabled={isUpdatingModels || selectedProviderModels.length === 0}>
                      Disable all
                    </Button>
                  </div>
                </div>

                {selectedProviderModels.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">
                    No models are cataloged for {selectedProvider.label}.
                  </div>
                ) : (
                  <div className="divide-y">
                    {selectedProviderModels.map(model => (
                      <div key={model.modelDbId} className={`flex items-center gap-3 px-4 py-3 ${model.enabled ? '' : 'opacity-55'}`}>
                        <Switch
                          checked={model.enabled}
                          onCheckedChange={(checked) => updateModelSelection(model.modelDbId, checked)}
                          disabled={isUpdatingModels}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{model.displayName}</span>
                            <span className="text-xs text-muted-foreground">{model.sizeLabel}</span>
                          </div>
                          <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground tabular-nums">
                            <code className="font-mono truncate max-w-[280px]">{model.modelId}</code>
                            <span>Intel #{model.intelligenceRank}</span>
                            <span>Speed #{model.speedRank}</span>
                            {model.rpmLimit && <span>{model.rpmLimit} rpm</span>}
                            {model.rpdLimit && <span>{model.rpdLimit} rpd</span>}
                            <span>{model.monthlyTokenBudget} tok/mo</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-sm font-medium mb-3">Configured providers</h2>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : keys.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No provider keys yet. Add one above to start routing.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map(group => (
                <div key={group.value}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={group.keys.some(k => k.enabled)}
                        onCheckedChange={(checked) =>
                          togglePlatform.mutate({ platform: group.value, enabled: checked })
                        }
                        disabled={togglePlatform.isPending}
                      />
                      <h3 className="text-sm font-medium">{group.label}</h3>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground tabular-nums"
                      onClick={() => setPlatform(group.value)}
                    >
                      {group.keys.length} key{group.keys.length === 1 ? '' : 's'}
                    </button>
                  </div>
                  <div className="rounded-lg border divide-y bg-card overflow-hidden">
                    {group.keys.map(k => {
                      const h = healthKeyMap.get(k.id)
                      const status = h?.status ?? k.status
                      const lastChecked = h?.lastCheckedAt
                      return (
                        <div key={k.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                          <span className={`size-1.5 rounded-full flex-shrink-0 ${statusDot[status] ?? statusDot.unknown}`} />
                          <code className="text-xs font-mono flex-shrink-0">{k.maskedKey}</code>
                          {k.label && <span className="text-xs text-muted-foreground">{k.label}</span>}
                          <span className="text-xs text-muted-foreground">{statusLabel[status] ?? status}</span>
                          <div className="flex-1" />
                          {lastChecked && (
                            <span className="text-[11px] text-muted-foreground tabular-nums">
                              {new Date(lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          <Button variant="ghost" size="xs" onClick={() => checkKey.mutate(k.id)} disabled={checkKey.isPending}>
                            Check
                          </Button>
                          <Button variant="ghost" size="xs" className="text-muted-foreground hover:text-destructive" onClick={() => deleteKey.mutate(k.id)} disabled={deleteKey.isPending}>
                            Remove
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
