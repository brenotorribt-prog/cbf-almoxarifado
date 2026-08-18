import { redirect } from "next/navigation"
import { createClient } from "@/lib/server"
import LandingClient from "@/components/landing/landing-client"

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  
  if (user) {
    redirect("/dashboard")
  }

  return <LandingClient />
}