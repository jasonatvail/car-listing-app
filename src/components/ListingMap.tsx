import React from 'react'
import { Card, CardHeader, CardContent } from './ui/card'

type Listing = {
  listing_id: number
  listing_vin_id: string
  listing_price?: number
  listing_make_model?: string
  listing_region?: string
  listing_year?: number
}

export default function ListingMap({ 
  listings, 
  selectedRegion,
  onSelectRegion
}: { 
  listings: Listing[]
  selectedRegion: string | null
  onSelectRegion: (region: string | null) => void
}) {
  // Group listings by region, then deduplicate by VIN within each region
  const listingsByRegion: Record<string, Listing[]> = {}
  listings.forEach(listing => {
    const region = listing.listing_region || 'Unknown'
    if (!listingsByRegion[region]) {
      listingsByRegion[region] = []
    }
    listingsByRegion[region].push(listing)
  })

  // Deduplicate each region by VIN and calculate stats
  const regionStats = Object.entries(listingsByRegion)
    .map(([region, regionListings]) => {
      // Get unique VINs in this region
      const uniqueVins = new Set(regionListings.map(l => l.listing_vin_id))
      const uniqueListings = Array.from(uniqueVins).map(vin => 
        regionListings.find(l => l.listing_vin_id === vin)!
      )
      
      return {
        region,
        count: uniqueListings.length,
        totalListings: regionListings.length,
        avgPrice: uniqueListings.length > 0 
          ? Math.round(uniqueListings.reduce((sum, l) => sum + (l.listing_price || 0), 0) / uniqueListings.length)
          : 0
      }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)

  if (listings.length === 0) {
    return (
      <Card className="mb-6">
        <CardContent>
          <p className="text-slate-600">No listings to display on map</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Listings by Region</h3>
          {selectedRegion && (
            <button
              onClick={() => onSelectRegion(null)}
              className="text-xs text-blue-600 hover:underline"
            >
              Clear filter
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {regionStats.map(stat => (
            <button
              key={stat.region}
              onClick={() => onSelectRegion(selectedRegion === stat.region ? null : stat.region)}
              className={`border rounded-lg p-4 transition cursor-pointer ${
                selectedRegion === stat.region
                  ? 'bg-blue-100 border-blue-500 ring-2 ring-blue-400'
                  : 'bg-slate-50 hover:bg-slate-100'
              }`}
            >
              <div className="font-semibold text-sm text-slate-900">{stat.region}</div>
              <div className="text-2xl font-bold text-blue-600 mt-2">{stat.count}</div>
              <div className="text-xs text-slate-600 mt-1">listings</div>
              {stat.avgPrice > 0 && (
                <div className="text-xs text-slate-600 mt-2">
                  Avg: ${(stat.avgPrice).toLocaleString()}
                </div>
              )}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

