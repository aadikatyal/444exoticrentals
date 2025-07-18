import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { v4 as uuidv4 } from "uuid"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      carId,
      startDate,
      endDate,
      startTime,
      endTime,
      location,
      totalPrice,
      bookingType,
      hours,
      depositAmount,
    } = body

    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    const {
      data: { user },
    } = await supabase.auth.getUser()

    // ✅ Check for required fields
    if (!user || !carId || !startDate || !endDate || !location || !totalPrice || !depositAmount || !bookingType) {
      console.error("❌ Missing booking data", {
        user: !!user,
        carId,
        startDate,
        endDate,
        location,
        totalPrice,
        depositAmount,
        bookingType,
      })
      return NextResponse.json({ error: "Missing booking data" }, { status: 400 })
    }

    // ✅ Create a pending booking entry
    const bookingId = uuidv4()
    const insertPayload = {
      id: bookingId,
      user_id: user.id,
      car_id: carId,
      start_date: startDate,
      end_date: endDate,
      start_time: startTime,
      end_time: endTime,
      location,
      total_price: totalPrice,
      booking_type: bookingType,
      hours: hours || null,
      deposit_amount: depositAmount,
      paid_deposit: false,
      status: "pending",
    }

    const { error: insertError } = await supabase
      .from("bookings")
      .insert([insertPayload])
      .select("id, status")
      .single()

    if (insertError) {
      console.error("❌ Failed to insert booking:", insertError)
      return NextResponse.json({ error: "Failed to create booking" }, { status: 500 })
    }

    // ✅ Metadata for Stripe
    const metadata = {
      type: "deposit",
      booking_id: bookingId,
      user_id: user.id,
      car_id: carId,
      start_date: startDate,
      end_date: endDate,
      start_time: startTime,
      end_time: endTime,
      location,
      total_price: totalPrice.toString(),
      booking_type: bookingType,
      hours: hours ? hours.toString() : "",
      deposit_amount: depositAmount.toString(),
    }

    console.log("📦 Creating deposit Stripe session with metadata:", metadata)

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: user.email,
      allow_promotion_codes: true,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Deposit for ${bookingType} booking`,
              description: `From ${startDate} to ${endDate}`,
            },
            unit_amount: Math.round(depositAmount * 100),
          },
          quantity: 1,
        },
      ],
      metadata,
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/booking/confirmation?id=${bookingId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/fleet/${carId}?canceled=true`,
    })

    if (!session.url) {
      console.error("❌ Stripe session returned no URL")
      return NextResponse.json({ error: "Stripe session failed to return a URL" }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error("❌ Stripe Checkout error:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}