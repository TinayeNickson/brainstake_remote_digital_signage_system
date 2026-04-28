'use client';

import React, { useState, useEffect } from 'react';
import DaySelector from '@/components/DaySelector';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { countScheduledDays, getPricePerSlot } from '@/lib/pricing';
import { money, fmtDate } from '@/lib/format';
import type { Location, Package, AdDuration, SlotAvailability } from '@/lib/types';

const STEPS = [
  { num: 1, label: 'Ad Type',    desc: 'Image, video, or audio' },
  { num: 2, label: 'Upload',     desc: 'Your creative file'     },
  { num: 3, label: 'Configure',  desc: 'Package & schedule'     },
  { num: 4, label: 'Review',     desc: 'Confirm & book'         },
];

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const ACCEPT: Record<string, string> = {
  image: 'image/*',
  video: 'video/*',
  audio: 'audio/*,video/*',
};

export default function NewBookingForm({
  locations,
  packages,
}: {
  locations: Location[];
  packages: Package[];
}) {
  const supa = supabaseBrowser();

  /* ── Step state ─────────────────── */
  const [step, setStep] = useState(1);

  /* ── Step 1: Ad Type ────────────── */
  const [adType,    setAdType]    = useState<'image'|'video'|'audio'|''>('');
  const [step1Err,  setStep1Err]  = useState('');

  /* ── Step 2: Upload ─────────────── */
  const [title,    setTitle]    = useState('');
  const [files,    setFiles]    = useState<File[]>([]);
  const [step2Err, setStep2Err] = useState('');
  // Convenience: first file (used everywhere a single file was expected)
  const file = files[0] ?? null;

  /* ── Step 3: Package + Configure ── */
  const [selectedPkg,  setSelectedPkg]  = useState<Package | null>(null);
  const [selectedLocs, setSelectedLocs] = useState<Location[]>([]);
  const [duration,     setDuration]     = useState<AdDuration>('15');
  const today = fmtDate(new Date());
  const [step3Err, setStep3Err] = useState('');

  // Schedule mode: true = one shared schedule applied to all locations
  const [applyToAll, setApplyToAll] = useState(true);

  // Global schedule (used when applyToAll = true)
  const [globalStart, setGlobalStart] = useState(today);
  const [globalEnd,   setGlobalEnd]   = useState(today);
  const [globalDow,   setGlobalDow]   = useState<number[]>([1,2,3,4,5]);
  const [globalSlots, setGlobalSlots] = useState(1);

  // Per-location schedule overrides: { location_id -> { start, end, dow, slots } }
  interface LocSchedule { start: string; end: string; dow: number[]; slots: number; }
  const [locSchedules, setLocSchedules] = useState<Record<string, LocSchedule>>({});

  // Return the effective schedule for a location
  function getLocSchedule(locId: string): LocSchedule {
    if (applyToAll) {
      return { start: globalStart, end: globalEnd, dow: globalDow, slots: globalSlots };
    }
    return locSchedules[locId] ?? {
      start:  globalStart,
      end:    globalEnd,
      dow:    globalDow,
      slots:  selectedPkg?.base_slots_per_day ?? 1,
    };
  }

  function setLocSched(locId: string, patch: Partial<LocSchedule>) {
    setLocSchedules(prev => ({
      ...prev,
      [locId]: { ...getLocSchedule(locId), ...patch },
    }));
  }

  /* ── Step 4: Submit ─────────────── */
  const [busy,      setBusy]      = useState(false);
  const [submitErr, setSubmitErr] = useState('');

  /* ── Slot availability ──────────── */
  const [slotAvailability, setSlotAvailability] = useState<Record<string, SlotAvailability>>({});
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  /* ── Derived pricing ─────────────────── */
  const locLineItems = selectedLocs.map(loc => {
    const sched = getLocSchedule(loc.id);
    const pps   = getPricePerSlot(loc, duration);
    const days  = (sched.start && sched.end && sched.dow.length > 0)
      ? countScheduledDays(new Date(sched.start), new Date(sched.end), sched.dow)
      : 0;
    return { loc, sched, pricePerSlot: pps, days, slots: sched.slots, subtotal: pps * sched.slots * days };
  });
  const totalPrice = locLineItems.reduce((s, r) => s + r.subtotal, 0);

  /* Sync duration + global slots when package changes */
  useEffect(() => {
    if (!selectedPkg) return;
    if (duration === '60' && !selectedPkg.allows_60s) setDuration('15');
    if (duration === '30' && !selectedPkg.allows_30s) setDuration('15');
    setGlobalSlots(selectedPkg.base_slots_per_day);
  }, [selectedPkg]); // eslint-disable-line

  /* Fetch slot availability when dates change */
  useEffect(() => {
    const effectiveStart = applyToAll ? globalStart : null;
    const effectiveEnd = applyToAll ? globalEnd : null;
    
    // If per-location mode, use the earliest start and latest end from selected locations
    let start = effectiveStart;
    let end = effectiveEnd;
    
    if (!applyToAll && selectedLocs.length > 0) {
      const schedules = selectedLocs.map(loc => locSchedules[loc.id]).filter(Boolean);
      if (schedules.length > 0) {
        start = schedules.reduce((min, s) => s.start < min ? s.start : min, schedules[0].start);
        end = schedules.reduce((max, s) => s.end > max ? s.end : max, schedules[0].end);
      }
    }
    
    if (!start || !end || start > end) return;
    
    setLoadingAvailability(true);
    fetch(`/api/availability/locations?start=${start}&end=${end}`)
      .then(r => r.json())
      .then(data => {
        if (data.availability) {
          setSlotAvailability(data.availability);
        }
      })
      .catch(() => {/* silent fail - availability is informational */})
      .finally(() => setLoadingAvailability(false));
  }, [globalStart, globalEnd, applyToAll, locSchedules, selectedLocs.length]); // eslint-disable-line

  /* ── Validation ─────────────────── */
  function validateStep1() {
    if (!adType) { setStep1Err('Please select an ad type to continue.'); return false; }
    setStep1Err(''); return true;
  }
  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const arr = Array.from(incoming);
    if (adType === 'image') {
      // merge, deduplicate by name+size
      setFiles(prev => {
        const existing = new Set(prev.map(f => f.name + f.size));
        const fresh = arr.filter(f => !existing.has(f.name + f.size));
        return [...prev, ...fresh];
      });
    } else {
      // video/audio: single file only
      setFiles(arr.slice(0, 1));
    }
    setStep2Err('');
  }
  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  }

  function validateStep2() {
    if (!title.trim())    { setStep2Err('Please enter a campaign title.'); return false; }
    if (files.length === 0) { setStep2Err('Please upload your ad file.'); return false; }
    setStep2Err(''); return true;
  }
  function toggleLocation(loc: Location) {
    setSelectedLocs(prev => {
      const already = prev.some(l => l.id === loc.id);
      if (already) return prev.filter(l => l.id !== loc.id);
      // Initialise per-location schedule from current global values
      setLocSchedules(m => ({
        ...m,
        [loc.id]: m[loc.id] ?? {
          start: globalStart, end: globalEnd,
          dow:   globalDow,
          slots: selectedPkg?.base_slots_per_day ?? 1,
        },
      }));
      return [...prev, loc];
    });
    setStep3Err('');
  }

  function validateStep3() {
    if (!selectedPkg)             { setStep3Err('Please select a package.'); return false; }
    if (selectedLocs.length === 0){ setStep3Err('Please select at least one location.'); return false; }
    if (duration === '60' && !selectedPkg.allows_60s) {
      setStep3Err('60-second slots are only available in the Pro Premium package.'); return false;
    }
    for (const loc of selectedLocs) {
      const s = getLocSchedule(loc.id);
      if (!s.start || !s.end)       { setStep3Err(`Set a start and end date for ${loc.name}.`); return false; }
      if (s.end < s.start)          { setStep3Err(`End date must be after start date for ${loc.name}.`); return false; }
      if (s.dow.length === 0)       { setStep3Err(`Select at least one play day for ${loc.name}.`); return false; }
      const days = countScheduledDays(new Date(s.start), new Date(s.end), s.dow);
      if (days === 0)               { setStep3Err(`No valid days in the selected range for ${loc.name}.`); return false; }
      if (s.slots < 1)              { setStep3Err(`Slots per day must be at least 1 for ${loc.name}.`); return false; }
      if (s.slots > loc.max_slots_per_day) {
        setStep3Err(`${loc.name} allows a maximum of ${loc.max_slots_per_day} slots/day.`); return false;
      }
    }
    setStep3Err(''); return true;
  }

  function goNext() {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step === 3 && !validateStep3()) return;
    setStep(s => s + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function goBack() { setStep(s => s - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  /* ── Final submit ───────────────── */
  async function submit() {
    setSubmitErr(''); setBusy(true);
    try {
      const { data: { user } } = await supa.auth.getUser();
      if (!user) throw new Error('Please sign in again.');

      // Upload all files, then create ONE ad row.
      // For multi-image: media_url stores a JSON array of all URLs so the
      // player can cycle through each image in the slideshow.
      const adFormat = adType === 'audio' ? 'video' : adType as 'image'|'video';
      const uploadedUrls: string[] = [];
      const firstPath: string[] = [];
      for (const f of files) {
        const ext  = f.name.split('.').pop() || 'bin';
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supa.storage.from('ad-media').upload(path, f, {
          contentType: f.type, upsert: false,
        });
        if (upErr) throw new Error(upErr.message);
        const { data: pub } = supa.storage.from('ad-media').getPublicUrl(path);
        uploadedUrls.push(pub.publicUrl);
        if (firstPath.length === 0) firstPath.push(path);
      }
      // Single image → plain URL. Multiple images → JSON array string.
      const mediaUrl = uploadedUrls.length === 1
        ? uploadedUrls[0]
        : JSON.stringify(uploadedUrls);
      const { data: ad, error: adErr } = await supa.from('ads').insert({
        customer_id:     user.id,
        title,
        format:          adFormat,
        duration,
        media_url:       mediaUrl,
        media_path:      firstPath[0],
        mime_type:       files[0].type,
        file_size_bytes: files.reduce((s, f) => s + f.size, 0),
      }).select().single();
      if (adErr) throw new Error(adErr.message);

      // Build per-location config array for v3 API
      const location_configs = selectedLocs.map(loc => {
        const s = getLocSchedule(loc.id);
        return {
          location_id:   loc.id,
          slots_per_day: s.slots,
          start_date:    s.start,
          end_date:      s.end,
          days_of_week:  s.dow,
        };
      });

      const res = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ad_id:            ad.id,
          location_configs,
          duration,
          package_id:       selectedPkg!.id,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Booking failed');
      window.location.href = `/dashboard/payment/campaign/${json.campaign.id}`;
    } catch (e: any) {
      setSubmitErr(e.message || 'Something went wrong');
      setBusy(false);
    }
  }

  /* ── Render ─────────────────────── */
  return (
    <div className="max-w-2xl mx-auto space-y-7">

      {/* Page title */}
      <div>
        <p className="text-sm text-ink-900/50 font-medium mb-0.5">New Campaign</p>
        <h1 className="text-3xl font-bold text-ink-900 tracking-tight">Create your advert</h1>
      </div>

      {/* Progress stepper */}
      <div className="card p-5">
        <div className="flex items-start">
          {STEPS.map((s, i) => {
            const done    = step > s.num;
            const current = step === s.num;
            return (
              <div key={s.num} className="flex items-start flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[13px] transition-all shrink-0 ${
                    done    ? 'bg-brand text-white'
                    : current ? 'bg-brand text-white ring-4 ring-brand/20'
                    : 'bg-ink-100 text-ink-900/35'}`}>
                    {done
                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      : s.num}
                  </div>
                  <div className="text-center hidden sm:block px-1">
                    <p className={`text-[11px] font-semibold leading-snug ${current ? 'text-brand' : done ? 'text-ink-900/55' : 'text-ink-900/25'}`}>{s.label}</p>
                  </div>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mt-4 mx-1.5 rounded-full transition-all ${done ? 'bg-brand' : 'bg-ink-100'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── STEP 1: Ad Type ─────────────────────────────────────────── */}
      {step === 1 && (
        <div className="card p-6 space-y-5">
          <StepHeader icon={<AdTypeIcon />} title="What type of ad are you creating?" desc="Select the format of your creative" />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([
              { type: 'image', label: 'Image', desc: 'JPG, PNG, GIF', icon: <ImageIcon /> },
              { type: 'video', label: 'Video', desc: 'MP4, MOV, WEBM', icon: <VideoIcon /> },
              { type: 'audio', label: 'Audio', desc: 'Background music', icon: <AudioIcon /> },
            ] as const).map(opt => {
              const sel = adType === opt.type;
              return (
                <button key={opt.type} type="button"
                  onClick={() => { setAdType(opt.type); setStep1Err(''); }}
                  className={`flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all text-center ${
                    sel ? 'border-brand bg-brand-soft/30 shadow-sm' : 'border-ink-100 bg-white hover:border-brand/40'}`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${sel ? 'bg-brand text-white' : 'bg-ink-50 text-ink-900/50'}`}>
                    {opt.icon}
                  </div>
                  <div>
                    <p className={`font-bold text-[15px] ${sel ? 'text-brand' : 'text-ink-900'}`}>{opt.label}</p>
                    <p className="text-xs text-ink-900/40 mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {step1Err && <ErrBox msg={step1Err} />}

          <button type="button" onClick={goNext} className="btn btn-primary w-full h-11 font-semibold text-[15px]">
            Continue — Upload Creative
            <ChevronRightIcon />
          </button>
        </div>
      )}

      {/* ── STEP 2: Upload ───────────────────────────────────────────── */}
      {step === 2 && (
        <div className="card p-6 space-y-5">
          <StepHeader icon={<UploadIcon />} title="Upload your ad" desc={`Upload your ${adType} file`} />

          <div>
            <label className="label">Campaign title <Required /></label>
            <input className="input" value={title}
              onChange={e => { setTitle(e.target.value); setStep2Err(''); }}
              placeholder="e.g. Grand Opening — June Sale" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label mb-0">
                {adType === 'image' ? 'Image files' : adType === 'video' ? 'Video file' : 'Audio file'} <Required />
                <span className="normal-case font-normal text-ink-900/40 text-xs ml-1">
                  {adType === 'image' ? 'JPG, PNG, GIF — max 20 MB each' : adType === 'video' ? 'MP4, MOV — max 200 MB' : 'MP3, WAV, AAC or video — max 100 MB'}
                </span>
              </label>
              {adType === 'image' && files.length > 0 && (
                <span className="inline-flex items-center gap-1 bg-brand text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {files.length} image{files.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Drop zone */}
            <label className="upload-zone block cursor-pointer">
              <input
                type="file"
                accept={ACCEPT[adType] ?? '*/*'}
                multiple={adType === 'image'}
                className="sr-only"
                onChange={e => addFiles(e.target.files)}
              />
              {files.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-4 text-ink-900/40">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <p className="font-semibold text-sm text-ink-900/60">
                    {adType === 'image' ? 'Click to upload one or more images' : 'Click to upload'}
                  </p>
                  {adType === 'image' && <p className="text-xs text-ink-900/35">You can select multiple files at once</p>}
                </div>
              ) : adType !== 'image' ? (
                <div className="flex flex-col items-center gap-2 py-2 text-brand">
                  <div className="w-10 h-10 rounded-full bg-brand-soft flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <p className="font-semibold text-sm text-ink-900">{file!.name}</p>
                  <p className="text-ink-900/40 text-xs">{(file!.size / 1024 / 1024).toFixed(1)} MB</p>
                  <span className="text-xs text-brand underline">Click to change file</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-3 text-brand">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <span className="text-xs text-brand underline">Click to add more images</span>
                </div>
              )}
            </label>

            {/* Image file list */}
            {adType === 'image' && files.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {files.map((f, i) => (
                  <div key={f.name + f.size}
                    className="flex items-center gap-3 rounded-xl border border-ink-100 bg-ink-50 px-3 py-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-brand shrink-0"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    <span className="flex-1 text-sm text-ink-900 truncate">{f.name}</span>
                    <span className="text-xs text-ink-900/40 shrink-0">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                    <button type="button" onClick={() => removeFile(i)}
                      className="shrink-0 text-ink-900/30 hover:text-red-500 transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {step2Err && <ErrBox msg={step2Err} />}
          <NavRow onBack={goBack} onNext={goNext} nextLabel="Choose Package & Schedule" />
        </div>
      )}

      {/* ── STEP 3: Package + Configure ──────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-5">

          {/* Package selection */}
          <div className="card p-6 space-y-4">
            <StepHeader icon={<PackageIcon />} title="Select a Package" desc="Package defines your base slots and pricing tier" />
            {packages.length === 0 ? (
              <p className="text-sm text-ink-900/50 text-center py-6">No packages available. Please contact support.</p>
            ) : (
              <div className="space-y-3">
                {packages.map(pkg => {
                  const sel = selectedPkg?.id === pkg.id;
                  return (
                    <button key={pkg.id} type="button" onClick={() => { setSelectedPkg(pkg); setStep3Err(''); }}
                      className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                        sel ? 'border-brand bg-brand-soft/30' : 'border-ink-100 bg-white hover:border-brand/40'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="font-bold text-ink-900">{pkg.name}</p>
                            {pkg.allows_60s && (
                              <span className="inline-flex px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold">60s available</span>
                            )}
                            {sel && <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-brand text-white text-[10px] font-bold">
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                              Selected
                            </span>}
                          </div>
                          {pkg.description && <p className="text-sm text-ink-900/50 mb-2">{pkg.description}</p>}
                          <div className="flex flex-wrap gap-1.5">
                            <Chip icon={<SlotsIcon />} label={`${pkg.base_slots_per_day} base plays/day`} />
                            <Chip icon={<ClockIcon />} label={[pkg.allows_15s && '15s', pkg.allows_30s && '30s', pkg.allows_60s && '60s'].filter(Boolean).join(' · ')} />
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

            {/* Location + Duration */}
          <div className="card p-6 space-y-5">
            <StepHeader icon={<LocationIcon />} title="Locations & Duration" desc="Select one or more screens where your ad will play" />

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Screen locations <Required /></label>
                {selectedLocs.length > 0 && (
                  <span className="inline-flex items-center gap-1 bg-brand text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    {selectedLocs.length} selected
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-900/45 mb-3">Click to select. Schedule details are configured in the Schedule section below.</p>
              <div className="space-y-2">
                {locations.map(loc => {
                  const sel  = selectedLocs.some(l => l.id === loc.id);
                  const lineItem = locLineItems.find(li => li.loc.id === loc.id);
                  return (
                    <div key={loc.id}
                      className={`rounded-xl border-2 transition-all ${
                        sel ? 'border-brand bg-brand-soft/10 shadow-sm' : 'border-ink-100 bg-white'
                      }`}>
                      {/* Selection row */}
                      <button type="button" onClick={() => toggleLocation(loc)}
                        className="w-full text-left px-4 py-3 flex items-center gap-4">
                        <div className={`w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-all ${
                          sel ? 'bg-brand border-brand' : 'border-ink-300'
                        }`}>
                          {sel && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-[14px] ${sel ? 'text-brand' : 'text-ink-900'}`}>{loc.name}</p>
                          {loc.description && <p className="text-xs text-ink-900/45 mt-0.5">{loc.description}</p>}
                          <div className="flex gap-3 mt-1 text-[11px] text-ink-900/50">
                            <span>15s — {money(loc.price_15s)}/slot</span>
                            <span>30s — {money(loc.price_30s)}/slot</span>
                            {loc.price_60s > 0 && <span>60s — {money(loc.price_60s)}/slot</span>}
                            {(() => {
                              const avail = slotAvailability[loc.id];
                              if (!avail) return <span className="text-ink-900/35">max {loc.max_slots_per_day}/day</span>;
                              const isLimited = avail.min_available < 5;
                              return (
                                <span className={isLimited ? 'text-amber-600 font-medium' : 'text-ink-900/35'}>
                                  max {avail.max_slots}/day
                                  <span className="mx-1">·</span>
                                  {avail.min_available} available
                                  {loadingAvailability && <span className="ml-1 opacity-50">(loading...)</span>}
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                        {lineItem && lineItem.subtotal > 0 && (
                          <div className="text-right shrink-0">
                            <p className="text-[11px] text-ink-900/40">{money(lineItem.pricePerSlot)}/slot</p>
                            <p className="font-bold text-brand text-sm">{money(lineItem.subtotal)}</p>
                          </div>
                        )}
                      </button>

                      {/* Schedule summary strip — visible when selected */}
                      {sel && lineItem && (
                        <div className="border-t border-brand/10 px-4 py-2 bg-brand-soft/10 rounded-b-xl flex items-center gap-3 flex-wrap">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-brand shrink-0"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                          <span className="text-[11px] text-ink-900/55">
                            {lineItem.sched.start} &rarr; {lineItem.sched.end}
                          </span>
                          <span className="text-[11px] text-ink-900/40">&middot;</span>
                          <span className="text-[11px] text-ink-900/55">
                            {lineItem.sched.dow.map(d => DOW_LABELS[d]).join(', ')}
                          </span>
                          <span className="text-[11px] text-ink-900/40">&middot;</span>
                          <span className="text-[11px] font-semibold text-brand">
                            {lineItem.slots} slot{lineItem.slots !== 1 ? 's' : ''}/day
                          </span>
                          {!applyToAll && (
                            <span className="ml-auto text-[10px] text-ink-900/35 italic">individual schedule</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="label">Slot duration <Required /></label>
              <div className="flex gap-2">
                {(['15', '30', '60'] as AdDuration[]).map(d => {
                  const allowed = d === '15' ? (selectedPkg?.allows_15s ?? true)
                                : d === '30' ? (selectedPkg?.allows_30s ?? true)
                                : (selectedPkg?.allows_60s ?? false);
                  return (
                    <button key={d} type="button" disabled={!allowed}
                      onClick={() => { setDuration(d); setStep3Err(''); }}
                      className={`flex-1 h-11 rounded-xl border-2 font-bold text-sm transition-all ${
                        !allowed ? 'border-ink-100 bg-ink-50 text-ink-900/20 cursor-not-allowed'
                        : duration === d ? 'border-brand bg-brand-soft/30 text-brand'
                        : 'border-ink-100 bg-white hover:border-brand/40 text-ink-900'}`}>
                      {d}s
                      {d === '60' && !allowed && <span className="block text-[9px] font-normal mt-0.5">Pro Premium only</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Schedule card */}
          <div className="card p-6 space-y-5">
            <StepHeader icon={<CalendarIcon />} title="Schedule" desc="Set dates, play days, and slots per location" />

            {/* Mode toggle */}
            <div className="flex items-center justify-between rounded-xl border border-ink-200 px-4 py-3">
              <div>
                <p className="text-[13px] font-semibold text-ink-900">Apply same schedule to all locations</p>
                <p className="text-[11px] text-ink-900/45 mt-0.5">Turn off to configure each location independently</p>
              </div>
              <button
                type="button"
                onClick={() => { setApplyToAll(v => !v); setStep3Err(''); }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                  applyToAll ? 'bg-brand' : 'bg-ink-200'
                }`}>
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  applyToAll ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {/* Global mode: one block */}
            {applyToAll && (
              <ScheduleBlock
                locName={null}
                start={globalStart}  onStart={v => { setGlobalStart(v); setStep3Err(''); }}
                end={globalEnd}      onEnd={v => { setGlobalEnd(v); setStep3Err(''); }}
                dow={globalDow}      onDow={v => { setGlobalDow(v); setStep3Err(''); }}
                slots={globalSlots}  onSlots={v => setGlobalSlots(Math.max(1, v))}
                maxSlots={Math.min(...(selectedLocs.length ? selectedLocs.map(l => l.max_slots_per_day) : [999]))}
                today={today}
                minStart={today}
              />
            )}

            {/* Per-location mode: one block per selected location */}
            {!applyToAll && selectedLocs.length === 0 && (
              <p className="text-sm text-ink-900/45 text-center py-2">Select at least one location above to configure its schedule.</p>
            )}
            {!applyToAll && selectedLocs.map(loc => {
              const s = getLocSchedule(loc.id);
              return (
                <div key={loc.id} className="rounded-xl border border-ink-200 overflow-hidden">
                  <div className="px-4 py-2.5 bg-ink-50 border-b border-ink-100 flex items-center gap-2">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-brand"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    <span className="text-[12px] font-bold text-ink-900">{loc.name}</span>
                    <span className="text-[11px] text-ink-900/40 ml-auto">max {loc.max_slots_per_day} slots/day</span>
                  </div>
                  <div className="p-4">
                    <ScheduleBlock
                      locName={loc.name}
                      start={s.start}  onStart={v => setLocSched(loc.id, { start: v })}
                      end={s.end}      onEnd={v => setLocSched(loc.id, { end: v })}
                      dow={s.dow}      onDow={v => setLocSched(loc.id, { dow: v })}
                      slots={s.slots}  onSlots={v => setLocSched(loc.id, { slots: Math.max(1, v) })}
                      maxSlots={loc.max_slots_per_day}
                      today={today}
                      minStart={today}
                    />
                  </div>
                </div>
              );
            })}

            {/* Live price preview */}
            {selectedLocs.length > 0 && totalPrice > 0 && (
              <div className="rounded-xl bg-brand-soft/40 border border-brand/15 p-4">
                <p className="text-xs text-ink-900/40 font-semibold uppercase tracking-widest mb-3">Live price estimate</p>
                <div className="space-y-2 mb-3">
                  <div className="grid grid-cols-4 text-[10px] font-semibold uppercase tracking-widest text-ink-900/40 pb-1 border-b border-brand/10">
                    <span>Location</span><span className="text-center">Slots</span><span className="text-center">Days</span><span className="text-right">Subtotal</span>
                  </div>
                  {locLineItems.map(({ loc, pricePerSlot: pps, slots, days, subtotal }) => (
                    <div key={loc.id}>
                      <div className="grid grid-cols-4 items-center text-sm">
                        <span className="text-ink-900/70 flex items-center gap-1.5 truncate">
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                          <span className="truncate">{loc.name}</span>
                        </span>
                        <span className="text-center font-bold text-ink-900">{slots}</span>
                        <span className="text-center text-ink-900/60">{days}</span>
                        <span className="font-semibold text-right text-brand">{money(subtotal)}</span>
                      </div>
                      <p className="text-[10px] text-ink-900/35 text-right">
                        {money(pps)}/slot &times; {slots} &times; {days} days
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-brand/15 pt-3">
                  <p className="text-sm font-semibold text-ink-900">Grand total</p>
                  <p className="font-bold text-2xl text-brand">{money(totalPrice)}</p>
                </div>
              </div>
            )}
          </div>

          {step3Err && <ErrBox msg={step3Err} />}
          <NavRow onBack={goBack} onNext={goNext} nextLabel="Review Campaign" />
        </div>
      )}

      {/* ── STEP 4: Review & Submit ───────────────────────────────────── */}
      {step === 4 && (
        <div className="card p-6 space-y-5">
          <StepHeader icon={<CheckIcon />} title="Review your campaign" desc="Confirm everything before proceeding to payment." />

          <ReviewSection title="Ad Type">
            <ReviewRow k="Format" v={adType.charAt(0).toUpperCase() + adType.slice(1)} />
            <ReviewRow k="Campaign title" v={title} />
            <ReviewRow k="File" v={
              adType === 'image' && files.length > 1
                ? `${files.length} images — ${files.map(f => f.name).join(', ')}`
                : `${file?.name} (${((file?.size ?? 0) / 1024 / 1024).toFixed(1)} MB)`
            } />
          </ReviewSection>

          <ReviewSection title="Package & Locations">
            <ReviewRow k="Package"      v={selectedPkg?.name ?? '—'} />
            <ReviewRow k="Locations"    v={selectedLocs.map(l => l.name).join(', ') || '—'} />
            <ReviewRow k="Slot duration" v={`${duration}s`} />
          </ReviewSection>

          <ReviewSection title="Schedule">
            <ReviewRow k="Mode" v={applyToAll ? 'Same schedule for all locations' : 'Per-location schedule'} />
            {locLineItems.map(({ loc, sched, days }) => (
              <React.Fragment key={loc.id}>
                <ReviewRow k={loc.name} v={`${sched.slots} slot${sched.slots !== 1 ? 's' : ''}/day · ${days} day${days !== 1 ? 's' : ''}`} />
                <ReviewRow k={`  ${loc.name} dates`} v={`${sched.start} to ${sched.end}`} />
                <ReviewRow k={`  ${loc.name} days`}  v={sched.dow.map(d => DOW_LABELS[d]).join(', ')} />
              </React.Fragment>
            ))}
          </ReviewSection>

          {/* Pricing breakdown */}
          <div className="rounded-xl bg-[#0a2e1f] text-white p-5">
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-4">Amount Due</p>
            <div className="space-y-1 text-sm text-white/60 mb-4">
              <div className="flex justify-between text-white/40 text-[10px] uppercase tracking-widest mb-1">
                <span>Location</span><span>Subtotal</span>
              </div>
              {locLineItems.map(({ loc, pricePerSlot: pps, slots, days, subtotal }) => (
                <div key={loc.id}>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1.5">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      {loc.name}
                    </span>
                    <span className="text-white font-semibold">{money(subtotal)}</span>
                  </div>
                  <p className="text-[10px] text-white/30 text-right">{money(pps)}/slot &times; {slots} &times; {days} days</p>
                </div>
              ))}
            </div>
            <div className="flex items-end justify-between border-t border-white/10 pt-4">
              <p className="text-white/55 text-sm">{selectedPkg?.name} &middot; {selectedLocs.length} location{selectedLocs.length !== 1 ? 's' : ''}</p>
              <p className="font-bold text-4xl tracking-tight">{money(totalPrice)}</p>
            </div>
          </div>

          {submitErr && <ErrBox msg={submitErr} />}

          <div className="flex gap-3">
            <button type="button" onClick={goBack} className="btn btn-ghost h-11 px-5 font-semibold">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="mr-1"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              Edit
            </button>
            <button type="button" onClick={submit} disabled={busy}
              className="btn btn-primary flex-1 h-11 font-semibold text-[15px]">
              {busy ? 'Creating your booking…' : `Confirm & Pay ${money(totalPrice)}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Shared sub-components ──────────────────────────────────────────── */

interface ScheduleBlockProps {
  locName:  string | null;
  start:    string; onStart: (v: string) => void;
  end:      string; onEnd:   (v: string) => void;
  dow:      number[]; onDow: (v: number[]) => void;
  slots:    number; onSlots: (v: number) => void;
  maxSlots: number;
  today:    string;
  minStart: string;
}

function ScheduleBlock({ start, onStart, end, onEnd, dow, onDow, slots, onSlots, maxSlots, today, minStart }: ScheduleBlockProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Start date <span className="text-red-500 ml-0.5">*</span></label>
          <input className="input" type="date" value={start} min={minStart}
            onChange={e => onStart(e.target.value)} />
        </div>
        <div>
          <label className="label">End date <span className="text-red-500 ml-0.5">*</span></label>
          <input className="input" type="date" value={end} min={start || today}
            onChange={e => onEnd(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Play days <span className="text-red-500 ml-0.5">*</span></label>
        <DaySelector value={dow} onChange={onDow} />
      </div>
      <div>
        <label className="label">Slots per day <span className="text-red-500 ml-0.5">*</span></label>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => onSlots(slots - 1)} disabled={slots <= 1}
            className="w-9 h-9 rounded-xl border-2 border-ink-200 font-bold text-lg hover:border-brand transition-colors flex items-center justify-center select-none disabled:opacity-30">
            −
          </button>
          <input
            type="number" min={1} max={maxSlots}
            value={slots}
            onChange={e => onSlots(parseInt(e.target.value) || 1)}
            className="w-16 h-9 text-center input font-bold tabular-nums"
          />
          <button type="button" onClick={() => onSlots(slots + 1)} disabled={slots >= maxSlots}
            className="w-9 h-9 rounded-xl border-2 border-ink-200 font-bold text-lg hover:border-brand transition-colors flex items-center justify-center select-none disabled:opacity-30">
            +
          </button>
          <span className="text-sm text-ink-900/45">plays / day &nbsp;&middot;&nbsp; max {maxSlots}</span>
        </div>
      </div>
    </div>
  );
}

function Required() {
  return <span className="text-red-500 ml-0.5">*</span>;
}

function ErrBox({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      {msg}
    </div>
  );
}

function StepHeader({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 pb-4 border-b border-ink-100">
      <div className="w-9 h-9 rounded-xl bg-brand-soft flex items-center justify-center text-brand shrink-0">{icon}</div>
      <div>
        <h2 className="font-bold text-lg text-ink-900">{title}</h2>
        <p className="text-sm text-ink-900/50">{desc}</p>
      </div>
    </div>
  );
}

function NavRow({ onBack, onNext, nextLabel }: { onBack: () => void; onNext: () => void; nextLabel: string }) {
  return (
    <div className="flex gap-3 pt-1">
      <button type="button" onClick={onBack} className="btn btn-ghost h-11 px-5 font-semibold">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="mr-1"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Back
      </button>
      <button type="button" onClick={onNext} className="btn btn-primary flex-1 h-11 font-semibold text-[15px]">
        {nextLabel}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="ml-1.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
      </button>
    </div>
  );
}

function Chip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-ink-50 border border-ink-100 text-[12px] font-medium text-ink-900/65">
      <span className="text-ink-900/40">{icon}</span>
      {label}
    </span>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-ink-900/35 mb-2">{title}</p>
      <div className="rounded-xl border border-ink-100 divide-y divide-ink-100 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function ReviewRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm bg-white">
      <span className="text-ink-900/50">{k}</span>
      <span className="font-semibold text-ink-900 text-right ml-4 max-w-[60%] truncate">{v}</span>
    </div>
  );
}

/* ── Inline SVG icons (no emojis) ───────────────────────────────────── */
function PackageIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>;
}
function UploadIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
}
function CalendarIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
}
function CheckIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
}
function LocationIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
}
function ClockIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}
function SlotsIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
}
function AdTypeIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>;
}
function ImageIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
}
function VideoIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>;
}
function AudioIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>;
}
function ChevronRightIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="ml-1.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;
}
