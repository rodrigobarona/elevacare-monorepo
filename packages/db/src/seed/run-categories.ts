/* eslint-disable no-console */
import { seedExpertCategories } from "./expert-categories"

async function main() {
  const result = await seedExpertCategories()
  console.log(
    `[seed:categories] inserted=${result.inserted} updated=${result.updated}`
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
