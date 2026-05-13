/**
 * @eleva/academy — Domain boundary for the LMS / Academy product.
 *
 * This package will own:
 * - Course, Lesson, Enrollment Zod schemas
 * - DB queries for course CRUD, enrollment, progress tracking
 * - Business rules (pricing, access control, completion criteria)
 *
 * The apps/academy Next.js app imports from this package for
 * server-side logic. This keeps business rules testable and
 * decoupled from the presentation layer.
 *
 * Status: placeholder — will be built when the LMS product is defined.
 */

export {}
