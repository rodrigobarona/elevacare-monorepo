import {
  AuthTransactionalEmail,
  type AuthTransactionalProps,
} from "../components/auth-transactional"

export default function TwoFactorOtp(props: AuthTransactionalProps) {
  return <AuthTransactionalEmail {...props} />
}

TwoFactorOtp.PreviewProps = {
  kind: "two-factor-otp",
  name: "Rodrigo",
  code: "847291",
  locale: "en",
} satisfies AuthTransactionalProps
