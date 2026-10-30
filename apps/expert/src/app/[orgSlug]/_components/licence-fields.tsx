"use client"

import { useTranslations } from "next-intl"
import {
  ERS_REGISTRATION_NUMBER_MAX_LENGTH,
  ERS_REGISTRATION_NUMBER_PATTERN,
  LICENCE_NUMBER_MAX_LENGTH,
  LICENCE_NUMBER_PATTERN,
  PROFESSIONAL_BODIES,
  isProfessionalBodyId,
} from "@eleva/config/professional-bodies"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@eleva/ui/components/accordion"
import { FieldDescription, FieldError } from "@eleva/ui/components/field"
import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eleva/ui/components/select"

export interface LicenceValue {
  professionalBody: string
  licenceNumber: string
  ersRegistrationNumber: string
}

export type LicenceFieldError =
  | "bodyRequired"
  | "licenceRequired"
  | "licenceInvalid"
  | "ersRequired"
  | "ersInvalid"

export type LicenceErrors = Partial<
  Record<keyof LicenceValue, LicenceFieldError>
>

/** Same rules as `ExpertLicenceSchema`, mapped to inline field messages. */
export function validateLicence(value: LicenceValue): LicenceErrors {
  const errors: LicenceErrors = {}
  if (!isProfessionalBodyId(value.professionalBody)) {
    errors.professionalBody = "bodyRequired"
  }
  const licence = value.licenceNumber.trim()
  if (!licence) errors.licenceNumber = "licenceRequired"
  else if (!LICENCE_NUMBER_PATTERN.test(licence)) {
    errors.licenceNumber = "licenceInvalid"
  }
  const ers = value.ersRegistrationNumber.trim()
  if (!ers) errors.ersRegistrationNumber = "ersRequired"
  else if (!ERS_REGISTRATION_NUMBER_PATTERN.test(ers)) {
    errors.ersRegistrationNumber = "ersInvalid"
  }
  return errors
}

export function hasLicenceErrors(errors: LicenceErrors): boolean {
  return Object.keys(errors).length > 0
}

interface Props {
  idPrefix: string
  value: LicenceValue
  errors: LicenceErrors
  onChange: (next: LicenceValue) => void
}

export function LicenceFields({ idPrefix, value, errors, onChange }: Props) {
  const t = useTranslations("licence.fields")
  const id = (field: string) => `${idPrefix}-${field}`
  const message = (field: keyof LicenceValue) =>
    errors[field] ? t(`errors.${errors[field]}`) : null

  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-medium">{t("legend")}</legend>
      <p className="text-sm text-muted-foreground">{t("intro")}</p>

      <div className="space-y-1.5">
        <Label htmlFor={id("body")}>{t("body")}</Label>
        <Select
          selectedKey={value.professionalBody || null}
          placeholder={t("bodyPlaceholder")}
          isInvalid={Boolean(errors.professionalBody)}
          onSelectionChange={(key) => {
            if (typeof key === "string") {
              onChange({ ...value, professionalBody: key })
            }
          }}
          className="w-full"
        >
          <SelectTrigger
            id={id("body")}
            className="w-full"
            aria-describedby={id("body-help")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROFESSIONAL_BODIES.map((body) => (
              <SelectItem key={body.id} id={body.id} textValue={body.name}>
                {body.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription id={id("body-help")} className="text-xs">
          {t("bodyHelp")}
        </FieldDescription>
        <FieldError>{message("professionalBody")}</FieldError>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={id("licence")}>{t("licenceNumber")}</Label>
        <Input
          id={id("licence")}
          value={value.licenceNumber}
          onChange={(e) =>
            onChange({ ...value, licenceNumber: e.target.value })
          }
          maxLength={LICENCE_NUMBER_MAX_LENGTH}
          autoComplete="off"
          aria-invalid={Boolean(errors.licenceNumber)}
          aria-describedby={id("licence-help")}
        />
        <FieldDescription id={id("licence-help")} className="text-xs">
          {t("licenceNumberHelp")}
        </FieldDescription>
        <FieldError>{message("licenceNumber")}</FieldError>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={id("ers")}>{t("ersNumber")}</Label>
        <Input
          id={id("ers")}
          value={value.ersRegistrationNumber}
          onChange={(e) =>
            onChange({ ...value, ersRegistrationNumber: e.target.value })
          }
          maxLength={ERS_REGISTRATION_NUMBER_MAX_LENGTH}
          autoComplete="off"
          aria-invalid={Boolean(errors.ersRegistrationNumber)}
          aria-describedby={id("ers-help")}
        />
        <FieldDescription id={id("ers-help")} className="text-xs">
          {t("ersNumberHelp")}
        </FieldDescription>
        <FieldError>{message("ersRegistrationNumber")}</FieldError>
      </div>

      <Accordion>
        <AccordionItem id={id("why")}>
          <AccordionTrigger>{t("whyTitle")}</AccordionTrigger>
          <AccordionContent>{t("whyBody")}</AccordionContent>
        </AccordionItem>
      </Accordion>
    </fieldset>
  )
}
