/**
 * Script to add native Next.js metadata exports to MDX files
 * This replaces the need for gray-matter and uses Next.js 16 native approach
 */
import fs from 'fs';
import path from 'path';

// Metadata for trust documents
const trustMetadata = {
  en: {
    security: {
      title: 'Security & Compliance | Eleva Care',
      description:
        "Learn about Eleva Care's security measures, certifications, and commitment to protecting your healthcare data with GDPR, LGPD, and HIPAA compliance.",
      og: {
        title: 'Security & Compliance | Eleva Care',
        description:
          "Learn about Eleva Care's security measures, certifications, and commitment to protecting your healthcare data with GDPR, LGPD, and HIPAA compliance.",
        siteName: 'Eleva Care',
      },
    },
    dpa: {
      title: 'Data Processing Agreement | Eleva Care',
      description:
        "Review Eleva Care's data processing agreement outlining how we handle and protect your healthcare data.",
      og: {
        title: 'Data Processing Agreement | Eleva Care',
        description:
          "Review Eleva Care's data processing agreement outlining how we handle and protect your healthcare data.",
        siteName: 'Eleva Care',
      },
    },
  },
  es: {
    security: {
      title: 'Seguridad y Cumplimiento | Eleva Care',
      description:
        'Conozca las medidas de seguridad, certificaciones y compromiso de Eleva Care para proteger sus datos de salud con cumplimiento de GDPR, LGPD y HIPAA.',
      og: {
        title: 'Seguridad y Cumplimiento | Eleva Care',
        description:
          'Conozca las medidas de seguridad, certificaciones y compromiso de Eleva Care para proteger sus datos de salud con cumplimiento de GDPR, LGPD y HIPAA.',
        siteName: 'Eleva Care',
      },
    },
    dpa: {
      title: 'Acuerdo de Procesamiento de Datos | Eleva Care',
      description:
        'Revise el acuerdo de procesamiento de datos de Eleva Care que describe cómo manejamos y protegemos sus datos de salud.',
      og: {
        title: 'Acuerdo de Procesamiento de Datos | Eleva Care',
        description:
          'Revise el acuerdo de procesamiento de datos de Eleva Care que describe cómo manejamos y protegemos sus datos de salud.',
        siteName: 'Eleva Care',
      },
    },
  },
  pt: {
    security: {
      title: 'Segurança e Conformidade | Eleva Care',
      description:
        'Saiba mais sobre as medidas de segurança, certificações e compromisso da Eleva Care para proteger os seus dados de saúde com conformidade GDPR, LGPD e HIPAA.',
      og: {
        title: 'Segurança e Conformidade | Eleva Care',
        description:
          'Saiba mais sobre as medidas de segurança, certificações e compromisso da Eleva Care para proteger os seus dados de saúde com conformidade GDPR, LGPD e HIPAA.',
        siteName: 'Eleva Care',
      },
    },
    dpa: {
      title: 'Acordo de Processamento de Dados | Eleva Care',
      description:
        'Reveja o acordo de processamento de dados da Eleva Care que descreve como tratamos e protegemos os seus dados de saúde.',
      og: {
        title: 'Acordo de Processamento de Dados | Eleva Care',
        description:
          'Reveja o acordo de processamento de dados da Eleva Care que descreve como tratamos e protegemos os seus dados de saúde.',
        siteName: 'Eleva Care',
      },
    },
  },
  br: {
    security: {
      title: 'Segurança e Conformidade | Eleva Care',
      description:
        'Saiba mais sobre as medidas de segurança, certificações e compromisso da Eleva Care para proteger seus dados de saúde com conformidade GDPR, LGPD e HIPAA.',
      og: {
        title: 'Segurança e Conformidade | Eleva Care',
        description:
          'Saiba mais sobre as medidas de segurança, certificações e compromisso da Eleva Care para proteger seus dados de saúde com conformidade GDPR, LGPD e HIPAA.',
        siteName: 'Eleva Care',
      },
    },
    dpa: {
      title: 'Acordo de Processamento de Dados | Eleva Care',
      description:
        'Revise o acordo de processamento de dados da Eleva Care que descreve como tratamos e protegemos seus dados de saúde.',
      og: {
        title: 'Acordo de Processamento de Dados | Eleva Care',
        description:
          'Revise o acordo de processamento de dados da Eleva Care que descreve como tratamos e protegemos seus dados de saúde.',
        siteName: 'Eleva Care',
      },
    },
  },
};

// Metadata for legal documents
const legalMetadata = {
  en: {
    terms: {
      title: 'Terms of Service | Eleva Care',
      description:
        "Read Eleva Care's terms of service and understand your rights and obligations when using our healthcare platform.",
      og: {
        title: 'Terms of Service | Eleva Care',
        description:
          "Read Eleva Care's terms of service and understand your rights and obligations when using our healthcare platform.",
        siteName: 'Eleva Care',
      },
    },
    privacy: {
      title: 'Privacy Policy | Eleva Care',
      description:
        'Learn how Eleva Care protects your personal health information and privacy rights in accordance with healthcare regulations.',
      og: {
        title: 'Privacy Policy | Eleva Care',
        description:
          'Learn how Eleva Care protects your personal health information and privacy rights in accordance with healthcare regulations.',
        siteName: 'Eleva Care',
      },
    },
    cookie: {
      title: 'Cookie Policy | Eleva Care',
      description:
        'Understand how Eleva Care uses cookies to enhance your browsing experience and protect your privacy.',
      og: {
        title: 'Cookie Policy | Eleva Care',
        description:
          'Understand how Eleva Care uses cookies to enhance your browsing experience and protect your privacy.',
        siteName: 'Eleva Care',
      },
    },
    'payment-policies': {
      title: 'Payment Policies | Eleva Care',
      description:
        "Understand Eleva Care's payment terms, refund policies, and billing procedures for healthcare services.",
      og: {
        title: 'Payment Policies | Eleva Care',
        description:
          "Understand Eleva Care's payment terms, refund policies, and billing procedures for healthcare services.",
        siteName: 'Eleva Care',
      },
    },
    'expert-agreement': {
      title: 'Expert Agreement | Eleva Care',
      description:
        "Review Eleva Care's expert agreement outlining the terms and conditions for independent experts using our platform.",
      og: {
        title: 'Expert Agreement | Eleva Care',
        description:
          "Review Eleva Care's expert agreement outlining the terms and conditions for independent experts using our platform.",
        siteName: 'Eleva Care',
      },
    },
  },
  es: {
    terms: {
      title: 'Términos de Servicio | Eleva Care',
      description:
        'Lea los términos de servicio de Eleva Care y comprenda sus derechos y obligaciones al utilizar nuestra plataforma de salud.',
      og: {
        title: 'Términos de Servicio | Eleva Care',
        description:
          'Lea los términos de servicio de Eleva Care y comprenda sus derechos y obligaciones al utilizar nuestra plataforma de salud.',
        siteName: 'Eleva Care',
      },
    },
    privacy: {
      title: 'Política de Privacidad | Eleva Care',
      description:
        'Conozca cómo Eleva Care protege su información de salud personal y sus derechos de privacidad de acuerdo con las regulaciones de salud.',
      og: {
        title: 'Política de Privacidad | Eleva Care',
        description:
          'Conozca cómo Eleva Care protege su información de salud personal y sus derechos de privacidad de acuerdo con las regulaciones de salud.',
        siteName: 'Eleva Care',
      },
    },
    cookie: {
      title: 'Política de Cookies | Eleva Care',
      description:
        'Comprenda cómo Eleva Care utiliza cookies para mejorar su experiencia de navegación y proteger su privacidad.',
      og: {
        title: 'Política de Cookies | Eleva Care',
        description:
          'Comprenda cómo Eleva Care utiliza cookies para mejorar su experiencia de navegación y proteger su privacidad.',
        siteName: 'Eleva Care',
      },
    },
    'payment-policies': {
      title: 'Políticas de Pago | Eleva Care',
      description:
        'Comprenda los términos de pago, políticas de reembolso y procedimientos de facturación de Eleva Care para servicios de salud.',
      og: {
        title: 'Políticas de Pago | Eleva Care',
        description:
          'Comprenda los términos de pago, políticas de reembolso y procedimientos de facturación de Eleva Care para servicios de salud.',
        siteName: 'Eleva Care',
      },
    },
    'expert-agreement': {
      title: 'Acuerdo de Expertos | Eleva Care',
      description:
        'Revise el acuerdo de expertos de Eleva Care que describe los términos y condiciones para expertos independientes que utilizan nuestra plataforma.',
      og: {
        title: 'Acuerdo de Expertos | Eleva Care',
        description:
          'Revise el acuerdo de expertos de Eleva Care que describe los términos y condiciones para expertos independientes que utilizan nuestra plataforma.',
        siteName: 'Eleva Care',
      },
    },
  },
  pt: {
    terms: {
      title: 'Termos de Serviço | Eleva Care',
      description:
        'Leia os termos de serviço da Eleva Care e compreenda os seus direitos e obrigações ao utilizar a nossa plataforma de saúde.',
      og: {
        title: 'Termos de Serviço | Eleva Care',
        description:
          'Leia os termos de serviço da Eleva Care e compreenda os seus direitos e obrigações ao utilizar a nossa plataforma de saúde.',
        siteName: 'Eleva Care',
      },
    },
    privacy: {
      title: 'Política de Privacidade | Eleva Care',
      description:
        'Saiba como a Eleva Care protege as suas informações de saúde pessoais e os seus direitos de privacidade de acordo com os regulamentos de saúde.',
      og: {
        title: 'Política de Privacidade | Eleva Care',
        description:
          'Saiba como a Eleva Care protege as suas informações de saúde pessoais e os seus direitos de privacidade de acordo com os regulamentos de saúde.',
        siteName: 'Eleva Care',
      },
    },
    cookie: {
      title: 'Política de Cookies | Eleva Care',
      description:
        'Compreenda como a Eleva Care utiliza cookies para melhorar a sua experiência de navegação e proteger a sua privacidade.',
      og: {
        title: 'Política de Cookies | Eleva Care',
        description:
          'Compreenda como a Eleva Care utiliza cookies para melhorar a sua experiência de navegação e proteger a sua privacidade.',
        siteName: 'Eleva Care',
      },
    },
    'payment-policies': {
      title: 'Políticas de Pagamento | Eleva Care',
      description:
        'Compreenda os termos de pagamento, políticas de reembolso e procedimentos de faturação da Eleva Care para serviços de saúde.',
      og: {
        title: 'Políticas de Pagamento | Eleva Care',
        description:
          'Compreenda os termos de pagamento, políticas de reembolso e procedimentos de faturação da Eleva Care para serviços de saúde.',
        siteName: 'Eleva Care',
      },
    },
    'expert-agreement': {
      title: 'Acordo de Especialistas | Eleva Care',
      description:
        'Reveja o acordo de especialistas da Eleva Care que descreve os termos e condições para especialistas independentes que utilizam a nossa plataforma.',
      og: {
        title: 'Acordo de Especialistas | Eleva Care',
        description:
          'Reveja o acordo de especialistas da Eleva Care que descreve os termos e condições para especialistas independentes que utilizam a nossa plataforma.',
        siteName: 'Eleva Care',
      },
    },
  },
  br: {
    terms: {
      title: 'Termos de Serviço | Eleva Care',
      description:
        'Leia os termos de serviço da Eleva Care e entenda seus direitos e obrigações ao usar nossa plataforma de saúde.',
      og: {
        title: 'Termos de Serviço | Eleva Care',
        description:
          'Leia os termos de serviço da Eleva Care e entenda seus direitos e obrigações ao usar nossa plataforma de saúde.',
        siteName: 'Eleva Care',
      },
    },
    privacy: {
      title: 'Política de Privacidade | Eleva Care',
      description:
        'Saiba como a Eleva Care protege suas informações de saúde pessoais e seus direitos de privacidade de acordo com os regulamentos de saúde.',
      og: {
        title: 'Política de Privacidade | Eleva Care',
        description:
          'Saiba como a Eleva Care protege suas informações de saúde pessoais e seus direitos de privacidade de acordo com os regulamentos de saúde.',
        siteName: 'Eleva Care',
      },
    },
    cookie: {
      title: 'Política de Cookies | Eleva Care',
      description:
        'Entenda como a Eleva Care usa cookies para melhorar sua experiência de navegação e proteger sua privacidade.',
      og: {
        title: 'Política de Cookies | Eleva Care',
        description:
          'Entenda como a Eleva Care usa cookies para melhorar sua experiência de navegação e proteger sua privacidade.',
        siteName: 'Eleva Care',
      },
    },
    'payment-policies': {
      title: 'Políticas de Pagamento | Eleva Care',
      description:
        'Entenda os termos de pagamento, políticas de reembolso e procedimentos de faturamento da Eleva Care para serviços de saúde.',
      og: {
        title: 'Políticas de Pagamento | Eleva Care',
        description:
          'Entenda os termos de pagamento, políticas de reembolso e procedimentos de faturamento da Eleva Care para serviços de saúde.',
        siteName: 'Eleva Care',
      },
    },
    'expert-agreement': {
      title: 'Acordo de Especialistas | Eleva Care',
      description:
        'Revise o acordo de especialistas da Eleva Care que descreve os termos e condições para especialistas independentes que usam nossa plataforma.',
      og: {
        title: 'Acordo de Especialistas | Eleva Care',
        description:
          'Revise o acordo de especialistas da Eleva Care que descreve os termos e condições para especialistas independentes que usam nossa plataforma.',
        siteName: 'Eleva Care',
      },
    },
  },
};

function generateMetadataExport(metadata: any): string {
  return `export const metadata = ${JSON.stringify(metadata, null, 2)};\n\n`;
}

function addMetadataToMDX(filePath: string, metadata: any) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Check if metadata already exists
    if (content.startsWith('export const metadata')) {
      console.log(`✓ Metadata already exists in ${filePath}`);
      return;
    }

    const metadataExport = generateMetadataExport(metadata);
    const newContent = metadataExport + content;

    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`✓ Added metadata to ${filePath}`);
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error);
  }
}

// Process trust documents
const trustDocuments = ['security', 'dpa'];
const locales = ['en', 'es', 'pt', 'br'];

trustDocuments.forEach((doc) => {
  locales.forEach((locale) => {
    const filePath = path.join(process.cwd(), `src/content/trust/${doc}/${locale}.mdx`);
    if (
      fs.existsSync(filePath) &&
      trustMetadata[locale as keyof typeof trustMetadata][doc as keyof typeof trustMetadata.en]
    ) {
      addMetadataToMDX(
        filePath,
        trustMetadata[locale as keyof typeof trustMetadata][doc as keyof typeof trustMetadata.en],
      );
    }
  });
});

// Process legal documents (all 4 locales)
const legalDocuments = ['terms', 'privacy', 'cookie', 'payment-policies', 'expert-agreement'];
legalDocuments.forEach((doc) => {
  locales.forEach((locale) => {
    const filePath = path.join(process.cwd(), `src/content/${doc}/${locale}.mdx`);
    if (
      fs.existsSync(filePath) &&
      legalMetadata[locale as keyof typeof legalMetadata] &&
      legalMetadata[locale as keyof typeof legalMetadata][doc as keyof typeof legalMetadata.en]
    ) {
      addMetadataToMDX(
        filePath,
        legalMetadata[locale as keyof typeof legalMetadata][doc as keyof typeof legalMetadata.en],
      );
    }
  });
});

console.log('\n✓ Metadata export script completed!');
