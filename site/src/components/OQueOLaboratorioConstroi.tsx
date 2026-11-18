import { ArrowUpRight } from 'lucide-react';

import { ENDERECOS } from '../dados/enderecos';
import { TIPO } from '../lib/tipografia';
import { GRADE_INTERNA, SecaoEmGrade } from './marca/SecaoEmGrade';

interface Componente {
  noOpenFinance: string;
  requisito: string;
  titulo: string;
}

/** A tabela "O que o laboratório constrói" da apresentação para laboratórios. */
const COMPONENTES: readonly Componente[] = [
  {
    noOpenFinance: 'FAPI 1.0 Advanced, fluxo híbrido, id_token cifrado.',
    requisito:
      'PAR, PKCE, private_key_jwt e tokens vinculados ao certificado por mTLS. Sem OpenID Connect, objeto de requisição assinado ou cifragem.',
    titulo: 'Servidor de autorização OAuth 2.0',
  },
  {
    noOpenFinance: 'Mesmo padrão, com três estados.',
    requisito:
      'POST, GET e DELETE /consents com token client_credentials, 60 minutos para o paciente autorizar e cinco estados.',
    titulo: 'Consentimento',
  },
  {
    noOpenFinance: 'Jornada por redirecionamento.',
    requisito:
      'No domínio do laboratório, sobre o login que o paciente já usa, e uma página onde ele vê e revoga os consentimentos.',
    titulo: 'Login e aprovação',
  },
  {
    noOpenFinance: 'APIs próprias em JSON.',
    requisito: 'Recursos por escopo, nos perfis publicados no guia de implementação.',
    titulo: 'API FHIR R4',
  },
  {
    noOpenFinance: 'Diretório central.',
    requisito: 'Só aceita certificados de aplicativos ativos no registro de participantes.',
    titulo: 'mTLS',
  },
];

export function OQueOLaboratorioConstroi() {
  return (
    <SecaoEmGrade className={GRADE_INTERNA} id="laboratorio">
      <h2 className={`col-span-full ${TIPO.tituloDeSecao}`}>O que o laboratório constrói</h2>
      <p className={`col-span-full mb-8 max-w-[56ch] ${TIPO.abertura}`}>
        Quem já opera Open Finance Brasil reaproveita o modelo de consentimento. O servidor de
        autorização precisa de outra configuração, porque o protocolo adota o FAPI 2.0 Security
        Profile no lugar do FAPI 1.0 Advanced usado no Open Finance.
      </p>

      {COMPONENTES.map((componente, i) => (
        <div
          key={componente.titulo}
          className="relative col-span-full border-t py-8 md:col-span-6 md:pl-16"
        >
          <span
            aria-hidden="true"
            className="mb-2.5 block text-sm text-primary md:absolute md:top-9 md:left-0 md:mb-0"
          >
            0{i + 1}
          </span>
          <h3 className={TIPO.tituloDeCartao}>{componente.titulo}</h3>
          <p className="mt-4 max-w-[54ch] leading-relaxed text-foreground/75">
            {componente.requisito}
          </p>
          <p className="mt-3 max-w-[54ch] text-sm leading-relaxed text-foreground/70">
            <span className="font-semibold">No Open Finance Brasil:</span>{' '}
            {componente.noOpenFinance}
          </p>
        </div>
      ))}

      <div className="relative col-span-full flex flex-col justify-center gap-3 border-t py-8 md:col-span-6 md:pl-16">
        <p className="max-w-[54ch] leading-relaxed text-foreground/75">
          A lista completa do que o provedor de dados precisa construir está no índice da
          especificação, e o perfil de segurança, no capítulo 7.
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { endereco: ENDERECOS.indice, rotulo: 'Índice' },
            { endereco: ENDERECOS.seguranca, rotulo: 'Perfil de segurança' },
          ].map((link) => (
            <a
              key={link.endereco}
              className="inline-flex items-center gap-1 rounded-full bg-card px-3 py-1 text-sm text-primary ring-1 ring-border transition-colors hover:ring-ps-violet"
              href={link.endereco}
              rel="noopener noreferrer"
              target="_blank"
            >
              {link.rotulo}
              <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
            </a>
          ))}
        </div>
      </div>
    </SecaoEmGrade>
  );
}
