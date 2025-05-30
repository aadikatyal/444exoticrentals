import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-03-31.basil" as any,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature") as string

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )

    console.log("🔔 Stripe webhook received:", event.type)

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session
      const metadata = session.metadata

      console.log("✅ Checkout session complete. Metadata:", metadata)

      if (
        !metadata?.booking_key ||
        !metadata?.user_id ||
        !metadata?.car_id ||
        !metadata?.start_date ||
        !metadata?.end_date
      ) {
        console.error("❌ Missing required metadata")
        return NextResponse.json({ error: "Missing required metadata" }, { status: 400 })
      }

      // 🔍 Check for duplicate booking using booking_key
      const { data: existing, error: checkError } = await supabase
        .from("bookings")
        .select("id")
        .eq("booking_key", metadata.booking_key)

      if (checkError) {
        console.error("❌ Failed to check for existing booking:", checkError)
        return NextResponse.json({ error: "Check error" }, { status: 500 })
      }

      if (existing && existing.length > 0) {
        console.log("⚠️ Booking already exists. Skipping insert.")
        return NextResponse.json({ message: "Booking already exists" }, { status: 200 })
      }

      // ✅ Insert new booking
      const { error } = await supabase.from("bookings").insert([
        {
          booking_key: metadata.booking_key,
          car_id: metadata.car_id,
          user_id: metadata.user_id,
          start_date: metadata.start_date,
          end_date: metadata.end_date,
          pickup_location: metadata.location,
          total_price: parseFloat(metadata.total_price || "0"),
          booking_type: metadata.booking_type,
          hours: metadata.hours ? parseInt(metadata.hours) : null,
          deposit_amount: parseFloat(metadata.deposit_amount || "0"),
          paid_deposit: true,
          status: "pending",
        },
      ])

      if (error) {
        console.error("❌ Failed to insert booking:", error)
        return NextResponse.json({ error: "Insert failed" }, { status: 500 })
      }

      console.log("✅ Booking inserted successfully")
    }

    return new NextResponse("Webhook received", { status: 200 })
  } catch (err) {
    console.error("❌ Webhook error:", err)
    return new NextResponse("Webhook error", { status: 400 })
  }
}