// Modo de violações deliberadas.
//
// Cada violação quebra uma regra da especificação de propósito. Serve para
// provar que a suíte de conformidade reprova um provedor que descumpre a regra:
// `suite-de-conformidade/testes/violacoes.test.ts` sobe o servidor com uma
// violação de cada vez e confere que o teste do requisito listado termina
// reprovado. Nunca use este modo fora de teste.

export const VIOLACOES = {
  'aceita-certificado-fora-do-registro': {
    descricao: 'Certificado de cliente fora do registro aceito',
    requisitos: ['SEG-004'],
  },
  'aceita-cliente-suspenso': {
    descricao: 'Cliente suspended ou withdrawn atendido',
    requisitos: ['AUT-023', 'REG-005', 'REG-009'],
  },
  'aceita-identificador-invalido': {
    descricao: 'Identificador do receptor fora do conjunto de caracteres aceito',
    requisitos: ['AGD-017'],
  },
  'aceita-password': { descricao: 'Concessão password aceita', requisitos: ['AUT-020'] },
  'aceita-response-type-token': {
    descricao: 'PAR aceita response_type diferente de code',
    requisitos: ['AUT-004'],
  },
  'aceita-rs256': {
    descricao: 'Asserção aceita com algoritmo diferente de PS256',
    requisitos: ['SEG-007'],
  },
  'aceita-sem-certificado': {
    descricao: 'PAR e token aceitos sem certificado de cliente',
    requisitos: ['SEG-003'],
  },
  'aceita-sem-pedido-contido': {
    descricao: 'Appointment aceito sem ServiceRequest contido',
    requisitos: ['AGD-002'],
  },
  'aceita-tls-1-1': { descricao: 'TLS 1.1 aceito', requisitos: ['SEG-001'] },
  'agenda-de-todas-as-unidades': {
    descricao: 'Parâmetro actor de Schedule ignorado',
    requisitos: ['AGE-002'],
  },
  'agenda-exige-paciente': { descricao: 'Agenda exige token de paciente', requisitos: ['AGE-001'] },
  'agendamento-de-outro-canal-visivel': {
    descricao: 'Agendamento de outro canal visível',
    requisitos: ['AGD-013'],
  },
  'aud-em-lista': { descricao: 'Asserção aceita com aud em lista', requisitos: ['AUT-009'] },
  'busca-por-cidade-ignorada': {
    descricao: 'Parâmetro address-city ignorado',
    requisitos: ['UNI-001'],
  },
  'busca-por-url-ignorada': {
    descricao: 'Parâmetro url ignorado no catálogo',
    requisitos: ['CAT-001', 'CAT-002'],
  },
  'capability-sem-perfis': {
    descricao: 'CapabilityStatement sem supportedProfile',
    requisitos: ['API-009'],
  },
  'certificado-de-outro-cliente': {
    descricao: 'Asserção de um cliente aceita com certificado de outro',
    requisitos: ['SEG-005'],
  },
  'cesta-com-ou': {
    descricao: 'service-type repetido combinado com "ou"',
    requisitos: ['AGE-005'],
  },
  'codigo-reutilizavel': {
    descricao: 'Código de autorização trocado mais de uma vez',
    requisitos: ['AUT-014'],
  },
  'consentimento-aceita-campo-desconhecido': {
    descricao: 'POST /consents aceita campo desconhecido',
    requisitos: ['CNS-005'],
  },
  'consentimento-aceita-escopo-de-provedor': {
    descricao: 'POST /consents aceita escopo de provedor',
    requisitos: ['CNS-002'],
  },
  'consentimento-de-outro-cliente-visivel': {
    descricao: 'Consentimento de outro cliente legível',
    requisitos: ['CNS-021'],
  },
  'consentimento-nao-expira': {
    descricao: 'Consentimento não passa a EXPIRED',
    requisitos: ['CNS-019', 'API-005'],
  },
  'consentimento-sem-limite-de-validade': {
    descricao: 'POST /consents aceita validade acima de 12 meses',
    requisitos: ['CNS-003'],
  },
  'consentimento-sem-prazo-de-autorizacao': {
    descricao: 'Consentimento não vai a REJECTED em 60 minutos',
    requisitos: ['CNS-006'],
  },
  'consentimentos-de-outros-receptores': {
    descricao: 'Consent de outros receptores visível',
    requisitos: ['RES-009'],
  },
  'conteudo-antes-da-seguranca': {
    descricao: 'Corpo validado antes do token',
    requisitos: ['ERR-003'],
  },
  'contexto-de-preco-desconhecido': {
    descricao: 'Preço com useContext fora de venue e brand',
    requisitos: ['CAT-005'],
  },
  'cors-na-autorizacao': {
    descricao: 'Endpoint de autorização responde a CORS',
    requisitos: ['SEG-008'],
  },
  'count-ignorado': { descricao: '_count ignorado', requisitos: ['API-007'] },
  'cpf-com-token-de-provedor': {
    descricao: 'patient devolvido com token de provedor',
    requisitos: ['CNS-013'],
  },
  'cpf-errado-na-leitura': {
    descricao: 'Leitura com token de paciente devolve outro CPF',
    requisitos: ['CNS-012'],
  },
  'cpf-invalido-aceito': {
    descricao: 'CPF de onze algarismos iguais aceito como CPF do paciente',
    requisitos: ['CNS-025'],
  },
  'cpf-na-resposta-do-token': {
    descricao: 'CPF do paciente na resposta do token',
    requisitos: ['AUT-017'],
  },
  'cpf-no-erro': {
    descricao: 'CPF do paciente em diagnostics de erro',
    requisitos: ['ERR-004'],
    tambem: ['RES-003'],
  },
  'cpf-no-redirecionamento': {
    descricao: 'CPF do paciente no redirecionamento de autorização',
    requisitos: ['AUT-012', 'AUT-013'],
  },
  'criacao-nao-idempotente': {
    descricao: 'If-None-Exist ignorado: a repetição cria outro agendamento',
    requisitos: ['AGD-003', 'AGD-004'],
  },
  'criacao-sem-etag': { descricao: 'Criação de agendamento sem ETag', requisitos: ['AGD-001'] },
  'data-period-ignorado': {
    descricao: 'data_period do consentimento ignorado',
    requisitos: ['RES-005'],
  },
  'erro-oauth-inventado': {
    descricao: 'Código de erro OAuth fora da seção 6.2',
    requisitos: ['ERR-001'],
    tambem: ['AUT-003'],
  },
  'erro-sem-operation-outcome': {
    descricao: 'Erros 404 sem OperationOutcome',
    requisitos: ['API-010'],
  },
  'escopo-de-paciente-em-client-credentials': {
    descricao: 'Escopo de paciente aceito em client_credentials',
    requisitos: ['AUT-021'],
  },
  'escopo-nao-conferido': {
    descricao: 'Escopo e tipo de token não conferidos na API',
    requisitos: ['API-003', 'API-004'],
  },
  'estado-final-ilegivel': {
    descricao: 'Consentimento em estado final devolve 404',
    requisitos: ['CNS-024'],
  },
  'exame-indisponivel-silencioso': {
    descricao: 'Exame fora da unidade sem OperationOutcome',
    requisitos: ['AGE-006'],
  },
  'horario-nao-liberado': {
    descricao: 'Remarcação e cancelamento não liberam o horário',
    requisitos: ['AGD-010', 'AGD-011'],
  },
  'horario-ocupado-aceito': {
    descricao: 'Agendamento aceito em horário ocupado',
    requisitos: ['AGD-005'],
  },
  'iat-sem-tolerancia': {
    descricao: 'Asserção com iat no futuro recusada mesmo dentro de 10 segundos',
    requisitos: ['AUT-011'],
  },
  'if-match-ignorado': { descricao: 'PUT sem If-Match aceito', requisitos: ['AGD-009'] },
  'if-none-exist-so-literal': {
    descricao: 'If-None-Exist com %7C recusado',
    requisitos: ['AGD-015'],
  },
  'ignora-parametro-desconhecido': {
    descricao: 'Parâmetro de busca desconhecido ignorado',
    requisitos: ['API-006'],
  },
  'include-ignorado': {
    descricao: '_include=DiagnosticReport:result ignorado',
    requisitos: ['RES-001'],
  },
  'iss-ausente-na-resposta': {
    descricao: 'Resposta de autorização sem iss',
    requisitos: ['AUT-012', 'ERR-006'],
  },
  'janela-de-agenda-sem-limite': {
    descricao: 'Janela de busca de horários maior que 31 dias aceita',
    requisitos: ['AGE-004'],
  },
  'jti-repetido': { descricao: 'Asserção aceita com jti repetido', requisitos: ['AUT-010'] },
  'laudo-parcial-visivel': {
    descricao: 'Laudos parciais e não liberados aparecem',
    requisitos: ['RES-004'],
  },
  'link-de-pagamento-em-comment': {
    descricao: 'Link de pagamento repetido em Appointment.comment',
    requisitos: ['AGD-016'],
  },
  'link-de-pagamento-http': { descricao: 'Link de pagamento com http', requisitos: ['AGD-007'] },
  'metadados-sem-iss': {
    descricao: 'Metadados sem authorization_response_iss_parameter_supported',
    requisitos: ['AUT-001', 'AUT-026'],
  },
  'motivo-do-receptor-ignorado': {
    descricao: 'reason do DELETE ignorado',
    requisitos: ['CNS-017'],
  },
  'observacao-sem-loinc': { descricao: 'Observation sem código LOINC', requisitos: ['RES-007'] },
  'paciente-de-outro-visivel': {
    descricao: 'Patient de outro paciente legível',
    requisitos: ['RES-008', 'API-011'],
  },
  'paciente-do-agendamento-livre': {
    descricao: 'Paciente do agendamento não conferido contra o consentimento',
    requisitos: ['AGD-006'],
  },
  'pagamento-nao-vence': { descricao: 'Agendamento pendente não vence', requisitos: ['AGD-008'] },
  'paginacao-com-usuario': {
    descricao: 'link next com componente de usuário',
    requisitos: ['API-013'],
  },
  'paginacao-fora-da-base': { descricao: 'link next em outro host', requisitos: ['API-012'] },
  'paginacao-relativa': { descricao: 'link next relativo', requisitos: ['API-013'] },
  'par-aceita-consentimento-de-outro': {
    descricao: 'PAR aceita consentimento de outro cliente',
    requisitos: ['CNS-007'],
  },
  'par-aceita-escopo-fora-do-consentimento': {
    descricao: 'PAR aceita escopo fora do consentimento',
    requisitos: ['CNS-015'],
  },
  'par-sem-autenticacao': {
    descricao: 'Cliente identificado só por client_id e certificado',
    requisitos: ['AUT-003', 'AUT-008'],
  },
  'par-sem-pkce': { descricao: 'PAR aceito sem code_challenge', requisitos: ['AUT-005'] },
  'parametro-patient-ignorado': {
    descricao: 'Parâmetro patient não conferido contra o consentimento',
    requisitos: ['RES-003'],
  },
  'pedido-contido-alteravel': {
    descricao: 'PUT que altera pedido contido aceito',
    requisitos: ['AGD-012'],
  },
  'pkce-ignorado': { descricao: 'code_verifier não conferido', requisitos: ['AUT-015'] },
  'preco-sem-exame': {
    descricao: 'Preço com código que não está no catálogo',
    requisitos: ['CAT-004'],
  },
  'purpose-opcional': {
    descricao: 'POST /consents aceita corpo sem purpose',
    requisitos: ['CNS-004'],
  },
  'recusa-schedule-read': {
    descricao: 'schedule.read recusado em client_credentials',
    requisitos: ['AUT-022', 'AUT-027'],
  },
  'redirecionamento-307': {
    descricao: 'Redirecionamento da autorização com 307',
    requisitos: ['AUT-025'],
  },
  'redirect-uri-com-parametro': {
    descricao: 'redirect_uri aceito quando só começa com um registrado',
    requisitos: ['AUT-006'],
  },
  'refresh-com-rotacao': {
    descricao: 'Refresh token trocado a cada renovação',
    requisitos: ['AUT-018'],
  },
  'refresh-em-client-credentials': {
    descricao: 'Refresh token emitido em client_credentials',
    requisitos: ['AUT-019'],
  },
  // 0.2.2
  'registro-aceita-crit': {
    descricao: 'Registro aceito com crit no cabeçalho',
    requisitos: ['REG-011'],
  },
  'registro-aceita-sequencia-menor': {
    descricao: 'Registro aceito com sequence menor',
    requisitos: ['REG-002'],
  },
  'registro-exige-typ-jose': {
    descricao: 'Registro recusado quando typ não é JOSE',
    requisitos: ['REG-011'],
  },
  'registro-expirado-sem-modo-restrito': {
    descricao: 'Registro expirado sem modo restrito',
    requisitos: ['REG-008'],
  },
  'registro-sem-conferir-ambiente': {
    descricao: 'Registro de outro ambiente aceito',
    requisitos: ['REG-007'],
  },
  'registro-sem-conferir-assinatura': {
    descricao: 'Registro aceito sem conferir a assinatura',
    requisitos: ['REG-001'],
  },
  'registro-sem-schema': {
    descricao: 'Registro aceito sem validar contra o schema',
    requisitos: ['REG-003'],
  },
  'registro-usa-jwk-do-cabecalho': {
    descricao: 'Chave do registro tirada de jwk do cabeçalho',
    requisitos: ['REG-011'],
  },
  'request-uri-reutilizavel': {
    descricao: 'request_uri aceito de novo depois de concluída a autorização',
    requisitos: ['AUT-007'],
  },
  'retirado-invisivel': { descricao: 'Item retirado some do catálogo', requisitos: ['CAT-003'] },
  'retry-after-longo': {
    descricao: 'Retry-After de 172800 segundos na revogação',
    requisitos: ['ERR-007'],
  },
  'revogacao-nao-invalida-tokens': {
    descricao: 'Tokens continuam valendo depois da revogação',
    requisitos: ['CNS-016'],
  },
  'revogacao-repetida-aceita': {
    descricao: 'DELETE em estado final devolve 204',
    requisitos: ['CNS-018', 'CNS-026'],
  },
  'revogacao-repetida-sobrescreve': {
    descricao: 'DELETE repetido devolve 204 e troca o motivo',
    requisitos: ['CNS-026'],
  },
  'sem-interaction-id': {
    descricao: 'x-fapi-interaction-id nem exigido nem devolvido',
    requisitos: ['API-001'],
  },
  'sem-meta-profile': { descricao: 'Recursos sem meta.profile', requisitos: ['API-008'] },
  'sem-retry-after': { descricao: '429 e 503 sem Retry-After', requisitos: ['ERR-005'] },
  'sem-www-authenticate': {
    descricao: 'Erros de token sem WWW-Authenticate',
    requisitos: ['ERR-002'],
  },
  'service-request-enderecavel': {
    descricao: 'ServiceRequest contido legível por id',
    requisitos: ['AGD-014'],
  },
  'servicos-de-todas-as-unidades': {
    descricao: 'Parâmetro location de HealthcareService ignorado',
    requisitos: ['UNI-002'],
  },
  'slot-sem-limites': {
    descricao: 'Busca de Slot aceita sem schedule ou sem limites de start',
    requisitos: ['AGE-003'],
  },
  'tls-com-suites-fracas': {
    descricao: 'Suítes TLS 1.2 fora da lista aceitas',
    requisitos: ['SEG-002'],
  },
  'token-de-paciente-le-outro-consentimento': {
    descricao: 'Token de paciente lê outro consentimento',
    requisitos: ['CNS-014'],
  },
  'token-longo': { descricao: 'expires_in de 3600 segundos', requisitos: ['AUT-016'] },
  'token-na-url': { descricao: 'Token aceito no parâmetro access_token', requisitos: ['API-002'] },
  'token-sem-vinculo': {
    descricao: 'Token aceito com certificado diferente do vinculado',
    requisitos: ['SEG-006'],
  },
  'troca-de-codigo-com-registro-expirado': {
    descricao: 'Código trocado com o registro expirado',
    requisitos: ['REG-013'],
  },
  'versao-nao-implementada-aceita': {
    descricao: 'Versão efetiva que o software não implementa tratada como válida',
    requisitos: ['REG-012'],
  },
} as const satisfies Record<
  string,
  { requisitos: readonly string[]; tambem?: readonly string[]; descricao: string }
>;

export type Violacao = keyof typeof VIOLACOES;

/** Testes que a suíte precisa executar para observar a violação: os reprovados e os que produzem a situação. */
export function testesDaViolacao(nome: Violacao): { reprovados: string[]; executar: string[] } {
  const v = VIOLACOES[nome] as { requisitos: readonly string[]; tambem?: readonly string[] };
  return { executar: [...(v.tambem ?? []), ...v.requisitos], reprovados: [...v.requisitos] };
}

export function eViolacao(nome: string): nome is Violacao {
  return Object.hasOwn(VIOLACOES, nome);
}
