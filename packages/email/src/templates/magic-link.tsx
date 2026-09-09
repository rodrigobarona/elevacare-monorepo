import {
  AuthTransactionalEmail,
  type AuthTransactionalProps,
} from "../components/auth-transactional"

export default function MagicLink(props: AuthTransactionalProps) {
  return <AuthTransactionalEmail {...props} />
}

MagicLink.PreviewProps = {
  kind: "magic-link",
  name: "Rodrigo",
  url: "https://eleva.care/magic-link?token=preview",
  locale: "en",
} satisfies AuthTransactionalProps
