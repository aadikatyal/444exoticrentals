import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const body = await req.json()
  const { car_id, start_date, end_date, pickup_location, total_price, user_id } = body

  // 🔍 Check for duplicate bookings
  const { data: existing, error: checkError } = await supabase
    .from("bookings")
    .select("id")
    .eq("car_id", car_id)
    .eq("user_id", user_id)
    .eq("start_date", start_date)
    .eq("end_date", end_date)

  if (checkError) {
    return NextResponse.json({ error: "Error checking existing bookings" }, { status: 500 })
  }

  if (existing.length > 0) {
    return NextResponse.json({ error: "You already have a booking for this car and date range." }, { status: 400 })
  }

  // ✅ If no duplicate, insert the booking
  const { data, error } = await supabase.from("bookings").insert([
    {
      car_id,
      user_id,
      start_date,
      end_date,
      pickup_location,
      total_price,
      status: "pending", // or "approved" if admin does that later
    },
  ])

  if (error) {
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 })
  }

  return NextResponse.json({ success: true, data })
}