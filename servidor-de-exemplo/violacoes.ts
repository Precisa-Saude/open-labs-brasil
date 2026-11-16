// Modo de violações deliberadas.
//
// Cada violação quebra uma regra da especificação de propósito. Serve para
// provar que a suíte de conformidade reprova um provedor que descumpre a regra:
// `suite-de-conformidade/testes/violacoes.test.ts` sobe o servidor com uma
// violação de cada vez e confere que o teste do requisito listado termina
// reprovado. Nunca use este modo fora de teste.

export const VIOLACOES = {
  'metadados-sem-iss': { requisitos: ['AUT-026'], descricao: 'Metadados sem authorization_response_iss_parameter_supported' },
  'par-sem-pkce': { requisitos: ['AUT-005'], descricao: 'PAR aceito sem code_challenge' },
  'redirect-uri-com-parametro': { requisitos: ['AUT-006'], descricao: 'redirect_uri aceito quando só começa com um registrado' },
  'request-uri-reutilizavel': { requisitos: ['AUT-007'], descricao: 'request_uri aceito de novo depois de concluída a autorização' },
  'aud-em-lista': { requisitos: ['AUT-009'], descricao: 'Asserção aceita com aud em lista' },
  'jti-repetido': { requisitos: ['AUT-010'], descricao: 'Asserção aceita com jti repetido' },
  'iss-ausente-na-resposta': { requisitos: ['AUT-012', 'ERR-006'], descricao: 'Resposta de autorização sem iss' },
  'codigo-reutilizavel': { requisitos: ['AUT-014'], descricao: 'Código de autorização trocado mais de uma vez' },
  'pkce-ignorado': { requisitos: ['AUT-015'], descricao: 'code_verifier não conferido' },
  'token-longo': { requisitos: ['AUT-016'], descricao: 'expires_in de 3600 segundos' },
  'cpf-na-resposta-do-token': { requisitos: ['AUT-017'], descricao: 'CPF do paciente na resposta do token' },
  'refresh-com-rotacao': { requisitos: ['AUT-018'], descricao: 'Refresh token trocado a cada renovação' },
  'refresh-em-client-credentials': { requisitos: ['AUT-019'], descricao: 'Refresh token emitido em client_credentials' },
  'aceita-password': { requisitos: ['AUT-020'], descricao: 'Concessão password aceita' },
  'escopo-de-paciente-em-client-credentials': { requisitos: ['AUT-021'], descricao: 'Escopo de paciente aceito em client_credentials' },
  'aceita-cliente-suspenso': { requisitos: ['AUT-023'], descricao: 'Cliente suspended ou withdrawn atendido' },
  'redirecionamento-307': { requisitos: ['AUT-025'], descricao: 'Redirecionamento da autorização com 307' },
  'aceita-rs256': { requisitos: ['SEG-007'], descricao: 'Asserção aceita com algoritmo diferente de PS256' },
  'token-sem-vinculo': { requisitos: ['SEG-006'], descricao: 'Token aceito com certificado diferente do vinculado' },
  'aceita-certificado-fora-do-registro': { requisitos: ['SEG-004'], descricao: 'Certificado de cliente fora do registro aceito' },
  'tls-com-suites-fracas': { requisitos: ['SEG-002'], descricao: 'Suítes TLS 1.2 fora da lista aceitas' },
  'consentimento-aceita-campo-desconhecido': { requisitos: ['CNS-005'], descricao: 'POST /consents aceita campo desconhecido' },
  'consentimento-sem-prazo-de-autorizacao': { requisitos: ['CNS-006'], descricao: 'Consentimento não vai a REJECTED em 60 minutos' },
  'cpf-com-token-de-provedor': { requisitos: ['CNS-013'], descricao: 'patient devolvido com token de provedor' },
  'revogacao-nao-invalida-tokens': { requisitos: ['CNS-016'], descricao: 'Tokens continuam valendo depois da revogação' },
  'revogacao-repetida-aceita': { requisitos: ['CNS-018'], descricao: 'DELETE em estado final devolve 204' },
  'consentimento-de-outro-cliente-visivel': { requisitos: ['CNS-021'], descricao: 'Consentimento de outro cliente legível' },
  'sem-interaction-id': { requisitos: ['API-001'], descricao: 'x-fapi-interaction-id nem exigido nem devolvido' },
  'ignora-parametro-desconhecido': { requisitos: ['API-006'], descricao: 'Parâmetro de busca desconhecido ignorado' },
  'paginacao-fora-da-base': { requisitos: ['API-012'], descricao: 'link next em outro host' },
  'sem-meta-profile': { requisitos: ['API-008'], descricao: 'Recursos sem meta.profile' },
  'erro-sem-operation-outcome': { requisitos: ['API-010'], descricao: 'Erros 404 sem OperationOutcome' },
  'janela-de-agenda-sem-limite': { requisitos: ['AGE-004'], descricao: 'Janela de busca de horários maior que 31 dias aceita' },
  'cesta-com-ou': { requisitos: ['AGE-005'], descricao: 'service-type repetido combinado com "ou"' },
  'criacao-nao-idempotente': { requisitos: ['AGD-004'], descricao: 'If-None-Exist ignorado: a repetição cria outro agendamento' },
  'aceita-identificador-invalido': { requisitos: ['AGD-017'], descricao: 'Identificador do receptor fora do conjunto de caracteres aceito' },
  'link-de-pagamento-em-comment': { requisitos: ['AGD-016'], descricao: 'Link de pagamento repetido em Appointment.comment' },
  'if-match-ignorado': { requisitos: ['AGD-009'], descricao: 'PUT sem If-Match aceito' },
  'pedido-contido-alteravel': { requisitos: ['AGD-012'], descricao: 'PUT que altera pedido contido aceito' },
  'laudo-parcial-visivel': { requisitos: ['RES-004'], descricao: 'Laudos parciais e não liberados aparecem' },
  'data-period-ignorado': { requisitos: ['RES-005'], descricao: 'data_period do consentimento ignorado' },
  'paciente-de-outro-visivel': { requisitos: ['RES-008'], descricao: 'Patient de outro paciente legível' },
  'cpf-no-erro': { requisitos: ['ERR-004'], tambem: ['RES-003'], descricao: 'CPF do paciente em diagnostics de erro' },
  'sem-www-authenticate': { requisitos: ['ERR-002'], descricao: 'Erros de token sem WWW-Authenticate' },
  'conteudo-antes-da-seguranca': { requisitos: ['ERR-003'], descricao: 'Corpo validado antes do token' },
  'registro-sem-conferir-assinatura': { requisitos: ['REG-001'], descricao: 'Registro aceito sem conferir a assinatura' },
  'registro-aceita-sequencia-menor': { requisitos: ['REG-002'], descricao: 'Registro aceito com sequence menor' },
  'registro-expirado-sem-modo-restrito': { requisitos: ['REG-008'], descricao: 'Registro expirado sem modo restrito' },
} as const satisfies Record<string, { requisitos: readonly string[]; tambem?: readonly string[]; descricao: string }>;

export type Violacao = keyof typeof VIOLACOES;

/** Testes que a suíte precisa executar para observar a violação: os reprovados e os que produzem a situação. */
export function testesDaViolacao(nome: Violacao): { reprovados: string[]; executar: string[] } {
  const v = VIOLACOES[nome] as { requisitos: readonly string[]; tambem?: readonly string[] };
  return { reprovados: [...v.requisitos], executar: [...(v.tambem ?? []), ...v.requisitos] };
}

export function eViolacao(nome: string): nome is Violacao {
  return Object.hasOwn(VIOLACOES, nome);
}
