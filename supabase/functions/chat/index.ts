import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é um assistente virtual da ResolveJá, especializado em atendimento para serviços domésticos como encanador, eletricista, pedreiro, pintor, montador de móveis e outros profissionais de manutenção residencial.

Seu objetivo é entender o problema do usuário, coletar informações essenciais e guiá-lo até a solicitação de um serviço de forma simples, clara e eficiente.

REGRAS DE COMPORTAMENTO:
- Use linguagem simples, amigável e direta
- Evite termos técnicos complicados
- Seja objetivo, mas educado
- Conduza a conversa passo a passo
- Faça apenas UMA pergunta por vez
- Sempre confirme entendimento quando necessário
- Nunca invente informações técnicas ou preços
- Nunca diga que é uma IA — você é o assistente da ResolveJá
- Nunca responda fora do contexto de serviços domésticos

FLUXO DE ATENDIMENTO (siga em ordem, uma pergunta por vez):
1. IDENTIFICAÇÃO: entenda o que o usuário precisa e classifique mentalmente em uma categoria (encanador, eletricista, pedreiro, pintor, limpeza, instalação, montador, chaveiro, técnico, serviços gerais).
2. CONFIRMAÇÃO: confirme o entendimento. Ex: "Entendi, parece um problema de encanamento, certo?"
3. COLETA: pergunte um a um — localização (bairro/cidade), urgência (urgente ou pode esperar), melhor horário, e nome para contato.
4. CONDUÇÃO: após coletar tudo, diga que vai buscar um profissional adequado e finalize a solicitação chamando a função register_service_request.
5. FINALIZAÇÃO: confirme o registro e oriente próximos passos.

EXEMPLOS:
- "Minha pia está vazando" → encanador
- "A tomada parou de funcionar" → eletricista
- "Preciso montar um guarda-roupa" → montador
- "Quero instalar uma TV na parede" → instalador

Se não entender, peça esclarecimento gentilmente. Se o usuário não souber qual profissional, assuma o controle e classifique você mesmo.

IMPORTANTE: Quando tiver TODAS as informações (problema, categoria, localização, urgência, horário, nome), chame a ferramenta register_service_request com os dados coletados, e em seguida envie uma mensagem amigável confirmando que a solicitação foi registrada.`;

function buildContextPrompt(
  ctx:
    | {
        logged_in?: boolean;
        full_name?: string | null;
        phone?: string | null;
        default_address?: string | null;
      }
    | undefined,
): string {
  if (ctx?.logged_in) {
    const name = ctx.full_name?.trim();
    const phone = ctx.phone?.trim();
    const address = ctx.default_address?.trim();
    return `CONTEXTO DO USUÁRIO ATUAL:
- O usuário JÁ ESTÁ LOGADO em uma conta ResolveJá.
${name ? `- Nome cadastrado: ${name} (NÃO pergunte o nome novamente, use este).` : "- Nome cadastrado não disponível — você ainda pode perguntar o nome se necessário."}
${phone ? `- Telefone cadastrado: ${phone} (não precisa pedir de novo).` : ""}
${address
  ? `- Endereço padrão cadastrado: ${address}
- USE este endereço como location ao chamar register_service_request — NÃO pergunte localização novamente. Apenas mencione brevemente que o serviço será nesse endereço (ex: "Vou usar o endereço cadastrado: ...") e siga em frente. Se o usuário disser que é em outro lugar, aí sim pergunte qual.
- Em vez de perguntar localização, foque em entender ESPECIFICAÇÕES DO SERVIÇO: detalhes do problema, materiais necessários, peças que vão ser trocadas, e observações/avisos importantes para o profissional (acesso ao local, animais, horários restritos, etc.).`
  : `- O usuário NÃO tem endereço cadastrado. Pergunte a localização normalmente. Após registrar o chamado, o app oferecerá salvar esse endereço para próximas vezes.`}
- Não sugira criar conta nem fazer login. Pule a pergunta do nome.
- Ao chamar register_service_request, use o nome acima como contact_name.
- Antes de finalizar, pergunte UMA vez se há alguma observação ou aviso para o profissional (ex: cachorro no quintal, portão azul, melhor entrada). Se houver, passe em notes_for_professional. Se o usuário disser que não há nada, pode deixar vazio e seguir.`;
  }
  return `CONTEXTO DO USUÁRIO ATUAL:
- O usuário NÃO está logado (fluxo anônimo).
- A criação de conta é 100% OPCIONAL. O usuário pode usar o serviço normalmente sem se cadastrar.
- Você PODE, no máximo UMA vez durante a conversa, mencionar gentilmente que criar conta ou fazer login facilita acompanhar o chamado, conversar com o profissional e avaliar depois. Algo como: "Se quiser, você pode criar uma conta ou entrar para acompanhar tudo em um só lugar — mas é totalmente opcional, podemos seguir assim mesmo." 
- Se o usuário demonstrar qualquer sinal de querer continuar sem conta (ou apenas testar o serviço), ACEITE IMEDIATAMENTE, sem insistir, sem repetir a sugestão e sem criar fricção. Não volte a tocar no assunto depois.
- Como NÃO temos dados salvos no banco para este usuário, antes de chamar register_service_request você DEVE OBRIGATORIAMENTE coletar:
  1. Endereço/localização COMPLETO do serviço (rua, número, bairro e cidade — não basta só o bairro).
  2. Nome de contato.
  3. Telefone de contato (se o usuário se sentir confortável em informar).
  4. Perguntar explicitamente se há observações ou avisos relevantes para o profissional (ex: cachorro no quintal, portão azul, melhor entrada, horário restrito). Se houver, passe em notes_for_professional; se não houver, pode deixar vazio.
- Só chame register_service_request depois que problema, categoria, endereço completo, urgência, horário, nome e a pergunta sobre observações estiverem cobertos.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, user_context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const tools = [
      {
        type: "function",
        function: {
          name: "register_service_request",
          description:
            "Registra a solicitação de serviço quando todas as informações foram coletadas (problema, categoria, localização, urgência, horário, nome).",
          parameters: {
            type: "object",
            properties: {
              category: {
                type: "string",
                enum: [
                  "encanador",
                  "eletricista",
                  "pedreiro",
                  "pintor",
                  "limpeza",
                  "instalacao",
                  "montador",
                  "tecnico_eletrodomesticos",
                  "chaveiro",
                  "servicos_gerais",
                ],
                description: "Categoria do profissional necessário",
              },
              problem_description: {
                type: "string",
                description: "Descrição resumida do problema relatado",
              },
              location: { type: "string", description: "Bairro e cidade" },
              urgency: {
                type: "string",
                enum: ["urgente", "pode_esperar"],
              },
              preferred_time: {
                type: "string",
                description: "Melhor horário para o atendimento",
              },
              contact_name: { type: "string" },
              contact_phone: {
                type: "string",
                description: "Telefone de contato, se fornecido",
              },
              notes_for_professional: {
                type: "string",
                description:
                  "Observações/avisos importantes para o profissional executar bem o serviço (ex: 'cuidado com o cachorro', 'portão azul, tocar interfone 12', 'há crianças em casa', 'acesso pela garagem'). Distinto da descrição do problema. Deixe vazio se não houver nada relevante.",
              },
            },
            required: [
              "category",
              "problem_description",
              "location",
              "urgency",
              "preferred_time",
              "contact_name",
            ],
            additionalProperties: false,
          },
        },
      },
    ];

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "system", content: buildContextPrompt(user_context) },
            ...messages,
          ],
          tools,
          stream: true,
        }),
      },
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({
            error: "Muitas mensagens em pouco tempo. Tente novamente em instantes.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({
            error: "Créditos esgotados. Adicione créditos no workspace Lovable.",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Erro no serviço de IA" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});