import React from 'react'
import { Input } from './ui/Input'
import { Button } from './ui/Button'
import { Card, CardHeader, CardBody } from './ui/Card'

type Props = {
  onApply?: (filters: {
    make_id?: number | null
    model_id?: number
    minPrice?: number | null
    maxPrice?: number | null
    minYear?: number | null
    maxYear?: number | null
    minOdometer?: number | null
    maxOdometer?: number | null
    drive?: number | null
    transmission?: number | null
    searchVin?: string
    searchListingId?: string
  }) => void
  priceRange?: {
    min?: number | null
    max?: number | null
  }
}

export default function Filters({ onApply, priceRange }: Props){
  const [makes, setMakes] = React.useState<Array<{ make_id: number; make_name: string }>>([])
  const [models, setModels] = React.useState<Array<{ model_id: number; model_name: string }>>([])
  const [regions, setRegions] = React.useState<Array<{ region_id: number; region_name: string }>>([]) 
  const [selectedMake, setSelectedMake] = React.useState<number | null>(null)

  const [selectedModel, setSelectedModel] = React.useState<number | null>(null)
  const [minYear, setMinYear] = React.useState('')
  const [maxYear, setMaxYear] = React.useState('')
  const [minPrice, setMinPrice] = React.useState('')
  const [maxPrice, setMaxPrice] = React.useState('')
  const [minOdometer, setMinOdometer] = React.useState('')
  const [maxOdometer, setMaxOdometer] = React.useState('')
  const [drives, setDrives] = React.useState<Array<{ id: number; name: string }>>([])
  const [transmissions, setTransmissions] = React.useState<Array<{ id: number; name: string }>>([])
  const [selectedDrive, setSelectedDrive] = React.useState<number | null>(null)
  const [selectedTransmission, setSelectedTransmission] = React.useState<number | null>(null)
  const [searchVin, setSearchVin] = React.useState('')
  const [searchListingId, setSearchListingId] = React.useState('')

  React.useEffect(() => {
    if (!priceRange) return
    const nextMin = priceRange.min != null ? String(Math.floor(priceRange.min)) : ''
    const nextMax = priceRange.max != null ? String(Math.ceil(priceRange.max)) : ''
    setMinPrice(prev => (prev !== nextMin ? nextMin : prev))
    setMaxPrice(prev => (prev !== nextMax ? nextMax : prev))
  }, [priceRange?.min, priceRange?.max])

  React.useEffect(()=>{
    fetch('/api/makes').then(r=>r.json()).then(setMakes).catch(()=>setMakes([]))
  }, [])

  React.useEffect(()=>{
    fetch('/api/drives').then(r=>r.json()).then((data)=> setDrives(Array.isArray(data) ? data : [])).catch(()=>setDrives([]))
    fetch('/api/transmissions').then(r=>r.json()).then((data)=> setTransmissions(Array.isArray(data) ? data : [])).catch(()=>setTransmissions([]))
  }, [])

  React.useEffect(()=>{
    // Fetch all models if no make selected, or filtered by make
    const url = selectedMake ? `/api/models?make_id=${selectedMake}` : '/api/models'
    fetch(url).then(r=>r.json()).then(setModels).catch(()=>setModels([]))
  }, [selectedMake])

  function handleReset(){
    setSelectedMake(null)
    setSelectedDrive(null)
    setSelectedTransmission(null)
    setSelectedModel(null)

    setMinPrice('')
    setMaxPrice('')
    setMinYear('')
    setMaxYear('')
    setMinOdometer('')
    setMaxOdometer('')
    setSearchVin('')
    setSearchListingId('')
    onApply && onApply({})
  }

  // Auto-apply whenever filters change
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const min = minPrice.trim() ? parseInt(minPrice) : null
      const max = maxPrice.trim() ? parseInt(maxPrice) : null
      const minYearInt = minYear.trim() ? parseInt(minYear) : null
      const maxYearInt = maxYear.trim() ? parseInt(maxYear) : null
      const minOdometerInt = minOdometer.trim() ? parseInt(minOdometer) : null
      const maxOdometerInt = maxOdometer.trim() ? parseInt(maxOdometer) : null

      onApply?.({
        make_id: selectedMake || null,
        model_id: selectedModel || undefined,
        minPrice: min,
        maxPrice: max,
        minYear: minYearInt,
        maxYear: maxYearInt,
        minOdometer: minOdometerInt,
        maxOdometer: maxOdometerInt,
        drive: selectedDrive || null,
        transmission: selectedTransmission || null,
        searchVin: searchVin.trim(),
        searchListingId: searchListingId.trim()
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [selectedModel, selectedMake, minPrice, maxPrice, minYear, maxYear, minOdometer, maxOdometer, selectedDrive, selectedTransmission, searchVin, searchListingId])

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold">Filters</h3>
      </CardHeader>
      <CardBody>
        <div className="mb-3">
          <label className="block text-sm text-slate-600">Make</label>
          <select className="mt-1 w-full border rounded p-2" value={selectedMake ?? ''} onChange={e=> setSelectedMake(e.target.value ? parseInt(e.target.value) : null)}>
            <option value="">— Any make —</option>
            {makes.map(m => <option key={m.make_id} value={m.make_id}>{m.make_name}</option>)}
          </select>
        </div>

        <div className="mb-3">
          <label className="block text-sm text-slate-600">Model</label>
          <select 
            className="mt-1 w-full border rounded p-2" 
            value={selectedModel ?? ''} 
            onChange={e=> setSelectedModel(e.target.value ? parseInt(e.target.value) : null)}
            disabled={!selectedMake && models.length === 0}
          >
            <option value="">— Any model —</option>
            {models.map(m => <option key={m.model_id} value={m.model_id}>{m.model_name}</option>)}
          </select>
          {!selectedMake && models.length === 0 && (
            <div className="mt-1 text-xs text-slate-400">Select a make first or models will load all</div>
          )}
        </div>
 
        <div className="mb-3">
          <label className="block text-sm text-slate-600 mb-2">Price Range</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Min</label>
              <Input 
                type="number" 
                className="mt-0" 
                placeholder="$0" 
                value={minPrice}
                onChange={e=>setMinPrice(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Max</label>
              <Input 
                type="number" 
                className="mt-0" 
                placeholder="$100000" 
                value={maxPrice}
                onChange={e=>setMaxPrice(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-sm text-slate-600 mb-2">Year Range</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Min</label>
              <Input 
                type="number" 
                className="mt-0" 
                placeholder="1900" 
                value={minYear}
                onChange={e=>setMinYear(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Max</label>
              <Input 
                type="number" 
                className="mt-0" 
                placeholder="2026" 
                value={maxYear}
                onChange={e=>setMaxYear(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-sm text-slate-600 mb-2">Odometer Range</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Min</label>
              <Input 
                type="number" 
                className="mt-0" 
                placeholder="0" 
                value={minOdometer}
                onChange={e=>setMinOdometer(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Max</label>
              <Input 
                type="number" 
                className="mt-0" 
                placeholder="200000" 
                value={maxOdometer}
                onChange={e=>setMaxOdometer(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-sm text-slate-600">Drive</label>
          <select className="mt-1 w-full border rounded p-2" value={selectedDrive ?? ''} onChange={e=> setSelectedDrive(e.target.value ? parseInt(e.target.value) : null)}>
            <option value="">— Any drive —</option>
            {drives.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        <div className="mb-3">
          <label className="block text-sm text-slate-600">Transmission</label>
          <select className="mt-1 w-full border rounded p-2" value={selectedTransmission ?? ''} onChange={e=> setSelectedTransmission(e.target.value ? parseInt(e.target.value) : null)}>
            <option value="">— Any transmission —</option>
            {transmissions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        <div className="border-t pt-3 mt-3">
          <h4 className="text-sm font-semibold text-slate-700 mb-3">Search</h4>
          
          <div className="mb-3">
            <label className="block text-sm text-slate-600 mb-1">Search by VIN</label>
            <Input 
              type="text" 
              placeholder="e.g., ?d8fa46e1bc6f49c?" 
              value={searchVin}
              onChange={e=>setSearchVin(e.target.value)}
            />
          </div>

          <div className="mb-3">
            <label className="block text-sm text-slate-600 mb-1">Search by Listing ID</label>
            <Input 
              type="text" 
              placeholder="e.g., 7316906656" 
              value={searchListingId}
              onChange={e=>setSearchListingId(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button onClick={handleReset} variant="ghost">Reset</Button>
        </div>
            </CardBody>
          </Card>
  )
}
