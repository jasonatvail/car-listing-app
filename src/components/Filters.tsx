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
    // Geo fallback
    userLat?: number | null
    userLon?: number | null
    radius?: number | null
    radiusUnit?: 'mi'|'km'
    address?: string | null
    resolvedAddress?: string | null
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
  const [fetchError, setFetchError] = React.useState<string | null>(null)

  // Geolocation filter
  const [userLat, setUserLat] = React.useState<number | null>(null)
  const [userLon, setUserLon] = React.useState<number | null>(null)
  const [gettingLocation, setGettingLocation] = React.useState(false)
  const [locationError, setLocationError] = React.useState<string | null>(null)
  const [radiusValue, setRadiusValue] = React.useState('50') // default
  const [radiusUnit, setRadiusUnit] = React.useState<'mi' | 'km'>('mi')

  // Address fallback (when browser geolocation is unavailable or user prefers typing an address)
  const [address, setAddress] = React.useState('')
  const [resolvedAddress, setResolvedAddress] = React.useState<string | null>(null)
  const [geocoding, setGeocoding] = React.useState(false)
  const [geocodeError, setGeocodeError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!priceRange) return
    const nextMin = priceRange.min != null ? String(Math.floor(priceRange.min)) : ''
    const nextMax = priceRange.max != null ? String(Math.ceil(priceRange.max)) : ''
    setMinPrice(prev => (prev !== nextMin ? nextMin : prev))
    setMaxPrice(prev => (prev !== nextMax ? nextMax : prev))
  }, [priceRange?.min, priceRange?.max])

  async function fetchWithRetry(url: string, retries = 2) {
    for (let i = 0; i <= retries; i++) {
      try {
        const res = await fetch(url)
        if (!res.ok) {
          const txt = await res.text()
          throw new Error(`${res.status} ${res.statusText} - ${txt.slice(0,200)}`)
        }
        return await res.json()
      } catch (err: any) {
        console.warn(`fetch ${url} attempt ${i+1} failed:`, err.message || err)
        if (i === retries) throw err
        await new Promise(r => setTimeout(r, 400))
      }
    }
  }

  React.useEffect(()=>{
    fetchWithRetry('/api/makes').then(setMakes).catch(e => { console.error(e); setMakes([]); setFetchError('Failed to load filters (makes)') })
  }, [])

  React.useEffect(()=>{
    fetchWithRetry('/api/drives').then((data)=> setDrives(Array.isArray(data) ? data : [])).catch(e => { console.error(e); setDrives([]); setFetchError('Failed to load drives') })
    fetchWithRetry('/api/transmissions').then((data)=> setTransmissions(Array.isArray(data) ? data : [])).catch(e => { console.error(e); setTransmissions([]); setFetchError('Failed to load transmissions') })
  }, [])

  React.useEffect(()=>{
    const url = selectedMake ? `/api/models?make_id=${selectedMake}` : '/api/models'
    fetchWithRetry(url).then(setModels).catch(e => { console.error(e); setModels([]); setFetchError('Failed to load models') })
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

    // Clear geolocation
    setUserLat(null)
    setUserLon(null)
    setRadiusValue('50')
    setRadiusUnit('mi')
    setLocationError(null)

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
        searchListingId: searchListingId.trim(),
        // Geo filters
        userLat: userLat,
        userLon: userLon,
        radius: radiusValue !== '' ? Number(radiusValue) : null,
        radiusUnit: radiusUnit
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [selectedModel, selectedMake, minPrice, maxPrice, minYear, maxYear, minOdometer, maxOdometer, selectedDrive, selectedTransmission, searchVin, searchListingId, userLat, userLon, radiusValue, radiusUnit, address, geocoding])

  async function geocodeAddress(){
    const q = address.trim()
    if (!q) {
      setGeocodeError('Enter an address to look up')
      return
    }
    setGeocoding(true)
    setGeocodeError(null)
    setResolvedAddress(null)
    try{
      // First try server-side geocoding (Google) if available
      const backendRes = await fetch(`/api/geocode?address=${encodeURIComponent(q)}`)
      if (backendRes.ok){
        const json = await backendRes.json()
        setUserLat(Number(json.lat))
        setUserLon(Number(json.lon))
        setResolvedAddress(json.formatted_address || q)
        setGeocodeError(null)
        return
      } else if (backendRes.status !== 404) {
        // non-404 means server tried and errored
        const txt = await backendRes.text()
        throw new Error(`Server geocode error: ${backendRes.status} ${txt.slice(0,200)}`)
      }

      // Fallback to public Nominatim if server-side geocoding not configured
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error(`Geocode failed: ${res.status}`)
      const data = await res.json()
      if (!Array.isArray(data) || data.length === 0){
        setGeocodeError('No location found for that address')
      } else {
        const first = data[0]
        const lat = parseFloat(first.lat)
        const lon = parseFloat(first.lon)
        if (!Number.isFinite(lat) || !Number.isFinite(lon)){
          setGeocodeError('Invalid location result')
        } else {
          setUserLat(lat)
          setUserLon(lon)
          setResolvedAddress(first.display_name || q)
          setGeocodeError(null)
        }
      }
    } catch (err: any){
      console.error('Geocode error', err)
      setGeocodeError(err.message || 'Geocoding failed')
    } finally {
      setGeocoding(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold">Filters</h3>
      </CardHeader>
      <CardBody>
        {fetchError && <div className="mb-3 text-sm text-red-600">Warning: {fetchError} — check backend / logs.</div>}
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

          <div className="mb-3 border-t pt-3">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Location</h4>

            <div className="flex items-center gap-2 mb-2">
              <Button onClick={async ()=>{
                if (!navigator.geolocation){
                  setLocationError('Geolocation not supported by your browser')
                  return
                }
                setGettingLocation(true)
                setLocationError(null)
                navigator.geolocation.getCurrentPosition((pos)=>{
                  setGettingLocation(false)
                  setUserLat(pos.coords.latitude)
                  setUserLon(pos.coords.longitude)
                }, (err)=>{
                  setGettingLocation(false)
                  setLocationError(err.message || 'Failed to get location')
                }, { timeout: 10000 })
              }} variant="ghost">{gettingLocation ? 'Locating...' : 'Use my location'}</Button>

              <Button onClick={()=>{ setUserLat(null); setUserLon(null); setLocationError(null); setResolvedAddress(null); setAddress('') }} variant="ghost">Clear</Button>
            </div>

            <div className="mb-2 text-xs text-slate-500">
              {userLat && userLon ? <span>Using location: {userLat.toFixed(4)}, {userLon.toFixed(4)}</span> : <span>No location set</span>}
            </div>

            <div className="mb-3">
              <label className="block text-sm text-slate-600 mb-1">Or enter an address</label>
              <div className="flex gap-2">
                <Input type="text" placeholder="123 Main St, City, State" value={address} onChange={e=>setAddress(e.target.value)} onKeyDown={(e)=>{ if (e.key === 'Enter') { e.preventDefault(); geocodeAddress() } }} />
                <Button onClick={geocodeAddress} disabled={geocoding} variant="ghost">{geocoding ? 'Looking up…' : 'Lookup'}</Button>
                <Button onClick={()=>{ setAddress(''); setResolvedAddress(null); setGeocodeError(null) }} variant="ghost">Clear</Button>
              </div>
              {resolvedAddress && <div className="mt-2 text-xs text-slate-600">Resolved: {resolvedAddress}</div>}
              {geocodeError && <div className="mt-2 text-xs text-red-600">{geocodeError}</div>}
              <div className="mt-2 text-xs text-slate-400">Tip: If geolocation is blocked (HTTP), type an address and click Lookup.</div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1">Radius</label>
                <Input type="number" value={radiusValue} onChange={e=>setRadiusValue(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Unit</label>
                <select className="border rounded p-2" value={radiusUnit} onChange={e=>setRadiusUnit(e.target.value as 'mi'|'km')}>
                  <option value="mi">miles</option>
                  <option value="km">km</option>
                </select>
              </div>
            </div>

            {locationError && <div className="mt-2 text-xs text-red-600">{locationError}</div>}

          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button onClick={handleReset} variant="ghost">Reset</Button>
        </div>
            </CardBody>
          </Card>
  )
}
