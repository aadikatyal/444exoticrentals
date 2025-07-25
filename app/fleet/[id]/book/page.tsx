"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { PageLayout } from "@/components/page-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { MapPin, AlertCircle } from "lucide-react"
import { useUser } from "@/contexts/user-context"
import { useCars } from "@/contexts/car-context"
import Image from "next/image"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"

export default function BookingPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useUser()
  const { cars } = useCars()

  const [car, setCar] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const canceled = searchParams.get("canceled") === "true"

  const [bookingType, setBookingType] = useState<"rental" | "photoshoot">("rental")
  const [hours, setHours] = useState(1)
  const [photoshootDate, setPhotoshootDate] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [totalDays, setTotalDays] = useState(1)
  const [totalPrice, setTotalPrice] = useState(0)
  const [pickupLocation, setPickupLocation] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState("")

  const [startTime, setStartTime] = useState("13:00")
  const [endTime, setEndTime] = useState("11:00")

  useEffect(() => {
    const urlStartDate = searchParams.get("startDate")
    const urlEndDate = searchParams.get("endDate")
    const today = new Date().toISOString().split("T")[0]

    if (urlStartDate) {
      setStartDate(urlStartDate)
    } else {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      setStartDate(tomorrow.toISOString().split("T")[0])
    }

    if (urlEndDate) {
      setEndDate(urlEndDate)
    } else {
      const threedays = new Date()
      threedays.setDate(threedays.getDate() + 3)
      setEndDate(threedays.toISOString().split("T")[0])
    }

    setPhotoshootDate(today)
  }, [searchParams])

  useEffect(() => {
    const fetchCar = async () => {
      try {
        const foundCar = cars.find((c) => c.id === params.id)
        if (foundCar) {
          setCar(foundCar)
        } else {
          const response = await fetch(`/api/cars/${params.id}`)
          if (!response.ok) throw new Error("Car not found")
          const data = await response.json()
          setCar(data)
        }
      } catch (error: any) {
        console.error("Error fetching car:", error.message)
      } finally {
        setLoading(false)
      }
    }

    if (cars.length > 0 || !params.id) {
      fetchCar()
    }
  }, [params.id, cars])

  useEffect(() => {
    if (!car) return
    if (bookingType === "rental" && startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      const diffTime = Math.abs(end.getTime() - start.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      setTotalDays(diffDays || 1)
      setTotalPrice(diffDays * car.price_per_day || car.price_per_day)
    } else if (bookingType === "photoshoot") {
      setTotalPrice(hours * (car.price_per_hour || 500))
    }
  }, [bookingType, startDate, endDate, hours, car])

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsProcessing(true)
    setError("")

    try {
      if (!user) {
        router.push(`/login?redirect=/fleet/${params.id}/book`)
        return
      }

      if (bookingType === "rental" && (!startDate || !endDate || new Date(startDate) > new Date(endDate))) {
        throw new Error("Please select valid start and end dates")
      }

      if (bookingType === "photoshoot") {
        if (!photoshootDate) throw new Error("Please select a date for the photoshoot")
        if (hours <= 0) throw new Error("Please enter a valid number of hours")
      }

      const res = await fetch("/api/checkout/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carId: car.id,
          startDate: bookingType === "rental" ? startDate : photoshootDate,
          endDate: bookingType === "rental" ? endDate : photoshootDate,
          startTime,
          endTime,
          location: pickupLocation,
          totalPrice,
          bookingType,
          hours: bookingType === "photoshoot" ? hours : null,
          depositAmount: bookingType === "photoshoot" ? 500 : 1500,
        }),
      })
      
      if (!res.ok) {
        throw new Error("Failed to initiate deposit payment")
      }

      const data = await res.json()
      if (!data.url) {
        throw new Error("Missing Stripe redirect URL")
      }

      window.location.href = data.url
    } catch (error: any) {
      setError(error.message || "An error occurred while creating your booking")
      setIsProcessing(false)
    }
  }

  if (loading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
        </div>
      </PageLayout>
    )
  }

  if (!car) {
    return (
      <PageLayout>
        <div className="flex-1 flex items-center justify-center pt-16">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-600 mx-auto" />
            <h2 className="mt-4 text-xl font-bold">Car Not Found</h2>
            <p className="mt-2 text-gray-600">The car you're looking for doesn't exist or has been removed.</p>
            <Button className="mt-6 bg-red-600 hover:bg-red-700 text-white" onClick={() => router.push("/fleet")}>
              Browse Our Fleet
            </Button>
          </div>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <div className="pt-16 bg-gray-50">
        <div className="container mx-auto py-12 px-4">
          <h1 className="text-3xl font-bold mb-2">{car.name || `${car.make} ${car.model}`}</h1>
          <p className="text-gray-600">Complete your booking details below</p>
        </div>
      </div>

      <div className="container mx-auto py-12 px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="mb-8">
            <div className="relative rounded-t-lg overflow-hidden" style={{ height: "28rem" }}>
                {Array.isArray(car.image_urls) && car.image_urls.length > 0 ? (
                  <Carousel className="w-full h-full" opts={{ loop: true }}>
                    <CarouselContent className="h-full">
                      {car.image_urls.map((url: string, index: number) => (
                        <CarouselItem key={index} className="basis-full h-full">
                          <div className="relative w-full h-full min-h-[28rem]">
                            <Image
                              src={url}
                              alt={`Car image ${index + 1}`}
                              fill
                              className="object-cover"
                            />
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    <CarouselPrevious className="left-4 z-10 bg-white/70 hover:bg-white transition" />
                    <CarouselNext className="right-4 z-10 bg-white/70 hover:bg-white transition" />
                  </Carousel>
                ) : (
                  <Image
                    src="/placeholder.svg?height=400&width=800"
                    alt="Placeholder"
                    fill
                    className="object-cover"
                  />
                )}
              </div>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-bold">{car.name || `${car.make} ${car.model}`}</h2>
                    <div className="flex items-center text-gray-600 mt-1">
                      <MapPin className="h-4 w-4 mr-1 text-red-600" />
                      <span>{car.location?.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}</span>
                    </div>
                  </div>
                  <div className="mt-4 md:mt-0">
                    <span className="text-2xl font-bold text-red-600">
                      ${bookingType === "rental" ? car.price_per_day : car.price_per_hour || 500}
                    </span>
                    <span className="text-gray-600"> / {bookingType === "rental" ? "day" : "hour"}</span>
                  </div>
                </div>

                <Separator className="my-6" />

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="flex flex-col">
                    <span className="text-gray-600 text-sm">Color</span>
                    <span className="font-semibold">{car.color} </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-600 text-sm">Horsepower</span>
                    <span className="font-semibold">{car.horsepower} HP</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-600 text-sm">Top Speed</span>
                    <span className="font-semibold">{car.top_speed} MPH</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-600 text-sm">0-60 mph</span>
                    <span className="font-semibold">{car.acceleration}s</span>
                  </div>
                </div>

                <Separator className="my-6" />

                <div>
                  <h3 className="text-lg font-semibold mb-2">Description</h3>
                  <p className="text-gray-600">{car.description}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rental Requirements</CardTitle>
                <CardDescription>Please ensure you meet all requirements before booking</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-4">
                  <li>✅ Valid Driver's License — 25+ years old</li>
                  <li>✅ Credit Card in renter’s name</li>
                  <li>✅ Proof of insurance</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Complete Your Booking</CardTitle>
                <CardDescription>Select your rental or shoot details to continue</CardDescription>
              </CardHeader>
              <CardContent>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">{error}</div>
                )}
                <form onSubmit={handleBooking} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Booking Type</Label>
                    <select
                      value={bookingType}
                      onChange={(e) => setBookingType(e.target.value as "rental" | "photoshoot")}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                      <option value="rental">Rental (Drive)</option>
                      <option value="photoshoot">Photoshoot</option>
                    </select>
                  </div>

                  {bookingType === "rental" ? (
                    <div className="space-y-2">
                    {/* Pickup Date & Time */}
                    <Label htmlFor="pickup-date">Pickup Date</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        id="pickup-date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                      />
                      <Input
                        id="pickup-time"
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        required
                      />
                    </div>
                  
                    {/* Return Date & Time */}
                    <Label htmlFor="return-date">Return Date</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        id="return-date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        required
                      />
                      <Input
                        id="return-time"
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>Photoshoot Date</Label>
                      <Input
                        type="date"
                        value={photoshootDate}
                        onChange={(e) => setPhotoshootDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        required
                      />
                      <Label>Booking Duration (Hours)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={isNaN(hours) ? "" : hours}
                        onChange={(e) => setHours(parseInt(e.target.value))}
                        required
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="pickup-location">Pickup Location</Label>
                    <select
                      id="pickup-location"
                      value={pickupLocation}
                      onChange={(e) => setPickupLocation(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      required
                    >
                      <option value="">Select a location</option>
                      {Array.isArray(car.location)
                        ? car.location.map((loc) => (
                            <option key={loc} value={loc}>
                              {loc}
                            </option>
                          ))
                        : <option value={car.location}>
                            {car.location?.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                          </option>}
                    </select>
                  </div>

                  <Separator />

                  <div className="flex justify-between font-bold">
                    <span>Total:</span>
                    <span>${totalPrice}</span>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-red-600 hover:bg-red-700 text-white"
                    disabled={isProcessing}
                  >
                    {isProcessing ? "Processing..." : "Submit Booking Request"}
                  </Button>

                  <p className="text-xs text-gray-500 text-center mt-2">
                    A deposit is required to submit your booking. Once approved, your final payment will be available under Approved Requests.
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
