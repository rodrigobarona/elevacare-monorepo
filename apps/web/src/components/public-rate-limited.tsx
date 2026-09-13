export function PublicRateLimited({ message }: { message: string }) {
  return (
    <main className="mx-auto flex min-h-[40vh] w-full max-w-xl flex-col justify-center px-6 py-16">
      <h1
        className="font-heading text-3xl font-semibold tracking-tight"
        data-testid="public-rate-limited"
      >
        {message}
      </h1>
    </main>
  )
}
