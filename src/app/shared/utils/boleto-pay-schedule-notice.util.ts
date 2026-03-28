/**
 * Avisos de agendamento de pagamento de boleto (horário de Brasília).
 * - Seg–Sex após 18h: pagamento tende a ser agendado.
 * - Fim de semana: sempre informar débito no primeiro dia útil após 9h.
 */
export function getBoletoPayScheduleNotice(): string | null {
  const now = new Date();
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
  }).format(now);

  if (weekday === 'Sat' || weekday === 'Sun') {
    return (
      'Em finais de semana o pagamento será agendado. O valor será debitado no primeiro dia útil ' +
      'após as 9h (horário de Brasília).'
    );
  }

  const hour = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      hour: 'numeric',
      hour12: false,
    }).format(now),
    10,
  );

  if (hour >= 18) {
    return (
      'Após as 18h (horário de Brasília), de segunda a sexta, o pagamento tende a ser agendado ' +
      'para o próximo dia útil.'
    );
  }

  return null;
}

/** Formata `Date` para `YYYY-MM-DD HH:mm:ss` em America/Sao_Paulo (payload da API). */
export function formatBrazilDateTimeForApi(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}
