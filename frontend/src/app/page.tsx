'use client';

import { useState, useEffect, useMemo } from 'react';

interface ComponentItem {
  id: string;
  component_category: string;
  brand: string;
  model: string;
  device_type: string;
  status: string;
  specifications: Record<string, string | number>;
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

export default function SalvageWorkbench() {
  const [section, setSection] = useState<'directory' | 'intake'>('directory');
  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [lockingId, setLockingId] = useState<string | null>(null);
  const [claimedCount, setClaimedCount] = useState<number>(0);

  const [eventNotice, setEventNotice] = useState<{
    ok: boolean;
    tag: string;
    text: string;
  } | null>(null);

  // Recycler Intake State
  const [deviceType, setDeviceType] = useState('Laptop');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [condition, setCondition] = useState('Board Tested / Chassis Damaged');
  const [draftParts, setDraftParts] = useState<DraftPart[]>([
    { category: 'RAM', specKey1: 'capacity', specVal1: '8GB', specKey2: 'type', specVal2: 'DDR4' },
    { category: 'SSD', specKey1: 'capacity', specVal1: '256GB', specKey2: 'interface', specVal2: 'NVMe' },
  ]);
  const [savingBatch, setSavingBatch] = useState(false);

  const syncInventory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/components`);
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setComponents(data);
        if (data.length > 0 && !expandedId) {
          setExpandedId(data[0].id);
        }
      } else {
        setComponents([]);
        setEventNotice({
          ok: false,
          tag: 'DB_READ_ERR',
          text: data.error || 'Unable to query salvaged_components.',
        });
      }
    } catch {
      setComponents([]);
      setEventNotice({
        ok: false,
        tag: 'API_OFFLINE',
        text: 'Cannot connect to Express server on port 5000.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncInventory();
  }, []);

  const categoryStats = useMemo(() => {
    const counts: Record<string, number> = {};
    components.forEach((c) => {
      const key = c.component_category.toUpperCase();
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [components]);

  const visibleItems = useMemo(() => {
    return components.filter((item) => {
      const catMatch =
        selectedCategory === 'ALL' ||
        item.component_category.toUpperCase() === selectedCategory;
      const q = query.trim().toLowerCase();
      const textMatch =
        !q ||
        item.brand?.toLowerCase().includes(q) ||
        item.model?.toLowerCase().includes(q) ||
        item.component_category.toLowerCase().includes(q) ||
        JSON.stringify(item.specifications).toLowerCase().includes(q);
      return catMatch && textMatch;
    });
  }, [components, selectedCategory, query]);

  const executeClaim = async (componentId: string) => {
    setLockingId(componentId);
    setEventNotice(null);
    try {
      const res = await fetch(`${API_BASE}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ componentId, buyerId: DEMO_BUYER_ID }),
      });
      const data = await res.json();

      if (res.ok) {
        setEventNotice({
          ok: true,
          tag: 'COMMITTED',
          text: `Row lock acquired & committed for #${componentId.slice(0, 8)}.`,
        });
        setClaimedCount((prev) => prev + 1);
        setComponents((prev) => prev.filter((c) => c.id !== componentId));
        if (expandedId === componentId) setExpandedId(null);
      } else {
        setEventNotice({
          ok: false,
          tag: 'CONFLICT',
          text: data.error || 'Component already allocated.',
        });
      }
    } catch {
      setEventNotice({
        ok: false,
        tag: 'NET_FAIL',
        text: 'Transaction request failed.',
      });
    } finally {
      setLockingId(null);
    }
  };

  const addDraftPart = () => {
    setDraftParts([
      ...draftParts,
      { category: 'Battery', specKey1: 'capacity', specVal1: '', specKey2: 'health', specVal2: '' },
    ]);
  };

  const removeDraftPart = (idx: number) => {
    if (draftParts.length > 1) {
      setDraftParts(draftParts.filter((_, i) => i !== idx));
    }
  };

  const editDraftPart = (idx: number, field: keyof DraftPart, val: string) => {
    const copy = [...draftParts];
    copy[idx] = { ...copy[idx], [field]: val };
    setDraftParts(copy);
  };

  const commitIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand.trim() || !model.trim()) return;

    setSavingBatch(true);
    setEventNotice(null);

    const formatted = draftParts
      .filter((p) => p.category.trim())
      .map((p) => {
        const specs: Record<string, string> = {};
        if (p.specKey1.trim() && p.specVal1.trim()) specs[p.specKey1.trim()] = p.specVal1.trim();
        if (p.specKey2.trim() && p.specVal2.trim()) specs[p.specKey2.trim()] = p.specVal2.trim();
        return { category: p.category.trim(), specs };
      });

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
          components: formatted,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setEventNotice({
          ok: true,
          tag: 'INGESTED',
          text: `Chassis ${data.parentDeviceId.slice(0, 8)} logged with ${formatted.length} extracted parts.`,
        });
        setBrand('');
        setModel('');
        await syncInventory();
        setSection('directory');
      } else {
        setEventNotice({
          ok: false,
          tag: 'INSERT_ERR',
          text: data.error || 'Failed to save batch.',
        });
      }
    } catch {
      setEventNotice({
        ok: false,
        tag: 'API_OFFLINE',
        text: 'Could not reach backend server.',
      });
    } finally {
      setSavingBatch(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* LEFT PERSISTENT WORKBENCH RAIL */}
      <aside className="w-full lg:w-72 bg-[#12151B] border-b lg:border-b-0 lg:border-r border-[#232833] flex flex-col justify-between shrink-0">
        <div>
          {/* IDENTITY BLOCK */}
          <div className="p-6 border-b border-[#232833]">
            <div className="flex items-center gap-2 font-mono text-xs text-[#38BDF8] mb-2">
              <span className="h-2 w-2 bg-[#34D399] inline-block" />
              <span>NEON_PG // ONLINE</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[#F2F4F8]">
              SALVAGE.SYS
            </h1>
            <p className="text-xs text-[#8A94A6] mt-1 leading-relaxed">
              Municipal hardware recovery & atomic component exchange.
            </p>
          </div>

          {/* WORKSPACE SWITCHER */}
          <div className="p-4 border-b border-[#232833]">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#8A94A6] px-2 mb-2">
              Operations
            </p>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  setSection('directory');
                  setEventNotice(null);
                }}
                className={`w-full text-left px-3 py-2.5 text-sm font-medium flex items-center justify-between transition-colors cursor-pointer ${
                  section === 'directory'
                    ? 'bg-[#1D222C] text-[#F2F4F8] border-l-2 border-[#38BDF8]'
                    : 'text-[#8A94A6] hover:text-[#F2F4F8] hover:bg-[#181C24]'
                }`}
              >
                <span>Component Directory</span>
                <span className="font-mono text-xs text-[#38BDF8]">{components.length}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSection('intake');
                  setEventNotice(null);
                }}
                className={`w-full text-left px-3 py-2.5 text-sm font-medium flex items-center justify-between transition-colors cursor-pointer ${
                  section === 'intake'
                    ? 'bg-[#1D222C] text-[#F2F4F8] border-l-2 border-[#38BDF8]'
                    : 'text-[#8A94A6] hover:text-[#F2F4F8] hover:bg-[#181C24]'
                }`}
              >
                <span>Disassembly Intake</span>
                <span className="font-mono text-xs text-[#8A94A6]">+LOG</span>
              </button>
            </div>
          </div>

          {/* CATEGORY BREAKDOWN TREE (ONLY IN DIRECTORY MODE) */}
          {section === 'directory' && (
            <div className="p-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#8A94A6] px-2 mb-2">
                Hardware Classes
              </p>
              <div className="space-y-0.5 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('ALL')}
                  className={`w-full flex items-center justify-between px-3 py-2 transition-colors cursor-pointer ${
                    selectedCategory === 'ALL'
                      ? 'text-[#38BDF8] bg-[#181C24]'
                      : 'text-[#8A94A6] hover:text-[#F2F4F8]'
                  }`}
                >
                  <span>ALL_PARTS</span>
                  <span>{components.length}</span>
                </button>
                {Object.entries(categoryStats).map(([cat, count]) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`w-full flex items-center justify-between px-3 py-2 transition-colors cursor-pointer ${
                      selectedCategory === cat
                        ? 'text-[#38BDF8] bg-[#181C24]'
                        : 'text-[#8A94A6] hover:text-[#F2F4F8]'
                    }`}
                  >
                    <span>{cat}</span>
                    <span>{count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM SESSION TELEMETRY */}
        <div className="p-5 border-t border-[#232833] font-mono text-[11px] text-[#8A94A6] space-y-2">
          <div className="flex justify-between">
            <span>SESSION_CLAIMS</span>
            <span className="text-[#34D399]">{claimedCount}</span>
          </div>
          <div className="flex justify-between">
            <span>LOCK_MODE</span>
            <span className="text-[#F2F4F8]">FOR UPDATE</span>
          </div>
          <div className="pt-2 border-t border-[#232833] truncate text-[#F2F4F8]">
            {section === 'directory' ? 'buyer: student@bennett.edu.in' : 'recycler: municipal.gov'}
          </div>
        </div>
      </aside>

      {/* RIGHT MAIN OPERATIONAL WORKSPACE */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* TOP SEARCH & ACTION STRIP */}
        <div className="border-b border-[#232833] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0E1116]">
          <div className="flex items-center gap-3 flex-1">
            <span className="font-mono text-xs text-[#8A94A6]">QUERY //</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by chassis, DDR4, NVMe, Dell, ThinkPad..."
              className="w-full max-w-md bg-transparent text-sm text-[#F2F4F8] placeholder:text-[#555E70] focus:outline-none font-mono"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={syncInventory}
              className="border border-[#232833] hover:border-[#38BDF8] px-3.5 py-1.5 font-mono text-xs text-[#8A94A6] hover:text-[#F2F4F8] transition-colors cursor-pointer"
            >
              SYNC_DB
            </button>
          </div>
        </div>

        {/* INLINE EVENT FEEDBACK STRIP */}
        {eventNotice && (
          <div
            className={`border-b border-[#232833] px-6 py-3 font-mono text-xs flex items-center justify-between ${
              eventNotice.ok
                ? 'bg-[#0F241D] text-[#34D399]'
                : 'bg-[#291417] text-[#F87171]'
            }`}
          >
            <div>
              <span className="font-bold mr-3">[{eventNotice.tag}]</span>
              <span>{eventNotice.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setEventNotice(null)}
              className="uppercase underline text-[11px] cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}

        {/* CONTENT VIEW */}
        {section === 'directory' ? (
          <div className="flex-1">
            {/* DIRECTORY COLUMN HEADERS */}
            <div className="hidden md:grid md:grid-cols-12 border-b border-[#232833] px-6 py-3 font-mono text-[11px] uppercase tracking-wider text-[#8A94A6] bg-[#0D1015]">
              <div className="col-span-2">Part UUID</div>
              <div className="col-span-2">Class</div>
              <div className="col-span-3">Donor Hardware</div>
              <div className="col-span-3">Extracted Specs</div>
              <div className="col-span-2 text-right">Allocation</div>
            </div>

            {loading ? (
              <div className="p-12 font-mono text-xs text-[#8A94A6]">
                READING SALVAGED_COMPONENTS RELATION...
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="p-12 max-w-lg">
                <p className="text-lg font-semibold text-[#F2F4F8] mb-2">
                  No unallocated parts in current view.
                </p>
                <p className="text-sm text-[#8A94A6] mb-6">
                  All components in this filter have been claimed or none have been logged yet.
                </p>
                <button
                  type="button"
                  onClick={() => setSection('intake')}
                  className="bg-[#38BDF8] text-[#0B0D10] px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wider cursor-pointer"
                >
                  Open Disassembly Intake
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[#232833]">
                {visibleItems.map((item) => {
                  const isOpen = expandedId === item.id;
                  const specSummary = Object.entries(item.specifications || {})
                    .map(([k, v]) => `${v}`)
                    .join(' · ');

                  return (
                    <div key={item.id} className="transition-colors">
                      {/* PRIMARY DIRECTORY ROW */}
                      <div
                        onClick={() => setExpandedId(isOpen ? null : item.id)}
                        className={`grid grid-cols-1 md:grid-cols-12 items-center gap-3 px-6 py-4 cursor-pointer transition-colors ${
                          isOpen ? 'bg-[#151922]' : 'hover:bg-[#12151B]'
                        }`}
                      >
                        <div className="md:col-span-2 font-mono text-xs text-[#8A94A6] flex items-center gap-2">
                          <span className="text-[#38BDF8]">{isOpen ? '▾' : '▸'}</span>
                          <span>{item.id.slice(0, 8)}</span>
                        </div>

                        <div className="md:col-span-2 font-mono text-xs font-semibold text-[#F2F4F8]">
                          {item.component_category}
                        </div>

                        <div className="md:col-span-3">
                          <div className="text-sm font-medium text-[#F2F4F8]">
                            {item.brand} {item.model}
                          </div>
                          <div className="font-mono text-[11px] text-[#8A94A6]">
                            {item.device_type}
                          </div>
                        </div>

                        <div className="md:col-span-3 font-mono text-xs text-[#8A94A6] truncate">
                          {specSummary || 'NO_SPECS'}
                        </div>

                        <div
                          className="md:col-span-2 flex md:justify-end"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            disabled={lockingId === item.id}
                            onClick={() => executeClaim(item.id)}
                            className="bg-[#38BDF8] hover:bg-[#7DD3FC] disabled:opacity-50 text-[#0B0D10] px-3.5 py-1.5 font-mono text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                          >
                            {lockingId === item.id ? 'LOCKING' : 'ALLOCATE'}
                          </button>
                        </div>
                      </div>

                      {/* INLINE EXPANDED TELEMETRY TRAY */}
                      {isOpen && (
                        <div className="bg-[#0E1117] border-t border-[#232833] px-6 py-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
                          <div className="lg:col-span-7">
                            <p className="font-mono text-[10px] uppercase tracking-widest text-[#8A94A6] mb-3">
                              Hardware Specification Matrix (JSONB)
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {Object.entries(item.specifications || {}).map(([k, v]) => (
                                <div
                                  key={k}
                                  className="border border-[#232833] bg-[#12151B] px-3 py-2"
                                >
                                  <div className="font-mono text-[10px] uppercase text-[#8A94A6]">
                                    {k}
                                  </div>
                                  <div className="font-mono text-xs text-[#F2F4F8] mt-0.5 font-medium">
                                    {String(v)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="lg:col-span-5 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-[#232833] pt-4 lg:pt-0 lg:pl-6">
                            <div>
                              <p className="font-mono text-[10px] uppercase tracking-widest text-[#8A94A6] mb-1">
                                Full Record Identifier
                              </p>
                              <p className="font-mono text-xs text-[#F2F4F8] break-all mb-3">
                                {item.id}
                              </p>
                              <p className="text-xs text-[#8A94A6] leading-relaxed">
                                Allocation locks this row in PostgreSQL (
                                <code className="text-[#F2F4F8]">FOR UPDATE</code>) and inserts an
                                immutable claim receipt.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* DISASSEMBLY INTAKE BENCH */
          <form onSubmit={commitIntake} className="p-6 md:p-8 max-w-5xl">
            <div className="mb-8">
              <p className="font-mono text-xs text-[#38BDF8] uppercase mb-1">
                FACILITY_INTAKE // POST /API/INVENTORY
              </p>
              <h2 className="text-2xl font-bold text-[#F2F4F8]">
                Log Dismantled Donor Hardware
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* LEFT: PARENT CHASSIS */}
              <div className="lg:col-span-5 space-y-4">
                <p className="font-mono text-xs uppercase tracking-wider text-[#8A94A6] border-b border-[#232833] pb-2">
                  01. Parent Chassis
                </p>

                <div>
                  <label className="block font-mono text-xs text-[#8A94A6] mb-1.5">
                    DEVICE_CLASS
                  </label>
                  <select
                    value={deviceType}
                    onChange={(e) => setDeviceType(e.target.value)}
                    className="w-full bg-[#12151B] border border-[#232833] focus:border-[#38BDF8] focus:outline-none px-3 py-2 text-sm text-[#F2F4F8]"
                  >
                    <option value="Laptop">Laptop</option>
                    <option value="Workstation">Workstation</option>
                    <option value="Server">Server</option>
                    <option value="Switch">Network Switch</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-xs text-[#8A94A6] mb-1.5">
                    MANUFACTURER *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Lenovo, Dell, HP..."
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full bg-[#12151B] border border-[#232833] focus:border-[#38BDF8] focus:outline-none px-3 py-2 text-sm text-[#F2F4F8]"
                  />
                </div>

                <div>
                  <label className="block font-mono text-xs text-[#8A94A6] mb-1.5">
                    MODEL_NUMBER *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ThinkPad T480"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-[#12151B] border border-[#232833] focus:border-[#38BDF8] focus:outline-none px-3 py-2 text-sm text-[#F2F4F8]"
                  />
                </div>

                <div>
                  <label className="block font-mono text-xs text-[#8A94A6] mb-1.5">
                    DIAGNOSTIC_NOTE
                  </label>
                  <input
                    type="text"
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="w-full bg-[#12151B] border border-[#232833] focus:border-[#38BDF8] focus:outline-none px-3 py-2 text-sm text-[#F2F4F8]"
                  />
                </div>
              </div>

              {/* RIGHT: EXTRACTED PARTS */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between border-b border-[#232833] pb-2">
                  <p className="font-mono text-xs uppercase tracking-wider text-[#8A94A6]">
                    02. Extracted Child Parts
                  </p>
                  <button
                    type="button"
                    onClick={addDraftPart}
                    className="font-mono text-xs text-[#38BDF8] hover:underline cursor-pointer"
                  >
                    + ADD_ROW
                  </button>
                </div>

                <div className="space-y-3">
                  {draftParts.map((part, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 bg-[#12151B] border border-[#232833] p-3"
                    >
                      <input
                        type="text"
                        placeholder="Category"
                        value={part.category}
                        onChange={(e) => editDraftPart(idx, 'category', e.target.value)}
                        className="col-span-3 bg-[#0B0D10] border border-[#232833] px-2 py-1.5 font-mono text-xs text-[#F2F4F8]"
                      />
                      <input
                        type="text"
                        placeholder="Key 1"
                        value={part.specKey1}
                        onChange={(e) => editDraftPart(idx, 'specKey1', e.target.value)}
                        className="col-span-2 bg-[#0B0D10] border border-[#232833] px-2 py-1.5 font-mono text-xs text-[#8A94A6]"
                      />
                      <input
                        type="text"
                        placeholder="Val 1"
                        value={part.specVal1}
                        onChange={(e) => editDraftPart(idx, 'specVal1', e.target.value)}
                        className="col-span-2 bg-[#0B0D10] border border-[#232833] px-2 py-1.5 font-mono text-xs text-[#F2F4F8]"
                      />
                      <input
                        type="text"
                        placeholder="Key 2"
                        value={part.specKey2}
                        onChange={(e) => editDraftPart(idx, 'specKey2', e.target.value)}
                        className="col-span-2 bg-[#0B0D10] border border-[#232833] px-2 py-1.5 font-mono text-xs text-[#8A94A6]"
                      />
                      <input
                        type="text"
                        placeholder="Val 2"
                        value={part.specVal2}
                        onChange={(e) => editDraftPart(idx, 'specVal2', e.target.value)}
                        className="col-span-2 bg-[#0B0D10] border border-[#232833] px-2 py-1.5 font-mono text-xs text-[#F2F4F8]"
                      />
                      <button
                        type="button"
                        onClick={() => removeDraftPart(idx)}
                        disabled={draftParts.length === 1}
                        className="col-span-1 font-mono text-xs text-[#8A94A6] hover:text-[#F87171] disabled:opacity-30 cursor-pointer"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setSection('directory')}
                    className="border border-[#232833] px-4 py-2 font-mono text-xs text-[#8A94A6] hover:text-[#F2F4F8] cursor-pointer"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={savingBatch}
                    className="bg-[#38BDF8] hover:bg-[#7DD3FC] text-[#0B0D10] px-5 py-2 font-mono text-xs font-semibold uppercase tracking-wider cursor-pointer"
                  >
                    {savingBatch ? 'COMMITTING...' : 'COMMIT_TO_POSTGRES'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}