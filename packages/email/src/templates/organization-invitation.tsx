import {
  AuthTransactionalEmail,
  type AuthTransactionalProps,
} from "../components/auth-transactional"

export default function OrganizationInvitation(props: AuthTransactionalProps) {
  return <AuthTransactionalEmail {...props} />
}

OrganizationInvitation.PreviewProps = {
  kind: "organization-invitation",
  name: "Rodrigo",
  url: "https://eleva.care/accept-invitation?id=preview",
  locale: "en",
} satisfies AuthTransactionalProps
