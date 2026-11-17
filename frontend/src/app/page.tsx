'use client';

import { useState, useEffect, useMemo } from 'react';

interface ComponentItem {
  id: string;
  component_category: string;
  brand: string;
  model: string;
  device_type: string;
  condition?: string;
  status: string;
  specifications: Record<string, string | number>;
}

interface ClaimedItem {
  claim_id: string;
  claim_status: string;
  claimed_at: string;
  component_id: string;
  component_category: string;
  specifications: Record<string, string | number>;
  brand: string;
  model: string;
  device_type: string;
}

interface DraftPart {
  category: string;
  specKey1: string;
  specVal1: string;
  specKey2: string;
  specVal2: string;
}

const API_BASE = 'http://localhost:5000/api';
const DEMO_BUYER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const DEMO_RECYCLER_ID = 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a00';

/* Forest PCB & Gold Contact Hardware Schematics */
function HardwareSchematic({ category }: { category: string }) {
  const cat = category.toUpperCase();

  if (cat.includes('RAM') || cat.includes('MEM')) {
    return (
      <svg viewBox="0 0 220 72" className="w-full h-16" fill="none">
        <rect x="6" y="12" width="208" height="44" rx="2" fill="#1A3A2F" />
        {[20, 56, 92, 128, 164].map((x) => (
          <rect key={x} x={x} y="20" width="26" height="24" rx="1" fill="#122921" stroke="#2D5A4A" strokeWidth="1" />
        ))}
        {Array.from({ length: 28 }).map((_, i) => (
          <rect key={i} x={14 + i * 7} y="56" width="4" height="6" fill="#D99B26" />
        ))}
        <circle cx="110" cy="56" r="3" fill="#ECEAE2" />
      </svg>
    );
  }

  if (cat.includes('SSD') || cat.includes('NVME') || cat.includes('STORAGE')) {
    return (
      <svg viewBox="0 0 220 72" className="w-full h-16" fill="none">
        <rect x="16" y="16" width="188" height="40" rx="2" fill="#1A3A2F" />
        <circle cx="16" cy="36" r="5" fill="#ECEAE2" />
        {Array.from({ length: 14 }).map((_, i) => (
          <rect key={i} x="204" y={20 + i * 2.3} width="6" height="1.4" fill="#D99B26" />
        ))}
        <rect x="38" y="24" width="24" height="24" rx="1" fill="#D97706" fillOpacity="0.28" stroke="#F59E0B" />
        <rect x="76" y="22" width="48" height="28" rx="1" fill="#122921" stroke="#2D5A4A" />
        <rect x="134" y="22" width="48" height="28" rx="1" fill="#122921" stroke="#2D5A4A" />
      </svg>
    );
  }

  if (cat.includes('BAT')) {
    return (
      <svg viewBox="0 0 220 72" className="w-full h-16" fill="none">
        <rect x="18" y="14" width="184" height="44" rx="3" fill="#1A3A2F" />
        <rect x="28" y="22" width="50" height="28" rx="1" fill="#122921" stroke="#2D5A4A" />
        <rect x="85" y="22" width="50" height="28" rx="1" fill="#122921" stroke="#2D5A4A" />
        <rect x="142" y="22" width="50" height="28" rx="1" fill="#122921" stroke="#2D5A4A" />
        <rect x="196" y="28" width="8" height="16" fill="#D99B26" />
      </svg>
    );
  }

  if (cat.includes('NET') || cat.includes('WI-FI') || cat.includes('WIFI')) {
    return (
      <svg viewBox="0 0 220 72" className="w-full h-16" fill="none">
        <rect x="66" y="12" width="88" height="48" rx="2" fill="#1A3A2F" />
        <rect x="82" y="22" width="38" height="28" rx="1" fill="#122921" stroke="#34D399" />
        {/* U.FL Gold Antenna Coax Ports */}
        <circle cx="138" cy="24" r="4" fill="#D99B26" />
        <circle cx="138" cy="48" r="4" fill="#D99B26" />
        {/* M.2 E-Key Gold Pins */}
        {Array.from({ length: 12 }).map((_, i) => (
          <rect key={i} x="60" y={18 + i * 3} width="6" height="1.6" fill="#D99B26" />
        ))}
      </svg>
    );
  }

  if (cat.includes('COOL') || cat.includes('FAN')) {
    return (
      <svg viewBox="0 0 220 72" className="w-full h-16" fill="none">
        {/* Copper Heatpipe */}
        <rect x="24" y="31" width="172" height="10" rx="2" fill="#D97706" fillOpacity="0.85" />
        {/* Turbine Shroud */}
        <circle cx="110" cy="36" r="26" fill="#1A3A2F" stroke="#2D5A4A" strokeWidth="2" />
        <circle cx="110" cy="36" r="18" fill="#122921" stroke="#34D399" strokeWidth="1" />
        <circle cx="110" cy="36" r="6" fill="#D99B26" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 220 72" className="w-full h-16" fill="none">
      <rect x="74" y="10" width="72" height="52" rx="3" fill="#1A3A2F" />
      <rect x="88" y="22" width="44" height="28" rx="1" fill="#122921" stroke="#34D399" />
      {[18, 28, 38, 48].map((y) => (
        <g key={y}>
          <rect x="64" y={y} width="10" height="3" fill="#D99B26" />
          <rect x="146" y={y} width="10" height="3" fill="#D99B26" />
        </g>
      ))}
    </svg>
  );
}

export default function ReclaimShowcase() {
  const [mode, setMode] = useState<'browse' | 'reserved' | 'intake'>('browse');
  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [myClaims, setMyClaims] = useState<ClaimedItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [toast, setToast] = useState<{
    ok: boolean;
    message: string;
    showViewLink?: boolean;
  } | null>(null);

  // Recycler Intake State
  const [deviceType, setDeviceType] = useState('Laptop');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [condition, setCondition] = useState('Chassis Damaged / Board Tested');
  const [draftParts, setDraftParts] = useState<DraftPart[]>([
    { category: 'RAM', specKey1: 'capacity', specVal1: '16GB', specKey2: 'type', specVal2: 'DDR4' },
    { category: 'SSD', specKey1: 'capacity', specVal1: '512GB', specKey2: 'interface', specVal2: 'NVMe' },
  ]);
  const [submitting, setSubmitting] = useState(false);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [compRes, claimsRes] = await Promise.all([
        fetch(`${API_BASE}/components`),
        fetch(`${API_BASE}/claims/${DEMO_BUYER_ID}`),
      ]);

      const compData = await compRes.json();
      if (compRes.ok && Array.isArray(compData)) {
        setComponents(compData);
      } else {
        setComponents([]);
      }

      if (claimsRes.ok) {
        const claimsData = await claimsRes.json();
        if (Array.isArray(claimsData)) setMyClaims(claimsData);
      }
    } catch {
      setToast({ ok: false, message: 'Backend offline on localhost:5000.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(components.map((c) => c.component_category.toUpperCase())));
    return ['ALL', ...unique];
  }, [components]);

  // Reset category filter if the last item in that category was claimed
  useEffect(() => {
    if (selectedCategory !== 'ALL' && !categories.includes(selectedCategory)) {
      setSelectedCategory('ALL');
    }
  }, [categories, selectedCategory]);

  const filtered = useMemo(() => {
    return components.filter((item) => {
      const catOk =
        selectedCategory === 'ALL' || item.component_category.toUpperCase() === selectedCategory;
      const q = search.trim().toLowerCase();
      const textOk =
        !q ||
        item.brand?.toLowerCase().includes(q) ||
        item.model?.toLowerCase().includes(q) ||
        item.component_category.toLowerCase().includes(q) ||
        JSON.stringify(item.specifications).toLowerCase().includes(q);
      return catOk && textOk;
    });
  }, [components, selectedCategory, search]);

  const pendingPickups = useMemo(
    () => myClaims.filter((c) => c.claim_status === 'pending_pickup'),
    [myClaims]
  );

  const completedPickups = useMemo(
    () => myClaims.filter((c) => c.claim_status !== 'pending_pickup'),
    [myClaims]
  );

  const claimComponent = async (item: ComponentItem) => {
    setBusyId(item.id);
    setToast(null);
    try {
      const res = await fetch(`${API_BASE}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ componentId: item.id, buyerId: DEMO_BUYER_ID }),
      });
      const data = await res.json();

      if (res.ok) {
        setToast({
          ok: true,
          message: `Reserved ${item.component_category} (${item.brand} ${item.model}) — Pickup Ticket #${item.id.slice(0, 8)} created.`,
          showViewLink: true,
        });
        await fetchAllData();
      } else {
        setToast({ ok: false, message: data.error || 'Component already claimed.' });
        // Re-sync in case another session claimed this component first
        await fetchAllData();
      }
    } catch {
      setToast({ ok: false, message: 'Network error during allocation.' });
    } finally {
      setBusyId(null);
    }
  };

  const completePickup = async (claim: ClaimedItem) => {
    setBusyId(claim.claim_id);
    setToast(null);
    try {
      const res = await fetch(`${API_BASE}/claims/${claim.claim_id}/complete`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setToast({
          ok: true,
          message: `Handover verified for ${claim.component_category} (${claim.brand} ${claim.model}). Ticket closed.`,
        });
        await fetchAllData();
      } else {
        setToast({ ok: false, message: data.error || 'Could not complete pickup.' });
      }
    } catch {
      setToast({ ok: false, message: 'Network error updating pickup status.' });
    } finally {
      setBusyId(null);
    }
  };

  const cancelReservation = async (claim: ClaimedItem) => {
    setBusyId(claim.claim_id);
    setToast(null);
    try {
      const res = await fetch(`${API_BASE}/claims/${claim.claim_id}/cancel`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setToast({
          ok: true,
          message: `Released ${claim.component_category} (${claim.brand} ${claim.model}) back to available pool.`,
        });
        await fetchAllData();
      } else {
        setToast({ ok: false, message: data.error || 'Could not cancel reservation.' });
      }
    } catch {
      setToast({ ok: false, message: 'Network error cancelling reservation.' });
    } finally {
      setBusyId(null);
    }
  };

  const addPartRow = () => {
    setDraftParts([
      ...draftParts,
      { category: 'Battery', specKey1: 'capacity', specVal1: '', specKey2: 'health', specVal2: '' },
    ]);
  };

  const removePartRow = (idx: number) => {
    if (draftParts.length > 1) {
      setDraftParts(draftParts.filter((_, i) => i !== idx));
    }
  };

  const updatePartRow = (idx: number, field: keyof DraftPart, val: string) => {
    const copy = [...draftParts];
    copy[idx] = { ...copy[idx], [field]: val };
    setDraftParts(copy);
  };

  const handleIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand.trim() || !model.trim()) return;

    const formattedParts = draftParts
      .filter((p) => p.category.trim())
      .map((p) => {
        const specs: Record<string, string> = {};
        if (p.specKey1.trim() && p.specVal1.trim()) specs[p.specKey1.trim()] = p.specVal1.trim();
        if (p.specKey2.trim() && p.specVal2.trim()) specs[p.specKey2.trim()] = p.specVal2.trim();
        return { category: p.category.trim(), specs };
      });

    if (formattedParts.length === 0) {
      setToast({ ok: false, message: 'Add at least one valid extracted component category.' });
      return;
    }

    setSubmitting(true);
    setToast(null);

    try {
      const res = await fetch(`${API_BASE}/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recyclerId: DEMO_RECYCLER_ID,
          deviceType,
          brand: brand.trim(),
          model: model.trim(),
          condition: condition.trim(),
          components: formattedParts,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setToast({
          ok: true,
          message: `Added ${brand} ${model} (${formattedParts.length} components) to live pool.`,
        });
        setBrand('');
        setModel('');
        await fetchAllData();
        setMode('browse');
      } else {
        setToast({ ok: false, message: data.error || 'Failed to log device.' });
      }
    } catch {
      setToast({ ok: false, message: 'Backend unreachable.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen pb-28">
      {/* MINIMALIST EDITORIAL TITLE + COMMAND BAR */}
      <div className="max-w-6xl mx-auto px-6 pt-12 pb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-2.5 font-mono text-xs text-[#5E6D66] mb-2">
              <span className="h-2 w-2 rounded-full bg-[#1F6E4E]" />
              <span>RECLAIM // MUNICIPAL HARDWARE POOL</span>
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight text-[#18221E]">
              {mode === 'reserved'
                ? 'Reserved Tickets'
                : mode === 'intake'
                ? 'Disassembly Intake'
                : 'Salvaged Parts'}
            </h1>
          </div>

          <div className="flex items-baseline gap-8 font-mono">
            <button
              type="button"
              onClick={() => setMode('browse')}
              className="text-left group cursor-pointer"
            >
              <span className="text-3xl font-bold text-[#18221E] group-hover:underline">
                {components.length}
              </span>
              <span className="text-xs text-[#5E6D66] ml-2">IN STOCK</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('reserved')}
              className="text-left group cursor-pointer"
            >
              <span className="text-3xl font-bold text-[#1F6E4E] group-hover:underline">
                {myClaims.length}
              </span>
              <span className="text-xs text-[#5E6D66] ml-2">RESERVED</span>
            </button>
          </div>
        </div>

        {/* FLOATING COMMAND SEARCH + CATEGORY CHIPS */}
        {mode === 'browse' && (
          <div className="bg-white border border-[#E2E0D8] p-2 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 shadow-[0_4px_20px_rgba(24,34,30,0.04)]">
            <div className="flex items-center gap-3 px-3 flex-1">
              <span className="font-mono text-xs text-[#1F6E4E] font-semibold">FILTER</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type DDR4, NVMe, Dell, 8GB..."
                className="w-full py-2 text-sm bg-transparent text-[#18221E] focus:outline-none placeholder:text-[#98A29D]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="font-mono text-xs text-[#7D8B84] hover:text-[#18221E] cursor-pointer"
                >
                  CLEAR
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1 border-t md:border-t-0 pt-2 md:pt-0 border-[#ECEAE2]">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 font-mono text-xs transition-colors cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-[#1F6E4E] text-white font-semibold'
                      : 'text-[#5E6D66] hover:bg-[#ECEAE2] hover:text-[#18221E]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* INLINE NOTIFICATION WITH DIRECT LINK TO RESERVED VIEW */}
        {toast && (
          <div
            className={`mt-4 px-4 py-3 font-mono text-xs flex flex-wrap items-center justify-between gap-3 border ${
              toast.ok
                ? 'bg-[#E6F4EE] border-[#B4DFCC] text-[#144D36]'
                : 'bg-[#FDF0ED] border-[#F3C5BA] text-[#962812]'
            }`}
          >
            <span>{toast.message}</span>
            <div className="flex items-center gap-4">
              {toast.showViewLink && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('reserved');
                    setToast(null);
                  }}
                  className="font-bold underline uppercase cursor-pointer"
                >
                  View Pickup Ticket →
                </button>
              )}
              <button
                type="button"
                onClick={() => setToast(null)}
                className="underline uppercase opacity-75 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MAIN CANVAS */}
      <main className="max-w-6xl mx-auto px-6">
        {mode === 'browse' ? (
          loading ? (
            <div className="py-20 font-mono text-xs text-[#5E6D66]">
              SYNCING WITH NEON POSTGRESQL...
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-[#E2E0D8] p-14 text-center shadow-[0_4px_20px_rgba(24,34,30,0.03)]">
              <p className="font-display text-2xl font-bold text-[#18221E] mb-2">
                {components.length === 0 ? 'Pool is currently empty' : 'No matching components'}
              </p>
              <p className="text-sm text-[#5E6D66] mb-6">
                {components.length === 0
                  ? 'Use the bottom dock to log dismantled hardware into the exchange.'
                  : 'Try clearing your search query or switching category filters.'}
              </p>
              {components.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setMode('intake')}
                  className="bg-[#1F6E4E] text-white px-5 py-2.5 font-mono text-xs font-semibold uppercase tracking-wider cursor-pointer"
                >
                  + Log Hardware Batch
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setSelectedCategory('ALL');
                  }}
                  className="bg-[#18221E] text-white px-5 py-2.5 font-mono text-xs font-semibold uppercase tracking-wider cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((item) => {
                const specValues = Object.values(item.specifications || {});
                const headlineSpec = specValues.slice(0, 2).join(' · ');

                return (
                  <article
                    key={item.id}
                    className="bg-white border border-[#E2E0D8] hover:border-[#1F6E4E] transition-all shadow-[0_2px_14px_rgba(24,34,30,0.03)] hover:shadow-[0_8px_24px_rgba(24,34,30,0.07)] flex flex-col justify-between"
                  >
                    <div className="p-6">
                      <div className="flex items-center justify-between font-mono text-[11px] text-[#5E6D66] mb-5">
                        <span className="uppercase tracking-wider font-semibold text-[#1F6E4E]">
                          {item.component_category}
                        </span>
                        <span>#{item.id.slice(0, 8)}</span>
                      </div>

                      <div className="bg-[#ECEAE2] border border-[#E2E0D8] py-4 px-5 mb-5">
                        <HardwareSchematic category={item.component_category} />
                      </div>

                      <h2 className="font-display text-2xl font-bold text-[#18221E] tracking-tight">
                        {headlineSpec || item.component_category}
                      </h2>
                      <p className="text-sm text-[#5E6D66] mt-1">
                        From {item.brand} {item.model}{' '}
                        <span className="font-mono text-xs text-[#7D8B84]">({item.device_type})</span>
                      </p>

                      <div className="mt-5 pt-4 border-t border-[#ECEAE2] flex flex-wrap gap-x-5 gap-y-2">
                        {Object.entries(item.specifications || {}).map(([k, v]) => (
                          <div key={k} className="font-mono text-xs">
                            <span className="text-[#7D8B84]">{k}: </span>
                            <span className="text-[#18221E] font-medium">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => claimComponent(item)}
                      className="w-full border-t border-[#E2E0D8] bg-[#FAF9F6] hover:bg-[#1F6E4E] hover:text-white hover:border-[#1F6E4E] disabled:opacity-50 py-3.5 px-6 font-mono text-xs font-semibold uppercase tracking-widest text-[#18221E] transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <span>{busyId === item.id ? 'LOCKING ROW...' : 'RESERVE COMPONENT'}</span>
                      <span>→</span>
                    </button>
                  </article>
                );
              })}
            </div>
          )
        ) : mode === 'reserved' ? (
          /* BUYER RESERVED PICKUP TICKETS LEDGER (ACTIVE + COMPLETED) */
          <div className="space-y-8">
            <div className="bg-white border border-[#E2E0D8] shadow-[0_4px_20px_rgba(24,34,30,0.04)]">
              <div className="p-6 border-b border-[#ECEAE2] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-mono text-xs uppercase text-[#1F6E4E] font-semibold">
                    Active Facility Holds ({pendingPickups.length})
                  </span>
                  <h2 className="font-display text-2xl font-bold text-[#18221E] mt-0.5">
                    Pending Pickup Passes
                  </h2>
                </div>
                <span className="font-mono text-xs text-[#5E6D66]">
                  BUYER: student@bennett.edu.in
                </span>
              </div>

              {pendingPickups.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-sm text-[#5E6D66] mb-4">
                    No pending pickup tickets in your queue.
                  </p>
                  <button
                    type="button"
                    onClick={() => setMode('browse')}
                    className="bg-[#1F6E4E] text-white px-5 py-2 font-mono text-xs uppercase cursor-pointer"
                  >
                    Browse Available Parts
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-[#ECEAE2]">
                  {pendingPickups.map((claim) => (
                    <div
                      key={claim.claim_id}
                      className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5 hover:bg-[#FAF9F6]"
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-mono text-xs font-semibold px-2.5 py-0.5 border uppercase bg-[#FEF6E7] text-[#92580C] border-[#F6D59B]">
                            PENDING PICKUP
                          </span>
                          <span className="font-mono text-xs text-[#5E6D66]">
                            TICKET #{claim.claim_id.slice(0, 8)}
                          </span>
                          <span className="font-mono text-xs text-[#7D8B84]">
                            • {new Date(claim.claimed_at).toLocaleString()}
                          </span>
                        </div>

                        <h3 className="font-display text-xl font-bold text-[#18221E] pt-0.5">
                          {claim.component_category} — {claim.brand} {claim.model}
                        </h3>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-[#5E6D66]">
                          {Object.entries(claim.specifications || {}).map(([k, v]) => (
                            <span key={k}>
                              {k}: <strong className="text-[#18221E]">{String(v)}</strong>
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                        <button
                          type="button"
                          disabled={busyId === claim.claim_id}
                          onClick={() => completePickup(claim)}
                          className="bg-[#1F6E4E] hover:bg-[#16523A] disabled:opacity-50 text-white px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                        >
                          {busyId === claim.claim_id ? 'UPDATING...' : 'Confirm Pickup ✓'}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === claim.claim_id}
                          onClick={() => cancelReservation(claim)}
                          className="border border-[#E2E0D8] hover:border-[#962812] text-[#5E6D66] hover:text-[#962812] disabled:opacity-50 px-3.5 py-2 font-mono text-xs uppercase transition-colors cursor-pointer"
                        >
                          Release Part
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* COMPLETED HANDOVER HISTORY */}
            {completedPickups.length > 0 && (
              <div className="bg-white border border-[#E2E0D8] shadow-[0_4px_20px_rgba(24,34,30,0.03)]">
                <div className="px-6 py-4 border-b border-[#ECEAE2] flex items-center justify-between">
                  <span className="font-mono text-xs uppercase text-[#5E6D66] font-semibold">
                    Verified Handover Archive ({completedPickups.length})
                  </span>
                </div>
                <div className="divide-y divide-[#ECEAE2]">
                  {completedPickups.map((claim) => (
                    <div
                      key={claim.claim_id}
                      className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[11px] font-semibold px-2 py-0.5 bg-[#E6F4EE] text-[#144D36] border border-[#B4DFCC] uppercase">
                          COMPLETED
                        </span>
                        <span className="font-semibold text-[#18221E]">
                          {claim.component_category} — {claim.brand} {claim.model}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-[#7D8B84]">
                        TICKET #{claim.claim_id.slice(0, 8)} • PART #{claim.component_id.slice(0, 8)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* CENTERED DISASSEMBLY INTAKE STUDIO */
          <form
            onSubmit={handleIntake}
            className="bg-white border border-[#E2E0D8] p-6 md:p-10 max-w-3xl mx-auto shadow-[0_4px_20px_rgba(24,34,30,0.04)]"
          >
            <div className="border-b border-[#ECEAE2] pb-5 mb-6">
              <span className="font-mono text-xs uppercase text-[#1F6E4E] font-semibold">
                Recycler Workbench
              </span>
              <h2 className="font-display text-3xl font-bold text-[#18221E] mt-1">
                Log Dismantled Unit
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block font-mono text-xs text-[#5E6D66] mb-1.5">
                  DEVICE TYPE
                </label>
                <select
                  value={deviceType}
                  onChange={(e) => setDeviceType(e.target.value)}
                  className="w-full bg-[#F5F4EF] border border-[#E2E0D8] px-3 py-2.5 text-sm text-[#18221E] focus:outline-none focus:border-[#1F6E4E]"
                >
                  <option value="Laptop">Laptop</option>
                  <option value="Desktop">Desktop</option>
                  <option value="Server">Server</option>
                  <option value="Switch">Network Switch</option>
                </select>
              </div>

              <div>
                <label className="block font-mono text-xs text-[#5E6D66] mb-1.5">
                  CONDITION
                </label>
                <input
                  type="text"
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="w-full bg-[#F5F4EF] border border-[#E2E0D8] px-3 py-2.5 text-sm text-[#18221E] focus:outline-none focus:border-[#1F6E4E]"
                />
              </div>

              <div>
                <label className="block font-mono text-xs text-[#5E6D66] mb-1.5">BRAND *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Dell, Lenovo"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full bg-[#F5F4EF] border border-[#E2E0D8] px-3 py-2.5 text-sm text-[#18221E] focus:outline-none focus:border-[#1F6E4E]"
                />
              </div>

              <div>
                <label className="block font-mono text-xs text-[#5E6D66] mb-1.5">MODEL *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Latitude 5490"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-[#F5F4EF] border border-[#E2E0D8] px-3 py-2.5 text-sm text-[#18221E] focus:outline-none focus:border-[#1F6E4E]"
                />
              </div>
            </div>

            <div className="border-t border-[#ECEAE2] pt-6 mb-8">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-xs uppercase font-semibold text-[#18221E]">
                  Extracted Components
                </span>
                <button
                  type="button"
                  onClick={addPartRow}
                  className="font-mono text-xs text-[#1F6E4E] font-semibold hover:underline cursor-pointer"
                >
                  + ADD PART
                </button>
              </div>

              <div className="space-y-2.5">
                {draftParts.map((part, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 bg-[#F5F4EF] border border-[#E2E0D8] p-2.5"
                  >
                    <input
                      type="text"
                      placeholder="RAM / SSD"
                      value={part.category}
                      onChange={(e) => updatePartRow(idx, 'category', e.target.value)}
                      className="col-span-3 bg-white border border-[#E2E0D8] px-2 py-1.5 font-mono text-xs text-[#18221E]"
                    />
                    <input
                      type="text"
                      placeholder="Key 1"
                      value={part.specKey1}
                      onChange={(e) => updatePartRow(idx, 'specKey1', e.target.value)}
                      className="col-span-2 bg-white border border-[#E2E0D8] px-2 py-1.5 font-mono text-xs text-[#5E6D66]"
                    />
                    <input
                      type="text"
                      placeholder="Val 1"
                      value={part.specVal1}
                      onChange={(e) => updatePartRow(idx, 'specVal1', e.target.value)}
                      className="col-span-2 bg-white border border-[#E2E0D8] px-2 py-1.5 font-mono text-xs text-[#18221E]"
                    />
                    <input
                      type="text"
                      placeholder="Key 2"
                      value={part.specKey2}
                      onChange={(e) => updatePartRow(idx, 'specKey2', e.target.value)}
                      className="col-span-2 bg-white border border-[#E2E0D8] px-2 py-1.5 font-mono text-xs text-[#5E6D66]"
                    />
                    <input
                      type="text"
                      placeholder="Val 2"
                      value={part.specVal2}
                      onChange={(e) => updatePartRow(idx, 'specVal2', e.target.value)}
                      className="col-span-2 bg-white border border-[#E2E0D8] px-2 py-1.5 font-mono text-xs text-[#18221E]"
                    />
                    <button
                      type="button"
                      onClick={() => removePartRow(idx)}
                      disabled={draftParts.length === 1}
                      className="col-span-1 font-mono text-xs text-[#5E6D66] hover:text-[#962812] disabled:opacity-30 cursor-pointer"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setMode('browse')}
                className="px-5 py-2.5 border border-[#E2E0D8] font-mono text-xs uppercase text-[#5E6D66] hover:text-[#18221E] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="bg-[#1F6E4E] hover:bg-[#16523A] text-white px-6 py-2.5 font-mono text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
              >
                {submitting ? 'SAVING...' : 'PUBLISH TO POOL'}
              </button>
            </div>
          </form>
        )}
      </main>

      {/* FLOATING BOTTOM WORKBENCH DOCK */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <div className="bg-[#18221E] text-white p-1.5 flex items-center gap-1 shadow-[0_10px_28px_rgba(24,34,30,0.22)] border border-[#2C3B35]">
          <button
            type="button"
            onClick={() => setMode('browse')}
            className={`px-4 py-2 font-mono text-xs transition-colors cursor-pointer ${
              mode === 'browse'
                ? 'bg-[#F5F4EF] text-[#18221E] font-semibold'
                : 'text-[#A3B3AC] hover:text-white'
            }`}
          >
            BROWSE ({components.length})
          </button>
          <button
            type="button"
            onClick={() => setMode('reserved')}
            className={`px-4 py-2 font-mono text-xs transition-colors cursor-pointer ${
              mode === 'reserved'
                ? 'bg-[#F5F4EF] text-[#18221E] font-semibold'
                : 'text-[#A3B3AC] hover:text-white'
            }`}
          >
            RESERVED ({myClaims.length})
          </button>
          <button
            type="button"
            onClick={() => setMode('intake')}
            className={`px-4 py-2 font-mono text-xs transition-colors cursor-pointer ${
              mode === 'intake'
                ? 'bg-[#1F6E4E] text-white font-semibold'
                : 'text-[#A3B3AC] hover:text-white'
            }`}
          >
            + LOG DEVICE
          </button>
          <button
            type="button"
            onClick={fetchAllData}
            title="Sync PostgreSQL"
            className="px-3 py-2 font-mono text-xs text-[#A3B3AC] hover:text-white border-l border-[#2C3B35] cursor-pointer"
          >
            ↻
          </button>
        </div>
      </div>
    </div>
  );
}