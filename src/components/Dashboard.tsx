import React, {useEffect, useState, useRef} from 'react'
import Filters from './Filters'
import ListingCard from './ListingCard'
import ListingMap from './ListingMap'
import axios from 'axios'
import { Card, CardHeader } from './ui/Card'
import { Spinner } from './ui/Spinner'

type Listing = {
  listing_id: string | number
  listing_region: string
  listing_year: number
  listing_make_model?: string
  listing_price?: string | number
  listing_odometer?: string | number
  listing_description?: string
  listing_vin_id: string
  listing_lat?: string | number | null
  listing_lon?: string | number | null
}

export default function Dashboard(){
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [priceRange, setPriceRange] = useState<{ min?: number | null; max?: number | null }>({})
  const [appliedFilters, setAppliedFilters] = useState<any>({})
  const [removingDuplicates, setRemovingDuplicates] = useState(false)
  const [interactiveMode, setInteractiveMode] = useState(false)
  const [duplicateStatus, setDuplicateStatus] = useState<string>('')
  const [stats, setStats] = useState<{ total_listings: number; total_cars: number } | null>(null)
  const statusRef = useRef<HTMLPreElement>(null)

  async function fetchListings(filters?: { q?: string; make_id?: number | null; model_id?: number; minPrice?: number | null; maxPrice?: number | null; minYear?: number | null; maxYear?: number | null; minOdometer?: number | null; maxOdometer?: number | null; drive?: number | null; transmission?: number | null; searchVin?: string; searchListingId?: string; userLat?: number | null; userLon?: number | null; radius?: number | null; radiusUnit?: 'mi'|'km'; address?: string | null }){
    setLoading(true)
    try{
      const params: any = { limit: 50 }
      if (filters){
        // Save filters for client-side processing (e.g., geo filters)
        setAppliedFilters(filters)
        // Handle VIN search
        if (filters.searchVin && filters.searchVin.trim()) {
          params.vin = filters.searchVin.trim()
          params.limit = 100 // Increase limit for VIN search
        }
        // Handle listing ID search (exact match)
        if (filters.searchListingId && filters.searchListingId.trim()) {
          params.listing_id = filters.searchListingId.trim()
          params.limit = 100 // Increase limit for listing ID search
        }
        if ((filters as any).q) params.q = (filters as any).q
        if (filters.make_id != null) params.make_id = filters.make_id
        if (filters.model_id != null) params.model_id = filters.model_id
        if (filters.minPrice != null) params.min_price = filters.minPrice
        if (filters.maxPrice != null) params.max_price = filters.maxPrice
        if (filters.minYear != null) params.min_year = filters.minYear
        if (filters.maxYear != null) params.max_year = filters.maxYear
        if (filters.minOdometer != null) params.min_odometer = filters.minOdometer
        if (filters.maxOdometer != null) params.max_odometer = filters.maxOdometer
        if (filters.drive != null) params.drive = filters.drive
        if (filters.transmission != null) params.transmission = filters.transmission

        // Geo filters
        if (filters.userLat != null && filters.userLon != null && filters.radius != null) {
          params.user_lat = filters.userLat
          params.user_lon = filters.userLon
          params.radius = filters.radius
          params.radius_unit = filters.radiusUnit || 'mi'
          params.with_coords = true
        }
      } else {
        setAppliedFilters({})
      }
      const r = await axios.get('/api/listings', { params })
      setListings(r.data || [])
    } catch (e) {
      setListings([])
    } finally {
      setLoading(false)
    }
  }

  async function fetchStats() {
    try {
      const response = await axios.get('/api/stats')
      setStats(response.data)
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  useEffect(()=>{ 
    fetchListings()
    fetchStats()
  }, [])

  // Auto-scroll status output to bottom
  useEffect(() => {
    if (statusRef.current) {
      statusRef.current.scrollTop = statusRef.current.scrollHeight
    }
  }, [duplicateStatus])

    // Filter by selected region first
  const filteredListings = selectedRegion 
    ? listings.filter(l => l.listing_region === selectedRegion)
    : listings

  // Group listings by VIN, keeping track of duplicates (region-filtered)
  const groupedByVin = filteredListings.reduce((acc: Record<string, Listing[]>, listing) => {
    const vin = listing.listing_vin_id
    if (!acc[vin]) acc[vin] = []
    acc[vin].push(listing)
    return acc
  }, {})

  // Flatten back to single listing per VIN (show first), but mark duplicates
  let uniqueListings = Object.values(groupedByVin).map(group => ({
    ...group[0],
    // duplicateCount stores the number of OTHER listings with the same VIN (excludes the displayed one)
    duplicateCount: group.length > 1 ? group.length - 1 : 0,
    groupListings: group
  }))

  // Price histogram data (based on all results, not region-filtered)
  const groupedByVinAll = listings.reduce((acc: Record<string, Listing[]>, listing) => {
    const vin = listing.listing_vin_id
    if (!acc[vin]) acc[vin] = []
    acc[vin].push(listing)
    return acc
  }, {})

  const allUniqueListings = Object.values(groupedByVinAll).map(group => group[0])

  const prices = allUniqueListings
    .map(l => (l.listing_price != null ? Number(l.listing_price) : NaN))
    .filter((p): p is number => Number.isFinite(p))

  const defaultBinCount = 10
  const minPriceVal = prices.length ? Math.min(...prices) : 0
  const maxPriceVal = prices.length ? Math.max(...prices) : 0
  const priceSpan = maxPriceVal - minPriceVal
  const binCount = priceSpan > 0 ? defaultBinCount : (prices.length ? 1 : 0)
  const binSize = binCount > 0 ? (priceSpan > 0 ? priceSpan / binCount : 1) : 0
  const bins = Array.from({ length: binCount }, (_, i) => ({
    start: minPriceVal + i * binSize,
    end: minPriceVal + (i + 1) * binSize,
    count: 0
  }))

  prices.forEach(price => {
    if (binCount === 0) return
    if (binSize === 0) {
      bins[0].count += 1
      return
    }
    const idx = Math.min(binCount - 1, Math.floor((price - minPriceVal) / binSize))
    bins[idx].count += 1
  })

  const maxBinCount = bins.reduce((max, b) => Math.max(max, b.count), 0)

  return (
    <div className="grid grid-cols-4 gap-6">
      <aside className="col-span-1">
        <Filters onApply={(f: any)=> fetchListings(f)} priceRange={priceRange} />
      </aside>
      <main className="col-span-3">
        {/* Database Statistics */}
        {stats && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card>
              <CardHeader>
                <div className="text-sm font-medium text-slate-600">Total Listings</div>
              </CardHeader>
              <div className="px-6 pb-6">
                <div className="text-3xl font-bold text-blue-600">{stats.total_listings.toLocaleString()}</div>
              </div>
            </Card>
            <Card>
              <CardHeader>
                <div className="text-sm font-medium text-slate-600">Total Cars</div>
              </CardHeader>
              <div className="px-6 pb-6">
                <div className="text-3xl font-bold text-green-600">{stats.total_cars.toLocaleString()}</div>
              </div>
            </Card>
          </div>
        )}
        
        <ListingMap listings={listings} selectedRegion={selectedRegion} onSelectRegion={setSelectedRegion} />
        <Card className="mb-6">
          <CardHeader>
            <div className="text-lg font-semibold">Price Distribution</div>
          </CardHeader>
          <div className="px-6 pb-6">
            {prices.length === 0 ? (
              <div className="text-slate-600 text-sm">No price data for current filters.</div>
            ) : (
              <div className="flex items-end gap-2 h-40">
                {bins.map((bin, i) => {
                  const heightPct = maxBinCount ? (bin.count / maxBinCount) * 100 : 0
                  const label = `$${Math.round(bin.start).toLocaleString()} - $${Math.round(bin.end).toLocaleString()}`
                  return (
                    <button
                      key={i}
                      type="button"
                      className="flex-1 flex flex-col items-center h-full focus:outline-none"
                      onClick={() => setPriceRange({
                        min: Math.floor(bin.start),
                        max: Math.ceil(bin.end)
                      })}
                      title={`Filter to ${label}`}
                    >
                      <div
                        className="w-full bg-blue-500 rounded-t"
                        style={{ height: `${Math.max(2, heightPct)}%` }}
                        title={`${label} (${bin.count})`}
                      />
                      <div className="mt-2 text-[10px] text-slate-500 text-center">
                        {Math.round(bin.start).toLocaleString()}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div className="text-lg font-semibold">Listings ({uniqueListings.length})</div>
            {loading && <Spinner />}
          </CardHeader>
          <div className="mt-3">
            {loading ? (
              <div className="flex items-center justify-center py-12"><Spinner className="h-8 w-8"/></div>
            ) : uniqueListings.length === 0 ? (
              <div className="text-center py-12 text-slate-600">No listings found</div>
            ) : (
              <div className="space-y-4">
                {uniqueListings.map(l=> <ListingCard key={l.listing_id} listing={l} listings={(l as any).groupListings} duplicateCount={(l as any).duplicateCount || 0} />)}
              </div>
            )}
          </div>
        </Card>
      </main>
    </div>
  )
}
