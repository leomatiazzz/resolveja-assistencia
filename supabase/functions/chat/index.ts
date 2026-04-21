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

function buildContextPrompt(ctx: { logged_in?: boolean; full_name?: string | null; phone?: string | null } | undefined): string {
  if (ctx?.logged_in) {
    const name = ctx.full_name?.trim();
    const phone = ctx.phone?.trim();
    return `CONTEXTO DO USUÁRIO ATUAL:
- O usuário JÁ ESTÁ LOGADO em uma conta ResolveJá.
${name ? `- Nome cadastrado: ${name} (NÃO pergunte o nome novamente, use este).` : "- Nome cadastrado não disponível — você ainda pode perguntar o nome se necessário."}
${phone ? `- Telefone cadastrado: ${phone} (não precisa pedir de novo).` : ""}
- Não sugira criar conta nem fazer login. Pule a pergunta do nome.
- Ao chamar register_service_request, use o nome acima como contact_name.`;
  }
  return `CONTEXTO DO USUÁRIO ATUAL:
- O usuário NÃO está logado (anônimo).
- IMPORTANTE: Antes de finalizar (antes de chamar register_service_request), quando já tiver coletado o problema, localização, urgência e horário, sugira de forma gentil que o usuário crie uma conta ou faça login para acompanhar o chamado, conversar com o profissional e avaliar o serviço depois. Diga algo como: "Para finalizar, recomendo que você crie uma conta ou faça login — assim você acompanha tudo em um só lugar. Quer fazer isso agora? Se preferir continuar sem conta, é só me dizer." 
- Se o usuário aceitar, oriente-o a clicar em "Criar conta / Entrar" no rodapé do chat e diga que após o login ele pode retomar a solicitação.
- Se o usuário recusar e quiser continuar sem conta, pergunte então o nome para contato e prossiga normalmente com register_service_request.`;
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