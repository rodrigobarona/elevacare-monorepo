import {
  AuthTransactionalEmail,
  type AuthTransactionalProps,
} from "../components/auth-transactional"

export default function VerifyEmail(props: AuthTransactionalProps) {
  return <AuthTransactionalEmail {...props} />
}

VerifyEmail.PreviewProps = {
  kind: "verify-email",
  name: "Rodrigo",
  url: "https://eleva.care/verify-email?token=preview",
  locale: "en",
} satisfies AuthTransactionalProps
