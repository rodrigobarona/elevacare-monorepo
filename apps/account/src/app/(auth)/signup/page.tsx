import { SignupForm } from "./signup-form"

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; email?: string; claim?: string }>
}) {
  const params = await searchParams
  return (
    <SignupForm
      initialName={params.name?.trim() ?? ""}
      initialEmail={params.email?.trim() ?? ""}
      claimGuest={params.claim === "1"}
    />
  )
}
