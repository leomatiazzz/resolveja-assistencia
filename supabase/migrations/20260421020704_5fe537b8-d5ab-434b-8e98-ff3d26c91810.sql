-- Tabela de notificações para profissionais
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  service_request_id UUID REFERENCES public.service_requests(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'professional_assigned',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_professional ON public.notifications(professional_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications(professional_id) WHERE read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Admins veem e gerenciam tudo
CREATE POLICY "Admins view all notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Permite criação a partir de qualquer cliente (chat anônimo ou logado), pois é gerada quando o cliente escolhe o profissional
CREATE POLICY "Anyone can create notifications"
ON public.notifications FOR INSERT
TO anon, authenticated
WITH CHECK (true);