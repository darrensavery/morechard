import { useState, useEffect, useCallback } from 'react'
import { clearDeviceIdentity } from '../../lib/deviceIdentity'
import type { ChildRecord } from '../../lib/api'
import {
  getChildren, addChild, generateInvite,
  getFamily, getSettings, updateSettings,
} from '../../lib/api'
import { AvatarSVG, AVATARS, AVATAR_CATEGORIES } from '../../lib/avatars'

interface Props {
  familyId: string
  onChildrenChange: (children: ChildRecord[]) => void
}

export function ParentSettingsTab({ familyId, onChildrenChange }: Props) {
  const [children, setChildren]     = useState<ChildRecord[]>([])
  const [family, setFamily]         = useState<Record<string, unknown>>({})
  const [settings, setSettings]     = useState<{ avatar_id: string; theme: string; locale: string } | null>(null)
  const [loading, setLoading]       = useState(true)

  // Add child
  const [showAddChild, setShowAddChild]     = useState(false)
  const [newChildName, setNewChildName]     = useState('')
  const [addingChild, setAddingChild]       = useState(false)
  const [addChildResult, setAddChildResult] = useState<{ child_id: string; invite_code: string } | null>(null)

  // Avatar picker
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [savingAvatar, setSavingAvatar]         = useState(false)

  // Invite
  const [inviteCode, setInviteCode]   = useState<string | null>(null)
  const [inviteExpiry, setInviteExpiry] = useState<string | null>(null)
  const [genningInvite, setGenningInvite] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [c, f, s] = await Promise.all([
      getChildren().then(r => r.children),
      getFamily(),
      getSettings(),
    ])
    setChildren(c)
    onChildrenChange(c)
    setFamily(f)
    setSettings(s)
    setLoading(false)
  }, [familyId, onChildrenChange])

  useEffect(() => { load() }, [load])

  async function handleAddChild(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!newChildName.trim()) return
    setAddingChild(true)
    try {
      const result = await addChild(newChildName.trim())
      setAddChildResult(result)
      setNewChildName('')
      await load()
    } finally {
      setAddingChild(false)
    }
  }

  async function handleSetAvatar(id: string) {
    setSavingAvatar(true)
    try {
      await updateSettings({ avatar_id: id })
      await load()
      setShowAvatarPicker(false)
    } finally {
      setSavingAvatar(false)
    }
  }

  async function handleGenerateInvite() {
    setGenningInvite(true)
    try {
      const r = await generateInvite('co-parent')
      setInviteCode(r.code)
      setInviteExpiry(new Date(r.expires_at * 1000).toLocaleString('en-GB'))
    } finally {
      setGenningInvite(false)
    }
  }

  if (loading) return <div className="py-10 text-center text-[14px] text-[#6b6a66]">Loading…</div>

  const myAvatar = settings?.avatar_id ?? 'bot'

  return (
    <div className="space-y-4">
      {/* My account */}
      <section className="bg-white border border-[#D3D1C7] rounded-xl p-4">
        <p className="text-[13px] font-bold text-[#6b6a66] uppercase tracking-wide mb-3">My account</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAvatarPicker(true)}
            className="relative cursor-pointer group"
            title="Change avatar"
          >
            <AvatarSVG id={myAvatar} size={52} />
            <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 rounded-full transition-colors text-white text-[18px] opacity-0 group-hover:opacity-100">✎</span>
          </button>
          <div>
            <p className="text-[14px] font-semibold text-[#1C1C1A]">
              {(family.display_name as string) ?? 'My family'}
            </p>
            <button
              onClick={() => setShowAvatarPicker(true)}
              className="text-[12px] font-semibold text-green-700 hover:underline cursor-pointer"
            >
              Change avatar
            </button>
          </div>
        </div>
      </section>

      {/* Avatar picker */}
      {showAvatarPicker && (
        <div className="bg-white border border-[#D3D1C7] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[15px] font-bold">Choose avatar</p>
            <button onClick={() => setShowAvatarPicker(false)} className="text-[#6b6a66] hover:text-[#1C1C1A] cursor-pointer text-[20px] leading-none">×</button>
          </div>
          {AVATAR_CATEGORIES.map(cat => (
            <div key={cat.id} className="mb-3">
              <p className="text-[11px] font-bold text-[#6b6a66] uppercase tracking-wide mb-1.5">{cat.label}</p>
              <div className="flex flex-wrap gap-2">
                {AVATARS.filter(av => av.category === cat.id).map(av => (
                  <button
                    key={av.id}
                    onClick={() => handleSetAvatar(av.id)}
                    disabled={savingAvatar}
                    className={`p-1.5 rounded-xl border-2 transition-colors cursor-pointer
                      ${myAvatar === av.id ? 'border-green-600 bg-green-50' : 'border-transparent hover:border-gray-300'}`}
                    title={av.name}
                  >
                    <AvatarSVG id={av.id} size={40} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Children */}
      <section className="bg-white border border-[#D3D1C7] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#D3D1C7]">
          <p className="text-[13px] font-bold text-[#6b6a66] uppercase tracking-wide">Children</p>
          <button
            onClick={() => setShowAddChild(v => !v)}
            className="text-[13px] font-semibold text-green-700 hover:underline cursor-pointer"
          >
            + Add child
          </button>
        </div>

        {children.map(child => (
          <div key={child.id} className="px-4 py-3 flex items-center gap-3 border-b border-[#D3D1C7] last:border-0">
            <AvatarSVG id={child.avatar_id ?? 'bot'} size={36} />
            <div>
              <p className="text-[14px] font-semibold text-[#1C1C1A]">{child.display_name}</p>
              {child.locked_until && child.locked_until > Date.now() / 1000 && (
                <p className="text-[12px] text-red-600 font-semibold">Locked</p>
              )}
            </div>
          </div>
        ))}

        {children.length === 0 && !showAddChild && (
          <div className="px-4 py-6 text-center text-[14px] text-[#6b6a66]">No children yet.</div>
        )}

        {showAddChild && (
          <form onSubmit={handleAddChild} className="px-4 py-3 space-y-2.5 border-t border-[#D3D1C7] bg-gray-50">
            {addChildResult && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-[13px] font-semibold text-green-700 mb-1">Child added!</p>
                <p className="text-[12px] text-[#1C1C1A]">Share this PIN code with them to log in:</p>
                <p className="text-[20px] font-extrabold text-green-700 tracking-widest mt-1">{addChildResult.invite_code}</p>
              </div>
            )}
            <input
              required
              className="w-full border border-[#D3D1C7] rounded-lg px-3 py-2 text-[14px] bg-white focus:outline-none focus:ring-2 focus:ring-green-600"
              placeholder="Child's name"
              value={newChildName}
              onChange={e => setNewChildName(e.target.value)}
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowAddChild(false); setAddChildResult(null) }} className="flex-1 border border-[#D3D1C7] rounded-xl py-2.5 text-[14px] font-semibold text-[#6b6a66] bg-white cursor-pointer">Cancel</button>
              <button type="submit" disabled={addingChild} className="flex-1 bg-green-700 text-white rounded-xl py-2.5 text-[14px] font-bold hover:bg-green-800 disabled:opacity-50 cursor-pointer">
                {addingChild ? 'Adding…' : 'Add'}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Co-parent invite */}
      <section className="bg-white border border-[#D3D1C7] rounded-xl p-4">
        <p className="text-[13px] font-bold text-[#6b6a66] uppercase tracking-wide mb-2">Invite co-parent</p>
        {inviteCode ? (
          <div className="space-y-1">
            <p className="text-[13px] text-[#6b6a66]">Share this code (expires {inviteExpiry}):</p>
            <p className="text-[22px] font-extrabold tracking-widest text-[#1C1C1A]">{inviteCode}</p>
            <button onClick={() => setInviteCode(null)} className="text-[12px] text-[#6b6a66] hover:underline cursor-pointer">Clear</button>
          </div>
        ) : (
          <button
            onClick={handleGenerateInvite}
            disabled={genningInvite}
            className="w-full border border-[#D3D1C7] rounded-xl py-2.5 text-[14px] font-semibold text-[#6b6a66] hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
          >
            {genningInvite ? 'Generating…' : 'Generate invite code'}
          </button>
        )}
      </section>

      {/* Log out */}
      <section className="bg-white border border-[#D3D1C7] rounded-xl p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[14px] font-semibold text-[#1C1C1A]">Log out</p>
            <p className="text-[12px] text-[#9b9a96] mt-0.5 leading-snug">
              Your family's data stays safe. You'll need to log back in to use the app on this phone.
            </p>
          </div>
          <button
            onClick={() => {
              if (!window.confirm('Log out? Your family\'s data stays safe.')) return
              clearDeviceIdentity()
              window.location.href = '/'
            }}
            className="shrink-0 px-4 py-2 rounded-xl border-2 border-[#D3D1C7] text-[#6b6a66] text-[13px] font-semibold hover:bg-gray-50 active:scale-[0.98] transition-all cursor-pointer"
          >
            Log out
          </button>
        </div>
      </section>
    </div>
  )
}