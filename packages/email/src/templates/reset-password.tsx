import {
  AuthTransactionalEmail,
  type AuthTransactionalProps,
} from "../components/auth-transactional"

export default function ResetPassword(props: AuthTransactionalProps) {
  return <AuthTransactionalEmail {...props} />
}

ResetPassword.PreviewProps = {
  kind: "reset-password",
  name: "Rodrigo",
  url: "https://eleva.care/reset-password/preview-token",
  locale: "en",
} satisfies AuthTransactionalProps
