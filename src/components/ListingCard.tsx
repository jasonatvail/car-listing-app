import React, { useState, useEffect, useRef } from 'react'
import { Card, CardHeader, CardBody } from './ui/Card'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import marker2x from 'leaflet/dist/images/marker-icon-2x.png'
import marker1x from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

L.Icon.Default.mergeOptions({
  iconRetinaUrl: marker2x,
  iconUrl: marker1x,
  shadowUrl: markerShadow
})

// Error Boundary component
class MapErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[MapErrorBoundary] Caught error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded">
          <div className="text-sm font-semibold text-red-800">Map Error</div>
          <div className="text-xs text-red-700 mt-1">{this.state.error?.message}</div>
        </div>
      )
    }

    return this.props.children
  }
}

export default function ListingCard({listing, duplicateCount=0}:{listing:any, duplicateCount?:number}){
  const [isClient, setIsClient] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  
  useEffect(() => {
    setIsClient(true)
  }, [])

  const decoded = listing.listing_description ?? null
  const formattedRegion = listing.listing_region ? listing.listing_region : 'N/A'
  const formattedDriveType = listing.listing_drive_type ? listing.listing_drive_type : 'N/A'
  const formattedTransmissionType = listing.listing_transmission_type ? listing.listing_transmission_type : 'N/A'
  const formattedYear = listing.listing_year ? listing.listing_year : 'N/A'
  const formattedMakeModel = listing.listing_make_model ? `${listing.listing_make_model}` : 'N/A'
  const formattedPrice = listing.listing_price ? `$${Number(listing.listing_price).toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}` : 'N/A'
  const formattedOdometer = listing.listing_odometer ? `${Number(listing.listing_odometer).toLocaleString('en-US')} miles` : 'N/A'
  
  // Convert lat/lon to numbers, handling both string and number types from API
  const lat = listing.listing_lat != null ? Number(String(listing.listing_lat).trim()) : null
  const lon = listing.listing_lon != null ? Number(String(listing.listing_lon).trim()) : null
  const hasCoords = lat !== null && lon !== null && Number.isFinite(lat) && Number.isFinite(lon)
  
  // Ensure lat/lon are valid numbers for MapContainer
  const mapLat = hasCoords ? Number(lat) : null
  const mapLon = hasCoords ? Number(lon) : null
  const mapKey = hasCoords ? `${listing.listing_id}-${mapLat}-${mapLon}` : ''

  React.useEffect(() => {
    console.log(`[ListingCard ${listing.listing_id}] Coords check:`, {
      raw_lat: listing.listing_lat,
      raw_lon: listing.listing_lon,
      lat,
      lon,
      hasCoords,
      lat_finite: lat !== null ? Number.isFinite(lat) : 'null',
      lon_finite: lon !== null ? Number.isFinite(lon) : 'null'
    })
  }, [listing.listing_id, listing.listing_lat, listing.listing_lon])

  // Initialize map using plain Leaflet
  useEffect(() => {
    if (!isClient || !hasCoords || !mapLat || !mapLon || !mapRef.current) {
      return
    }

    // Clear existing map if it exists
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
    }

    try {
      // Create new map instance with zoom 4 to show multiple states
      const map = L.map(mapRef.current, {
        scrollWheelZoom: false
      }).setView([mapLat, mapLon], 4)
      
      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)
      
      // Add marker with default icon
      L.marker([mapLat, mapLon], {
        icon: L.icon({
          iconUrl: marker1x,
          iconRetinaUrl: marker2x,
          shadowUrl: markerShadow,
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        })
      }).addTo(map)
      
      mapInstanceRef.current = map
    } catch (error) {
      console.error('[ListingCard] Map initialization error:', error)
    }

    return () => {
      // Cleanup is handled by the check at the start of useEffect
    }
  }, [isClient, hasCoords, mapLat, mapLon])

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="flex items-center justify-between">
        <div className="text-lg font-medium">{listing.listing_vin_id}</div>
        <div className="text-sm text-slate-500">ID: {listing.listing_id}</div>
      </CardHeader>
      <CardBody>
        {duplicateCount > 0 && (
          <div className="mb-2 text-xs text-amber-600 font-medium">📌 {duplicateCount + 1} listings with same VIN</div>
        )}
        <div className="text-slate-700 mb-2">Price: {formattedPrice}</div>
        <div className="text-sm text-slate-600 mb-3">Odometer: {formattedOdometer}</div>
        <div className="text-sm text-slate-600 mb-3">Year: {formattedYear}</div>
        <div className="text-sm text-slate-600 mb-3">Region: {formattedRegion}</div>
        <div className="text-sm text-slate-600 mb-3">Make & Model: {formattedMakeModel}</div>
        <div className="text-sm text-slate-600 mb-3">Drive Type: {formattedDriveType}</div>
        <div className="text-sm text-slate-600 mb-3">Transmission Type: {formattedTransmissionType}</div>
        {hasCoords && mapLat !== null && mapLon !== null && isClient && (
          <MapErrorBoundary>
            <div className="mb-3 rounded border overflow-hidden bg-gray-100" style={{ height: '200px', width: '100%' }} ref={mapRef}></div>
          </MapErrorBoundary>
        )}
        <div className="text-sm text-slate-700 line-clamp-3">{decoded ?? 'No description'}</div>
      </CardBody>
    </Card>
  )
}
